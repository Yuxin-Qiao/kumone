package dev.yuxinqiao.kumone.data

import android.content.Context
import dev.yuxinqiao.kumone.core.FfiLyricLine
import dev.yuxinqiao.kumone.core.FfiPlaybackData
import dev.yuxinqiao.kumone.core.FfiPlaylistDetail
import dev.yuxinqiao.kumone.core.FfiPlaylistSummary
import dev.yuxinqiao.kumone.core.FfiRequestSpec
import dev.yuxinqiao.kumone.core.FfiSearchTrack
import dev.yuxinqiao.kumone.core.FfiUserProfile
import dev.yuxinqiao.kumone.core.buildDailySongsRequest
import dev.yuxinqiao.kumone.core.buildLyricRequest
import dev.yuxinqiao.kumone.core.buildPersonalizedPlaylistsRequest
import dev.yuxinqiao.kumone.core.buildPlaylistDetailRequest
import dev.yuxinqiao.kumone.core.buildQrCheckRequest
import dev.yuxinqiao.kumone.core.buildQrKeyRequest
import dev.yuxinqiao.kumone.core.buildRecommendResourceRequest
import dev.yuxinqiao.kumone.core.buildSongSearchRequest
import dev.yuxinqiao.kumone.core.buildSongUrlRequest
import dev.yuxinqiao.kumone.core.buildUserAccountRequest
import dev.yuxinqiao.kumone.core.buildUserPlaylistsRequest
import dev.yuxinqiao.kumone.core.clearAuthCookies
import dev.yuxinqiao.kumone.core.decodeDailySongsResponse
import dev.yuxinqiao.kumone.core.decodeLyricsResponse
import dev.yuxinqiao.kumone.core.decodePersonalizedPlaylistsResponse
import dev.yuxinqiao.kumone.core.decodePlaylistDetailResponse
import dev.yuxinqiao.kumone.core.decodeQrCheckResponse
import dev.yuxinqiao.kumone.core.decodeQrKeyResponse
import dev.yuxinqiao.kumone.core.decodeRecommendResourceResponse
import dev.yuxinqiao.kumone.core.decodeSongSearchResponse
import dev.yuxinqiao.kumone.core.decodeSongUrlResponse
import dev.yuxinqiao.kumone.core.decodeUserAccountResponse
import dev.yuxinqiao.kumone.core.decodeUserPlaylistsResponse
import dev.yuxinqiao.kumone.core.ingestCookieString
import dev.yuxinqiao.kumone.core.isLoggedIn as coreIsLoggedIn
import java.net.HttpURLConnection
import java.net.URL
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * Thin Android transport around the shared Rust protocol core.
 *
 * Rust owns request construction, crypto, response decoding and deterministic
 * business rules. Android owns HTTP I/O and durable cookie storage.
 */
class NeteaseRepository(context: Context) {
    private val session = SessionStore(context.applicationContext)

    fun isLoggedIn(): Boolean = coreIsLoggedIn(session.snapshot())

    fun logout() {
        session.replace(clearAuthCookies(session.snapshot()))
    }

    suspend fun beginQrLogin(): QrLoginSession = withContext(Dispatchers.IO) {
        val requestResult = buildQrKeyRequest(session.snapshot())
        val request = requestResult.request
            ?: error(requestResult.error ?: "Unable to create QR login request")
        val decoded = decodeQrKeyResponse(execute(request))
        decoded.error?.let(::error)
        QrLoginSession(
            key = decoded.key ?: error("NetEase returned no QR login key"),
            url = decoded.url ?: error("NetEase returned no QR login URL"),
        )
    }

    suspend fun checkQrLogin(key: String): QrLoginStatus = withContext(Dispatchers.IO) {
        val requestResult = buildQrCheckRequest(key, session.snapshot())
        val request = requestResult.request
            ?: error(requestResult.error ?: "Unable to build QR check request")
        val decoded = decodeQrCheckResponse(execute(request))
        decoded.error?.let(::error)
        QrLoginStatus(
            code = decoded.code,
            state = decoded.state,
            message = decoded.message,
            nickname = decoded.nickname,
            avatarUrl = decoded.avatarUrl,
        )
    }

    suspend fun account(): FfiUserProfile? = withContext(Dispatchers.IO) {
        val requestResult = buildUserAccountRequest(session.snapshot())
        val request = requestResult.request
            ?: error(requestResult.error ?: "Unable to build account request")
        val decoded = decodeUserAccountResponse(execute(request))
        decoded.error?.let(::error)
        decoded.profile
    }

    suspend fun userPlaylists(uid: Long, limit: Long = 100, offset: Long = 0): List<FfiPlaylistSummary> =
        withContext(Dispatchers.IO) {
            val requestResult = buildUserPlaylistsRequest(uid, limit, offset, session.snapshot())
            val request = requestResult.request
                ?: error(requestResult.error ?: "Unable to build library request")
            val decoded = decodeUserPlaylistsResponse(execute(request))
            decoded.error?.let(::error)
            decoded.playlists
        }

    suspend fun personalizedPlaylists(limit: Long = 12): List<FfiPlaylistSummary> =
        withContext(Dispatchers.IO) {
            val requestResult = buildPersonalizedPlaylistsRequest(limit, session.snapshot())
            val request = requestResult.request
                ?: error(requestResult.error ?: "Unable to build recommendation request")
            val decoded = decodePersonalizedPlaylistsResponse(execute(request))
            decoded.error?.let(::error)
            decoded.playlists
        }

    suspend fun recommendedPlaylists(): List<FfiPlaylistSummary> = withContext(Dispatchers.IO) {
        val requestResult = buildRecommendResourceRequest(session.snapshot())
        val request = requestResult.request
            ?: error(requestResult.error ?: "Unable to build personalized recommendation request")
        val decoded = decodeRecommendResourceResponse(execute(request))
        decoded.error?.let(::error)
        decoded.playlists
    }

    suspend fun dailySongs(): List<FfiSearchTrack> = withContext(Dispatchers.IO) {
        val requestResult = buildDailySongsRequest(session.snapshot())
        val request = requestResult.request
            ?: error(requestResult.error ?: "Unable to build daily songs request")
        val decoded = decodeDailySongsResponse(execute(request))
        decoded.error?.let(::error)
        decoded.tracks
    }

    suspend fun playlistDetail(id: Long): FfiPlaylistDetail = withContext(Dispatchers.IO) {
        val requestResult = buildPlaylistDetailRequest(id, session.snapshot())
        val request = requestResult.request
            ?: error(requestResult.error ?: "Unable to build playlist request")
        val decoded = decodePlaylistDetailResponse(execute(request))
        decoded.error?.let(::error)
        decoded.detail ?: error("NetEase returned no playlist detail")
    }

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

data class QrLoginSession(
    val key: String,
    val url: String,
)

data class QrLoginStatus(
    val code: Long,
    val state: String,
    val message: String?,
    val nickname: String?,
    val avatarUrl: String?,
)

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
