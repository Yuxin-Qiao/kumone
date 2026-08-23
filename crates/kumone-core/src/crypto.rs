//! NetEase Cloud Music request encryption shared by Windows and Android.
//!
//! This module intentionally mirrors the upstream Swift implementation in
//! `Sources/Kumone/Core/API/NeteaseCrypto.swift`. The fixed vectors below are
//! compatibility gates: changing any byte is a downstream protocol break.

use aes::Aes128;
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
use cbc::Encryptor as CbcEncryptor;
use cipher::{BlockEncryptMut, KeyInit, KeyIvInit, block_padding::Pkcs7};
use ecb::Encryptor as EcbEncryptor;
use md5::{Digest, Md5};
use serde::{Deserialize, Serialize};

// Public NetEase wire-protocol constants, not app credentials. WEAPI_IV is
// intentionally fixed for protocol compatibility and must not be randomized.
const WEAPI_PRESET_KEY: &[u8; 16] = b"0CoJUm6Qyw8W8jud";
const WEAPI_IV: &[u8; 16] = b"0102030405060708";
const WEAPI_SECRET_KEY: &[u8; 16] = b"kumone2026abcDEF";
const WEAPI_ENC_SEC_KEY: &str = concat!(
    "38cef2efdbcc1cfd6a44d81620dae5d23091f50ef27e01a1b1bb7e998e0fde2d",
    "7ab6002a9e79a3c195f661cbde80e21e6245997b11b54d28407115822f95d447",
    "7cc06b5a77de46fab6568410abf1229abef81b4c8588f386149010d190bb0b04",
    "f064be330bd877a4d4b99514febbdb4335b10744b13d9f7ee24d314d6e62cdc9"
);
const EAPI_KEY: &[u8; 16] = b"e82ckenh8dichen8";

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct WeapiForm {
    pub params: String,
    #[serde(rename = "encSecKey")]
    pub enc_sec_key: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct EapiForm {
    pub params: String,
}

/// Encrypt a UTF-8 JSON payload for a `/weapi/...` endpoint.
#[must_use]
pub fn weapi(json_text: &str) -> WeapiForm {
    let first = encrypt_cbc(json_text.as_bytes(), WEAPI_PRESET_KEY, WEAPI_IV);
    let first_base64 = BASE64.encode(first);
    let second = encrypt_cbc(first_base64.as_bytes(), WEAPI_SECRET_KEY, WEAPI_IV);

    WeapiForm {
        params: BASE64.encode(second),
        enc_sec_key: WEAPI_ENC_SEC_KEY.to_owned(),
    }
}

/// Encrypt a UTF-8 JSON payload for an `/eapi/...` endpoint.
#[must_use]
pub fn eapi(api_path: &str, json_text: &str) -> EapiForm {
    let digest_input = format!("nobody{api_path}use{json_text}md5forencrypt");
    let digest = Md5::digest(digest_input.as_bytes());
    let digest_hex = hex::encode(digest);
    let message = format!("{api_path}-36cd479b6b5-{json_text}-36cd479b6b5-{digest_hex}");
    let encrypted = encrypt_ecb(message.as_bytes(), EAPI_KEY);

    EapiForm {
        params: hex::encode_upper(encrypted),
    }
}

fn encrypt_cbc(data: &[u8], key: &[u8; 16], iv: &[u8; 16]) -> Vec<u8> {
    CbcEncryptor::<Aes128>::new_from_slices(key, iv)
        .expect("AES-128 key and IV constants must remain 16 bytes")
        .encrypt_padded_vec_mut::<Pkcs7>(data)
}

fn encrypt_ecb(data: &[u8], key: &[u8; 16]) -> Vec<u8> {
    EcbEncryptor::<Aes128>::new_from_slice(key)
        .expect("AES-128 key constant must remain 16 bytes")
        .encrypt_padded_vec_mut::<Pkcs7>(data)
}

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE_JSON: &str = r#"{"ids":"[347230]","level":"standard"}"#;

    #[test]
    fn weapi_matches_existing_swift_and_node_vector() {
        let result = weapi(SAMPLE_JSON);
        assert_eq!(
            result.params,
            "isn5IRF2EcZHMA6I0M7V8NMu9NZhOwdwrGUA/akbGLbhLsijcD3FnYcErglcKFR4RI9arrEFmJfbrKVjqlVYtTTfArhs4lmexwaoxGLooR4="
        );
        assert_eq!(result.enc_sec_key, WEAPI_ENC_SEC_KEY);
    }

    #[test]
    fn eapi_matches_existing_swift_and_node_vector() {
        let result = eapi("/api/song/enhance/player/url/v1", SAMPLE_JSON);
        assert_eq!(
            result.params,
            "FA90B329E9614F79E79598F37DC2EDB487F00D1BC4C9B24CD57E6C318B9073569338432CD7D98D1A3626E997A2C53121C461EE0E88D3D1BF3F42E78643807A29B83D00D24CECA2C01F229A64E4D80CBB5EEF4A69DCB79E93C1D2301D38DAC26511D81BB3F926495784500B9A0C9F7DD47E1396F5D6B610C295193B8A1FCBA1AD"
        );
    }
}
