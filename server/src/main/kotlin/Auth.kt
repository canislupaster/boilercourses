package com.boilerclasses

import com.auth0.jwk.JwkProvider
import com.auth0.jwk.JwkProviderBuilder
import com.auth0.jwt.JWT
import com.auth0.jwt.algorithms.Algorithm
import com.auth0.jwt.interfaces.RSAKeyProvider
import io.jooby.Environment
import io.jooby.kt.HandlerContext
import org.slf4j.Logger
import java.net.URI
import java.security.interfaces.RSAPrivateKey
import java.security.interfaces.RSAPublicKey
import java.util.concurrent.TimeUnit


class Auth(val db: DB, val log: Logger, val env: Environment) {
    val tenant = env.getProperty("msalTenant")!!
    val clientId = env.getProperty("msalClientId")!!
    val provider: JwkProvider = JwkProviderBuilder(URI("https://login.microsoftonline.com/${tenant}/discovery/v2.0/keys?appid=${clientId}").toURL())
        .cached(10, 72, TimeUnit.HOURS)
        .build()

    val algorithm = Algorithm.RSA256(object: RSAKeyProvider {
        override fun getPublicKeyById(id: String): RSAPublicKey = provider.get(id).publicKey as RSAPublicKey
        override fun getPrivateKey(): RSAPrivateKey = throw NotImplementedError("no private keys")
        override fun getPrivateKeyId(): String = throw NotImplementedError("no private keys")
    })

    val verifier = JWT.require(algorithm)
        .withIssuer("https://login.microsoftonline.com/${tenant}/v2.0")
        .withClaimPresence("name").withClaimPresence("email")
        .withAudience(clientId).build()

    fun validateEmail(email: String): Boolean =
        "^[A-Za-z0-9+_.-]+@purdue.edu\$".toRegex().matches(email)

    suspend fun auth(ses: DB.SessionDB, token: String) =
        try {
            val verified = runCatching { verifier.verify(token) }.getOrThrow()
                ?: throw APIErrTy.Unauthorized.err("Bad access token")
            val email = verified.getClaim("email").asString()
            if (!validateEmail(email))
                throw APIErrTy.Unauthorized.err("Non-Purdue email found")
            ses.withEmail(email, verified.getClaim("name").asString())
        } catch(e: Exception) {
            ses.remove()
            throw e
        }

    suspend fun HandlerContext.getSession(): DB.SessionDB {
        val authHdr = ctx.header("Authorization").valueOrNull()?.split(" ")
            ?: throw APIErrTy.Unauthorized.err("No auth header")
        if (authHdr.size!=3 || authHdr[0]!="Basic")
        throw APIErrTy.Unauthorized.err("Invalid auth header")

        return db.auth(authHdr[1], authHdr[2]) ?: throw APIErrTy.SessionExpire.err()
    }

    inline fun<reified T> withSession(crossinline f: suspend HandlerContext.(session: DB.SessionDB)->T): suspend HandlerContext.()->T = {
        f(getSession())
    }

    inline fun<reified T> withUserMaybe(crossinline f: suspend HandlerContext.(user: DB.UserData?)->T): suspend HandlerContext.()->T = {
        f(runCatching { getSession() }.getOrNull()?.user)
    }

    inline fun<reified T> withUser(admin:Boolean=false, crossinline f: suspend HandlerContext.(user: DB.UserData)->T): suspend HandlerContext.()->T = withSession {
        if (it.user==null) throw APIErrTy.Unauthorized.err("Not logged in")
        if (admin && !it.user.admin)
            throw APIErrTy.Unauthorized.err("You aren't an administrator")
        f(it.user)
    }
}