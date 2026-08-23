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

// These are public NetEase protocol constants, not application credentials or
// secret key material. In particular, WEAPI_IV is fixed by the wire protocol;
// randomizing it would make requests incompatible with NetEase and upstream.
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

pub fn weapi(payload: &str) -> WeapiForm {
    let first = aes_cbc_encrypt(payload.as_bytes(), WEAPI_PRESET_KEY, WEAPI_IV);
    let first_b64 = BASE64.encode(first);
    let second = aes_cbc_encrypt(first_b64.as_bytes(), WEAPI_SECRET_KEY, WEAPI_IV);

    WeapiForm {
        params: BASE64.encode(second),
        enc_sec_key: WEAPI_ENC_SEC_KEY.to_string(),
    }
}

pub fn eapi(path: &str, payload: &str) -> EapiForm {
    let message = format!("nobody{path}use{payload}md5forencrypt");
    let digest = hex::encode(Md5::digest(message.as_bytes()));
    let data = format!("{path}-36cd479b6b5-{payload}-36cd479b6b5-{digest}");
    let encrypted = aes_ecb_encrypt(data.as_bytes(), EAPI_KEY);

    EapiForm {
        params: hex::encode_upper(encrypted),
    }
}

fn aes_cbc_encrypt(input: &[u8], key: &[u8; 16], iv: &[u8; 16]) -> Vec<u8> {
    let mut buffer = vec![0u8; input.len() + 16];
    buffer[..input.len()].copy_from_slice(input);
    CbcEncryptor::<Aes128>::new(key.into(), iv.into())
        .encrypt_padded_mut::<Pkcs7>(&mut buffer, input.len())
        .expect("AES CBC buffer is sized for PKCS#7 padding")
        .to_vec()
}

fn aes_ecb_encrypt(input: &[u8], key: &[u8; 16]) -> Vec<u8> {
    let mut buffer = vec![0u8; input.len() + 16];
    buffer[..input.len()].copy_from_slice(input);
    EcbEncryptor::<Aes128>::new(key.into())
        .encrypt_padded_mut::<Pkcs7>(&mut buffer, input.len())
        .expect("AES ECB buffer is sized for PKCS#7 padding")
        .to_vec()
}

#[cfg(test)]
mod tests {
    use super::{eapi, weapi};

    #[test]
    fn weapi_matches_existing_swift_and_node_vector() {
        let form = weapi(r#"{"s":"hello","type":1,"limit":30,"offset":0}"#);

        assert_eq!(
            form.params,
            "2JfcHa/FiktsfKnTJCNM5m2wPYR7n+G3H7XO0wF3jIlbSNJm3AXRE2bmS5xQj8VdcU0mB9EiO8i58rAfvSAnNg=="
        );
        assert_eq!(
            form.enc_sec_key,
            concat!(
                "38cef2efdbcc1cfd6a44d81620dae5d23091f50ef27e01a1b1bb7e998e0fde2d",
                "7ab6002a9e79a3c195f661cbde80e21e6245997b11b54d28407115822f95d447",
                "7cc06b5a77de46fab6568410abf1229abef81b4c8588f386149010d190bb0b04",
                "f064be330bd877a4d4b99514febbdb4335b10744b13d9f7ee24d314d6e62cdc9"
            )
        );
    }

    #[test]
    fn eapi_matches_existing_swift_and_node_vector() {
        let form = eapi(
            "/api/song/enhance/player/url/v1",
            r#"{"ids":"[347230]","level":"exhigh","encodeType":"flac"}"#,
        );

        assert_eq!(
            form.params,
            "779B79A1802E97CED506CE4222082100BCFEA4DDC1B8E7487B7FE17DC99B134784F1828534AE752AF2BFF720DB35C41F8903903FD20F9DD9DC9F30FAE9B4B8E6210BD21762770721A9028461F00B9279052615E518234182166A8D2472BB8D7E4394F1530FA332DFE65FCB0E6C37079151742652623661036622C409E668B3DB488F4F9F8EA3B3BD1E21CB797785129722D166FB50F0753C8646316952774FE7BC4D1A51FC84A1E4689F41BD514AE8B"
        );
    }
}
