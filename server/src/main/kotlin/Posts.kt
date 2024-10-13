package com.boilerclasses

import io.jooby.kt.Kooby
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.SqlExpressionBuilder.inList
import org.jetbrains.exposed.sql.SqlExpressionBuilder.isNotNull
import org.jetbrains.exposed.sql.SqlExpressionBuilder.minus
import org.jetbrains.exposed.sql.SqlExpressionBuilder.plus
import java.time.Instant
import kotlin.time.Duration.Companion.seconds

const val POST_LIMIT = 2000
const val ADMIN_PAGE_POSTS=50

//TODO: add pagination, if like we ever have a full page lmao

@Serializable
enum class CoursePostsSortBy { RatingDesc, RatingAsc, Newest, MostHelpful }
@Serializable
data class CoursePostsRequest(val course: Int, val sortBy: CoursePostsSortBy)

@Serializable
data class CoursePost(val name: String?, val rating: Int?,
                      //text is only null if edit in coursepostdata (otherwise should be null-asserted n stuff)
                      val votes: Int, val text: String?,
                      val id: Int, val voted: Boolean,
                      @Serializable(with=InstantSerializer::class)
                      val submitted: Instant)

@Serializable
data class AddCoursePost(val showName: Boolean, val edit: Int?, val course: Int, val rating: Int?, val text: String?)

@Serializable
data class CoursePostData(
    val posts: List<CoursePost>,
    val postLimit: Int,
    val edit: CoursePost?
)

@Serializable
data class AdminCoursePost(
    val id: Int,
    val userData: DB.UserData,
    val rating: Int?, val text: String,
    val numReports: Int, val votes: Int,
    @Serializable(with=InstantSerializer::class)
    val submitted: Instant,
    val course: Schema.SmallCourse
)

fun Kooby.posts(auth: Auth, db: DB, courses: Courses) = path("/posts") {
    val postRatelimit = RateLimiter(10, 100.seconds)

    coroutine {
        post("/submit", auth.withUser { u->
            if (u.banned) throw APIErrTy.Banned.err()

            val post = ctx.json<AddCoursePost>().let {
                it.copy(text=it.text?.trim())
            }

            if (post.text!=null && post.text.length !in 1..POST_LIMIT)
                throw APIErrTy.BadRequest.err("Post requires text (at most $POST_LIMIT characters)")
            if (post.rating!=null && post.rating !in 1..5)
                throw APIErrTy.BadRequest.err("Bad rating")
            if (post.rating==null && post.text==null)
                throw APIErrTy.BadRequest.err("You should leave a rating or a comment on the course!")

            postRatelimit.check(u.id.toString())

            ctx.resp(db.query {
                if (DB.Course.select(DB.Course.id).where {DB.Course.id eq post.course}.firstOrNull()==null)
                    throw APIErrTy.NotFound.err("Course not found")

                if (DB.CoursePost.select(DB.CoursePost.id).where {
                    (DB.CoursePost.course eq post.course) and (DB.CoursePost.user eq u.id)
                }.firstOrNull()!=null && post.edit==null)
                    throw APIErrTy.BadRequest.err("You've already posted to this course")

                val oldRating = post.edit?.let {
                    (DB.CoursePost.select(DB.CoursePost.rating)
                        .where { DB.CoursePost.id eq it }.firstOrNull()
                        ?: throw APIErrTy.NotFound.err("Post to edit not found"))[DB.CoursePost.rating]
                }

                val nid = DB.CoursePost.upsertReturning(DB.CoursePost.id, returning=listOf(DB.CoursePost.id)) {
                    if (post.edit!=null) it[id]=post.edit

                    it[course]=post.course
                    it[name]=if (post.showName) u.name else null
                    it[rating]=post.rating
                    it[new]=true
                    it[user]=u.id
                    it[text]=post.text
                    it[submitted]=Instant.now()
                }.first()[DB.CoursePost.id]

                oldRating?.let { courses.setRating(post.course, -1, it) }
                post.rating?.let { courses.setRating(post.course, 1, it) }

                nid
            })
        })

        post("/course", auth.withUserMaybe { u->
            val req = ctx.json<CoursePostsRequest>()

            val didVote = (intLiteral(1) as Expression<Int?>).alias("didVote")

            val subq = if (u?.id==null) null else
                DB.PostVote.select(didVote, DB.PostVote.post).where {
                    DB.PostVote.user eq u.id
                }.alias("userVoted")

            val ret = db.query {
                val edit = u?.id?.let {uid ->
                    DB.CoursePost.select(DB.CoursePost.id, DB.CoursePost.text, DB.CoursePost.rating,
                            DB.CoursePost.name, DB.CoursePost.votes, DB.CoursePost.submitted)
                        .where {(DB.CoursePost.user eq uid) and (DB.CoursePost.course eq req.course)}
                        .firstOrNull()?.let {
                            CoursePost(it[DB.CoursePost.name], it[DB.CoursePost.rating], it[DB.CoursePost.votes],
                                it[DB.CoursePost.text], it[DB.CoursePost.id],
                                false, it[DB.CoursePost.submitted])
                        }
                }

                ((subq?.let {
                    DB.CoursePost.join(it, JoinType.LEFT, DB.CoursePost.id, it[DB.PostVote.post])
                } ?: DB.CoursePost)
                    .select(DB.CoursePost.id, DB.CoursePost.text, DB.CoursePost.rating,
                        DB.CoursePost.name, DB.CoursePost.votes, DB.CoursePost.submitted,
                        *(if (subq==null) emptyArray() else arrayOf(subq[didVote]))))
                    .where {
                        ((DB.CoursePost.course eq req.course) and DB.CoursePost.text.isNotNull()).let {
                            if (edit==null) it else it and (DB.CoursePost.id neq edit.id)
                        }
                    }
                    .orderBy(*when (req.sortBy) {
                        CoursePostsSortBy.Newest->null
                        CoursePostsSortBy.RatingDesc->DB.CoursePost.rating to SortOrder.DESC_NULLS_LAST
                        CoursePostsSortBy.RatingAsc->DB.CoursePost.rating to SortOrder.ASC_NULLS_LAST
                        CoursePostsSortBy.MostHelpful->DB.CoursePost.votes to SortOrder.DESC
                    }?.let { arrayOf(it) } ?: emptyArray(),
                        DB.CoursePost.submitted to SortOrder.DESC
                    ).map {
                        CoursePost(it[DB.CoursePost.name], it[DB.CoursePost.rating], it[DB.CoursePost.votes],
                            it[DB.CoursePost.text]!!, it[DB.CoursePost.id],
                                if (subq==null) false else it[subq[didVote]]==1,
                            it[DB.CoursePost.submitted])
                    }.let {
                        CoursePostData(it, POST_LIMIT, edit)
                    }
            }

            ctx.resp(ret)
        })

        post("/delete", auth.withUser {
            val id = ctx.json<Int>()

            val u = db.query {
                val u = DB.CoursePost.select(DB.CoursePost.user, DB.CoursePost.rating, DB.CoursePost.course)
                    .where {DB.CoursePost.id eq id}.firstOrNull()
                    ?: throw APIErrTy.NotFound.err("Post not found")
                if (!it.admin && u[DB.CoursePost.user]!=it.id)
                    throw APIErrTy.Unauthorized.err("You can't delete that post")
                DB.CoursePost.deleteWhere { DB.CoursePost.id eq id }

                u
            }

            u[DB.CoursePost.rating]?.let {courses.setRating(u[DB.CoursePost.course], -1, it) }
            ctx.resp(Unit)
        })

        @Serializable
        data class VoteReq(val id: Int, val vote: Boolean)

        post("/vote", auth.withUser {u->
            if (u.banned) throw APIErrTy.Banned.err()

            val req = ctx.json<VoteReq>()
            if (req.vote) db.query {
                val cp = DB.CoursePost.select(DB.CoursePost.user).where {DB.CoursePost.id eq req.id}
                    .firstOrNull() ?: throw APIErrTy.NotFound.err("Post to vote not found")

                if (cp[DB.CoursePost.user] == u.id)
                    throw APIErrTy.BadRequest.err("You can't vote your own post")

                if (DB.PostVote.insertIgnore {
                    it[post]=req.id
                    it[user]=u.id
                    it[submitted]=Instant.now()
                }.insertedCount>0)
                    DB.CoursePost.update({DB.CoursePost.id eq req.id}) { it[votes]=votes+1 }
            } else db.query {
                if (DB.PostVote.deleteWhere { (post eq req.id) and (user eq u.id) }>0)
                    DB.CoursePost.update({DB.CoursePost.id eq req.id}) { it[votes]=votes-1 }
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
            @Serializable
            data class ListResponse(val posts: List<AdminCoursePost>, val npage: Int)

            post("/list", auth.withUser(admin=true) {
                val req = ctx.json<ListRequest>()

                val nreports = (Count(intLiteral(1)) as Expression<Long?>).alias("count")
                var where: Op<Boolean> = DB.CoursePost.text.isNotNull()
                if (req.new) where = where and DB.CoursePost.new
                val nreportQuery = DB.PostReport.select(nreports, DB.PostReport.post)
                    .groupBy(DB.PostReport.post)
                    .alias("nreportQuery")

                if (req.reported) where = where and GreaterOp(nreportQuery[nreports], longLiteral(0))

                val npage = db.query {
                    val x = intLiteral(1).count().alias("count")

                    val count = DB.CoursePost.join(nreportQuery, JoinType.LEFT,
                        DB.CoursePost.id, nreportQuery[DB.PostReport.post])
                        .select(x).where {where}.first()[x]

                    (count+ADMIN_PAGE_POSTS-1)/ADMIN_PAGE_POSTS
                }

                val posts = db.query {
                    val cols: List<Expression<*>> = DB.CoursePost.columns +
                            listOf(nreportQuery[nreports]) + db.udataCols
                    //if needed can make a nreport column
                    (DB.CoursePost leftJoin DB.User).join(nreportQuery, JoinType.LEFT,
                            DB.CoursePost.id, nreportQuery[DB.PostReport.post])
                        .select(cols)
                        .where {where}
                        .let {
                            if (req.reported) it.orderBy(nreportQuery[nreports] to SortOrder.DESC)
                            else it.orderBy(DB.CoursePost.submitted to SortOrder.DESC)
                        }
                        .limit(ADMIN_PAGE_POSTS, req.page.toLong()*ADMIN_PAGE_POSTS)
                        .map {
                            AdminCoursePost(it[DB.CoursePost.id], db.toUData(it),
                                it[DB.CoursePost.rating], it[DB.CoursePost.text]!!,
                                it[nreportQuery[nreports]]?.toInt() ?: 0,
                                it[DB.CoursePost.votes], it[DB.CoursePost.submitted],
                                //kinda fucked up!
                                courses.getSmallCourse(it[DB.CoursePost.course])!!)
                        }
                }

                ctx.resp(ListResponse(posts, npage.toInt()))
            })

            post("/deletemany", auth.withUser(admin=true) {
                val which = ctx.json<List<Int>>()

                db.query {
                    DB.CoursePost.deleteReturning(listOf(DB.CoursePost.course, DB.CoursePost.rating)) {
                        DB.CoursePost.id inList which
                    }.filter { it[DB.CoursePost.rating]!=null }.map {
                        it[DB.CoursePost.course] to it[DB.CoursePost.rating]!!
                    }
                }.let {
                    courses.removeRatings(it)
                }

                ctx.resp(Unit)
            })

            post("/markread", auth.withUser(admin=true) {
                val which = ctx.json<List<Int>>()

                db.query {
                    DB.CoursePost.update({ DB.CoursePost.id inList which }) {
                        it[new] = false
                    }
                }

                ctx.resp(Unit)
            })

            post("/dismissreports", auth.withUser(admin=true) {
                val which = ctx.json<List<Int>>()

                db.query {
                    DB.PostReport.deleteWhere { post inList which }
                }

                ctx.resp(Unit)
            })
        }
    }
}