use std::collections::BTreeMap;

use kumone_core::{
    crypto::{self, EapiForm, WeapiForm},
    netease::{
        EapiContext, RequestSpec, SessionCookies, build_eapi_request, build_weapi_request,
    },
};
use serde_json::Value;

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
        .invoke_handler(tauri::generate_handler![
            netease_weapi,
            netease_eapi,
            netease_build_weapi_request,
            netease_build_eapi_request,
        ])
        .run(tauri::generate_context!())
        .expect("failed to run Kumone Windows");
}
