use std::{sync::OnceLock, time::Duration};

use kumone_core::unblock::{
    UnblockHttpRequest, UnblockTrack, decode_kugou_search_response, decode_kugou_track_response,
    decode_kuwo_convert_response, decode_kuwo_search_response, decode_pyncmd_response,
    kugou_search_request, kugou_track_request, kuwo_convert_request, kuwo_search_request,
    pyncmd_request,
};
use reqwest::Client;
use serde::Serialize;

static CLIENT: OnceLock<Client> = OnceLock::new();

fn client() -> &'static Client {
    CLIENT.get_or_init(|| {
        Client::builder()
            .timeout(Duration::from_secs(10))
            .build()
            .expect("failed to initialize unblock HTTP client")
    })
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UnblockResolution {
    pub url: String,
    pub source: String,
}

async fn get(request: UnblockHttpRequest) -> Option<String> {
    client()
        .get(request.url)
        .header("User-Agent", request.user_agent)
        .send()
        .await
        .ok()?
        .error_for_status()
        .ok()?
        .text()
        .await
        .ok()
}

#[tauri::command]
pub async fn netease_unblock_track(track: UnblockTrack) -> Option<UnblockResolution> {
    if let Some(body) = get(pyncmd_request(&track)).await
        && let Some(url) = decode_pyncmd_response(&body)
    {
        return Some(UnblockResolution {
            url,
            source: "pyncmd".to_owned(),
        });
    }

    if let Some(search_body) = get(kuwo_search_request(&track)).await
        && let Some(song) = decode_kuwo_search_response(&search_body, track.duration_ms)
        && let Some(convert_body) = get(kuwo_convert_request(&song.rid)).await
        && let Some(url) = decode_kuwo_convert_response(&convert_body)
    {
        return Some(UnblockResolution {
            url,
            source: "kuwo".to_owned(),
        });
    }

    if let Some(search_body) = get(kugou_search_request(&track)).await
        && let Some(song) = decode_kugou_search_response(&search_body, track.duration_ms)
        && let Some(track_body) = get(kugou_track_request(&song)).await
        && let Some(url) = decode_kugou_track_response(&track_body)
    {
        return Some(UnblockResolution {
            url,
            source: "kugou".to_owned(),
        });
    }

    None
}
