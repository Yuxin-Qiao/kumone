#!/usr/bin/env bash
set -euo pipefail

EXPECTED_KEYSTORE_SHA256="679cd8d890491caa93c96e8672699e6083c228e1c5087309432442375c370d9b"
EXPECTED_CERT_SHA256="BCAF88ACDB9F176CEE66C5350BB75107365EB65C40CED83A6BAAA930C4473A88"
EXPECTED_ALIAS="kumone-release"

for name in ANDROID_KEYSTORE_BASE64 ANDROID_KEYSTORE_PASSWORD ANDROID_KEY_PASSWORD; do
  if [[ -z "${!name:-}" ]]; then
    echo "::error::$name is required for an installable, update-stable Android release"
    exit 1
  fi
done

trim() {
  sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//'
}

normalize_scalar() {
  local name="$1"
  local value="$2"
  value="$(printf '%s' "$value" | tr -d '\r\n' | trim)"
  value="${value#${name}=}"
  value="$(printf '%s' "$value" | trim)"
  value="${value#\`}"
  value="${value%\`}"
  value="${value#\"}"
  value="${value%\"}"
  value="${value#\'}"
  value="${value%\'}"
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
clean_b64="${clean_b64#\'}"
clean_b64="${clean_b64%\'}"

store_pass="$(normalize_scalar ANDROID_KEYSTORE_PASSWORD "$ANDROID_KEYSTORE_PASSWORD")"
key_pass="$(normalize_scalar ANDROID_KEY_PASSWORD "$ANDROID_KEY_PASSWORD")"
provided_alias="$(normalize_scalar ANDROID_KEY_ALIAS "${ANDROID_KEY_ALIAS:-}")"
key_alias="$EXPECTED_ALIAS"

if [[ -z "$clean_b64" || -z "$store_pass" || -z "$key_pass" ]]; then
  echo "::error::One or more Android signing secrets become empty after normalization"
  exit 1
fi

if [[ -n "$provided_alias" && "$provided_alias" != "$EXPECTED_ALIAS" ]]; then
  echo "::warning::ANDROID_KEY_ALIAS did not match the pinned public alias; using $EXPECTED_ALIAS"
fi

echo "::add-mask::$store_pass"
echo "::add-mask::$key_pass"

runner_temp="${RUNNER_TEMP:-/tmp}"
keystore="$runner_temp/kumone-release.jks"
printf '%s' "$clean_b64" | base64 --decode --ignore-garbage > "$keystore"
if [[ ! -s "$keystore" ]]; then
  echo "::error::ANDROID_KEYSTORE_BASE64 did not decode to a non-empty keystore"
  exit 1
fi

actual_keystore_sha256="$(sha256sum "$keystore" | awk '{print $1}')"
if [[ "$actual_keystore_sha256" != "$EXPECTED_KEYSTORE_SHA256" ]]; then
  echo "::error::Decoded keystore does not match the pinned Kumone release keystore"
  exit 1
fi
echo "Pinned Kumone keystore bytes verified."

store_listing="$runner_temp/kumone-keytool-store.txt"
if ! keytool -list -v -storetype JKS -keystore "$keystore" -storepass "$store_pass" >"$store_listing" 2>&1; then
  rm -f "$store_listing"
  echo "::error::Keystore bytes are correct, but ANDROID_KEYSTORE_PASSWORD is incorrect or malformed"
  exit 1
fi

alias_listing="$runner_temp/kumone-keytool-alias.txt"
if ! keytool -list -v -storetype JKS -keystore "$keystore" -storepass "$store_pass" -alias "$key_alias" >"$alias_listing" 2>&1; then
  rm -f "$store_listing" "$alias_listing"
  echo "::error::Pinned Android release alias $EXPECTED_ALIAS is missing from the verified keystore"
  exit 1
fi

actual_cert_sha256="$(sed -n 's/^[[:space:]]*SHA256: //p' "$alias_listing" | head -n 1 | tr -d ':' | tr '[:lower:]' '[:upper:]')"
rm -f "$store_listing" "$alias_listing"
if [[ "$actual_cert_sha256" != "$EXPECTED_CERT_SHA256" ]]; then
  echo "::error::Android signing certificate fingerprint does not match the pinned Kumone release identity"
  exit 1
fi

validation_store="$runner_temp/kumone-key-password-check.p12"
rm -f "$validation_store"
if ! keytool -importkeystore -noprompt \
  -srckeystore "$keystore" -srcstoretype JKS -srcstorepass "$store_pass" \
  -srcalias "$key_alias" -srckeypass "$key_pass" \
  -destkeystore "$validation_store" -deststoretype PKCS12 \
  -deststorepass "kumone-validation-only" -destkeypass "kumone-validation-only" \
  >/dev/null 2>&1; then
  rm -f "$validation_store"
  echo "::error::Keystore and store password are correct, but ANDROID_KEY_PASSWORD is incorrect or malformed"
  exit 1
fi
rm -f "$validation_store"

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
    echo "- Alias: \`$key_alias\`"
    echo "- Store password and key password: verified without disclosure"
  } >> "$GITHUB_STEP_SUMMARY"
fi

printf 'Verified Kumone Android release signing identity (%s)\n' "$actual_cert_sha256"
