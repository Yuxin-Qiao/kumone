use kumone_core::crypto::{self, EapiForm, WeapiForm};

#[tauri::command]
fn netease_weapi(json_text: String) -> WeapiForm {
    crypto::weapi(&json_text)
}

#[tauri::command]
fn netease_eapi(api_path: String, json_text: String) -> EapiForm {
    crypto::eapi(&api_path, &json_text)
}

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![netease_weapi, netease_eapi])
        .run(tauri::generate_context!())
        .expect("failed to run Kumone Windows");
}
