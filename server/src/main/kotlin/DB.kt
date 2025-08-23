package com.boilerclasses

import io.jooby.Environment
import kotlinx.coroutines.Dispatchers
import kotlinx.serialization.KSerializer
import kotlinx.serialization.Serializable
import kotlinx.serialization.descriptors.PrimitiveKind
import kotlinx.serialization.descriptors.PrimitiveSerialDescriptor
import kotlinx.serialization.descriptors.SerialDescriptor
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.SqlExpressionBuilder.plus
import org.jetbrains.exposed.sql.javatime.timestamp
import org.jetbrains.exposed.sql.json.jsonb
import org.jetbrains.exposed.sql.transactions.experimental.newSuspendedTransaction
import org.jetbrains.exposed.sql.transactions.transaction
import java.io.File
import java.security.MessageDigest
import java.security.SecureRandom
import java.time.Duration
import java.time.Instant
import java.util.*
import kotlin.time.Duration.Companion.days
import kotlin.time.toJavaDuration

val SESSION_EXPIRE = 7.days.toJavaDuration()

fun ByteArray.base64(): String = Base64.getEncoder().encodeToString(this)
fun String.base64(): ByteArray = Base64.getDecoder().decode(this)

object InstantSerializer: KSerializer<Instant> {
    override val descriptor: SerialDescriptor = PrimitiveSerialDescriptor("Instant", PrimitiveKind.STRING)
    override fun serialize(encoder: Encoder, value: Instant) = encoder.encodeString(value.toString())
    override fun deserialize(decoder: Decoder): Instant = Instant.parse(decoder.decodeString())
}

class DB(env: Environment) {
    val dbFile = File("./data/db.sqlite")
    val db = Database.connect("jdbc:sqlite:${dbFile.path}?foreign_keys=on", "org.sqlite.JDBC")
    val rng = SecureRandom()
    val adminEmail = env.getProperty("adminEmail")

    fun genKey(): String {
        val key = ByteArray(32)
        rng.nextBytes(key)
        return key.base64()
    }

    fun hash(data: String): ByteArray = MessageDigest.getInstance("SHA-256").run {
        update(data.toByteArray())
        digest()
    }

    init {
        transaction(db) {
            SchemaUtils.createMissingTablesAndColumns()
        }
    }

    // constraints and indices are created by migrations in scripts with knex so we don't worry about that here...

    object Course: Table("course") {
        val id = integer("id")

        val subject = text("subject")
        val course = integer("course")
        val name = text("name")
        val views = long("views")

        val data = jsonb<Schema.Course>("data", json)
    }

    object User: Table("user") {
        val id = integer("id")
        val email = text("email")
        val admin = bool("admin")
        val name = text("name")
        val banned = bool("banned")
    }

    object Session: Table("session") {
        val id = text("id")
        val user = integer("user").references(User.id).nullable()
        val key = binary("key")
        val created = timestamp("created")
    }

    object CoursePost: Table("course_post") {
        val id = integer("id")
        val course = integer("course").references(Course.id)
        val rating = integer("rating").nullable()
        val new = bool("new")
        //users can optionally show name
        val name = text("name").nullable()
        val user = integer("user").references(User.id)
        val votes = integer("votes")

        val text = text("text").nullable()
        val submitted = timestamp("submitted")
    }

    object PostReport: Table("post_report") {
        val user = integer("user").references(User.id)
        val post = integer("post").references(CoursePost.id)
        val submitted = timestamp("submitted")
    }

    object PostVote: Table("post_vote") {
        val id = integer("id")
        val user = integer("user").references(User.id)
        val post = integer("post").references(CoursePost.id)
        val submitted = timestamp("submitted")
    }

    object Instructor: Table("instructor") {
        val id = integer("id")
        val name = text("name")
        val rmp = jsonb<Schema.RMPInfo>("rmp", json).nullable()
        val data = jsonb<Schema.Instructor>("data", json)
    }

    object CourseInstructor: Table("course_instructor") {
        val course = integer("course").references(Course.id)
        val instructor = text("instructor").references(Instructor.name)
    }

    object Term: Table("term") {
        val id = text("id")
        val purdueId = text("purdue_id")
        val name = text("name")
        val lastUpdated = timestamp("last_updated")
    }

    object AvailabilityNotification: Table("availability_notification") {
        val id = long("id").autoIncrement()
        val term = text("term")
        val course = integer("course").references(Course.id)
        val user = integer("user").references(User.id)
        val crn = integer("crn").nullable()
        val threshold = integer("threshold")
        val satisfied = bool("satisfied")
        val sent = bool("sent")
    }

    object EmailBlock: Table("email_block") {
        val email = text("email")
        val key = text("key")
        val blocked = bool("blocked")
        val verified = bool("verified")
        val verification_count = integer("verification_count")
    }

    object Subject: Table("subject") {
        val abbr = text("abbr")
        val name = text("name")
    }

    object Attribute: Table("attribute") {
        val id = text("id")
        val name = text("name")
    }

    object ScheduleType: Table("schedule_type") {
        val name = text("name")
    }

    object SectionEnrollment : Table("section_enrollment") {
        val id = integer("id").autoIncrement()
        val course = integer("course").references(DB.Course.id)
        val crn = integer("crn")
        val time = timestamp("time")
        val term = text("term")
        val enrollment = integer("enrollment")
    }

    suspend fun<T> query(block: suspend Transaction.() -> T): T =
        newSuspendedTransaction(Dispatchers.IO,db,statement=block)

    //this could be considered sucky, by some
    suspend fun getInfo(): Schema.Info = query {
        val count = intLiteral(1).count().alias("count")

        Schema.Info(
            Term.selectAll().associate {
                it[Term.id] to Schema.Term(it[Term.purdueId], it[Term.name], it[Term.lastUpdated].toString())
            },
            Subject.selectAll().map { Schema.Subject(it[Subject.abbr], it[Subject.name]) },
            Attribute.selectAll().map { Schema.Attribute(it[Attribute.id], it[Attribute.name]) },
            ScheduleType.selectAll().map { it[ScheduleType.name] },
            SEARCH_LIMIT,
            Course.select(count).first()[count].toInt(),
            Instructor.select(count).first()[count].toInt()
        )
    }

    private val ratingCount = (CoursePost.rating.count() as Expression<Long?>).alias("ratingCount")
    private val avgRating = CoursePost.rating.castTo(DoubleColumnType())
        .function("avg").alias("avgRating")
    private val agg = CoursePost.select(ratingCount, avgRating, CoursePost.course)
        .groupBy(CoursePost.course).alias("rating")
    private val courseWithRating = Course.join(agg, JoinType.LEFT, Course.id, agg[CoursePost.course])

    private fun toCourseId(it: ResultRow) =
        Schema.CourseId(it[Course.id], it[Course.data], it[Course.views],
            it[agg[ratingCount]]?.toInt() ?: 0, it[agg[avgRating]])

    suspend fun lookupCourses(sub: String, num: Int) = query {
        courseWithRating
            .select(Course.id, Course.data, Course.views, agg[ratingCount], agg[avgRating])
                .where { (Course.subject eq sub) and (Course.course eq num) }
                .map { toCourseId(it) }
                .filter { it.course.sections.isNotEmpty() }
    }

    suspend fun allCourses() = query {
        courseWithRating.select(Course.id, Course.data, Course.views, agg[avgRating], agg[ratingCount])
            .map { toCourseId(it) }
            .filter { it.course.sections.isNotEmpty() } // empty courses may be created when sections are removed from catalog
    }

    suspend fun allPostContent() = query {
        CoursePost.select(CoursePost.course, CoursePost.text)
            .where {CoursePost.text.isNotNull()}
            .groupBy {it[CoursePost.course]}.mapValues {it.value.map {x->x[CoursePost.text]!!}}
    }

    suspend fun allInstructors() = query {
        Instructor.select(Instructor.id, Instructor.data)
            .associate { it[Instructor.id] to it[Instructor.data] }
    }

    suspend fun getRMPs(profs: List<String>) = query {
        val m = Instructor.select(Instructor.name, Instructor.rmp)
            .where { Instructor.name inList profs }
            .associate { it[Instructor.name] to it[Instructor.rmp] }
        profs.map { m[it] }
    }

    suspend fun addCourseView(id: Int) = query {
        if (Course.update({ Course.id eq id }) {
            it[Course.views] = Course.views+1
        }==0) throw APIErrTy.NotFound.err()
    }

    @Serializable
    data class ChartPoint(
        val enrollment: Int,
        @Serializable(with=InstantSerializer::class)
        val time: Instant
    )

    @Serializable
    data class SectionChart(
        val crn: Int,
        val counts: List<ChartPoint>,
        val dropRate: Double
    )

    @Serializable
    data class ChartData(
        val sections: List<SectionChart>,
        val dropRate: Double
    )

    suspend fun getChartData(course: Int, term: String): ChartData {
        val records = query {
            DB.SectionEnrollment.select(DB.SectionEnrollment.time, DB.SectionEnrollment.enrollment, DB.SectionEnrollment.crn)
                .where {
                    (DB.SectionEnrollment.term eq term) and (DB.SectionEnrollment.course eq course)
                }
                .orderBy(DB.SectionEnrollment.id to SortOrder.ASC_NULLS_LAST)
                .toList()
        }

        return records.groupBy { it[DB.SectionEnrollment.crn] }.map {
            val (_, add, drop) = it.value.fold(Triple(0,0,0)) { acc, v ->
                val enrollment = v[DB.SectionEnrollment.enrollment]
                val diff = enrollment-acc.first
                if (diff>0) Triple(enrollment, acc.second+diff, acc.third)
                else Triple(enrollment, acc.second, acc.third-diff)
            }

            Triple(add, drop, SectionChart(
                it.key,
                it.value.map { v->ChartPoint(v[DB.SectionEnrollment.enrollment], v[DB.SectionEnrollment.time]) },
                if (add<=0) 0.0 else drop.toDouble()/add.toDouble()
            ))
        }.let { data->
            val (add, drop) = data.sumOf { it.first } to data.sumOf { it.second }
            DB.ChartData(data.map {it.third}, if (add<=0) 0.0 else drop.toDouble()/add.toDouble())
        }
    }

    data class DBInstructor(val id: Int, val data: Schema.Instructor, val rmp: Schema.RMPInfo?, val courseIds: List<Int>)

    private fun toDBInstructor(r: ResultRow) =
        DBInstructor(r[Instructor.id], r[Instructor.data], r[Instructor.rmp],
            CourseInstructor.select(CourseInstructor.course).where {
                CourseInstructor.instructor eq r[Instructor.data].name
            }.map { it[CourseInstructor.course] })

    suspend fun getInstructorByName(name: String) = query {
        Instructor.select(Instructor.id, Instructor.data, Instructor.rmp, Instructor.name)
            .where {Instructor.name eq name}.firstOrNull()?.let { toDBInstructor(it) }
    }

    suspend fun getInstructor(id: Int) = query {
        Instructor.select(Instructor.id, Instructor.data, Instructor.rmp, Instructor.name)
            .where {Instructor.id eq id}.firstOrNull()?.let { toDBInstructor(it) }
    }

    suspend fun setAdminByEmail(email: String, newAdmin: Boolean) = query {
        if (User.update({User.email eq email}) {it[admin]=newAdmin}==0)
            throw APIErrTy.NotFound.err("User to promote not found")
    }

    @Serializable
    data class UserData(val id: Int, val email: String, val name: String, val admin: Boolean, val banned: Boolean)
    val udataCols = listOf(User.id, User.email, User.name, User.admin, User.banned)
    fun toUData(it: ResultRow) =
        UserData(it[User.id], it[User.email], it[User.name], it[User.admin], it[User.banned])

    suspend fun getUser(id: Int) = query {
        User.select(udataCols).where {User.id eq id}.firstOrNull()
            ?.let { toUData(it) }
    }

    suspend fun auth(id: String, key: String) = query {
        val ses = (Session leftJoin User)
            .select(Session.key, Session.user, Session.created, User.admin, User.email, User.banned, User.name)
            .where { Session.id eq id }
            .firstOrNull() ?: throw APIErrTy.Unauthorized.err("Session not found")

        if (Duration.between(ses[Session.created], Instant.now())>=SESSION_EXPIRE)
            return@query null

        val khash = hash(key)
        if (!MessageDigest.isEqual(khash, ses[Session.key]))
            throw APIErrTy.Unauthorized.err("invalid session key")

        SessionDB(id, ses[Session.user]?.let { uid->
            UserData(uid, ses[User.email], ses[User.name], ses[User.admin], ses[User.banned])
        })
    }

    data class MakeSession(val sdb: SessionDB, val key: String)
    suspend fun makeSession(): MakeSession = query {
        val sid = genKey()
        val skey = genKey()
        val skeyHash = hash(skey)

        Session.insert {
            it[created] = Instant.now()
            it[key] = skeyHash
            it[id] = sid
        }

        MakeSession(SessionDB(sid, null), skey)
    }

    private fun allRatingsFrom(user: Int) =
        CoursePost.select(CoursePost.rating, CoursePost.course)
            .where {(CoursePost.user eq user) and CoursePost.rating.isNotNull()}
            .map { it[CoursePost.course] to it[CoursePost.rating]!! }

    suspend fun deleteUser(id: Int) = query {
        val res = allRatingsFrom(id)
        User.deleteWhere {User.id eq id}
        res
    }

    @Serializable
    data class BanRequest(val id: Int, val removePosts: Boolean?=null, val banned: Boolean)

    suspend fun banUser(req: BanRequest) = query {
        if (User.update({User.id eq req.id}) { it[banned]=req.banned }==0)
            throw APIErrTy.NotFound.err("User to ban not found")

        if (req.removePosts==true) {
            val ratings = allRatingsFrom(req.id)
            CoursePost.deleteWhere { user eq req.id }
            PostVote.deleteWhere { user eq req.id }
            PostReport.deleteWhere { user eq req.id }
            ratings
        } else {
            emptyList()
        }
    }

    suspend fun getAdmins() = query {
        User.select(udataCols).where {User.admin eq true}.map { toUData(it) }
    }

    inner class SessionDB(val sesId: String, val user: UserData?) {
        suspend fun withEmail(newEmail: String, newName: String): SessionDB = query {
            val u = User.upsertReturning(User.email, returning=listOf(User.id,User.admin,User.banned)) {
                it[email]=newEmail
                it[name]=newName
                //sketchy!!! :)
                if (adminEmail!=null && newEmail==adminEmail) it[admin]=true
            }.first()

            Session.update({Session.id eq sesId}) { it[user] = u[User.id] }

            SessionDB(sesId, UserData(u[User.id], newEmail, newName, u[User.admin], u[User.banned]))
        }

        suspend fun remove() = query {
            val u = user
            Session.deleteWhere {
                if (u==null) id eq sesId
                else user eq u.id
            }
        }
    }
}