package com.boilerclasses

import com.sendgrid.Method
import com.sendgrid.Request
import com.sendgrid.SendGrid
import com.sendgrid.helpers.mail.Mail
import com.sendgrid.helpers.mail.objects.Content
import com.sendgrid.helpers.mail.objects.Email
import io.jooby.Environment
import io.jooby.MediaType
import io.jooby.kt.Kooby
import io.ktor.utils.io.errors.*
import kotlinx.coroutines.*
import kotlinx.serialization.Serializable
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.slf4j.Logger
import java.net.URLEncoder
import java.security.MessageDigest

const val USER_NOTIFICATION_LIMIT = 10

class Availability(val db: DB, val log: Logger, env: Environment, val courses: Courses, val auth: Auth) {
    val sg = SendGrid(env.getProperty("sendGridKey"))
    var currentEmail: String? = null
    val send = env.getProperty("noSend")!="true"
    val root = env.getProperty("rootUrl")!!

    suspend fun update() {
        log.info("checking notifications")

        data class ToNotify(val c: Schema.CourseId, val userId: Int, val email: String, val name: String, val sections: List<EmailAvailability>)

        val userToSections = db.query {
            (DB.AvailabilityNotification leftJoin DB.User)
                .select(
                    DB.AvailabilityNotification.course, DB.AvailabilityNotification.crn,
                    DB.AvailabilityNotification.term, DB.AvailabilityNotification.id,
                    DB.AvailabilityNotification.threshold,
                    DB.User.name, DB.User.email, DB.User.id
                ).where {
                    (DB.AvailabilityNotification.satisfied eq true) and (DB.AvailabilityNotification.sent eq false)
                }.mapNotNull {x->
                    val c = courses.getCourse(x[DB.AvailabilityNotification.course])
                        ?: return@mapNotNull null
                    val crn = x[DB.AvailabilityNotification.crn]

                    val satisfiedSections = c.course.sections
                        .filterKeys { it==x[DB.AvailabilityNotification.term] }
                        .flatMap {
                            it.value.mapNotNull x@{ sec->
                                if ((crn!=null && sec.crn==crn) || sec.seats==null ||
                                    sec.seats.left<x[DB.AvailabilityNotification.threshold])
                                    return@x null
                                EmailAvailability(sec.seats.left, sec.seats.left+sec.seats.used, sec, c, it.key)
                            }
                        }

                    if (satisfiedSections.isEmpty()) {
                        DB.AvailabilityNotification.update({
                            DB.AvailabilityNotification.id eq x[DB.AvailabilityNotification.id]
                        }) {
                            it[satisfied] = false
                        }

                        return@mapNotNull null
                    }

                    DB.AvailabilityNotification.update({
                        DB.AvailabilityNotification.id eq x[DB.AvailabilityNotification.id]
                    }) {
                        it[sent] = true
                    }

                    ToNotify(c, x[DB.User.id], x[DB.User.email], x[DB.User.name], satisfiedSections)
                }.groupBy { it.userId }
        }

        log.info("updating ${userToSections.size} users")

        coroutineScope {
            userToSections.map { (_,v)->async {
                val x = v.first()
                val key = db.genKey()
                val kh = db.hash(key)

                val isBlocked = db.query {
                    DB.EmailBlock.upsertReturning(DB.EmailBlock.email, returning=listOf(DB.EmailBlock.blocked)) {
                        it[email] = x.email
                        it[DB.EmailBlock.key] = kh
                    }.first()[DB.EmailBlock.blocked]
                }

                if (isBlocked) return@async

                val qparams = "?email=${URLEncoder.encode(x.email, "UTF-8")}&key=${URLEncoder.encode(key, "UTF-8")}"
                val unsubscribeUrl = "$root/unsubscribe$qparams"
                val listUnsubscribeUrl = "$root/api/notifications/listunsubscribe$qparams"

                val data = EmailData(root, x.email, unsubscribeUrl, x.name,
                    v.distinctBy { it.c.id }.map { it.c },
                    v.flatMap { it.sections }.distinctBy { it.section.crn })
                val out = email(data)

                val fst = x.c.course.let {formatCourse(it.subject, it.course)}
                val subject = if (v.size>=2) "Availability in $fst and ${v.size-1} other courses at Purdue"
                else "Open spot in $fst at Purdue"

                if (send) withContext(Dispatchers.IO) {
                    for (retry in 1..3) try {
                        log.info("emailing ${x.email}")

                        sg.api(Request().apply {
                            method = Method.POST
                            endpoint = "mail/send"
                            body = Mail(
                                Email("notify@boiler.courses"),
                                subject, Email(x.email),
                                Content("text/html", out)
                            ).run {
                                addHeader("List-Unsubscribe-Post", "List-Unsubscribe=One-Click")
                                addHeader("List-Unsubscribe", "<$listUnsubscribeUrl>")
                                build()
                            }
                        })

                        break
                    } catch (e: IOException) {
                        log.error("failed to send email to ${x.email}: $e (retry $retry)")
                    }
                }
                else currentEmail = out
            } }.awaitAll()
        }

        log.info("done checking availability")
    }

    fun Kooby.route() = path("notifications") {
        if (!send) get("/email") {
            ctx.setResponseType(MediaType.HTML)
            return@get currentEmail ?: "No email"
        }

        coroutine {
            @Serializable
            data class NotificationRegistration(val course: Int, val crn: Int?, val threshold: Int, val term: String)
            post("/register", auth.withUser { u->
                val req = ctx.json<NotificationRegistration>()

                db.query {
                    val c = courses.getCourse(req.course) ?: throw APIErrTy.NotFound.err("Course not found")
                    val termSec = c.course.sections[req.term] ?: throw APIErrTy.NotFound.err("Term not found")
                    if (termSec.any {sec->
                        (req.crn==null || sec.crn==req.crn) && sec.seats!=null && sec.seats.left>=req.threshold
                    })
                        throw APIErrTy.BadRequest.err("There are already enough seats")

                    DB.AvailabilityNotification.deleteWhere {
                        (user eq u.id) and (course eq req.course) and (crn eq req.crn)
                    }

                    val countExpr = intLiteral(1).count()
                    val current = DB.AvailabilityNotification.select(countExpr)
                        .where {DB.AvailabilityNotification.user eq u.id}.first()[countExpr]

                    if (current >= USER_NOTIFICATION_LIMIT)
                        throw APIErrTy.BadRequest.err("You are registered for too many notifications")

                    ctx.resp(DB.AvailabilityNotification.insertReturning(
                        listOf(DB.AvailabilityNotification.id)
                    ) {
                        it[course] = req.course
                        it[crn] = req.crn
                        it[term] = req.term
                        it[user] = u.id
                        it[threshold] = req.threshold
                    }.first()[DB.AvailabilityNotification.id])
                }
            })

            post("/delete", auth.withUser { u->
                val target = ctx.json<Long>()
                if (db.query {
                    DB.AvailabilityNotification.deleteWhere {
                        (user eq u.id) and (id eq target)
                    }>0
                }) ctx.resp(Unit)
                else throw APIErrTy.NotFound.err()
            })

            @Serializable
            data class Notification(val id: Long, val section: Schema.Section?,
                                    val threshold: Int, val term: String, val satisfied: Boolean,
                                    val sent: Boolean, val course: Schema.SmallCourse)

            post("/list", auth.withUser {u->
                ctx.resp(db.query {
                    DB.AvailabilityNotification.select(
                        DB.AvailabilityNotification.id,
                        DB.AvailabilityNotification.crn, DB.AvailabilityNotification.threshold,
                        DB.AvailabilityNotification.term, DB.AvailabilityNotification.satisfied,
                        DB.AvailabilityNotification.sent, DB.AvailabilityNotification.course
                    ).where {DB.AvailabilityNotification.user eq u.id}.mapNotNull {
                        val sec = it[DB.AvailabilityNotification.crn]?.let { crn->
                            val course = courses.getCourse(it[DB.AvailabilityNotification.course])!!
                            course.course.sections[it[DB.AvailabilityNotification.term]]?.find {
                                sec->sec.crn==crn
                            } ?: return@mapNotNull null
                        }

                        Notification(
                            it[DB.AvailabilityNotification.id], sec,
                            it[DB.AvailabilityNotification.threshold],
                            it[DB.AvailabilityNotification.term], it[DB.AvailabilityNotification.satisfied],
                            it[DB.AvailabilityNotification.sent],
                            courses.getSmallCourse(it[DB.AvailabilityNotification.course])!!
                        )
                    }.toList()
                })
            })

            @Serializable
            data class EmailBlockReq(val email: String, val key: String)

            post("/unsubscribe") {
                val req = ctx.json<EmailBlockReq>()
                val h = db.hash(req.key)

                db.query {
                    val k = DB.EmailBlock.select(DB.EmailBlock.key).where { DB.EmailBlock.email eq req.email }.firstOrNull()
                        ?: throw APIErrTy.NotFound.err("This email hasn't been used yet")
                    if (!MessageDigest.isEqual(k[DB.EmailBlock.key], h))
                        throw APIErrTy.Unauthorized.err("Invalid key -- can't unsubscribe")

                    DB.EmailBlock.update({DB.EmailBlock.email eq req.email}) {
                        it[blocked]=true
                    }
                }

                ctx.resp(Unit)
            }
        }
    }
}