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
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.nio.charset.StandardCharsets

class KumoneAndroidBridge(
    private val activity: MainActivity,
    private val webView: WebView
) {
    private val prefs = activity.getSharedPreferences("kumone_prefs", Context.MODE_PRIVATE)
    private val bridgeScope = CoroutineScope(Dispatchers.IO + SupervisorJob())

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

    // MARK: - Native HTTP Transport Layer

    @JavascriptInterface
    fun asyncHttpRequest(reqId: String, url: String, method: String, headersJson: String, body: String) {
        bridgeScope.launch {
            try {
                val responseObj = executeHttp(url, method, headersJson, body)
                val responseJsonString = responseObj.toString()
                activity.runOnUiThread {
                    val script = "if (window.__nativeHttpCallback) { window.__nativeHttpCallback('$reqId', null, $responseJsonString); }"
                    webView.evaluateJavascript(script, null)
                }
            } catch (e: Exception) {
                val errorMsg = e.message ?: "网络请求异常"
                val escapedErr = JSONObject.quote(errorMsg)
                activity.runOnUiThread {
                    val script = "if (window.__nativeHttpCallback) { window.__nativeHttpCallback('$reqId', $escapedErr, null); }"
                    webView.evaluateJavascript(script, null)
                }
            }
        }
    }

    @JavascriptInterface
    fun httpRequest(url: String, method: String, headersJson: String, body: String): String {
        return try {
            executeHttp(url, method, headersJson, body).toString()
        } catch (e: Exception) {
            val errObj = JSONObject()
            errObj.put("status", 0)
            errObj.put("ok", false)
            errObj.put("error", e.message ?: "网络请求异常")
            errObj.put("data", "")
            errObj.put("cookies", JSONArray())
            errObj.toString()
        }
    }

    private fun executeHttp(urlStr: String, method: String, headersJson: String, bodyStr: String): JSONObject {
        val url = URL(urlStr)
        val conn = (url.openConnection() as HttpURLConnection).apply {
            requestMethod = method.uppercase()
            connectTimeout = 15000
            readTimeout = 15000
            instanceFollowRedirects = true
            doInput = true
        }

        // Apply custom headers
        if (headersJson.isNotEmpty()) {
            try {
                val headersObj = JSONObject(headersJson)
                val keys = headersObj.keys()
                while (keys.hasNext()) {
                    val k = keys.next()
                    val v = headersObj.optString(k, "")
                    if (k.isNotEmpty() && v.isNotEmpty()) {
                        conn.setRequestProperty(k, v)
                    }
                }
            } catch (_: Exception) {}
        }

        // Default User-Agent and Referer if not specified
        if (conn.getRequestProperty("User-Agent") == null) {
            conn.setRequestProperty(
                "User-Agent",
                "Mozilla/5.0 (Linux; Android 14; Mobile; rv:125.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36"
            )
        }
        if (conn.getRequestProperty("Referer") == null && urlStr.contains("163.com")) {
            conn.setRequestProperty("Referer", "https://music.163.com")
        }

        // Send request payload if POST/PUT
        if (method.equals("POST", ignoreCase = true) || method.equals("PUT", ignoreCase = true)) {
            conn.doOutput = true
            val bytes = bodyStr.toByteArray(StandardCharsets.UTF_8)
            conn.outputStream.use { os ->
                os.write(bytes)
                os.flush()
            }
        }

        val statusCode = conn.responseCode
        val isSuccess = statusCode in 200..299
        val inputStream = if (isSuccess) conn.inputStream else (conn.errorStream ?: conn.inputStream)
        val responseBytes = inputStream?.use { it.readBytes() } ?: ByteArray(0)
        val responseText = String(responseBytes, StandardCharsets.UTF_8)

        // Capture all Set-Cookie headers
        val setCookieList = mutableListOf<String>()
        val headerFields = conn.headerFields
        for ((key, values) in headerFields) {
            if (key != null && key.equals("Set-Cookie", ignoreCase = true)) {
                for (v in values) {
                    if (!v.isNullOrBlank()) setCookieList.add(v)
                }
            }
        }

        // Persist cookies to SharedPreferences
        if (setCookieList.isNotEmpty()) {
            absorbSetCookies(setCookieList)
        }

        val result = JSONObject()
        result.put("status", statusCode)
        result.put("ok", isSuccess)
        result.put("data", responseText)
        val cookiesArray = JSONArray()
        for (c in setCookieList) {
            cookiesArray.put(c)
        }
        result.put("cookies", cookiesArray)
        return result
    }

    private fun absorbSetCookies(setCookies: List<String>) {
        val currentCookiesJson = prefs.getString("kumone_cookies", "{}") ?: "{}"
        val cookieMap = try {
            val obj = JSONObject(currentCookiesJson)
            val map = mutableMapOf<String, String>()
            val it = obj.keys()
            while (it.hasNext()) {
                val k = it.next()
                map[k] = obj.optString(k)
            }
            map
        } catch (_: Exception) {
            mutableMapOf<String, String>()
        }

        var changed = false
        for (cookie in setCookies) {
            val pair = cookie.split(";")[0]
            val eq = pair.indexOf("=")
            if (eq > 0) {
                val name = pair.substring(0, eq).trim()
                val value = pair.substring(eq + 1).trim()
                if (name.isNotEmpty() && value.isNotEmpty() && value != "\"\"") {
                    cookieMap[name] = value
                    changed = true
                }
            }
        }

        if (changed) {
            val newJson = JSONObject(cookieMap as Map<*, *>).toString()
            prefs.edit().putString("kumone_cookies", newJson).apply()
        }
    }

    // MARK: - Audio Player Controls

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

    // MARK: - UI & Device Services

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
                val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                }
                activity.startActivity(intent)
            } catch (e: Exception) {
                Toast.makeText(activity, "无法打开链接", Toast.LENGTH_SHORT).show()
            }
        }
    }

    @JavascriptInterface
    fun openNeteaseApp(unikey: String): Boolean {
        return try {
            val orpheusUri = Uri.parse("orpheus://login?codekey=$unikey")
            val intent = Intent(Intent.ACTION_VIEW, orpheusUri).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            activity.startActivity(intent)
            true
        } catch (e: Exception) {
            try {
                val fallbackUri = Uri.parse("https://music.163.com/login?codekey=$unikey")
                val fallbackIntent = Intent(Intent.ACTION_VIEW, fallbackUri).apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                }
                activity.startActivity(fallbackIntent)
                true
            } catch (err: Exception) {
                activity.runOnUiThread {
                    Toast.makeText(activity, "未检测到网易云音乐 App 或无法唤起", Toast.LENGTH_SHORT).show()
                }
                false
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

    fun destroy() {
        bridgeScope.cancel()
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
