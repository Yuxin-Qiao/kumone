#!/usr/bin/env bash
set -euo pipefail

EXPECTED_KEYSTORE_SHA256="679cd8d890491caa93c96e8672699e6083c228e1c5087309432442375c370d9b"
EXPECTED_CERT_SHA256="BCAF88ACDB9F176CEE66C5350BB75107365EB65C40CED83A6BAAA930C4473A88"

for name in ANDROID_KEYSTORE_BASE64 ANDROID_KEYSTORE_PASSWORD ANDROID_KEY_ALIAS ANDROID_KEY_PASSWORD; do
  if [[ -z "${!name:-}" ]]; then
    echo "::error::$name is required for an installable, update-stable Android release"
    exit 1
  fi
done

normalize_scalar() {
  local name="$1"
  local value="$2"
  value="$(printf '%s' "$value" | tr -d '\r\n')"
  value="${value#${name}=}"
  value="${value#\"}"
  value="${value%\"}"
  printf '%s' "$value"
}

raw_b64="$ANDROID_KEYSTORE_BASE64"
if printf '%s\n' "$raw_b64" | grep -q 'ANDROID_KEYSTORE_BASE64='; then
  clean_b64="$(printf '%s\n' "$raw_b64" | sed -n 's/^[[:space:]]*ANDROID_KEYSTORE_BASE64=//p' | head -n 1)"
else
  clean_b64="$raw_b64"
fi
clean_b64="$(printf '%s' "$clean_b64" | tr -d '[:space:]')"
clean_b64="${clean_b64#\`}"
clean_b64="${clean_b64%\`}"
clean_b64="${clean_b64#\"}"
clean_b64="${clean_b64%\"}"

store_pass="$(normalize_scalar ANDROID_KEYSTORE_PASSWORD "$ANDROID_KEYSTORE_PASSWORD")"
key_alias="$(normalize_scalar ANDROID_KEY_ALIAS "$ANDROID_KEY_ALIAS")"
key_pass="$(normalize_scalar ANDROID_KEY_PASSWORD "$ANDROID_KEY_PASSWORD")"

[[ -n "$clean_b64" && -n "$store_pass" && -n "$key_alias" && -n "$key_pass" ]]

echo "::add-mask::$store_pass"
echo "::add-mask::$key_pass"

runner_temp="${RUNNER_TEMP:-/tmp}"
keystore="$runner_temp/kumone-release.jks"
printf '%s' "$clean_b64" | base64 --decode --ignore-garbage > "$keystore"
test -s "$keystore"

actual_keystore_sha256="$(sha256sum "$keystore" | awk '{print $1}')"
if [[ "$actual_keystore_sha256" != "$EXPECTED_KEYSTORE_SHA256" ]]; then
  echo "::error::Decoded keystore does not match the pinned Kumone release keystore"
  exit 1
fi

actual_cert_sha256="$(keytool -list -v -storetype JKS -keystore "$keystore" -storepass "$store_pass" -alias "$key_alias" 2>/dev/null | sed -n 's/^[[:space:]]*SHA256: //p' | head -n 1 | tr -d ':' | tr '[:lower:]' '[:upper:]')"
if [[ "$actual_cert_sha256" != "$EXPECTED_CERT_SHA256" ]]; then
  echo "::error::Android signing certificate fingerprint does not match the pinned Kumone release identity"
  exit 1
fi

if [[ -n "${GITHUB_ENV:-}" ]]; then
  {
    echo "ANDROID_KEYSTORE_PATH=$keystore"
    echo "ANDROID_KEYSTORE_PASSWORD=$store_pass"
    echo "ANDROID_KEY_ALIAS=$key_alias"
    echo "ANDROID_KEY_PASSWORD=$key_pass"
  } >> "$GITHUB_ENV"
fi

if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  {
    echo "### Android signing identity"
    echo "- Keystore SHA-256: \`$actual_keystore_sha256\`"
    echo "- Certificate SHA-256: \`$actual_cert_sha256\`"
  } >> "$GITHUB_STEP_SUMMARY"
fi

printf 'Verified Kumone Android release signing identity (%s)\n' "$actual_cert_sha256"
