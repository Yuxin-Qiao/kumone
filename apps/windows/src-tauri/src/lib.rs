mod unblock;

use std::{
    collections::BTreeMap,
    sync::Mutex,
    time::{Duration, SystemTime, UNIX_EPOCH},
};

use kumone_core::{
    account::{
        PlaylistSummary, QrLoginState, UserProfile, build_daily_songs_request,
        build_personalized_playlists_request, build_playlist_detail_request,
        build_qr_check_request, build_qr_key_request, build_recommend_resource_request,
        build_user_account_request, build_user_playlists_request, decode_daily_songs_response,
        decode_personalized_playlists_response, decode_playlist_detail_response,
        decode_qr_check_response, decode_qr_key_response, decode_recommend_resource_response,
        decode_user_account_response, decode_user_playlists_response, qr_login_url,
    },
    crypto::{self, EapiForm, WeapiForm},
    lyrics::{LyricLine, build_lyric_request, decode_lyrics_response},
    netease::{
        EapiContext, RequestSpec, SessionCookies, build_eapi_request, build_weapi_request,
    },
    playback::{SongUrlData, build_song_url_request, first_playable_url},
    search::{SearchTrack, SongSearchResult, build_song_search_request, decode_song_search_response},
};
use reqwest::{Client, Method, header::SET_COOKIE};
use serde::Serialize;
use serde_json::Value;
use tauri::State;

struct AppState {
    client: Client,
    cookies: Mutex<SessionCookies>,
}

impl AppState {
    fn new() -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(20))
            .user_agent("Kumone/0.1")
            .build()
            .expect("failed to initialize HTTP client");
        Self {
            client,
            cookies: Mutex::new(SessionCookies::default()),
        }
    }

    fn snapshot(&self) -> Result<SessionCookies, String> {
        self.cookies
            .lock()
            .map(|cookies| cookies.clone())
            .map_err(|_| "session lock poisoned".to_owned())
    }

    fn replace(&self, cookies: SessionCookies) -> Result<(), String> {
        *self
            .cookies
            .lock()
            .map_err(|_| "session lock poisoned".to_owned())? = cookies;
        Ok(())
    }

    fn ingest_set_cookie(&self, raw: &str) -> Result<(), String> {
        self.cookies
            .lock()
            .map_err(|_| "session lock poisoned".to_owned())?
            .ingest_cookie_string(raw);
        Ok(())
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct QrBeginResult {
    key: String,
    url: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct QrStatusResult {
    code: i64,
    state: String,
    message: Option<String>,
    nickname: Option<String>,
    avatar_url: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct LyricLineView {
    time_ms: u64,
    text: String,
    translation: Option<String>,
    romaji: Option<String>,
}

impl From<LyricLine> for LyricLineView {
    fn from(value: LyricLine) -> Self {
        Self {
            time_ms: value.time_ms,
            text: value.text,
            translation: value.translation,
            romaji: value.romaji,
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct LyricsView {
    lines: Vec<LyricLineView>,
    is_instrumental: bool,
    contributor: Option<String>,
    translation_contributor: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct PlaylistDetailView {
    summary: PlaylistSummary,
    tracks: Vec<SearchTrack>,
}

fn request_context() -> EapiContext {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    let millis = now.as_millis();
    EapiContext::new(
        format!("{:08}", millis % 100_000_000),
        now.as_secs().to_string(),
    )
}

async fn execute(state: &AppState, request: RequestSpec) -> Result<String, String> {
    let method = Method::from_bytes(request.method.as_bytes())
        .map_err(|error| format!("invalid HTTP method: {error}"))?;
    let mut builder = state.client.request(method, &request.url);
    for (name, value) in request.headers {
        builder = builder.header(name, value);
    }
    if !request.body.is_empty() {
        builder = builder.body(request.body);
    }

    let response = builder
        .send()
        .await
        .map_err(|error| format!("NetEase request failed: {error}"))?;
    let status = response.status();
    let set_cookies = response
        .headers()
        .get_all(SET_COOKIE)
        .iter()
        .filter_map(|value| value.to_str().ok())
        .collect::<Vec<_>>()
        .join(";;");
    if !set_cookies.is_empty() {
        state.ingest_set_cookie(&set_cookies)?;
    }
    let body = response
        .text()
        .await
        .map_err(|error| format!("failed to read NetEase response: {error}"))?;
    if !status.is_success() {
        return Err(format!(
            "NetEase HTTP {status}: {}",
            body.chars().take(240).collect::<String>()
        ));
    }
    Ok(body)
}

#[tauri::command]
fn session_import(state: State<'_, AppState>, values: BTreeMap<String, String>) -> Result<(), String> {
    let mut cookies = SessionCookies::default();
    cookies.extend(values);
    state.replace(cookies)
}

#[tauri::command]
fn session_export(state: State<'_, AppState>) -> Result<BTreeMap<String, String>, String> {
    Ok(state.snapshot()?.into_values())
}

#[tauri::command]
fn session_is_logged_in(state: State<'_, AppState>) -> Result<bool, String> {
    Ok(state.snapshot()?.is_logged_in())
}

#[tauri::command]
fn session_logout(state: State<'_, AppState>) -> Result<BTreeMap<String, String>, String> {
    let mut cookies = state.snapshot()?;
    cookies.clear_auth();
    let output = cookies.clone().into_values();
    state.replace(cookies)?;
    Ok(output)
}

#[tauri::command]
async fn netease_search_songs(
    state: State<'_, AppState>,
    keywords: String,
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<SongSearchResult, String> {
    let cookies = state.snapshot()?;
    let request = build_song_search_request(
        keywords.trim(),
        limit.unwrap_or(30),
        offset.unwrap_or(0),
        &cookies,
        &request_context(),
    )
    .map_err(|error| error.to_string())?;
    let body = execute(&state, request).await?;
    decode_song_search_response(&body).map_err(|error| error.to_string())
}

#[tauri::command]
async fn netease_resolve_playback(
    state: State<'_, AppState>,
    track_id: i64,
    level: Option<String>,
) -> Result<SongUrlData, String> {
    let cookies = state.snapshot()?;
    let level = level.unwrap_or_else(|| "standard".to_owned());
    let request = build_song_url_request(&[track_id], &level, &cookies, &request_context())
        .map_err(|error| error.to_string())?;
    let body = execute(&state, request).await?;
    first_playable_url(&body, track_id).map_err(|error| error.to_string())
}

#[tauri::command]
async fn netease_lyrics(state: State<'_, AppState>, track_id: i64) -> Result<LyricsView, String> {
    let request =
        build_lyric_request(track_id, &state.snapshot()?).map_err(|error| error.to_string())?;
    let body = execute(&state, request).await?;
    let lyrics = decode_lyrics_response(&body).map_err(|error| error.to_string())?;
    Ok(LyricsView {
        lines: lyrics.lines.into_iter().map(Into::into).collect(),
        is_instrumental: lyrics.is_instrumental,
        contributor: lyrics.contributor,
        translation_contributor: lyrics.translation_contributor,
    })
}

#[tauri::command]
async fn netease_qr_begin(state: State<'_, AppState>) -> Result<QrBeginResult, String> {
    let request = build_qr_key_request(&state.snapshot()?).map_err(|error| error.to_string())?;
    let body = execute(&state, request).await?;
    let key = decode_qr_key_response(&body).map_err(|error| error.to_string())?;
    Ok(QrBeginResult {
        url: qr_login_url(&key),
        key,
    })
}

#[tauri::command]
async fn netease_qr_check(
    state: State<'_, AppState>,
    key: String,
) -> Result<QrStatusResult, String> {
    let request = build_qr_check_request(&key, &state.snapshot()?)
        .map_err(|error| error.to_string())?;
    let body = execute(&state, request).await?;
    let result = decode_qr_check_response(&body).map_err(|error| error.to_string())?;
    let state_name = match result.state {
        QrLoginState::Expired => "expired".to_owned(),
        QrLoginState::Waiting => "waiting".to_owned(),
        QrLoginState::Scanned => "scanned".to_owned(),
        QrLoginState::Success => "success".to_owned(),
        QrLoginState::Other(code) => format!("other:{code}"),
    };
    Ok(QrStatusResult {
        code: result.code,
        state: state_name,
        message: result.message,
        nickname: result.nickname,
        avatar_url: result.avatar_url,
    })
}

#[tauri::command]
async fn netease_account(state: State<'_, AppState>) -> Result<Option<UserProfile>, String> {
    let request =
        build_user_account_request(&state.snapshot()?).map_err(|error| error.to_string())?;
    let body = execute(&state, request).await?;
    decode_user_account_response(&body).map_err(|error| error.to_string())
}

#[tauri::command]
async fn netease_user_playlists(
    state: State<'_, AppState>,
    uid: i64,
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<Vec<PlaylistSummary>, String> {
    let request = build_user_playlists_request(
        uid,
        limit.unwrap_or(100),
        offset.unwrap_or(0),
        &state.snapshot()?,
    )
    .map_err(|error| error.to_string())?;
    let body = execute(&state, request).await?;
    decode_user_playlists_response(&body).map_err(|error| error.to_string())
}

#[tauri::command]
async fn netease_personalized_playlists(
    state: State<'_, AppState>,
    limit: Option<i64>,
) -> Result<Vec<PlaylistSummary>, String> {
    let request = build_personalized_playlists_request(limit.unwrap_or(12), &state.snapshot()?)
        .map_err(|error| error.to_string())?;
    let body = execute(&state, request).await?;
    decode_personalized_playlists_response(&body).map_err(|error| error.to_string())
}

#[tauri::command]
async fn netease_recommended_playlists(
    state: State<'_, AppState>,
) -> Result<Vec<PlaylistSummary>, String> {
    let request = build_recommend_resource_request(&state.snapshot()?)
        .map_err(|error| error.to_string())?;
    let body = execute(&state, request).await?;
    decode_recommend_resource_response(&body).map_err(|error| error.to_string())
}

#[tauri::command]
async fn netease_daily_songs(state: State<'_, AppState>) -> Result<Vec<SearchTrack>, String> {
    let request =
        build_daily_songs_request(&state.snapshot()?).map_err(|error| error.to_string())?;
    let body = execute(&state, request).await?;
    decode_daily_songs_response(&body).map_err(|error| error.to_string())
}

#[tauri::command]
async fn netease_playlist_detail(
    state: State<'_, AppState>,
    id: i64,
) -> Result<PlaylistDetailView, String> {
    let request =
        build_playlist_detail_request(id, &state.snapshot()?).map_err(|error| error.to_string())?;
    let body = execute(&state, request).await?;
    let detail = decode_playlist_detail_response(&body).map_err(|error| error.to_string())?;
    Ok(PlaylistDetailView {
        summary: detail.summary,
        tracks: detail.tracks,
    })
}

// Temporary low-level compatibility commands. They keep the existing web UI
// runnable while the renderer migrates to the business commands above.
#[tauri::command]
fn netease_weapi(json_text: String) -> WeapiForm {
    crypto::weapi(&json_text)
}

#[tauri::command]
fn netease_eapi(api_path: String, json_text: String) -> EapiForm {
    crypto::eapi(&api_path, &json_text)
}

fn session_cookies(values: BTreeMap<String, String>) -> SessionCookies {
    let mut cookies = SessionCookies::default();
    cookies.extend(values);
    cookies
}

#[tauri::command]
fn netease_build_weapi_request(
    path: String,
    payload: Value,
    cookies: BTreeMap<String, String>,
) -> Result<RequestSpec, String> {
    build_weapi_request(&path, &payload, &session_cookies(cookies)).map_err(|error| error.to_string())
}

#[tauri::command]
fn netease_build_eapi_request(
    path: String,
    payload: Value,
    cookies: BTreeMap<String, String>,
    request_id: String,
    build_version: String,
) -> Result<RequestSpec, String> {
    let context = EapiContext::new(request_id, build_version);
    build_eapi_request(&path, &payload, &session_cookies(cookies), &context)
        .map_err(|error| error.to_string())
}

pub fn run() {
    tauri::Builder::default()
        .manage(AppState::new())
        .invoke_handler(tauri::generate_handler![
            session_import,
            session_export,
            session_is_logged_in,
            session_logout,
            netease_search_songs,
            netease_resolve_playback,
            netease_lyrics,
            netease_qr_begin,
            netease_qr_check,
            netease_account,
            netease_user_playlists,
            netease_personalized_playlists,
            netease_recommended_playlists,
            netease_daily_songs,
            netease_playlist_detail,
            unblock::netease_unblock_track,
            netease_weapi,
            netease_eapi,
            netease_build_weapi_request,
            netease_build_eapi_request,
        ])
        .run(tauri::generate_context!())
        .expect("failed to run Kumone Windows");
}
