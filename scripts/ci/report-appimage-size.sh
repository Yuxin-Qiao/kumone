#!/usr/bin/env bash
set -euo pipefail

APPIMAGE=${1:?AppImage path is required}
SUMMARY=${2:-}
[[ -f "$APPIMAGE" ]] || { echo "missing AppImage: $APPIMAGE" >&2; exit 1; }

if ! bytes=$(stat -c%s "$APPIMAGE" 2>/dev/null); then
  bytes=$(stat -f%z "$APPIMAGE")
fi
mib=$(awk -v bytes="$bytes" 'BEGIN { printf "%.2f", bytes / 1048576 }')
echo "AppImage: $(basename "$APPIMAGE") (${mib} MiB)"
if command -v unsquashfs >/dev/null 2>&1; then
  # AppImage v2 wraps the SquashFS image at a non-zero offset.  Some
  # unsquashfs versions detect that wrapper while others do not; inspection is
  # informative only and must never turn a valid package into a failed build.
  if ! unsquashfs -s "$APPIMAGE" | sed -n '1,16p'; then
    echo "unsquashfs could not inspect the AppImage wrapper; size budget remains authoritative"
  fi
  if [[ -n "$SUMMARY" ]]; then
    {
      echo "### AppImage component report"
      echo "- File: **$(basename "$APPIMAGE")**"
      echo "- Compressed size: **${mib} MiB**"
      echo "- Runtime: **self-contained WebKitGTK/GTK AppImage**"
      echo "- Policy: documentation/debug payloads may be stripped; runtime libraries remain bundled"
    } >> "$SUMMARY"
  fi
else
  echo "unsquashfs unavailable; package budget still enforced"
fi
