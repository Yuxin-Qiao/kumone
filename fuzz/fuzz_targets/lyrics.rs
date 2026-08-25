#![no_main]

use libfuzzer_sys::fuzz_target;

fuzz_target!(|data: &[u8]| {
    let text = String::from_utf8_lossy(data);
    let _ = kumone_core::lyrics::parse_lrc(&text);
    let _ = kumone_core::lyrics::decode_lyrics_response(&text);
});
