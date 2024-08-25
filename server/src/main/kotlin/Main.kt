package com.boilerclasses

import com.boilerclasses.Schema.Attribute
import com.boilerclasses.Schema.Subject
import com.boilerclasses.Schema.Term
import io.jooby.*
import io.jooby.exception.NotFoundException
import io.jooby.kt.HandlerContext
import io.jooby.kt.runApp
import io.jooby.netty.NettyServer
import kotlinx.coroutines.coroutineScope
import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.json.*
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import java.io.File

const val SESSION_MAXAGE = (3600*24*7).toLong()
const val NONCE_MAXAGE = (60*5).toLong()

val json = Json {
    classDiscriminatorMode= ClassDiscriminatorMode.NONE
    encodeDefaults=true
    decodeEnumsCaseInsensitive = true
}

enum class APIErrTy {
    NotFound,
    Unauthorized,
    Banned,
    BadRequest,
    Loading,
    RateLimited,
    LoginErr,
    SessionExpire,
    Other;

    fun code() = when(this) {
        NotFound -> StatusCode.NOT_FOUND
        SessionExpire, LoginErr, Unauthorized, Banned -> StatusCode.UNAUTHORIZED
        BadRequest -> StatusCode.BAD_REQUEST
        RateLimited -> StatusCode.TOO_MANY_REQUESTS
        Other,Loading -> StatusCode.SERVER_ERROR
    }

    fun str() = when(this) {
        NotFound -> "notFound"
        Unauthorized -> "unauthorized"
        Banned -> "banned"
        LoginErr -> "loginErr"
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

        launch { courses.runScraper() }

        before {
            if (ctx.remoteAddress=="127.0.0.1")
                ctx.header("X-Forwarded-For").valueOrNull()?.let {
                    ctx.remoteAddress=it.split(",").last().trim()
                }
        }

        install(NettyServer())

        coroutine {
            post("/info") {
                ctx.resp(db.getInfo())
            }

            post("/all") {
                val courses = db.allCourses().map {
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
                    put("courses", Json.encodeToJsonElement(courses))
                    put("instructors", Json.encodeToJsonElement(profs))
                })
            }

            post("/search") {
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
                ctx.json<Int>().let { ctx.resp(courses.similarCourses(it)) }
            }

            post("/prof") {
                ctx.resp(db.getInstructor(ctx.json<Int>()) ?: throw APIErrTy.NotFound.err())
            }

            post("/profbyname") {
                ctx.resp(db.getInstructorByName(ctx.json<String>()) ?: throw APIErrTy.NotFound.err())
            }

            post("/rmp") {
                ctx.resp(db.getRMPs(ctx.json<List<String>>()))
            }

            post("/login") {
                val mk = db.makeSession()
                val nonce = db.genKey()
                ctx.resp(buildJsonObject {
                    put("id", mk.sdb.sesId)
                    put("key", mk.key)
                    put("nonce", nonce)
                    put("redirect", auth.redir(mk.sdb.state, nonce))
                })
            }

            @Serializable
            data class AuthRequest(val code: String, val state: String, val nonce: String)
            post("/auth", auth.withSession {
                val authReq = ctx.json<AuthRequest>()
                auth.auth(authReq.code, it, authReq.nonce, authReq.state)
                ctx.resp(Unit)
            })

            post("/logout", auth.withSession { it.remove() })

            posts(auth, db)

            @Serializable
            data class SetAdmin(val email: String, val admin: Boolean)
            post("/setadmin", auth.withUser(admin=true) {
                if (it.email!=db.adminEmail)
                    throw APIErrTy.Unauthorized.err("Only the admin specified in the environment can manage others")
                val who = ctx.json<SetAdmin>()
                db.setAdminByEmail(who.email, who.admin)
                ctx.resp(Unit)
            })

            get("/data") { courses.download() }
        }

        error { ctx, cause, code ->
            log.error("Request error", cause)

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
                    ctx.setResponseCode(code)
                    ctx.resp(APIErrTy.Other.err(cause.message))
                }
            }
        }
    }
}