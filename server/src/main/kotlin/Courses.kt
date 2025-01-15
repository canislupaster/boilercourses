package com.boilerclasses

import io.jooby.Environment
import io.jooby.FileDownload
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import org.apache.lucene.analysis.Analyzer
import org.apache.lucene.analysis.CharacterUtils
import org.apache.lucene.analysis.LowerCaseFilter
import org.apache.lucene.analysis.Tokenizer
import org.apache.lucene.analysis.core.DecimalDigitFilter
import org.apache.lucene.analysis.core.LetterTokenizer
import org.apache.lucene.analysis.core.WhitespaceTokenizer
import org.apache.lucene.analysis.en.EnglishAnalyzer
import org.apache.lucene.analysis.miscellaneous.PerFieldAnalyzerWrapper
import org.apache.lucene.analysis.ngram.EdgeNGramTokenFilter
import org.apache.lucene.analysis.standard.StandardAnalyzer
import org.apache.lucene.analysis.tokenattributes.CharTermAttribute
import org.apache.lucene.analysis.tokenattributes.OffsetAttribute
import org.apache.lucene.document.*
import org.apache.lucene.index.*
import org.apache.lucene.queries.mlt.MoreLikeThis
import org.apache.lucene.queryparser.simple.SimpleQueryParser
import org.apache.lucene.search.*
import org.apache.lucene.store.MMapDirectory
import org.apache.lucene.util.BytesRef
import org.slf4j.Logger
import java.io.File
import java.time.Instant
import java.time.LocalTime
import kotlin.math.max
import kotlin.math.min

val termTypes = listOf("fall", "summer", "spring", "winter")
const val SEARCH_LIMIT = 50
const val MOST_VIEWED_LIMIT = 50

fun parseTerm(term: String): Pair<Int,Int> {
    for ((i,x) in termTypes.withIndex())
        if (term.startsWith(x)) return i to term.substring(x.length).toInt()
    throw IllegalArgumentException("invalid term")
}

fun formatCourse(subject: String, course: Int) =
    "$subject ${if (course%100 == 0) course/100 else course}"

fun formatTerm(term: String): String = parseTerm(term).let {
    "${termTypes[it.first].replaceFirstChar {x->x.uppercase()}} ${it.second}"
}

fun termIdx(term: String) = parseTerm(term).let { it.second*termTypes.size + it.first }
fun timeToMin(x: LocalTime) = x.toSecondOfDay()/60

class Courses(val env: Environment, val log: Logger, val db: DB) {
    val numResults = 30
    val maxResults = 1000

    @Serializable
    data class SearchReq(
        val query: String,
        val minCredits: Int?=null, val maxCredits: Int?=null,
        val minCourse: Int?=null, val maxCourse: Int?=null,
        val attributes: List<String> = emptyList(),
        val subjects: List<String> = emptyList(),
        val scheduleType: List<String> = emptyList(),
        val terms: List<String> = emptyList(),
        val instructors: List<String> = emptyList(),
        val minMinute: Int? = null, val maxMinute: Int? = null,
        val minGPA: Float? = null, val maxGPA: Float? = null,
        val page: Int=0
    ) {
        fun isEmpty() = copy(query=query.trim(), page=0) == SearchReq("")
    }

    @Serializable
    data class SearchResult(
        val score: Float?,
        val course: Schema.SmallCourse
    )

    @Serializable
    data class SearchOutput(
        val results: List<SearchResult>,
        val numHits: Int, val npage: Int,
        val ms: Double
    )

    private val indexFile = File("./data/index")
    private val indexSwapFile = File("./data/index-tmp")

    val lock = RwLock()

    private fun crapAnalyzer() = object: Analyzer() {
        val tokenizer = object: Tokenizer() {
            private val termAttr = addAttribute(CharTermAttribute::class.java)
            private val offsetAttr = addAttribute(OffsetAttribute::class.java)
            private val buffer = CharacterUtils.newCharacterBuffer(4096)

            private var offset=0
            private var finalOffset=0
            private var dataLen=0
            private var bufferOffset=0

            override fun incrementToken(): Boolean {
                clearAttributes()
                var last = -1
                var start = -1
                var mode=0
                var termBuf = termAttr.buffer()

                while (true) {
                    if (offset>=dataLen+bufferOffset) {
                        CharacterUtils.fill(buffer, input)
                        bufferOffset+=dataLen
                        dataLen = buffer.length

                        if (dataLen==0) {
                            if (last>=0) break
                            else {
                                finalOffset=correctOffset(offset)
                                return false
                            }
                        }
                    }

                    //no support for wide chars :>)
                    val c = buffer.buffer[offset-bufferOffset]
                    var newMode=0
                    if (c.isDigit()) newMode=1
                    else if (c.isLetter()) newMode=2

                    if (mode==0 && newMode>0) {
                        start=offset
                        mode=newMode
                    } else if (mode!=newMode) {
                        break
                    }

                    if (mode>0) {
                        last=offset-start
                        if (last>=termBuf.size)
                            termBuf=termAttr.resizeBuffer(1+last)
                        termBuf[last]=c.lowercaseChar()
                    }

                    offset++
                }

                termAttr.setLength(last+1)
                offsetAttr.setOffset(correctOffset(start), correctOffset(start+last+1))
                return true
            }

            override fun reset() {
                super.reset()
                buffer.reset() //prolly unnecessary...? buffer should be filled next time
                offset=0
                dataLen=0
                bufferOffset=0
            }

            override fun end() {
                super.end()
                offsetAttr.setOffset(finalOffset, finalOffset)
            }
        }

        override fun createComponents(fieldName: String?): TokenStreamComponents {
            return TokenStreamComponents(tokenizer)
        }
    }

    private fun subjectAnalyzer() = object: Analyzer() {
        override fun createComponents(fieldName: String?): TokenStreamComponents {
            val tokenizer = object: LetterTokenizer() {
                override fun isTokenChar(c: Int): Boolean = Character.isAlphabetic(c)
            }
            return TokenStreamComponents(tokenizer, LowerCaseFilter(tokenizer))
        }
    }

    private fun idAnalyzer(withngrams: Boolean) = object: Analyzer() {
        override fun createComponents(fieldName: String?): TokenStreamComponents {
            val tokenizer = WhitespaceTokenizer()
            return TokenStreamComponents(tokenizer,
                DecimalDigitFilter(tokenizer).let {
                    if (withngrams)
                        EdgeNGramTokenFilter(it, 1, 5, true)
                    else it
                })
        }
    }

    private var idx: MMapDirectory? = null
    private var dirReader: DirectoryReader? = null
    private var moreLike: MoreLikeThis? = null
    private var searcher: IndexSearcher? = null

    //internally mutable to updated cached ratings
    private var courseIds = listOf<Schema.CourseId>()
    private var courseById = emptyMap<Int,Schema.CourseId>()
    private var smallCourseBySearchId = emptyMap<Int,Schema.SmallCourse>()
    private var sortedCourses = emptyList<Schema.CourseId>()
    private var mostViewedCourses = emptyList<Schema.CourseId>()
    private var smallCourseByCourseId = emptyMap<Int, List<Schema.SmallCourse>>()

    private val fieldAnalyzer = PerFieldAnalyzerWrapper(EnglishAnalyzer(), mapOf(
        "subject" to subjectAnalyzer(), "course" to idAnalyzer(true),
        "prereqs" to crapAnalyzer(), "instructor" to StandardAnalyzer(),
        "suggest" to crapAnalyzer(), "titleStandard" to StandardAnalyzer()
    ))

    //same thing but course is crap, function (above is only for indexing)
    private fun queryFieldAnalyzer() = PerFieldAnalyzerWrapper(EnglishAnalyzer(), mapOf(
        "subject" to subjectAnalyzer(), "course" to crapAnalyzer(),
        "prereqs" to crapAnalyzer(), "instructor" to StandardAnalyzer(),
        "suggest" to crapAnalyzer(), "titleStandard" to StandardAnalyzer()
    ))

    private val weights = mapOf(
        //uh idk lemme just type some random numbers
        "subject" to 130,
        "course" to 180,
        "subjectName" to 150,
        "title" to 100,
        "postContent" to 40,
        "titleStandard" to 50,
        "desc" to 35,
        "instructor" to 80,
        "prereq" to 10,
        "term" to 100,
    ).mapValues { it.value.toFloat()/10.0f }

    private val similarFields = listOf(
        "subject", "subjectName", "title", "desc", "instructor", "term"
    )

    private fun makeQueryParser(analyzer: Analyzer) = SimpleQueryParser(analyzer, weights)

    suspend fun loadCourses() {
        try {
            log.info("loading courses & posts")

            val c = db.allCourses()
            val posts = db.allPostContent()
            val info = db.getInfo()

            val subjectMap = info.subjects.associateBy { it.abbr }

            val newCourseById = c.associateBy { it.id }
            val newSortedCourses = c.sortedWith(compareBy({it.course.subject}, {it.course.course}))
            val newMostViewedCourses = c.filter { it.views>5 }.sortedByDescending { it.views }

            data class IndexCourse(val searchId: Int, val cid: Schema.CourseId, val small: Schema.SmallCourse)
            val indexCourses = c.flatMap {
                (it.course.sections.entries
                    .asSequence()
                    .map { x->x.value.map { y-> x.key to y}}
                    .flatten()
                    .filter { sec->sec.second.name!=null }
                    .groupBy { sec->sec.second.name }.map { (secName, secs) -> secName to it.copy(
                        course=it.course.copy(
                            sections=secs.groupBy {x->x.first}.mapValues {x->x.value.map {y->y.second}}
                        ))
                    }
                    .toList() + listOf(null to it))
            }.mapIndexed { i, x ->
                IndexCourse(i, x.second, x.second.toSmall(x.first)) }

            val newSmallCourses = indexCourses.associate {
                it.searchId to it.small
            }.toMutableMap()
            val newSmallCourseByCID = indexCourses.groupBy {it.cid.id}
                .mapValues {it.value.map {v->v.small}}

            if (indexSwapFile.exists()) indexSwapFile.deleteRecursively()

            val newIdx = MMapDirectory(indexSwapFile.toPath())
            val cfg = IndexWriterConfig(fieldAnalyzer)
            val writer = IndexWriter(newIdx, cfg)

            log.info("indexing courses & posts")

            val instructorNicks = db.allInstructors().values.associate {it.name to it.nicknames}

            writer.addDocuments(indexCourses.map { indexCourse->
                val cid = indexCourse.cid

                Document().apply {
                    val textTermVec = FieldType().apply {
                        setIndexOptions(IndexOptions.DOCS_AND_FREQS_AND_POSITIONS)
                        setTokenized(true)
                        setStoreTermVectors(true)
                        freeze()
                    }

                    add(IntField("id", indexCourse.cid.id, Field.Store.YES))
                    add(IntField("searchId", indexCourse.searchId, Field.Store.YES))
                    add(SortedDocValuesField("subjectSort", BytesRef(cid.course.subject)))
                    add(SortedDocValuesField("courseSort", BytesRef(cid.course.course)))

                    val secs = cid.course.sections.values.asSequence().flatten()

                    add(Field("subject", cid.course.subject, textTermVec))
                    posts[cid.id]?.let {
                        add(Field("postContent", it.joinToString("\n"), TextField.TYPE_NOT_STORED))
                    }
                    add(StringField("subjectString", cid.course.subject, Field.Store.NO))
                    add(Field("subjectName",
                        subjectMap[cid.course.subject]!!.name, textTermVec))
                    add(Field("course", cid.course.course.toString(), TextField.TYPE_NOT_STORED))
                    val titleStr = (listOf(cid.course.subject, cid.course.course, cid.course.name)
                            + if (indexCourse.small.varTitle!=null)
                                listOf(indexCourse.small.varTitle) else emptyList()
                        ).joinToString(" ")
                    add(Field("title", titleStr, textTermVec))
                    add(Field("titleStandard", titleStr, TextField.TYPE_NOT_STORED))
                    add(Field("desc", cid.course.description, textTermVec))
                    add(IntField("courseInt", cid.course.course, Field.Store.NO))

                    val reqs = mutableListOf<Schema.PreReq>()
                    cid.course.prereqs()?.let { prereqs->
                        val stack = ArrayDeque<Schema.PreReqs>()
                        stack.addLast(prereqs)
                        while (stack.size>0) {
                            when (val x=stack.removeLast()) {
                                is Schema.PreReqs.Or -> x.vs.forEach {stack.addLast(it)}
                                is Schema.PreReqs.And -> x.vs.forEach {stack.addLast(it)}
                                is Schema.PreReqs.Leaf -> reqs.add(x.leaf)
                            }
                        }
                    }

                    //didnt really work...
                    val (min,max) = when (val x = cid.course.credits) {
                        is Schema.Credits.Fixed-> x.values.min() to x.values.max()
                        is Schema.Credits.Range-> x.min to x.max
                    }

                    add(IntField("minCredits", min, Field.Store.NO))
                    add(IntField("maxCredits", max, Field.Store.NO))

                    reqs.mapNotNull {
                        if (it is Schema.PreReq.Course) "${it.subject} ${it.course}"
                        else null
                    }.joinToString(" ").let {
                        add(Field("prereq", it, TextField.TYPE_NOT_STORED))
                    }

                    secs.flatMap {it.instructors}
                        .also { instructors->
                            instructors.map {it.name}.distinct().forEach {
                                add(StringField("instructorString", it, Field.Store.NO))
                            }
                        }
                        .flatMap { (instructorNicks[it.name] ?: emptyList()) + it.name }.distinct()
                        .joinToString(" ").let {
                            add(Field("instructor", it, textTermVec))
                        }

                    cid.course.sections.keys.forEach {
                        add(StringField("termId", it, Field.Store.NO))
                    }

                    cid.course.sections.keys.joinToString(" ") {info.terms[it]!!.name}.let {
                        add(Field("term", it, textTermVec))
                    }

                    secs.map {it.scheduleType}
                        .distinct().forEach {
                            add(StringField("scheduleType", it, Field.Store.NO))
                        }

                    cid.course.sections.maxBy {termIdx(it.key)}.value
                        .flatMap { it.times }.mapNotNull {it.toTimes().firstOrNull()}.forEach {
                        add(IntField("time", timeToMin(it), Field.Store.NO))
                    }

                    cid.course.grades(null).gpa?.let {
                        add(FloatField("gpa", it.toFloat(), Field.Store.NO))
                    }

                    cid.course.attributes.forEach { add(StringField("attributes", it, Field.Store.NO)) }
                }
            })

            writer.close()

            log.info("finished indexing")
            newIdx.close()
            lock.write {
                dirReader?.close()
                idx?.close()

                indexFile.deleteRecursively()
                indexSwapFile.copyRecursively(indexFile, overwrite = true)

                courseIds = c
                sortedCourses = newSortedCourses
                mostViewedCourses = newMostViewedCourses
                courseById = newCourseById
                smallCourseBySearchId = newSmallCourses
                smallCourseByCourseId = newSmallCourseByCID

                idx=MMapDirectory(indexFile.toPath())
                dirReader=DirectoryReader.open(idx)
                searcher=IndexSearcher(dirReader)
                moreLike=MoreLikeThis(dirReader).apply {
                    minDocFreq=2 //idk if this helps!
                    fieldNames=similarFields.toTypedArray()
                }
            }
        } catch (e: Throwable) {
            log.error("error parsing/indexing course data:", e)
        } finally {
            indexSwapFile.deleteRecursively()
        }
    }

    fun randomCourseId() =
        (courseIds.randomOrNull() ?: throw APIErrTy.Loading.err("Courses are still indexing")).id

    private fun setSmallCoursesRating(course: Int, numRating: Int, avgRating: Double?) =
        smallCourseByCourseId[course]!!.forEach {
            it.ratings=numRating
            it.avgRating=avgRating
        }

    suspend fun setRating(course: Int, k: Int, v: Int) = lock.write {
        val c = courseById[course]!!

        val nk = c.ratings+k
        c.avgRating = if (nk==0) null else (c.ratings*(c.avgRating ?: 0.0) + k*v.toDouble())/nk.toDouble()
        c.ratings = nk
        setSmallCoursesRating(course, nk, c.avgRating)
    }

    suspend fun removeRatings(ratings: List<Pair<Int,Int>>) = lock.write {
        for ((k,v) in ratings) {
           val c = courseById[k]!!
            c.avgRating = if (c.ratings==1) null else (c.ratings*c.avgRating!! - v)/(c.ratings-1)
                c.ratings--
            setSmallCoursesRating(k, c.ratings, c.avgRating)
        }
    }

    private fun scoreDocsToCourses(scoredocs: List<ScoreDoc>): List<SearchResult> {
        val fields = searcher!!.storedFields()

        return scoredocs.map { scoredoc ->
            val id = fields.document(scoredoc.doc).getField("searchId").numericValue().toInt()
            SearchResult(
                if (scoredoc.score.isNaN()) null else scoredoc.score,
                smallCourseBySearchId[id]!!
            )
        }
    }

    suspend fun similarCourses(id: Int): List<SearchResult> = withContext(Dispatchers.IO) {
        lock.read {
            if (searcher==null) throw APIErrTy.Loading.err("courses not indexed yet")

            val doc = searcher!!.search(IntField.newExactQuery("id", id), 1).scoreDocs[0]
            val fields = searcher!!.storedFields()

            searcher!!.search(moreLike!!.like(doc.doc), 15).scoreDocs.filter {
                val id2 = fields.document(it.doc).getField("id").numericValue().toInt()
                id!=id2 && it.score>4
            }.let { scoreDocsToCourses(it) }
        }
    }

    suspend fun mostViewed(): List<Schema.SmallCourse> = mostViewedCourses
        .take(MOST_VIEWED_LIMIT).map { it.toSmall(null) }

    suspend fun searchCourses(req: SearchReq): SearchOutput = lock.read {
        if (searcher==null) throw APIErrTy.Loading.err("courses not indexed yet")
        if (req.page<0) throw APIErrTy.BadRequest.err("page is negative")
        if (req.query.length > SEARCH_LIMIT) throw APIErrTy.BadRequest.err("Search query is too long!")

        if (req.isEmpty()) {
            val (f,t) = req.page*numResults to min(sortedCourses.size,(req.page+1)*numResults)
            if (f>t) throw APIErrTy.NotFound.err("Page doesn't exist")

            return@read sortedCourses.subList(f,t).map {
                SearchResult(null, it.toSmall(null))
            }.let {
                SearchOutput(it, sortedCourses.size,
                    (sortedCourses.size+numResults-1)/numResults, 0.0)
            }
        }

        val startTime = Instant.now()
        val trimQuery = req.query.trim()

        val analyzer = queryFieldAnalyzer()

        val bq = BooleanQuery.Builder()
        val parser = makeQueryParser(analyzer)
        if (trimQuery.isNotEmpty()) {
            bq.add(parser.parse(trimQuery), BooleanClause.Occur.SHOULD)

            for ((k,v) in weights) {
                val term = analyzer.normalize(k,trimQuery)
                bq.add(BoostQuery(FuzzyQuery(Term(k, term)), v), BooleanClause.Occur.SHOULD)
                parser.createPhraseQuery(k, trimQuery)?.let {
                    bq.add(BoostQuery(it, v*2f), BooleanClause.Occur.SHOULD)
                }
                bq.add(BoostQuery(PrefixQuery(Term(k, term)), v*3f), BooleanClause.Occur.SHOULD)
            }
        }

        if (req.minCourse!=null || req.maxCourse!=null)
            bq.add(IntField.newRangeQuery("courseInt",
                req.minCourse?.times(100) ?: 0,
                req.maxCourse?.times(100) ?: Int.MAX_VALUE),
                BooleanClause.Occur.FILTER)

        if (req.minMinute!=null || req.maxMinute!=null)
            bq.add(IntField.newRangeQuery("time", req.minMinute ?: 0,
                req.maxMinute ?: Int.MAX_VALUE), BooleanClause.Occur.FILTER)

        if (req.minCredits!=null)
            bq.add(IntField.newRangeQuery("maxCredits", req.minCredits, Int.MAX_VALUE),
                BooleanClause.Occur.FILTER)
        if (req.maxCredits!=null)
            bq.add(IntField.newRangeQuery("minCredits", 0, req.maxCredits),
                BooleanClause.Occur.FILTER)

        if (req.minGPA!=null || req.maxGPA!=null)
            bq.add(FloatField.newRangeQuery("gpa",
                req.minGPA ?: 0.0f, req.maxGPA ?: Float.MAX_VALUE),
                BooleanClause.Occur.FILTER)

        listOf(
            req.scheduleType to "scheduleType",
            req.terms to "termId",
            req.subjects to "subjectString",
            req.attributes to "attributes",
            req.instructors to "instructorString"
        ).forEach { (a,b)->
            if (a.isNotEmpty())
                bq.add(TermInSetQuery(b,a.map {
                    BytesRef(it.toByteArray())
                }), BooleanClause.Occur.FILTER)
        }

        val q = bq.build()
        val cnt = min(maxResults, (req.page+1)*numResults)
        val res = withContext(Dispatchers.IO) {
            searcher!!.search(q, cnt,
                if (trimQuery.isNotEmpty()) Sort.RELEVANCE
                else Sort(SortField("subjectSort", SortField.Type.STRING), SortField("courseSort", SortField.Type.STRING)), true)
        }
//        println(searcher!!.explain(q, res.scoreDocs[0].doc).toString())

        val intHits = res.totalHits.value.toInt()
        //num pages may change as numhits increases...
        return@read SearchOutput(
            res.scoreDocs.takeLast((res.scoreDocs.size-1)%numResults +1)
                .let { scoreDocsToCourses(it) },
            intHits, max(1,min(intHits+numResults-1, maxResults)/numResults),
            java.time.Duration.between(startTime, Instant.now()).toNanos().toDouble()/1e6
        )
    }

    suspend fun getCourse(id: Int): Schema.CourseId? = lock.read { courseById[id] }
    suspend fun getSmallCourse(id: Int): Schema.SmallCourse? = lock.read {
        smallCourseByCourseId[id]?.firstOrNull()
    }

    suspend fun dbInstructorToInstructorId(dbI: DB.DBInstructor) = lock.read {
        Schema.InstructorId(dbI.id, dbI.data, dbI.rmp, dbI.courseIds.mapNotNull { courseById[it] })
    }

    suspend fun download() = withContext(Dispatchers.IO) {
        lock.read {
            val json = Json.encodeToString(sortedCourses)
            FileDownload(FileDownload.Mode.INLINE, json.toByteArray(), "courses.json")
        }
    }
}