package com.boilerclasses

import io.jooby.Context
import io.jooby.MediaType
import io.jooby.StatusCode
import io.jooby.exception.NotFoundException
import io.jooby.kt.runApp
import io.jooby.netty.NettyServer
import kotlinx.coroutines.coroutineScope
import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.*
import java.io.File
import java.security.MessageDigest
import kotlin.time.Duration.Companion.seconds

@OptIn(ExperimentalSerializationApi::class)
val json = Json {
    classDiscriminatorMode=ClassDiscriminatorMode.NONE
    encodeDefaults=true
    decodeEnumsCaseInsensitive = true
    prettyPrint=false
}

enum class APIErrTy {
    NotFound,
    Unauthorized,
    Banned,
    BadRequest,
    Loading,
    RateLimited,
    SessionExpire,
    Other;

    fun code(): StatusCode = when(this) {
        NotFound -> StatusCode.NOT_FOUND
        SessionExpire, Unauthorized, Banned -> StatusCode.UNAUTHORIZED
        BadRequest -> StatusCode.BAD_REQUEST
        RateLimited -> StatusCode.TOO_MANY_REQUESTS
        Other,Loading -> StatusCode.SERVER_ERROR
    }

    fun str() = when(this) {
        NotFound -> "notFound"
        Unauthorized -> "unauthorized"
        Banned -> "banned"
        SessionExpire -> "sessionExpire"
        BadRequest -> "badRequest"
        Loading -> "loading"
        RateLimited -> "rateLimited"
        Other -> "other"
    }

    fun err(msg: String?=null) = APIError(this, msg)
}

data class APIError(val ty: APIErrTy, val msg: String?): Throwable(msg ?: ty.str())

inline fun<reified T> Context.json() =
    runCatching {
        json.decodeFromString<T>(body().value())
    }.getOrElse {
        throw APIErrTy.BadRequest.err("Invalid JSON: ${it.message}")
    }

@OptIn(ExperimentalSerializationApi::class)
inline fun<reified T> Context.resp(x: T): Context {
    val stream = responseStream(MediaType.json)

    json.encodeToStream(buildJsonObject {
        if (x is APIError) {
            put("status", "error")
            put("error", x.ty.str())
            put("message", x.msg)
        } else {
            put("status", "ok")
            put("result", Json.encodeToJsonElement(x))
        }
    }, stream)

    stream.close()
    return this
}

suspend fun main(args: Array<String>) = coroutineScope {
    if (!File("./data").isDirectory)
        throw RuntimeException("the server should be run alongside a data directory for courses and DB")

    runApp(args) {
        val db = DB(environment)
        val auth = Auth(db,log,environment)
        val courses = Courses(environment, log, db)
        val availability = Availability(db, log, environment, courses, auth)
        val scrape = Scrape(log, db, environment, courses, availability, auth)

        val searchRateLimit = RateLimiter(10, 1.seconds)
        val dataRateLimit = RateLimiter(1, 5.seconds)
        val loginRateLimit = RateLimiter(3, 3.seconds)
        val allRateLimit = RateLimiter(25, 2.seconds)
        val isFF = environment.getProperty("useForwardedFor")=="true"

        before {
            if (isFF) ctx.header("X-Forwarded-For").valueOrNull()?.let {
                val idx = it.lastIndexOf(",")+1
                ctx.remoteAddress = it.drop(idx)
            }

            allRateLimit.check(ctx.remoteAddress)
        }

        install(NettyServer())

        posts(auth, db, courses)
        with(availability) { route() }
        with(scrape) { route(this@coroutineScope) }

        coroutine {
            post("/info") {
                ctx.resp(db.getInfo())
            }

            post("/random") { ctx.resp(courses.randomCourseId()) }

            post("/all") {
                val allCourses = db.allCourses().map {
                    buildJsonObject {
                        put("id", it.id)
                        put("lastUpdated", it.course.lastUpdated)
                    }
                }

                val profs = db.allInstructors().map {
                    buildJsonObject {
                        put("id", it.key)
                        put("lastUpdated", it.value.lastUpdated)
                    }
                }

                ctx.resp(buildJsonObject {
                    put("courses", Json.encodeToJsonElement(allCourses))
                    put("instructors", Json.encodeToJsonElement(profs))
                })
            }

            post("/search") {
                searchRateLimit.check(ctx.remoteAddress)

                val req = ctx.json<Courses.SearchReq>()
                ctx.resp(courses.searchCourses(req))
            }

            post("/course") {
                ctx.json<Int>().let {
                    ctx.resp(courses.getCourse(it) ?: throw APIErrTy.NotFound.err())
                }
            }

            @Serializable data class LookupRequest(val subject: String, val course: Int)
            post("/lookup") {
                ctx.json<LookupRequest>().let {
                    ctx.resp(db.lookupCourses(it.subject, it.course))
                }
            }

            post("/similar") {
                searchRateLimit.check(ctx.remoteAddress)

                ctx.json<Int>().let { ctx.resp(courses.similarCourses(it)) }
            }

            post("/prof") {
                val dbI = db.getInstructor(ctx.json<Int>()) ?: throw APIErrTy.NotFound.err()
                ctx.resp(courses.dbInstructorToInstructorId(dbI))
            }

            post("/profbyname") {
                val dbI = db.getInstructorByName(ctx.json<String>()) ?: throw APIErrTy.NotFound.err()
                ctx.resp(courses.dbInstructorToInstructorId(dbI))
            }

            post("/rmp") {
                ctx.resp(db.getRMPs(ctx.json<List<String>>()))
            }

            post("/login") {
                loginRateLimit.check(ctx.remoteAddress)

                val accessToken = ctx.json<String>()

                val mk = db.makeSession()
                auth.auth(mk.sdb, accessToken)

                ctx.resp(buildJsonObject {
                    put("id", mk.sdb.sesId)
                    put("key", mk.key)
                })
            }

            post("/admins", auth.withUser(admin=true) {
                ctx.resp(db.getAdmins())
            })

            post("/userdata", auth.withUser(admin=true) {
                ctx.resp(db.getUser(ctx.json<Int>()))
            })

            post("/ban", auth.withUser(admin=true) {
                val req = ctx.json<DB.BanRequest>()
                courses.removeRatings(db.banUser(req))
                ctx.resp(Unit)
            })

            post("/logout", auth.withSession { it.remove() })

            post("/user", auth.withUser { ctx.resp(it) })

            //deletes all user data via cascade
            post("/deleteuser", auth.withSession {
                it.user?.id?.let { uid->courses.removeRatings(db.deleteUser(uid)) }
                it.remove()
                ctx.resp(Unit)
            })

            @Serializable
            data class SetAdmin(val email: String, val admin: Boolean)
            post("/setadmin", auth.withUser(admin=true) {
                if (it.email!=db.adminEmail)
                    throw APIErrTy.Unauthorized.err("Only the admin specified in the environment can manage others")
                val who = ctx.json<SetAdmin>()
                db.setAdminByEmail(who.email, who.admin)
                ctx.resp(Unit)
            })

            get("/data") {
                dataRateLimit.check(ctx.remoteAddress)
                courses.download()
            }
        }

        error { ctx, cause, code ->
            when (cause) {
                is APIError -> {
                    ctx.setResponseCode(cause.ty.code())
                    ctx.resp(cause)
                }
                is NotFoundException -> {
                    ctx.setResponseCode(StatusCode.NOT_FOUND)
                    ctx.resp(APIErrTy.NotFound.err())
                }
                else -> {
                    val hash = MessageDigest.getInstance("MD5").run {
                        update(cause.toString().toByteArray())
                        digest().sliceArray(0..5).base64()
                    }

                    log.error("Exception thrown, hash: $hash", cause)

                    ctx.setResponseCode(code)
                    ctx.resp(APIErrTy.Other.err("An internal server error occurred.\nHash: $hash"))
                }
            }
        }
    }
}