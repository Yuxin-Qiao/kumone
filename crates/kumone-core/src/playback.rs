//! Shared NetEase playback URL request/response behavior.

use serde::{Deserialize, Serialize};
use serde_json::json;
use thiserror::Error;

use crate::netease::{
    EapiContext, RequestBuildError, RequestSpec, SessionCookies, build_eapi_request,
};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SongUrlData {
    pub id: i64,
    pub url: Option<String>,
    #[serde(default)]
    pub br: i64,
    #[serde(default)]
    pub size: i64,
    #[serde(rename = "type")]
    pub format: Option<String>,
    pub level: Option<String>,
    #[serde(default)]
    pub fee: i64,
    #[serde(default)]
    pub time: i64,
}

#[derive(Debug, Deserialize)]
struct SongUrlResponse {
    #[serde(default = "ok_code")]
    code: i64,
    #[serde(default)]
    data: Vec<SongUrlData>,
    message: Option<String>,
}

const fn ok_code() -> i64 {
    200
}

#[derive(Debug, Error, PartialEq, Eq)]
pub enum PlaybackDecodeError {
    #[error("failed to decode song URL response: {0}")]
    Decode(String),
    #[error("NetEase song URL request failed with code {code}: {message}")]
    Business { code: i64, message: String },
    #[error("NetEase returned no playback URL for track {0}")]
    NoPlayableUrl(i64),
}

pub fn build_song_url_request(
    ids: &[i64],
    level: &str,
    cookies: &SessionCookies,
    context: &EapiContext,
) -> Result<RequestSpec, RequestBuildError> {
    let ids = format!(
        "[{}]",
        ids.iter()
            .map(ToString::to_string)
            .collect::<Vec<_>>()
            .join(",")
    );
    let mut payload = json!({
        "ids": ids,
        "level": level,
        "encodeType": "flac"
    });
    if level == "sky" {
        payload["immerseType"] = json!("c51");
    }
    build_eapi_request("/song/enhance/player/url/v1", &payload, cookies, context)
}

pub fn decode_song_url_response(body: &str) -> Result<Vec<SongUrlData>, PlaybackDecodeError> {
    let response: SongUrlResponse = serde_json::from_str(body)
        .map_err(|error| PlaybackDecodeError::Decode(error.to_string()))?;
    if response.code != 200 {
        return Err(PlaybackDecodeError::Business {
            code: response.code,
            message: response.message.unwrap_or_default(),
        });
    }
    Ok(response.data)
}

pub fn first_playable_url(body: &str, track_id: i64) -> Result<SongUrlData, PlaybackDecodeError> {
    decode_song_url_response(body)?
        .into_iter()
        .find(|item| item.id == track_id && item.url.as_deref().is_some_and(|url| !url.is_empty()))
        .ok_or(PlaybackDecodeError::NoPlayableUrl(track_id))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn request_matches_upstream_song_url_contract() {
        let request = build_song_url_request(
            &[42],
            "lossless",
            &SessionCookies::default(),
            &EapiContext::new("12345678", "1777777777"),
        )
        .expect("request");
        assert_eq!(
            request.url,
            "https://interface.music.163.com/eapi/song/enhance/player/url/v1"
        );
        assert!(request.body.starts_with("params="));
    }

    #[test]
    fn decoder_preserves_playback_fields() {
        let data = decode_song_url_response(
            r#"{"code":200,"data":[{"id":42,"url":"https://audio","br":999000,"size":1234,"type":"flac","level":"lossless","fee":0,"time":180000}]}"#,
        )
        .expect("response");
        assert_eq!(data[0].id, 42);
        assert_eq!(data[0].url.as_deref(), Some("https://audio"));
        assert_eq!(data[0].level.as_deref(), Some("lossless"));
    }

    #[test]
    fn missing_url_is_explicit_error() {
        let error = first_playable_url(r#"{"code":200,"data":[{"id":42,"url":null}]}"#, 42)
            .expect_err("unplayable");
        assert_eq!(error, PlaybackDecodeError::NoPlayableUrl(42));
    }
}
