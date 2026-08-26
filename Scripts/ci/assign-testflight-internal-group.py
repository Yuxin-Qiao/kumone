#!/usr/bin/env python3
"""Attach a processed TestFlight build to an App Store Connect beta group.

This uses only the Python standard library plus the macOS runner's OpenSSL
binary. The private key is read from an environment variable and is never
printed. A missing beta group is a warning (the upload itself remains valid),
so the group can be created once in App Store Connect and a later dispatch can
retry the assignment.
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import subprocess
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path


API_ROOT = "https://api.appstoreconnect.apple.com"


def b64url(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def der_length(data: bytes, offset: int) -> tuple[int, int]:
    first = data[offset]
    offset += 1
    if first < 0x80:
        return first, offset
    count = first & 0x7F
    if count == 0 or count > 4:
        raise ValueError("unsupported DER length")
    end = offset + count
    return int.from_bytes(data[offset:end], "big"), end


def der_to_raw_ecdsa(signature: bytes, size: int = 32) -> bytes:
    if not signature or signature[0] != 0x30:
        raise ValueError("OpenSSL returned a non-DER ECDSA signature")
    sequence_length, offset = der_length(signature, 1)
    sequence_end = offset + sequence_length
    if sequence_end > len(signature):
        raise ValueError("truncated ECDSA sequence")
    if signature[offset] != 0x02:
        raise ValueError("missing ECDSA r integer")
    r_length, r_start = der_length(signature, offset + 1)
    r = signature[r_start : r_start + r_length]
    offset = r_start + r_length
    if signature[offset] != 0x02:
        raise ValueError("missing ECDSA s integer")
    s_length, s_start = der_length(signature, offset + 1)
    s = signature[s_start : s_start + s_length]
    if s_start + s_length != sequence_end:
        raise ValueError("unexpected bytes after ECDSA signature")
    return r.lstrip(b"\x00").rjust(size, b"\x00")[-size:] + s.lstrip(b"\x00").rjust(size, b"\x00")[-size:]


def make_token(key_id: str, issuer_id: str, private_key: str) -> str:
    header = b64url(json.dumps({"alg": "ES256", "kid": key_id, "typ": "JWT"}, separators=(",", ":")).encode())
    now = int(time.time())
    payload = b64url(
        json.dumps(
            {"aud": "appstoreconnect-v1", "exp": now + 1_200, "iat": now, "iss": issuer_id},
            separators=(",", ":"),
        ).encode()
    )
    signing_input = f"{header}.{payload}".encode("ascii")
    with tempfile.TemporaryDirectory(prefix="kumone-asc-") as temp_dir:
        key_path = Path(temp_dir) / "AuthKey.p8"
        input_path = Path(temp_dir) / "input"
        signature_path = Path(temp_dir) / "signature"
        key_path.write_text(private_key, encoding="utf-8")
        key_path.chmod(0o600)
        input_path.write_bytes(signing_input)
        result = subprocess.run(
            ["openssl", "dgst", "-sha256", "-sign", str(key_path), "-out", str(signature_path), str(input_path)],
            check=False,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
        )
        if result.returncode != 0:
            raise RuntimeError("OpenSSL could not sign the App Store Connect request")
        signature = der_to_raw_ecdsa(signature_path.read_bytes())
    return f"{header}.{payload}.{b64url(signature)}"


def api_request(token: str, method: str, path: str, body: dict | None = None) -> dict:
    data = None if body is None else json.dumps(body).encode("utf-8")
    request = urllib.request.Request(
        API_ROOT + path,
        data=data,
        method=method,
        headers={
            "Accept": "application/json",
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return json.load(response)
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")[:600]
        raise RuntimeError(f"App Store Connect API {method} {path} returned HTTP {exc.code}: {detail}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"App Store Connect API request failed: {exc.reason}") from exc


def find_exact_build(token: str, app_id: str, version: str, build_number: str) -> dict | None:
    query = urllib.parse.urlencode(
        {
            "filter[app]": app_id,
            "filter[versionString]": version,
            "filter[buildNumber]": build_number,
            "limit": "50",
        }
    )
    response = api_request(token, "GET", f"/v1/builds?{query}")
    for item in response.get("data", []):
        attributes = item.get("attributes", {})
        if attributes.get("versionString") == version and attributes.get("buildNumber") == build_number:
            return item
    return None


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--bundle-id", required=True)
    parser.add_argument("--version", required=True)
    parser.add_argument("--build-number", required=True)
    parser.add_argument("--group-name", default="Internal Testers")
    parser.add_argument("--poll-seconds", type=int, default=30)
    parser.add_argument("--timeout-seconds", type=int, default=1_800)
    args = parser.parse_args()

    key_id = os.environ.get("ASC_KEY_ID", "")
    issuer_id = os.environ.get("ASC_ISSUER_ID", "")
    private_key = os.environ.get("ASC_PRIVATE_KEY", "")
    if not key_id or not issuer_id or not private_key:
        raise SystemExit("ASC_KEY_ID, ASC_ISSUER_ID and ASC_PRIVATE_KEY are required")

    token = make_token(key_id, issuer_id, private_key)
    app_query = urllib.parse.urlencode({"filter[bundleId]": args.bundle_id, "limit": "50"})
    apps = api_request(token, "GET", f"/v1/apps?{app_query}").get("data", [])
    if not apps:
        raise SystemExit(f"no App Store Connect app exists for bundle ID {args.bundle_id}")
    app = apps[0]
    app_id = app["id"]

    deadline = time.monotonic() + args.timeout_seconds
    build = None
    while time.monotonic() < deadline:
        build = find_exact_build(token, app_id, args.version, args.build_number)
        if build:
            state = build.get("attributes", {}).get("processingState", "")
            if state in {"VALID", "INVALID", "FAILED"}:
                break
        time.sleep(max(1, args.poll_seconds))
    if not build:
        raise SystemExit("uploaded build has not appeared in App Store Connect before the timeout")
    state = build.get("attributes", {}).get("processingState", "")
    if state != "VALID":
        raise SystemExit(f"App Store Connect build processing ended in {state or 'unknown'} state")

    group_query = urllib.parse.urlencode({"filter[app]": app_id, "limit": "200"})
    groups = api_request(token, "GET", f"/v1/betaGroups?{group_query}").get("data", [])
    group = next((item for item in groups if item.get("attributes", {}).get("name") == args.group_name), None)
    if group is None and args.group_name == "Internal Testers":
        group = next((item for item in groups if item.get("attributes", {}).get("isInternalGroup") is True), None)
    if group is None:
        print(json.dumps({"build_id": build["id"], "processing_state": state, "group": None}, sort_keys=True))
        print(f"::warning::App Store Connect beta group {args.group_name!r} does not exist; upload succeeded but group assignment was skipped")
        return 0

    group_id = group["id"]
    relationship = api_request(token, "GET", f"/v1/betaGroups/{group_id}/relationships/builds")
    existing_ids = {item.get("id") for item in relationship.get("data", [])}
    if build["id"] not in existing_ids:
        api_request(
            token,
            "POST",
            f"/v1/betaGroups/{group_id}/relationships/builds",
            {"data": [{"type": "builds", "id": build["id"]}]},
        )
    print(
        json.dumps(
            {"app_id": app_id, "build_id": build["id"], "processing_state": state, "group": group.get("attributes", {}).get("name"), "group_id": group_id},
            sort_keys=True,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
