package com.kumone.music.crypto

import android.util.Base64
import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import javax.crypto.Cipher
import javax.crypto.spec.IvParameterSpec
import javax.crypto.spec.SecretKeySpec

object NeteaseCrypto {
    private const val WEAPI_PRESET_KEY = "0CoJUm6Qyw8W8jud"
    private const val WEAPI_IV = "0102030405060708"
    private const val WEAPI_SECRET_KEY = "kumone2026abcDEF"
    const val WEAPI_ENC_SEC_KEY =
        "38cef2efdbcc1cfd6a44d81620dae5d23091f50ef27e01a1b1bb7e998e0fde2d" +
        "7ab6002a9e79a3c195f661cbde80e21e6245997b11b54d28407115822f95d447" +
        "7cc06b5a77de46fab6568410abf1229abef81b4c8588f386149010d190bb0b04" +
        "f064be330bd877a4d4b99514febbdb4335b10744b13d9f7ee24d314d6e62cdc9"
    private const val EAPI_KEY = "e82ckenh8dichen8"

    private fun aesCbcEncrypt(data: ByteArray, key: String, iv: String): ByteArray {
        val cipher = Cipher.getInstance("AES/CBC/PKCS5Padding")
        val keySpec = SecretKeySpec(key.toByteArray(StandardCharsets.UTF_8), "AES")
        val ivSpec = IvParameterSpec(iv.toByteArray(StandardCharsets.UTF_8))
        cipher.init(Cipher.ENCRYPT_MODE, keySpec, ivSpec)
        return cipher.doFinal(data)
    }

    private fun aesEcbEncrypt(data: ByteArray, key: String): ByteArray {
        val cipher = Cipher.getInstance("AES/ECB/PKCS5Padding")
        val keySpec = SecretKeySpec(key.toByteArray(StandardCharsets.UTF_8), "AES")
        cipher.init(Cipher.ENCRYPT_MODE, keySpec)
        return cipher.doFinal(data)
    }

    private fun md5Hex(input: String): String {
        val md = MessageDigest.getInstance("MD5")
        val digest = md.digest(input.toByteArray(StandardCharsets.UTF_8))
        val sb = StringBuilder()
        for (b in digest) {
            sb.append(String.format("%02x", b.toInt() and 0xff))
        }
        return sb.toString()
    }

    fun weapi(jsonText: String): Map<String, String> {
        val first = aesCbcEncrypt(jsonText.toByteArray(StandardCharsets.UTF_8), WEAPI_PRESET_KEY, WEAPI_IV)
        val firstB64 = Base64.encodeToString(first, Base64.NO_WRAP)
        val second = aesCbcEncrypt(firstB64.toByteArray(StandardCharsets.UTF_8), WEAPI_SECRET_KEY, WEAPI_IV)
        val params = Base64.encodeToString(second, Base64.NO_WRAP)
        return mapOf(
            "params" to params,
            "encSecKey" to WEAPI_ENC_SEC_KEY
        )
    }

    fun eapi(apiPath: String, jsonText: String): Map<String, String> {
        val message = "nobody${apiPath}use${jsonText}md5forencrypt"
        val digest = md5Hex(message)
        val data = "$apiPath-36cd479b6b5-$jsonText-36cd479b6b5-$digest"
        val enc = aesEcbEncrypt(data.toByteArray(StandardCharsets.UTF_8), EAPI_KEY)
        val sb = StringBuilder()
        for (b in enc) {
            sb.append(String.format("%02X", b.toInt() and 0xff))
        }
        return mapOf("params" to sb.toString())
    }
}
