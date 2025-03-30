package com.boilerclasses

import io.jooby.Environment
import io.jooby.kt.Kooby
import kotlinx.coroutines.*
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import org.slf4j.Logger
import java.time.Instant
import kotlin.coroutines.CoroutineContext
import kotlin.time.Duration
import kotlin.time.Duration.Companion.minutes

class Scrape(val log: Logger, db: DB, val env: Environment, val courses: Courses, val availability: Availability, val auth: Auth) {
    fun getDur(name: String) = env.getProperty(name)?.ifBlank {null}?.toInt()?.minutes

    private val mut = Mutex()
    private var scrapeOk: Boolean?=null
    private var lastScrape: Instant?=null

    @Serializable
    enum class ScrapeType {
        @SerialName("unitime") Unitime,
        @SerialName("catalog") Catalog
    }

    @Serializable
    data class ScrapeProperties(val args: List<String>, val interval: Duration?, val name: String)

    val scrapeArgs = env.getProperty("scrapeArgs")
    val unitimeArgs = env.getProperty("unitimeArgs")
    val defaultTerms = env.getProperty("defaultTerms")?.split(" ") ?: emptyList()

    private fun parseArgs(x: String?) = x?.let {
        Regex("[^\\s\"]+|\"((?:\\\\\"|[^\"])*)\"").findAll(it)
            .map { m->m.groups[1]?.value ?: m.value }.toList()
    } ?: emptyList()

    val scrape = mapOf(
        ScrapeType.Unitime to ScrapeProperties(listOf("./scripts/unitime.ts", "-d", db.dbFile.absolutePath) +
                parseArgs(unitimeArgs), getDur("unitimeInterval"), "unitime"),
        ScrapeType.Catalog to ScrapeProperties(listOf("./scripts/main.ts", "-d", db.dbFile.absolutePath) +
                parseArgs(scrapeArgs), getDur("scrapeInterval"), "catalog")
    )

    private suspend fun reload() {
        courses.loadCourses()
        availability.update()
    }

    private suspend fun scrape(x: ScrapeProperties, terms: List<String>?=null) {
        // validate terms
        terms?.forEach { parseTerm(it) }

        log.info("starting ${x.name} on terms ${terms?.joinToString(", ") { formatTerm(it) } ?: "latest"}")

        val (res,proc) = withContext(Dispatchers.IO) {
            val procArgs = listOf("./scripts/node_modules/.bin/tsx") + x.args + (terms ?: emptyList())
            val proc = ProcessBuilder().command(procArgs).inheritIO().start()

            proc.waitFor(1, java.util.concurrent.TimeUnit.HOURS) to proc
        }

        if (!res) {
            proc.destroyForcibly()

            log.error("${x.name} took too long")
            scrapeOk=false
            lastScrape=Instant.now()
            return
        }

        val code = proc.exitValue()
        log.info("${x.name} exited with code $code")

        scrapeOk=code==0
        lastScrape=Instant.now()
    }

    suspend fun CoroutineContext.runEvery(x: ScrapeProperties) {
        if (x.interval==null) return

        while (isActive) {
            delay(x.interval)

            mut.withLock {
                scrape(x, defaultTerms)
                reload()
            }
        }
    }

    @Serializable
    enum class ScrapeStatus {
        @SerialName("busy") Busy,
        @SerialName("ok") Ok,
        @SerialName("fail") Fail,
        @SerialName("notStarted") NotStarted
    }

    suspend fun withTryLock(f: suspend ()->Unit) {
        if (mut.tryLock()) {
            try {
                f()
            } finally {
                mut.unlock()
            }
        } else {
            throw APIErrTy.Loading.err("Server is already busy scraping/indexing")
        }
    }

    fun Kooby.route(scope: CoroutineScope) = coroutine {
        scope.launch { reload() }

        for ((_,v) in scrape) scope.launch {
            coroutineContext.runEvery(v)
        }

        path("admin") {
            post("/reindex", auth.withUser(admin=true) {
                withTryLock {
                    courses.loadCourses()
                    availability.update()
                }

                ctx.resp(Unit)
            })

            @Serializable
            data class StatusResponse(val status: ScrapeStatus,
                                      @Serializable(with=InstantSerializer::class)
                                      val lastScrape: Instant?)
            post("/status", auth.withUser(admin=true) {
                ctx.resp(if (mut.tryLock()) {
                    val ret = StatusResponse(when (scrapeOk) {
                        null->ScrapeStatus.NotStarted
                        true->ScrapeStatus.Ok
                        false->ScrapeStatus.Fail
                    }, lastScrape)

                    mut.unlock()
                    ret
                } else {
                    StatusResponse(ScrapeStatus.Busy, null)
                })
            })

            @Serializable
            data class ScrapeRequest(val term: String?, val type: ScrapeType)

            post("/scrape", auth.withUser(admin=true) {
                val req = ctx.json<ScrapeRequest>()

                withTryLock {
                    log.info("scraping ${scrape[req.type]!!.name}, term ${req.term ?: "default"} at admin request")
                    scrape(scrape[req.type]!!, req.term?.let {listOf(it)} ?: defaultTerms)
                    log.info("reindexing after scrape")
                    reload()
                }

                ctx.resp(Unit)
            })
        }
    }
}