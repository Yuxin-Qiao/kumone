package com.kumone.music.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.media.MediaPlayer
import android.os.Binder
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.support.v4.media.MediaMetadataCompat
import android.support.v4.media.session.MediaSessionCompat
import android.support.v4.media.session.PlaybackStateCompat
import androidx.core.app.NotificationCompat
import androidx.media.app.NotificationCompat.MediaStyle
import com.kumone.music.MainActivity
import com.kumone.music.R
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

class AudioPlayerService : Service(), MediaPlayer.OnPreparedListener,
    MediaPlayer.OnCompletionListener, MediaPlayer.OnErrorListener {

    private val binder = LocalBinder()
    private var mediaPlayer: MediaPlayer? = null
    private var mediaSession: MediaSessionCompat? = null
    private var audioManager: AudioManager? = null
    private var audioFocusRequest: AudioFocusRequest? = null
    private var wakeLock: PowerManager.WakeLock? = null

    private var currentUrl: String? = null
    private var currentTrack: JSONObject? = null
    private var currentCoverBitmap: Bitmap? = null
    private var isPlaying = false
    private var isPrepared = false

    private val handler = Handler(Looper.getMainLooper())
    private val executor = Executors.newSingleThreadExecutor()

    var onStateChangedListener: ((isPlaying: Boolean, positionMs: Int, durationMs: Int) -> Unit)? = null
    var onCompletionListener: (() -> Unit)? = null
    var onNextListener: (() -> Unit)? = null
    var onPrevListener: (() -> Unit)? = null

    private val becomingNoisyReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action == AudioManager.ACTION_AUDIO_BECOMING_NOISY) {
                pause()
            }
        }
    }

    private val progressRunnable = object : Runnable {
        override fun run() {
            if (isPlaying && isPrepared && mediaPlayer != null) {
                try {
                    val pos = mediaPlayer?.currentPosition ?: 0
                    val dur = mediaPlayer?.duration ?: 0
                    onStateChangedListener?.invoke(true, pos, dur)
                } catch (_: Exception) {}
            }
            handler.postDelayed(this, 500)
        }
    }

    inner class LocalBinder : Binder() {
        fun getService(): AudioPlayerService = this@AudioPlayerService
    }

    override fun onBind(intent: Intent?): IBinder = binder

    override fun onCreate() {
        super.onCreate()
        audioManager = getSystemService(Context.AUDIO_SERVICE) as AudioManager
        createNotificationChannel()
        setupMediaSession()

        val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Kumone:AudioPlayback")

        val filter = IntentFilter(AudioManager.ACTION_AUDIO_BECOMING_NOISY)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(becomingNoisyReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            registerReceiver(becomingNoisyReceiver, filter)
        }

        handler.post(progressRunnable)
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                getString(R.string.notification_channel_name),
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = getString(R.string.notification_channel_desc)
                setShowBadge(false)
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager?.createNotificationChannel(channel)
        }
    }

    private fun setupMediaSession() {
        mediaSession = MediaSessionCompat(this, "KumoneMediaSession").apply {
            setCallback(object : MediaSessionCompat.Callback() {
                override fun onPlay() { resume() }
                override fun onPause() { pause() }
                override fun onSkipToNext() { onNextListener?.invoke() }
                override fun onSkipToPrevious() { onPrevListener?.invoke() }
                override fun onSeekTo(pos: Long) { seekTo(pos.toInt()) }
                override fun onStop() { pause() }
            })
            isActive = true
        }
    }

    fun play(url: String, trackJson: JSONObject?, startPositionMs: Int = 0) {
        currentUrl = url
        currentTrack = trackJson
        isPrepared = false

        fetchCoverBitmap(trackJson?.optString("picUrl"))

        try {
            if (mediaPlayer == null) {
                mediaPlayer = MediaPlayer().apply {
                    setAudioAttributes(
                        AudioAttributes.Builder()
                            .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                            .setUsage(AudioAttributes.USAGE_MEDIA)
                            .build()
                    )
                    setOnPreparedListener(this@AudioPlayerService)
                    setOnCompletionListener(this@AudioPlayerService)
                    setOnErrorListener(this@AudioPlayerService)
                }
            } else {
                mediaPlayer?.reset()
            }

            requestAudioFocus()
            mediaPlayer?.setDataSource(url)
            mediaPlayer?.prepareAsync()

            wakeLock?.acquire(10 * 60 * 1000L)
            updateNotification()
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    fun pause() {
        if (mediaPlayer != null && isPlaying) {
            mediaPlayer?.pause()
            isPlaying = false
            updateMediaSessionState()
            updateNotification()
            val pos = mediaPlayer?.currentPosition ?: 0
            val dur = mediaPlayer?.duration ?: 0
            onStateChangedListener?.invoke(false, pos, dur)
        }
    }

    fun resume() {
        if (mediaPlayer != null && !isPlaying && isPrepared) {
            requestAudioFocus()
            mediaPlayer?.start()
            isPlaying = true
            updateMediaSessionState()
            updateNotification()
            val pos = mediaPlayer?.currentPosition ?: 0
            val dur = mediaPlayer?.duration ?: 0
            onStateChangedListener?.invoke(true, pos, dur)
        }
    }

    fun seekTo(positionMs: Int) {
        if (mediaPlayer != null && isPrepared) {
            mediaPlayer?.seekTo(positionMs)
            updateMediaSessionState()
        }
    }

    fun setVolume(volume: Float) {
        mediaPlayer?.setVolume(volume, volume)
    }

    fun getPosition(): Int = if (isPrepared) mediaPlayer?.currentPosition ?: 0 else 0
    fun getDuration(): Int = if (isPrepared) mediaPlayer?.duration ?: 0 else 0
    fun isCurrentlyPlaying(): Boolean = isPlaying

    override fun onPrepared(mp: MediaPlayer?) {
        isPrepared = true
        mp?.start()
        isPlaying = true
        updateMediaSessionMetadata()
        updateMediaSessionState()
        updateNotification()
        val dur = mp?.duration ?: 0
        onStateChangedListener?.invoke(true, 0, dur)
    }

    override fun onCompletion(mp: MediaPlayer?) {
        isPlaying = false
        updateMediaSessionState()
        updateNotification()
        onCompletionListener?.invoke()
    }

    override fun onError(mp: MediaPlayer?, what: Int, extra: Int): Boolean {
        isPlaying = false
        isPrepared = false
        updateMediaSessionState()
        updateNotification()
        return false
    }

    private fun requestAudioFocus(): Boolean {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            audioFocusRequest = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
                .setAudioAttributes(
                    AudioAttributes.Builder()
                        .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                        .setUsage(AudioAttributes.USAGE_MEDIA)
                        .build()
                )
                .setOnAudioFocusChangeListener { focusChange ->
                    when (focusChange) {
                        AudioManager.AUDIOFOCUS_LOSS -> pause()
                        AudioManager.AUDIOFOCUS_LOSS_TRANSIENT -> pause()
                        AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK -> mediaPlayer?.setVolume(0.2f, 0.2f)
                        AudioManager.AUDIOFOCUS_GAIN -> {
                            mediaPlayer?.setVolume(1.0f, 1.0f)
                            resume()
                        }
                    }
                }
                .build()
            return audioManager?.requestAudioFocus(audioFocusRequest!!) == AudioManager.AUDIOFOCUS_REQUEST_GRANTED
        } else {
            @Suppress("DEPRECATION")
            return audioManager?.requestAudioFocus(
                { focusChange ->
                    when (focusChange) {
                        AudioManager.AUDIOFOCUS_LOSS, AudioManager.AUDIOFOCUS_LOSS_TRANSIENT -> pause()
                        AudioManager.AUDIOFOCUS_GAIN -> resume()
                    }
                },
                AudioManager.STREAM_MUSIC,
                AudioManager.AUDIOFOCUS_GAIN
            ) == AudioManager.AUDIOFOCUS_REQUEST_GRANTED
        }
    }

    private fun fetchCoverBitmap(picUrl: String?) {
        if (picUrl.isNullOrEmpty()) {
            currentCoverBitmap = null
            return
        }
        executor.execute {
            try {
                val url = URL(picUrl + "?param=300y300")
                val connection = url.openConnection() as HttpURLConnection
                connection.connectTimeout = 5000
                connection.readTimeout = 5000
                connection.doInput = true
                connection.connect()
                val input = connection.inputStream
                currentCoverBitmap = BitmapFactory.decodeStream(input)
                handler.post {
                    updateMediaSessionMetadata()
                    updateNotification()
                }
            } catch (_: Exception) {
                currentCoverBitmap = null
            }
        }
    }

    private fun updateMediaSessionMetadata() {
        val title = currentTrack?.optString("name") ?: "Kumone"
        val artist = currentTrack?.optJSONArray("artists")?.let { arr ->
            val list = mutableListOf<String>()
            for (i in 0 until arr.length()) {
                list.add(arr.getJSONObject(i).optString("name"))
            }
            list.joinToString(", ")
        } ?: currentTrack?.optString("artist") ?: ""
        val album = currentTrack?.optJSONObject("album")?.optString("name") ?: ""

        val metadataBuilder = MediaMetadataCompat.Builder()
            .putString(MediaMetadataCompat.METADATA_KEY_TITLE, title)
            .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, artist)
            .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, album)
            .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, (mediaPlayer?.duration ?: 0).toLong())

        currentCoverBitmap?.let {
            metadataBuilder.putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, it)
        }

        mediaSession?.setMetadata(metadataBuilder.build())
    }

    private fun updateMediaSessionState() {
        val state = if (isPlaying) PlaybackStateCompat.STATE_PLAYING else PlaybackStateCompat.STATE_PAUSED
        val position = mediaPlayer?.currentPosition?.toLong() ?: 0L
        val playbackState = PlaybackStateCompat.Builder()
            .setActions(
                PlaybackStateCompat.ACTION_PLAY or
                PlaybackStateCompat.ACTION_PAUSE or
                PlaybackStateCompat.ACTION_PLAY_PAUSE or
                PlaybackStateCompat.ACTION_SKIP_TO_NEXT or
                PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS or
                PlaybackStateCompat.ACTION_SEEK_TO
            )
            .setState(state, position, 1.0f)
            .build()

        mediaSession?.setPlaybackState(playbackState)
    }

    private fun updateNotification() {
        if (currentTrack == null && currentUrl == null) {
            stopForeground(STOP_FOREGROUND_REMOVE)
            return
        }

        val title = currentTrack?.optString("name") ?: "Kumone"
        val artist = currentTrack?.optJSONArray("artists")?.let { arr ->
            val list = mutableListOf<String>()
            for (i in 0 until arr.length()) {
                list.add(arr.getJSONObject(i).optString("name"))
            }
            list.joinToString(", ")
        } ?: currentTrack?.optString("artist") ?: ""

        val activityIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        val contentPendingIntent = PendingIntent.getActivity(
            this, 0, activityIntent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val prevIntent = Intent(this, AudioPlayerService::class.java).apply { action = ACTION_PREV }
        val prevPendingIntent = PendingIntent.getService(this, 1, prevIntent, PendingIntent.FLAG_IMMUTABLE)

        val playIntent = Intent(this, AudioPlayerService::class.java).apply { action = ACTION_TOGGLE_PLAY }
        val playPendingIntent = PendingIntent.getService(this, 2, playIntent, PendingIntent.FLAG_IMMUTABLE)

        val nextIntent = Intent(this, AudioPlayerService::class.java).apply { action = ACTION_NEXT }
        val nextPendingIntent = PendingIntent.getService(this, 3, nextIntent, PendingIntent.FLAG_IMMUTABLE)

        val playPauseIcon = if (isPlaying) R.drawable.ic_pause else R.drawable.ic_play
        val playPauseTitle = if (isPlaying) getString(R.string.pause) else getString(R.string.play)

        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(artist)
            .setSmallIcon(R.drawable.ic_stat_music)
            .setLargeIcon(currentCoverBitmap)
            .setContentIntent(contentPendingIntent)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .addAction(R.drawable.ic_prev, getString(R.string.prev), prevPendingIntent)
            .addAction(playPauseIcon, playPauseTitle, playPendingIntent)
            .addAction(R.drawable.ic_next, getString(R.string.next), nextPendingIntent)
            .setStyle(
                MediaStyle()
                    .setMediaSession(mediaSession?.sessionToken)
                    .setShowActionsInCompactView(0, 1, 2)
            )
            .setOngoing(isPlaying)
            .build()

        startForeground(NOTIFICATION_ID, notification)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_TOGGLE_PLAY -> {
                if (isPlaying) pause() else resume()
            }
            ACTION_NEXT -> onNextListener?.invoke()
            ACTION_PREV -> onPrevListener?.invoke()
        }
        return START_NOT_STICKY
    }

    override fun onDestroy() {
        handler.removeCallbacks(progressRunnable)
        try {
            unregisterReceiver(becomingNoisyReceiver)
        } catch (_: Exception) {}

        wakeLock?.let {
            if (it.isHeld) it.release()
        }

        mediaPlayer?.release()
        mediaPlayer = null
        mediaSession?.release()
        mediaSession = null
        executor.shutdown()
        super.onDestroy()
    }

    companion object {
        const val CHANNEL_ID = "kumone_playback_channel"
        const val NOTIFICATION_ID = 1001
        const val ACTION_TOGGLE_PLAY = "com.kumone.music.TOGGLE_PLAY"
        const val ACTION_NEXT = "com.kumone.music.NEXT"
        const val ACTION_PREV = "com.kumone.music.PREV"
    }
}
