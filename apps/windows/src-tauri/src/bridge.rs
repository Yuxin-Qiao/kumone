use tauri::{App, Manager, Wry};

/// Injects the Windows-only bridge after the static Web UI has loaded.
///
/// The browser/PWA build never sees this code. Tauri evaluates the same small
/// adapter that redirects stabilized NetEase operations to Rust commands and
/// wires Media Session controls for Windows/WebView2.
pub fn install(app: &mut App<Wry>) -> Result<(), Box<dyn std::error::Error>> {
    let webview = app
        .get_webview_window("main")
        .ok_or("main webview was not created")?;
    let bridge = include_str!("../../../../web/lib/tauri-bridge.js");
    let script = format!(
        "window.addEventListener('DOMContentLoaded', () => {{\n{bridge}\n}}, {{ once: true }});"
    );
    webview.eval(&script)?;
    Ok(())
}
