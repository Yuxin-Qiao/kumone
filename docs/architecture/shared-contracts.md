# Shared Contracts and Platform Boundaries

Kumone intentionally shares protocol and domain behavior without forcing every UI or media stack into one implementation language.

## Downstream ownership

- `crates/kumone-core`: platform-neutral NetEase protocol, crypto, account/session semantics, search, lyrics, queue, playback state and unblock behavior.
- `crates/kumone-ffi`: UniFFI boundary used by Android and available to additional downstream clients.
- `apps/windows/src-tauri`: shared Tauri desktop shell used for Windows and Linux packaging.
- `apps/android`: Android-native Jetpack Compose / Media3 UI and playback integration.
- `web`: Web/PWA UI and browser transport.

## Upstream-owned Apple code

macOS and iOS/iPadOS remain upstream-aligned Swift code. Downstream automation must not rewrite Apple platform UI or playback layers merely to increase Rust usage. This keeps upstream merges tractable.

## What must stay shared

The following semantics belong in `kumone-core` for downstream native clients:

- NetEase `weapi` / `eapi` crypto and request construction
- cookie and account/session semantics
- search request/response semantics
- LRC, translation and romaji parsing
- playback queue/state transitions
- gray-track / unblock behavior
- stable error classification for authentication, QR expiry, rate limits,
  region restrictions, external challenges and unplayable URLs
- UI state, package-budget, diagnostics and update metadata contracts in
  `contracts/`

Platform-native media engines remain native: AVPlayer on Apple platforms, Media3 on Android, and the appropriate Web/Tauri integration for Web/desktop.

## Contract fixtures

`contracts/` contains language-neutral fixtures for behavior that still has multiple implementations. `contracts/crypto-vectors.json` is consumed by both Rust tests and Web smoke tests, so protocol changes cannot silently diverge between those implementations.

Add new fixtures when a behavior is duplicated across implementation boundaries. Prefer moving reusable downstream logic into `kumone-core` over adding more duplicate fixtures.

Desktop session cookies are persisted only inside the platform app-data
directory.  Diagnostics exports are local, redacted and never uploaded by
default.  Update manifests carry HTTPS URLs and SHA-256 digests; missing
trusted signatures fail closed and disable automatic installation.

## CI policy

Every pull request to `main` must pass:

1. Rust format, clippy and workspace tests.
2. Shared contract vectors.
3. Web/PWA smoke tests.
4. Windows Tauri validation.
5. Linux Tauri package validation.
6. Android Rust/UniFFI, lint and package validation.
7. Downstream version-consistency checks.

Real-device testing is community feedback after publication, not a maintainer-side release gate.
