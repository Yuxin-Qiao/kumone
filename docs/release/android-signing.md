# Android release signing

Kumone downstream Android releases are signed through GitHub Actions secrets. The private keystore must never be committed to this repository.

## Signing identity

- Alias: `kumone-release`
- Algorithm: RSA 4096 / SHA256withRSA
- Certificate validity: 2026-08-23 through 2126-07-30
- Certificate SHA-256 fingerprint: `BC:AF:88:AC:DB:9F:17:6C:EE:66:C5:35:0B:B7:51:07:36:5E:B6:5C:40:CE:D8:3A:6B:AA:A9:30:C4:47:3A:88`

Keep the release keystore and its credentials in a secure backup. Do not rotate this key casually: direct APK updates must continue to use the same signing identity, and Play-distributed builds should use the corresponding Google Play App Signing/update-key process.

## Required GitHub Actions secrets

`release-downstream.yml` expects:

```text
ANDROID_KEYSTORE_BASE64
ANDROID_KEYSTORE_PASSWORD
ANDROID_KEY_ALIAS
ANDROID_KEY_PASSWORD
```

`ANDROID_KEYSTORE_BASE64` is the base64-encoded private keystore. The workflow decodes it only on the ephemeral GitHub-hosted release runner and uses it to sign both APK and AAB outputs.

Never add the keystore, its Base64 representation, or any signing password to Git history, issues, pull-request comments, workflow logs, or release assets.
