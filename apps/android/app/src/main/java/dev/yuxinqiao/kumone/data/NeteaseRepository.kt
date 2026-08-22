package dev.yuxinqiao.kumone.data

import android.content.Context
import java.net.HttpURLConnection
import java.net.URL
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import uniffi.kumone_ffi.FfiLyricLine
import uniffi.kumone_ffi.FfiPlaybackData
import uniffi.kumone_ffi.FfiRequestSpec
import uniffi.kumone_ffi.FfiSearchTrack
import uniffi.kumone_ffi.buildLyricRequest
import uniffi.kumone_ffi.buildSongSearchRequest
import uniffi.kumone_ffi.buildSongUrlRequest
import uniffi.kumone_ffi.decodeLyricsResponse
import uniffi.kumone_ffi.decodeSongSearchResponse
import uniffi.kumone_ffi.decodeSongUrlResponse
import uniffi.kumone_ffi.ingestCookieString

/**
 * Thin Android transport around the shared Rust protocol core.
 *
 * Rust owns request construction, crypto, response decoding and lyric parsing.
 * Android owns only HTTP I/O and durable cookie storage.
 */
class NeteaseRepository(context: Context) {
    private val session = SessionStore(context.applicationContext)

    suspend fun searchSongs(query: String, limit: Long = 30, offset: Long = 0): SearchPage =
        withContext(Dispatchers.IO) {
            val requestResult = buildSongSearchRequest(
                keywords = query.trim(),
                limit = limit,
                offset = offset,
                cookies = session.snapshot(),
                requestId = requestId(),
                buildVersion = buildVersion(),
            )
            val request = requestResult.request
                ?: error(requestResult.error ?: "Unable to build search request")
            val decoded = decodeSongSearchResponse(execute(request))
            decoded.error?.let(::error)
            SearchPage(decoded.songs, decoded.total)
        }

    suspend fun resolvePlayback(trackId: Long, level: String = "standard"): FfiPlaybackData =
        withContext(Dispatchers.IO) {
            val requestResult = buildSongUrlRequest(
                trackId = trackId,
                level = level,
                cookies = session.snapshot(),
                requestId = requestId(),
                buildVersion = buildVersion(),
            )
            val request = requestResult.request
                ?: error(requestResult.error ?: "Unable to build playback request")
            val decoded = decodeSongUrlResponse(execute(request), trackId)
            decoded.error?.let(::error)
            decoded.data ?: error("NetEase returned no playable URL")
        }

    suspend fun lyrics(trackId: Long): LyricsPage = withContext(Dispatchers.IO) {
        val requestResult = buildLyricRequest(trackId, session.snapshot())
        val request = requestResult.request
            ?: error(requestResult.error ?: "Unable to build lyric request")
        val decoded = decodeLyricsResponse(execute(request))
        decoded.error?.let(::error)
        LyricsPage(
            lines = decoded.lines,
            isInstrumental = decoded.isInstrumental,
            contributor = decoded.contributor,
            translationContributor = decoded.translationContributor,
        )
    }

    private fun execute(request: FfiRequestSpec): String {
        val connection = (URL(request.url).openConnection() as HttpURLConnection).apply {
            requestMethod = request.method
            connectTimeout = 15_000
            readTimeout = 20_000
            instanceFollowRedirects = true
            request.headers.forEach { (name, value) -> setRequestProperty(name, value) }
            if (request.body.isNotEmpty()) {
                doOutput = true
                outputStream.use { stream ->
                    stream.write(request.body.toByteArray(Charsets.UTF_8))
                }
            }
        }

        return try {
            val status = connection.responseCode
            absorbCookies(connection)
            val stream = if (status in 200..399) connection.inputStream else connection.errorStream
            val body = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }.orEmpty()
            if (status !in 200..399) {
                error("NetEase HTTP $status${body.takeIf(String::isNotBlank)?.let { ": $it" }.orEmpty()}")
            }
            body
        } finally {
            connection.disconnect()
        }
    }

    private fun absorbCookies(connection: HttpURLConnection) {
        val raw = connection.headerFields
            .filterKeys { key -> key?.equals("Set-Cookie", ignoreCase = true) == true }
            .values
            .flatten()
            .filter(String::isNotBlank)
            .joinToString(";;")
        if (raw.isNotEmpty()) {
            session.replace(ingestCookieString(session.snapshot(), raw))
        }
    }

    private fun requestId(): String =
        (System.currentTimeMillis() % 100_000_000L).toString().padStart(8, '0')

    private fun buildVersion(): String = (System.currentTimeMillis() / 1000L).toString()
}

data class SearchPage(
    val songs: List<FfiSearchTrack>,
    val total: Long,
)

data class LyricsPage(
    val lines: List<FfiLyricLine>,
    val isInstrumental: Boolean,
    val contributor: String?,
    val translationContributor: String?,
)

private class SessionStore(context: Context) {
    private val preferences = context.getSharedPreferences("netease-session", Context.MODE_PRIVATE)

    fun snapshot(): Map<String, String> = preferences.all.mapNotNull { (key, value) ->
        (value as? String)?.let { key to it }
    }.toMap()

    fun replace(values: Map<String, String>) {
        preferences.edit().clear().apply {
            values.forEach { (key, value) -> putString(key, value) }
        }.apply()
    }
}
