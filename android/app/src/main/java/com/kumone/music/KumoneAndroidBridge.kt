package com.kumone.music

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.widget.Toast
import com.kumone.music.crypto.NeteaseCrypto
import org.json.JSONObject

class KumoneAndroidBridge(
    private val activity: MainActivity,
    private val webView: WebView
) {
    private val prefs = activity.getSharedPreferences("kumone_prefs", Context.MODE_PRIVATE)

    @JavascriptInterface
    fun weapi(jsonText: String): String {
        val res = NeteaseCrypto.weapi(jsonText)
        val obj = JSONObject()
        obj.put("params", res["params"])
        obj.put("encSecKey", res["encSecKey"])
        return obj.toString()
    }

    @JavascriptInterface
    fun eapi(apiPath: String, jsonText: String): String {
        val res = NeteaseCrypto.eapi(apiPath, jsonText)
        val obj = JSONObject()
        obj.put("params", res["params"])
        return obj.toString()
    }

    @JavascriptInterface
    fun playAudio(url: String, trackJsonString: String, positionMs: Int) {
        activity.runOnUiThread {
            val trackObj = try { JSONObject(trackJsonString) } catch (_: Exception) { null }
            activity.playerService?.play(url, trackObj, positionMs)
        }
    }

    @JavascriptInterface
    fun pauseAudio() {
        activity.runOnUiThread {
            activity.playerService?.pause()
        }
    }

    @JavascriptInterface
    fun resumeAudio() {
        activity.runOnUiThread {
            activity.playerService?.resume()
        }
    }

    @JavascriptInterface
    fun seekAudio(positionMs: Int) {
        activity.runOnUiThread {
            activity.playerService?.seekTo(positionMs)
        }
    }

    @JavascriptInterface
    fun setAudioVolume(volume: Float) {
        activity.runOnUiThread {
            activity.playerService?.setVolume(volume)
        }
    }

    @JavascriptInterface
    fun getAudioPosition(): Int {
        return activity.playerService?.getPosition() ?: 0
    }

    @JavascriptInterface
    fun getAudioDuration(): Int {
        return activity.playerService?.getDuration() ?: 0
    }

    @JavascriptInterface
    fun isAudioPlaying(): Boolean {
        return activity.playerService?.isCurrentlyPlaying() ?: false
    }

    @JavascriptInterface
    fun toast(message: String) {
        activity.runOnUiThread {
            Toast.makeText(activity, message, Toast.LENGTH_SHORT).show()
        }
    }

    @JavascriptInterface
    fun copyToClipboard(text: String) {
        activity.runOnUiThread {
            val clipboard = activity.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
            val clip = ClipData.newPlainText("Kumone", text)
            clipboard.setPrimaryClip(clip)
            Toast.makeText(activity, "已复制到剪贴板", Toast.LENGTH_SHORT).show()
        }
    }

    @JavascriptInterface
    fun openExternal(url: String) {
        activity.runOnUiThread {
            try {
                val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                activity.startActivity(intent)
            } catch (e: Exception) {
                Toast.makeText(activity, "无法打开链接", Toast.LENGTH_SHORT).show()
            }
        }
    }

    @JavascriptInterface
    fun vibrate(durationMs: Long) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val vibratorManager = activity.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
                vibratorManager.defaultVibrator.vibrate(
                    VibrationEffect.createOneShot(durationMs, VibrationEffect.DEFAULT_AMPLITUDE)
                )
            } else {
                @Suppress("DEPRECATION")
                val vibrator = activity.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
                vibrator.vibrate(durationMs)
            }
        } catch (_: Exception) {}
    }

    @JavascriptInterface
    fun setPreference(key: String, value: String) {
        prefs.edit().putString(key, value).apply()
    }

    @JavascriptInterface
    fun getPreference(key: String, defaultValue: String): String {
        return prefs.getString(key, defaultValue) ?: defaultValue
    }

    @JavascriptInterface
    fun getAppVersion(): String {
        return "0.1.9"
    }

    fun dispatchProgress(isPlaying: Boolean, positionMs: Int, durationMs: Int) {
        activity.runOnUiThread {
            val script = "if(window.kumoneApp && window.kumoneApp.onNativePlaybackProgress) { window.kumoneApp.onNativePlaybackProgress($isPlaying, $positionMs, $durationMs); }"
            webView.evaluateJavascript(script, null)
        }
    }

    fun dispatchCompletion() {
        activity.runOnUiThread {
            val script = "if(window.kumoneApp && window.kumoneApp.onNativePlaybackComplete) { window.kumoneApp.onNativePlaybackComplete(); }"
            webView.evaluateJavascript(script, null)
        }
    }

    fun dispatchNext() {
        activity.runOnUiThread {
            val script = "if(window.kumoneApp && window.kumoneApp.onNativeNext) { window.kumoneApp.onNativeNext(); }"
            webView.evaluateJavascript(script, null)
        }
    }

    fun dispatchPrev() {
        activity.runOnUiThread {
            val script = "if(window.kumoneApp && window.kumoneApp.onNativePrev) { window.kumoneApp.onNativePrev(); }"
            webView.evaluateJavascript(script, null)
        }
    }
}
