# Maintainers

This document lists the maintainers and key contributors for the **Kumone** project.

## Project Maintainers

| Name | Role | GitHub | Contact |
| :--- | :--- | :--- | :--- |
| **Yuxin Qiao** | Maintainer (Windows, Linux & Web/PWA) | [@Yuxin-Qiao](https://github.com/Yuxin-Qiao) | [qiaoyuxin123@gmail.com](mailto:qiaoyuxin123@gmail.com) |
| **ksingir** | Maintainer | [@ksingir](https://github.com/ksingir) | [ksingir](https://github.com/ksingir) |
| **Vincent Young (missuo)** | Original Author & macOS Core Maintainer | [@missuo](https://github.com/missuo) | [missuo](https://github.com/missuo) |

---

## Areas of Responsibility

- **Apple clients (macOS / iOS / iPadOS)**: upstream-owned SwiftUI implementation; downstream does not maintain a separate iOS release pipeline.
- **Windows & Linux desktop**: shared downstream Tauri 2 + Rust desktop shell in `apps/windows/src-tauri/`; the historical Electron desktop tree is retired.
- **Android client**: downstream Jetpack Compose + Media3 + Rust/UniFFI implementation in `apps/android/`.
- **Shared Rust core & protocol contracts**: `crates/`, `contracts/` and the UniFFI boundary.
- **Web / PWA / Docker Client**: upstream-aligned Web implementation plus downstream contract tests and Tauri bridge.
- **CI/CD, compatibility feedback & upstream synchronization**: GitHub Actions, structured Issue triage, compatibility reporting and exact-source release automation.
