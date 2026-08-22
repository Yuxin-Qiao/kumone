package dev.yuxinqiao.kumone

import android.content.ComponentName
import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Slider
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.session.MediaController
import androidx.media3.session.SessionToken
import dev.yuxinqiao.kumone.core.FfiLyricLine
import dev.yuxinqiao.kumone.core.FfiSearchTrack
import dev.yuxinqiao.kumone.data.LyricsPage
import dev.yuxinqiao.kumone.data.NeteaseRepository
import dev.yuxinqiao.kumone.playback.PlaybackService
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            MaterialTheme {
                KumoneApp()
            }
        }
    }
}

@Composable
private fun KumoneApp() {
    val context = LocalContext.current
    val repository = remember { NeteaseRepository(context) }
    val controller = rememberMediaController()
    val scope = rememberCoroutineScope()

    var query by remember { mutableStateOf("") }
    var songs by remember { mutableStateOf<List<FfiSearchTrack>>(emptyList()) }
    var total by remember { mutableLongStateOf(0) }
    var loading by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var nowPlaying by remember { mutableStateOf<FfiSearchTrack?>(null) }
    var lyrics by remember { mutableStateOf<LyricsPage?>(null) }
    var positionMs by remember { mutableLongStateOf(0) }

    fun search() {
        val keyword = query.trim()
        if (keyword.isEmpty() || loading) return
        scope.launch {
            loading = true
            errorMessage = null
            runCatching { repository.searchSongs(keyword) }
                .onSuccess { page ->
                    songs = page.songs
                    total = page.total
                }
                .onFailure { errorMessage = it.message ?: "Search failed" }
            loading = false
        }
    }

    LaunchedEffect(controller, nowPlaying) {
        while (controller != null) {
            positionMs = controller.currentPosition.coerceAtLeast(0L)
            delay(250L)
        }
    }

    Scaffold(modifier = Modifier.fillMaxSize()) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(horizontal = 16.dp),
        ) {
            Spacer(Modifier.height(12.dp))
            Text("Kumone", style = MaterialTheme.typography.headlineMedium)
            Text(
                "Native Android · Rust Core · Media3",
                style = MaterialTheme.typography.bodySmall,
            )
            Spacer(Modifier.height(12.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                OutlinedTextField(
                    value = query,
                    onValueChange = { query = it },
                    modifier = Modifier.weight(1f),
                    singleLine = true,
                    label = { Text("Search songs") },
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                    keyboardActions = KeyboardActions(onSearch = { search() }),
                )
                Button(onClick = { search() }, enabled = !loading && query.isNotBlank()) {
                    Text("Search")
                }
            }
            errorMessage?.let { message ->
                Text(
                    message,
                    color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.bodySmall,
                    modifier = Modifier.padding(vertical = 8.dp),
                )
            }
            if (loading) {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(12.dp),
                    horizontalArrangement = Arrangement.Center,
                ) {
                    CircularProgressIndicator()
                }
            } else if (songs.isNotEmpty()) {
                Text(
                    "$total results",
                    style = MaterialTheme.typography.labelMedium,
                    modifier = Modifier.padding(vertical = 8.dp),
                )
            }

            LazyColumn(modifier = Modifier.weight(1f)) {
                items(songs, key = { it.id }) { track ->
                    SongRow(track = track) {
                        val mediaController = controller
                        if (mediaController == null) {
                            errorMessage = "Playback service is still connecting"
                            return@SongRow
                        }
                        scope.launch {
                            loading = true
                            errorMessage = null
                            runCatching {
                                val playback = repository.resolvePlayback(track.id)
                                val metadata = MediaMetadata.Builder()
                                    .setTitle(track.name)
                                    .setArtist(track.artistNames)
                                    .setAlbumTitle(track.albumName)
                                    .apply {
                                        track.albumPicUrl?.let { setArtworkUri(Uri.parse(it)) }
                                    }
                                    .build()
                                mediaController.setMediaItem(
                                    MediaItem.Builder()
                                        .setMediaId(track.id.toString())
                                        .setUri(playback.url)
                                        .setMediaMetadata(metadata)
                                        .build(),
                                )
                                mediaController.prepare()
                                mediaController.play()
                                nowPlaying = track
                                positionMs = 0L
                                lyrics = runCatching { repository.lyrics(track.id) }.getOrNull()
                            }.onFailure {
                                errorMessage = it.message ?: "Unable to play this track"
                            }
                            loading = false
                        }
                    }
                    HorizontalDivider()
                }
            }

            nowPlaying?.let { track ->
                NowPlayingCard(
                    track = track,
                    lyrics = lyrics,
                    positionMs = positionMs,
                    isPlaying = controller?.isPlaying == true,
                    onToggle = {
                        controller?.let { player ->
                            if (player.isPlaying) player.pause() else player.play()
                        }
                    },
                    onSeek = { value -> controller?.seekTo(value) },
                )
                Spacer(Modifier.height(8.dp))
            }
        }
    }
}

@Composable
private fun SongRow(track: FfiSearchTrack, onClick: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(vertical = 12.dp, horizontal = 4.dp),
    ) {
        Text(track.name, style = MaterialTheme.typography.titleMedium)
        Text(
            listOf(track.artistNames, track.albumName)
                .filter(String::isNotBlank)
                .joinToString(" · "),
            style = MaterialTheme.typography.bodySmall,
        )
        track.subtitle?.takeIf(String::isNotBlank)?.let {
            Text(it, style = MaterialTheme.typography.labelSmall)
        }
    }
}

@Composable
private fun NowPlayingCard(
    track: FfiSearchTrack,
    lyrics: LyricsPage?,
    positionMs: Long,
    isPlaying: Boolean,
    onToggle: () -> Unit,
    onSeek: (Long) -> Unit,
) {
    val duration = track.durationMs.coerceAtLeast(1L)
    val activeLine = activeLyricLine(lyrics?.lines.orEmpty(), positionMs)

    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(14.dp)) {
            Text(track.name, style = MaterialTheme.typography.titleMedium)
            Text(track.artistNames, style = MaterialTheme.typography.bodySmall)
            activeLine?.let { line ->
                Spacer(Modifier.height(8.dp))
                Text(line.text, fontWeight = FontWeight.SemiBold)
                line.translation?.takeIf(String::isNotBlank)?.let {
                    Text(it, style = MaterialTheme.typography.bodySmall)
                }
            }
            Slider(
                value = (positionMs.toFloat() / duration.toFloat()).coerceIn(0f, 1f),
                onValueChange = { fraction -> onSeek((fraction * duration).toLong()) },
            )
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text("${formatTime(positionMs)} / ${formatTime(duration)}")
                TextButton(onClick = onToggle) {
                    Text(if (isPlaying) "Pause" else "Play")
                }
            }
        }
    }
}

private fun activeLyricLine(lines: List<FfiLyricLine>, positionMs: Long): FfiLyricLine? =
    lines.lastOrNull { it.timeMs <= positionMs }

private fun formatTime(milliseconds: Long): String {
    val totalSeconds = milliseconds.coerceAtLeast(0L) / 1000L
    return "%d:%02d".format(totalSeconds / 60L, totalSeconds % 60L)
}

@Composable
private fun rememberMediaController(): MediaController? {
    val context = LocalContext.current
    var controller by remember { mutableStateOf<MediaController?>(null) }

    DisposableEffect(context) {
        val token = SessionToken(context, ComponentName(context, PlaybackService::class.java))
        val future = MediaController.Builder(context, token).buildAsync()
        future.addListener(
            {
                runCatching { future.get() }.onSuccess { controller = it }
            },
            ContextCompat.getMainExecutor(context),
        )
        onDispose {
            controller?.release()
            controller = null
            future.cancel(true)
        }
    }
    return controller
}
