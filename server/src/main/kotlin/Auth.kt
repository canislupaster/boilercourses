package com.boilerclasses

import com.microsoft.aad.msal4j.*
import com.nimbusds.jwt.SignedJWT
import io.jooby.Environment
import io.jooby.kt.HandlerContext
import org.slf4j.Logger
import java.net.URI
import java.security.MessageDigest

class Auth(val db: DB, val log: Logger, val env: Environment) {
    val client = ConfidentialClientApplication
        .builder(env.getProperty("msalClientId")!!,
            ClientCredentialFactory.createFromSecret(env.getProperty("msalClientSecret")!!))
        .authority("https://login.microsoftonline.com/4130bd39-7c53-419c-b1e5-8758d6d63f21/")
        .build()

    val root = env.getProperty("rootUrl")!!
    val redirectUrl = "$root/auth"

    fun validateEmail(email: String): Boolean =
        "^[A-Za-z0-9+_.-]+@purdue.edu\$".toRegex().matches(email)

    fun redir(state: String, nonce: String) =
        client.getAuthorizationRequestUrl(AuthorizationRequestUrlParameters
            .builder(redirectUrl, setOf("User.Read"))
            .state(state)
            .nonce(db.hash(nonce).base64())
            .responseMode(ResponseMode.FORM_POST)
            .prompt(Prompt.SELECT_ACCOUNT)
            .build()).toString()

    suspend fun auth(code: String, ses: DB.SessionDB, nonce: String, state: String) =
        try {
            if (ses.state!=state)
                throw APIErrTy.LoginErr.err("Bad state")
            val authParams = AuthorizationCodeParameters
                .builder(code, URI(redirectUrl)).scopes(setOf("User.Read")).build()

            val res = client.acquireToken(authParams).get()
            val claims = SignedJWT.parse(res.idToken()).jwtClaimsSet
            val nonceHash = claims.getStringClaim("nonce").base64()

            if (!MessageDigest.isEqual(nonceHash, db.hash(nonce)))
                throw APIErrTy.LoginErr.err("Bad nonce")

            if (!validateEmail(res.account().username()))
                throw APIErrTy.LoginErr.err("Invalid email. Please login with your @purdue.edu email address")

            ses.withEmail(res.account().username(), claims.getStringClaim("name"))
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