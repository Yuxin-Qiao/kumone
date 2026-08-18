#!/bin/bash
# Builds native Swift Kumone for iOS (iPhone & iPad) and packages into .app bundle.
# Usage:
#   Scripts/build-ios.sh [debug|release] [simulator|device]
#   Scripts/build-ios.sh run [simulator_udid_or_name]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT"

CONF="Debug"
ACTION="build"
TARGET="simulator"
SIM_DEVICE="booted"

if [ "${1:-}" = "run" ]; then
  ACTION="run"
  shift || true
  if [ -n "${1:-}" ]; then
    SIM_DEVICE="$1"
    shift || true
  fi
elif [ -n "${1:-}" ]; then
  case "$1" in
    release|Release) CONF="Release" ;;
    debug|Debug) CONF="Debug" ;;
    *) CONF="Debug" ;;
  esac
  shift || true
  if [ -n "${1:-}" ]; then
    TARGET="$1"
    shift || true
  fi
fi

APP_NAME="Kumone"
BUNDLE_ID="im.missuo.Kumone"
MARKETING_VERSION="0.1.0"
BUILD_NUMBER="1"
[ -f "$ROOT/version.env" ] && source "$ROOT/version.env"

BUILD_DIR="$ROOT/.build/ios"
APP_BUNDLE="$BUILD_DIR/$APP_NAME.app"
DERIVED_DATA="$ROOT/.build/DerivedData-iOS"

echo "==> Building Kumone for iOS ($CONF, $TARGET)..."

if [ "$TARGET" = "device" ]; then
  DESTINATION="generic/platform=iOS"
  SDK="iphoneos"
else
  DESTINATION="generic/platform=iOS Simulator"
  SDK="iphonesimulator"
fi

xcodebuild build \
  -scheme "$APP_NAME" \
  -configuration "$CONF" \
  -destination "$DESTINATION" \
  -sdk "$SDK" \
  -derivedDataPath "$DERIVED_DATA" \
  -quiet

BIN_DIR="$DERIVED_DATA/Build/Products/$CONF-$SDK"
EXECUTABLE="$BIN_DIR/$APP_NAME"

if [ ! -f "$EXECUTABLE" ]; then
  echo "ERROR: Compiled executable not found at $EXECUTABLE" >&2
  exit 1
fi

rm -rf "$BUILD_DIR"
mkdir -p "$APP_BUNDLE"

cp "$EXECUTABLE" "$APP_BUNDLE/$APP_NAME"
chmod +x "$APP_BUNDLE/$APP_NAME"

# Copy localizations
for lproj in "$ROOT"/Sources/Kumone/Resources/*.lproj; do
  [ -d "$lproj" ] && cp -R "$lproj" "$APP_BUNDLE/"
done

# Copy icon if present
if [ -d "$ROOT/AppIcon.icon" ]; then
  xcrun actool "$ROOT/AppIcon.icon" \
    --compile "$APP_BUNDLE" \
    --notices --warnings --errors \
    --output-partial-info-plist "$BUILD_DIR/icon-partial.plist" \
    --app-icon AppIcon \
    --enable-on-demand-resources NO \
    --development-region zh-Hans \
    --target-device iphone \
    --target-device ipad \
    --minimum-deployment-target 17.0 \
    --platform "$SDK" >/dev/null 2>&1 || true
fi

GIT_COMMIT="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"

cat > "$APP_BUNDLE/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleDevelopmentRegion</key><string>zh-Hans</string>
    <key>CFBundleLocalizations</key>
    <array>
        <string>zh-Hans</string>
        <string>en</string>
    </array>
    <key>CFBundleExecutable</key><string>$APP_NAME</string>
    <key>CFBundleIdentifier</key><string>$BUNDLE_ID</string>
    <key>CFBundleInfoDictionaryVersion</key><string>6.0</string>
    <key>CFBundleName</key><string>$APP_NAME</string>
    <key>CFBundleDisplayName</key><string>$APP_NAME</string>
    <key>CFBundlePackageType</key><string>APPL</string>
    <key>CFBundleShortVersionString</key><string>$MARKETING_VERSION</string>
    <key>CFBundleVersion</key><string>$BUILD_NUMBER</string>
    <key>MinimumOSVersion</key><string>17.0</string>
    <key>UIDeviceFamily</key>
    <array>
        <integer>1</integer>
        <integer>2</integer>
    </array>
    <key>UIBackgroundModes</key>
    <array>
        <string>audio</string>
    </array>
    <key>UILaunchScreen</key>
    <dict/>
    <key>UIRequiredDeviceCapabilities</key>
    <array>
        <string>arm64</string>
    </array>
    <key>UISupportedInterfaceOrientations</key>
    <array>
        <string>UIInterfaceOrientationPortrait</string>
        <string>UIInterfaceOrientationLandscapeLeft</string>
        <string>UIInterfaceOrientationLandscapeRight</string>
    </array>
    <key>UISupportedInterfaceOrientations~ipad</key>
    <array>
        <string>UIInterfaceOrientationPortrait</string>
        <string>UIInterfaceOrientationPortraitUpsideDown</string>
        <string>UIInterfaceOrientationLandscapeLeft</string>
        <string>UIInterfaceOrientationLandscapeRight</string>
    </array>
    <key>NSAppTransportSecurity</key>
    <dict>
        <key>NSAllowsArbitraryLoads</key><true/>
    </dict>
    <key>KumoneGitCommit</key><string>$GIT_COMMIT</string>
</dict>
</plist>
PLIST

printf 'APPL????' > "$APP_BUNDLE/PkgInfo"

# Ad-hoc codesign
codesign --force --sign - "$APP_BUNDLE" >/dev/null 2>&1 || true

echo "✓ Successfully built iOS App: $APP_BUNDLE ($CONF, $GIT_COMMIT)"

if [ "$ACTION" = "run" ]; then
  echo "==> Installing and running on iOS Simulator ($SIM_DEVICE)..."
  xcrun simctl boot "$SIM_DEVICE" 2>/dev/null || true
  xcrun simctl install "$SIM_DEVICE" "$APP_BUNDLE"
  xcrun simctl launch "$SIM_DEVICE" "$BUNDLE_ID"
  echo "✓ Launched $BUNDLE_ID on $SIM_DEVICE"
fi
