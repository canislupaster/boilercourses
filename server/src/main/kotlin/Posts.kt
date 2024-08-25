package com.boilerclasses

import io.jooby.kt.Kooby
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.SqlExpressionBuilder.greater
import org.jetbrains.exposed.sql.SqlExpressionBuilder.greaterEq
import org.jetbrains.exposed.sql.SqlExpressionBuilder.inList
import java.time.Instant

const val POST_LIMIT = 2000
const val ADMIN_PAGE_POSTS=50

//TODO: add pagination, if like we ever have a full page lmao

@Serializable
enum class CoursePostsSortBy { RatingDesc, RatingAsc, Newest }
@Serializable
data class CoursePostsRequest(val course: Int, val sortBy: CoursePostsSortBy)

@Serializable
data class CoursePost(val name: String?, val rating: Int?, val text: String,
                      val id: Int, val isYours: Boolean,
                      @Serializable(with=InstantSerializer::class)
                      val submitted: Instant)
@Serializable
data class CoursePostData(
    val posts: List<CoursePost>,
    val postLimit: Int
)

@Serializable
data class AddCoursePost(val showName: Boolean, val edit: Int?, val course: Int, val rating: Int?, val text: String)

@Serializable
data class AdminCoursePost(
    val id: Int, val course: Int,
    val rating: Int?, val text: String,
    val name: String, val email: String,
    val numReports: Int,
    @Serializable(with=InstantSerializer::class)
    val submitted: Instant
)

fun Kooby.posts(auth: Auth, db: DB) = path("/posts") {
    coroutine {
        post("/submit", auth.withUser { u->
            if (u.banned) throw APIErrTy.Banned.err()

            val post = ctx.json<AddCoursePost>()
            if (post.text.length > POST_LIMIT)
                throw APIErrTy.BadRequest.err("Oversized post")
            
            ctx.resp(db.query {
                if (DB.Course.select(DB.Course.id).where {DB.Course.id eq post.course}.firstOrNull()==null)
                    throw APIErrTy.NotFound.err("Course not found")

                DB.CoursePost.upsertReturning(DB.CoursePost.id, returning=listOf(DB.CoursePost.id)) {
                    if (post.edit!=null) it[id]=post.edit

                    it[course]=post.course
                    it[showName]=post.showName
                    it[rating]=post.rating
                    it[new]=true
                    it[user]=u.id
                    it[text]=post.text
                    it[submitted]=Instant.now()
                }.first()[DB.CoursePost.id]
            })
        })

        post("/course", auth.withUserMaybe { u->
            val req = ctx.json<CoursePostsRequest>()
            val isYours = if (u?.id==null) Op.FALSE else DB.CoursePost.user eq u.id

            val ret = db.query {
                (DB.CoursePost leftJoin DB.User)
                    .select(DB.CoursePost.id, DB.CoursePost.text, DB.CoursePost.rating, isYours,
                        DB.CoursePost.showName, DB.User.name, DB.CoursePost.submitted)
                    .orderBy(isYours to SortOrder.DESC, when (req.sortBy) {
                        CoursePostsSortBy.Newest->DB.CoursePost.submitted to SortOrder.DESC
                        CoursePostsSortBy.RatingDesc->DB.CoursePost.rating to SortOrder.DESC_NULLS_LAST
                        CoursePostsSortBy.RatingAsc->DB.CoursePost.rating to SortOrder.ASC_NULLS_LAST
                    })
                    .map {
                        CoursePost(if (it[DB.CoursePost.showName]) it[DB.User.name] else null,
                            it[DB.CoursePost.rating], it[DB.CoursePost.text], it[DB.CoursePost.id],
                            it[isYours], it[DB.CoursePost.submitted])
                    }.let {
                        CoursePostData(it, POST_LIMIT)
                    }
            }

            ctx.resp(ret)
        })

        post("/delete", auth.withUser {
            val id = ctx.json<Int>()

            db.query {
                val u = DB.CoursePost.select(DB.CoursePost.user).where {DB.CoursePost.id eq id}.firstOrNull()
                    ?: throw APIErrTy.NotFound.err("Post not found")
                if (!it.admin && u[DB.CoursePost.user]!=it.id)
                    throw APIErrTy.Unauthorized.err("You can't delete that post")
                DB.CoursePost.deleteWhere { DB.CoursePost.id eq id }
            }

            ctx.resp(Unit)
        })

        post("/report", auth.withUser {u->
            if (u.banned) throw APIErrTy.Banned.err()

            val postId = ctx.json<Int>()
            val count = db.query {
                DB.PostReport.insertIgnore {
                    it[post]=postId
                    it[user]=u.id
                    it[submitted]=Instant.now()
                }.insertedCount
            }

            ctx.resp(buildJsonObject {
                put("alreadyReported", count==0)
            })
        })

        path("admin") {
            @Serializable
            data class ListRequest(val reported: Boolean, val new: Boolean, val page: Int)

            post("/list", auth.withUser(admin=true) {
                val req = ctx.json<ListRequest>()

                db.query {
                    //if needed can make a nreport column
                    val nreports = DB.PostReport.id.count()
                    var where: Op<Boolean> = Op.TRUE
                    if (req.new) where = where and DB.CoursePost.new
                    val cols: List<Expression<*>> = DB.CoursePost.columns +
                            listOf(nreports, DB.User.name, DB.User.email)

                    val nreportQuery = DB.PostReport.select(nreports).alias("nreportQuery")
                    if (req.reported) where = where and (nreports greater 0)
                    (DB.CoursePost leftJoin DB.User).join(nreportQuery, JoinType.LEFT,
                            DB.CoursePost.id, nreportQuery[DB.PostReport.post])
                        .select(cols)
                        .groupBy(DB.CoursePost.id)
                        .where {where}
                        .let {
                            if (req.reported) it.orderBy(nreports to SortOrder.DESC)
                            else it.orderBy(DB.CoursePost.submitted to SortOrder.DESC)
                        }
                        .limit(ADMIN_PAGE_POSTS, req.page.toLong()*ADMIN_PAGE_POSTS)
                        .map {
                            AdminCoursePost(it[DB.CoursePost.id], it[DB.CoursePost.course],
                                it[DB.CoursePost.rating], it[DB.CoursePost.text],
                                it[DB.User.name], it[DB.User.email],
                                it[nreportQuery[nreports]].toInt(), it[DB.CoursePost.submitted])
                        }
                }
            })

            post("/markRead", auth.withUser(admin=true) {
                val which = ctx.json<List<Int>>()

                db.query {
                    DB.CoursePost.update({ DB.CoursePost.id inList which }) {
                        it[DB.CoursePost.new] = false
                    }
                }

                ctx.resp(Unit)
            })

            post("/dismissReports", auth.withUser(admin=true) {
                val which = ctx.json<List<Int>>()

                db.query {
                    DB.PostReport.deleteWhere {
                        DB.PostReport.post inList which
                    }
                }

                ctx.resp(Unit)
            })

            post("/ban", auth.withUser(admin=true) {
                val who = ctx.json<Int>()
                db.query {
                    if (DB.User.update({DB.User.id eq who}) { it[banned]=true }==0)
                        throw APIErrTy.NotFound.err("User to ban not found")
                }
                ctx.resp(Unit)
            })
        }
    }
}