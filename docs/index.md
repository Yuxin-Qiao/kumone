# Kumone downstream documentation

Kumone is maintained as an automated downstream of `missuo/kumone`. The downstream owns the shared Rust core and the Windows, Linux, Android and Web/PWA adaptation/release layers while Apple/iOS implementation remains upstream-owned.

## Start here

- [Downstream architecture](architecture/downstream-refactor.md)
- [Shared cross-platform contracts](architecture/shared-contracts.md)
- [Autonomous upstream maintenance](automation/upstream-maintenance.md)
- [Free OSS infrastructure](automation/free-oss-infrastructure.md)
- [Community compatibility](compatibility.md)
- [Android release signing](release/android-signing.md)

The automation is intentionally fail-closed: deterministic CI and security gates may merge routine upstream/dependency maintenance, while ambiguous changes stop and surface an incident instead of guessing.
