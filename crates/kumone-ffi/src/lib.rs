//! Stable foreign-function boundary for Kumone platform apps.
//!
//! Keep this crate deliberately thin: domain and protocol behavior belongs in
//! `kumone-core`; this crate only converts UniFFI-friendly values to and from
//! core types.

use std::collections::HashMap;

use kumone_core::{
    netease::{
        EapiContext, RequestBuildError, RequestSpec, SessionCookies,
        build_eapi_request as core_build_eapi_request,
        build_weapi_request as core_build_weapi_request,
    },
    search::{
        SearchTrack, build_song_search_request as core_build_song_search_request,
        decode_song_search_response as core_decode_song_search_response,
    },
};
use serde_json::Value;

uniffi::setup_scaffolding!();

#[derive(Debug, Clone, uniffi::Record)]
pub struct FfiRequestSpec {
    pub method: String,
    pub url: String,
    pub headers: HashMap<String, String>,
    pub body: String,
}

impl From<RequestSpec> for FfiRequestSpec {
    fn from(value: RequestSpec) -> Self {
        Self {
            method: value.method,
            url: value.url,
            headers: value.headers.into_iter().collect(),
            body: value.body,
        }
    }
}

#[derive(Debug, Clone, uniffi::Record)]
pub struct FfiRequestResult {
    pub request: Option<FfiRequestSpec>,
    pub error: Option<String>,
}

impl FfiRequestResult {
    fn success(request: RequestSpec) -> Self {
        Self {
            request: Some(request.into()),
            error: None,
        }
    }

    fn failure(error: impl ToString) -> Self {
        Self {
            request: None,
            error: Some(error.to_string()),
        }
    }
}

#[derive(Debug, Clone, uniffi::Record)]
pub struct FfiSearchTrack {
    pub id: i64,
    pub name: String,
    pub artist_names: String,
    pub album_name: String,
    pub album_pic_url: Option<String>,
    pub duration_ms: i64,
    pub subtitle: Option<String>,
}

impl From<SearchTrack> for FfiSearchTrack {
    fn from(value: SearchTrack) -> Self {
        let artist_names = value.artist_names();
        let subtitle = value.subtitle().map(str::to_owned);
        Self {
            id: value.id,
            name: value.name,
            artist_names,
            album_name: value.album.name,
            album_pic_url: value.album.pic_url,
            duration_ms: value.duration_ms,
            subtitle,
        }
    }
}

#[derive(Debug, Clone, uniffi::Record)]
pub struct FfiSongSearchResult {
    pub songs: Vec<FfiSearchTrack>,
    pub total: i64,
    pub error: Option<String>,
}

impl FfiSongSearchResult {
    fn failure(error: impl ToString) -> Self {
        Self {
            songs: Vec::new(),
            total: 0,
            error: Some(error.to_string()),
        }
    }
}

fn session_cookies(values: HashMap<String, String>) -> SessionCookies {
    let mut cookies = SessionCookies::default();
    cookies.extend(values);
    cookies
}

fn parse_payload(payload_json: &str) -> Result<Value, String> {
    serde_json::from_str(payload_json).map_err(|error| format!("invalid JSON payload: {error}"))
}

fn request_result(result: Result<RequestSpec, RequestBuildError>) -> FfiRequestResult {
    match result {
        Ok(request) => FfiRequestResult::success(request),
        Err(error) => FfiRequestResult::failure(error),
    }
}

#[uniffi::export]
pub fn build_weapi_request(
    path: String,
    payload_json: String,
    cookies: HashMap<String, String>,
) -> FfiRequestResult {
    let payload = match parse_payload(&payload_json) {
        Ok(payload) => payload,
        Err(error) => return FfiRequestResult::failure(error),
    };
    request_result(core_build_weapi_request(
        &path,
        &payload,
        &session_cookies(cookies),
    ))
}

#[uniffi::export]
pub fn build_eapi_request(
    path: String,
    payload_json: String,
    cookies: HashMap<String, String>,
    request_id: String,
    build_version: String,
) -> FfiRequestResult {
    let payload = match parse_payload(&payload_json) {
        Ok(payload) => payload,
        Err(error) => return FfiRequestResult::failure(error),
    };
    let context = EapiContext::new(request_id, build_version);
    request_result(core_build_eapi_request(
        &path,
        &payload,
        &session_cookies(cookies),
        &context,
    ))
}

#[uniffi::export]
pub fn build_song_search_request(
    keywords: String,
    limit: i64,
    offset: i64,
    cookies: HashMap<String, String>,
    request_id: String,
    build_version: String,
) -> FfiRequestResult {
    let context = EapiContext::new(request_id, build_version);
    request_result(core_build_song_search_request(
        &keywords,
        limit,
        offset,
        &session_cookies(cookies),
        &context,
    ))
}

#[uniffi::export]
pub fn decode_song_search_response(body: String) -> FfiSongSearchResult {
    match core_decode_song_search_response(&body) {
        Ok(result) => FfiSongSearchResult {
            songs: result.songs.into_iter().map(Into::into).collect(),
            total: result.total,
            error: None,
        },
        Err(error) => FfiSongSearchResult::failure(error),
    }
}

#[uniffi::export]
pub fn ingest_cookie_string(
    cookies: HashMap<String, String>,
    raw: String,
) -> HashMap<String, String> {
    let mut session = session_cookies(cookies);
    session.ingest_cookie_string(&raw);
    session.into_values().into_iter().collect()
}

#[uniffi::export]
pub fn is_logged_in(cookies: HashMap<String, String>) -> bool {
    session_cookies(cookies).is_logged_in()
}

#[uniffi::export]
pub fn clear_auth_cookies(cookies: HashMap<String, String>) -> HashMap<String, String> {
    let mut session = session_cookies(cookies);
    session.clear_auth();
    session.into_values().into_iter().collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ffi_request_builder_delegates_to_core() {
        let mut cookies = HashMap::new();
        cookies.insert("__csrf".to_owned(), "csrf-token".to_owned());

        let result = build_weapi_request(
            "/search/get".to_owned(),
            r#"{"s":"Kumone"}"#.to_owned(),
            cookies,
        );

        let request = result.request.expect("valid request");
        assert_eq!(
            request.url,
            "https://music.163.com/weapi/search/get?csrf_token=csrf-token"
        );
        assert!(result.error.is_none());
    }

    #[test]
    fn ffi_reports_invalid_json_without_panicking() {
        let result = build_weapi_request("/search/get".to_owned(), "{".to_owned(), HashMap::new());

        assert!(result.request.is_none());
        assert!(
            result
                .error
                .as_deref()
                .is_some_and(|error| error.contains("invalid JSON"))
        );
    }

    #[test]
    fn ffi_search_exposes_ui_stable_track_fields() {
        let result = decode_song_search_response(
            r#"{
                "code": 200,
                "result": {
                    "songCount": 1,
                    "songs": [{
                        "id": 42,
                        "name": "Kumone",
                        "ar": [{"id": 1, "name": "Artist"}],
                        "al": {"id": 2, "name": "Album", "picUrl": "https://img"},
                        "dt": 123000,
                        "tns": ["Translation"]
                    }]
                }
            }"#
            .to_owned(),
        );

        assert!(result.error.is_none());
        assert_eq!(result.total, 1);
        assert_eq!(result.songs[0].id, 42);
        assert_eq!(result.songs[0].artist_names, "Artist");
        assert_eq!(result.songs[0].subtitle.as_deref(), Some("Translation"));
    }

    #[test]
    fn ffi_cookie_helpers_preserve_complete_cookie_jar() {
        let cookies = ingest_cookie_string(
            HashMap::new(),
            "MUSIC_U=token; Path=/;; __csrf=csrf; Secure;; NMTID=device-cookie; HttpOnly"
                .to_owned(),
        );
        assert!(is_logged_in(cookies.clone()));
        assert_eq!(
            cookies.get("NMTID").map(String::as_str),
            Some("device-cookie")
        );

        let cleared = clear_auth_cookies(cookies);
        assert!(!is_logged_in(cleared.clone()));
        assert_eq!(
            cleared.get("NMTID").map(String::as_str),
            Some("device-cookie")
        );
    }
}
