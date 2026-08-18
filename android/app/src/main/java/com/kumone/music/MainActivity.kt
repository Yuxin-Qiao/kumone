package com.kumone.music

import android.Manifest
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.os.IBinder
import android.view.View
import android.webkit.ConsoleMessage
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.core.view.WindowCompat
import com.kumone.music.service.AudioPlayerService

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var bridge: KumoneAndroidBridge

    var playerService: AudioPlayerService? = null
    private var isServiceBound = false

    private val serviceConnection = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName?, service: IBinder?) {
            val binder = service as AudioPlayerService.LocalBinder
            playerService = binder.getService().apply {
                onStateChangedListener = { isPlaying, pos, dur ->
                    bridge.dispatchProgress(isPlaying, pos, dur)
                }
                onCompletionListener = {
                    bridge.dispatchCompletion()
                }
                onNextListener = {
                    bridge.dispatchNext()
                }
                onPrevListener = {
                    bridge.dispatchPrev()
                }
            }
            isServiceBound = true
        }

        override fun onServiceDisconnected(name: ComponentName?) {
            playerService = null
            isServiceBound = false
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, true)

        setContentView(R.layout.activity_main)

        checkNotificationPermission()
        bindAudioService()
        setupWebView()
        setupBackPressed()
    }

    private fun checkNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(
                    this,
                    arrayOf(Manifest.permission.POST_NOTIFICATIONS),
                    101
                )
            }
        }
    }

    private fun bindAudioService() {
        val serviceIntent = Intent(this, AudioPlayerService::class.java)
        startService(serviceIntent)
        bindService(serviceIntent, serviceConnection, Context.BIND_AUTO_CREATE)
    }

    private fun setupWebView() {
        webView = findViewById(R.id.web_view)
        bridge = KumoneAndroidBridge(this, webView)

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            mediaPlaybackRequiresUserGesture = false
            allowFileAccess = true
            allowContentAccess = true
            cacheMode = WebSettings.LOAD_DEFAULT
            mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            useWideViewPort = true
            loadWithOverviewMode = true
        }

        webView.isVerticalScrollBarEnabled = false
        webView.isHorizontalScrollBarEnabled = false
        webView.overScrollMode = View.OVER_SCROLL_NEVER

        webView.addJavascriptInterface(bridge, "AndroidBridge")

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val url = request?.url?.toString() ?: return false
                if (url.startsWith("http://") || url.startsWith("https://")) {
                    if (!url.contains("163.com") && !url.contains("126.net") && !url.contains("music")) {
                        bridge.openExternal(url)
                        return true
                    }
                }
                return false
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onConsoleMessage(consoleMessage: ConsoleMessage?): Boolean {
                return super.onConsoleMessage(consoleMessage)
            }
        }

        webView.loadUrl("file:///android_asset/web/index.html")
    }

    private fun setupBackPressed() {
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                webView.evaluateJavascript("if(window.kumoneApp && window.kumoneApp.handleBack) { window.kumoneApp.handleBack(); } else { 'default'; }") { result ->
                    val handled = result?.replace("\"", "") == "handled"
                    if (!handled) {
                        moveTaskToBack(true)
                    }
                }
            }
        })
    }

    override fun onDestroy() {
        bridge.destroy()
        if (isServiceBound) {
            unbindService(serviceConnection)
            isServiceBound = false
        }
        webView.destroy()
        super.onDestroy()
    }
}
