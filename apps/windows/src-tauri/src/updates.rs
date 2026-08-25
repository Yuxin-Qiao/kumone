//! GitHub Release update metadata for Windows/Linux Tauri builds.
//!
//! The release workflow always publishes checksums.  Automatic installation is
//! deliberately disabled until a trusted Tauri updater signature/public key is
//! configured; an unsigned manifest is never treated as an installable update.

use reqwest::Client;
use serde::Serialize;
use serde_json::Value;
use std::time::Duration;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCheck {
    pub status: String,
    pub version: Option<String>,
    pub url: Option<String>,
    pub install_enabled: bool,
    pub reason: Option<String>,
}

#[tauri::command]
pub async fn check_for_update() -> Result<UpdateCheck, String> {
    let client = Client::builder()
        .timeout(Duration::from_secs(10))
        .user_agent("Kumone updater metadata")
        .build()
        .map_err(|error| format!("updater client: {error}"))?;
    let release_body = client
        .get("https://api.github.com/repos/Yuxin-Qiao/kumone/releases/latest")
        .send()
        .await
        .map_err(|error| format!("updater request: {error}"))?
        .error_for_status()
        .map_err(|error| format!("updater HTTP: {error}"))?
        .text()
        .await
        .map_err(|error| format!("updater decode: {error}"))?;
    let release: Value = serde_json::from_str(&release_body)
        .map_err(|error| format!("updater JSON: {error}"))?;

    let version = release
        .get("tag_name")
        .and_then(Value::as_str)
        .map(|tag| tag.trim_start_matches("downstream-v").to_owned());
    let url = release
        .get("html_url")
        .and_then(Value::as_str)
        .map(str::to_owned);
    let manifest_url = release
        .get("assets")
        .and_then(Value::as_array)
        .and_then(|assets| {
            assets.iter().find_map(|asset| {
                (asset.get("name").and_then(Value::as_str) == Some("latest.json"))
                    .then(|| asset.get("browser_download_url").and_then(Value::as_str))
                    .flatten()
            })
        });

    let Some(manifest_url) = manifest_url else {
        return Ok(UpdateCheck {
            status: "disabled".to_owned(),
            version,
            url,
            install_enabled: false,
            reason: Some("release has no update manifest".to_owned()),
        });
    };

    let manifest_body = client
        .get(manifest_url)
        .send()
        .await
        .map_err(|error| format!("manifest request: {error}"))?
        .error_for_status()
        .map_err(|error| format!("manifest HTTP: {error}"))?
        .text()
        .await
        .map_err(|error| format!("manifest decode: {error}"))?;
    let manifest: Value = serde_json::from_str(&manifest_body)
        .map_err(|error| format!("manifest JSON: {error}"))?;
    let signed = manifest.get("signed").and_then(Value::as_bool).unwrap_or(false);
    let public_key_id = manifest
        .get("public_key_id")
        .and_then(Value::as_str)
        .is_some_and(|value| !value.is_empty());
    let assets_signed = manifest
        .get("assets")
        .and_then(Value::as_array)
        .is_some_and(|assets| {
            !assets.is_empty()
                && assets.iter().all(|asset| {
                    let https = asset
                        .get("url")
                        .and_then(Value::as_str)
                        .is_some_and(|value| value.starts_with("https://"));
                    let checksum = asset
                        .get("sha256")
                        .and_then(Value::as_str)
                        .is_some_and(|value| {
                            value.len() == 64 && value.chars().all(|character| character.is_ascii_hexdigit())
                        });
                    let signature = asset
                        .get("signature")
                        .and_then(Value::as_str)
                        .is_some_and(|value| !value.is_empty());
                    https && checksum && signature
                })
        });
    if !signed || !public_key_id || !assets_signed {
        return Ok(UpdateCheck {
            status: "disabled".to_owned(),
            version,
            url,
            install_enabled: false,
            reason: Some("update manifest is not signed; automatic installation is disabled".to_owned()),
        });
    }

    Ok(UpdateCheck {
        status: "available".to_owned(),
        version,
        url,
        install_enabled: false,
        reason: Some("signature is present; Tauri installer wiring remains opt-in until a public key is configured".to_owned()),
    })
}
