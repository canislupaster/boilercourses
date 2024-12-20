package com.boilerclasses

import java.time.Instant
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.locks.ReentrantReadWriteLock
import kotlin.concurrent.read
import kotlin.concurrent.write
import kotlin.time.Duration

class RateLimiter(val reqs: Long, val dur: Duration, val message: String?=null) {
    val durS = dur.inWholeSeconds
    val nreq = ConcurrentHashMap<String, Long>()
    var lastClean = Instant.now().epochSecond
    val lock = ReentrantReadWriteLock()

    fun check(addr: String) = lock.read {
        val now = Instant.now().epochSecond
        if (now-lastClean>=durS) lock.write {
            if (now-lastClean>=durS) {
                nreq.clear()
                lastClean = now
            }
        }

        nreq.compute(addr) { _, v ->
            val x = v ?: 0
            if (x>=reqs) throw APIErrTy.RateLimited.err(message)
            x+1
        }
    }
}