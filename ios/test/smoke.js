#!/usr/bin/env node
/**
 * Smoke test for Kumone for iOS (Project integrity, Swift sources, Info.plist, Web assets).
 */
'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT_DIR = path.resolve(__dirname, '..');
console.log('🧪 [iOS Smoke Test] Running validation on Kumone for iOS...');

// 1. Check Project Structure
const requiredFiles = [
  'Kumone.xcodeproj/project.pbxproj',
  'Kumone.xcodeproj/xcshareddata/xcschemes/Kumone.xcscheme',
  'Kumone/App/KumoneApp.swift',
  'Kumone/App/ContentView.swift',
  'Kumone/Bridge/KumoneIOSBridge.swift',
  'Kumone/Audio/AudioPlayerManager.swift',
  'Kumone/Resources/Info.plist',
  'Kumone/Resources/Assets.xcassets/Contents.json',
  'Kumone/Resources/Assets.xcassets/AppIcon.appiconset/Contents.json',
  'Kumone/Resources/web/index.html',
  'Kumone/Resources/web/style.css',
  'Kumone/Resources/web/app.js',
  'Kumone/Resources/web/lib/api.js',
  'Kumone/Resources/web/lib/client.js',
  'Kumone/Resources/web/lib/crypto.js',
  'Kumone/Resources/web/lib/unblock.js',
  'README.md'
];

for (const file of requiredFiles) {
  const fullPath = path.join(ROOT_DIR, file);
  assert(fs.existsSync(fullPath), `Required iOS file missing: ${file}`);
}
console.log(`  ✓ Checked ${requiredFiles.length} required iOS project files.`);

// 2. Validate Xcode project
const pbxproj = fs.readFileSync(path.join(ROOT_DIR, 'Kumone.xcodeproj/project.pbxproj'), 'utf-8');
assert(pbxproj.includes('PRODUCT_BUNDLE_IDENTIFIER = com.kumone.music'), 'Xcode project must set PRODUCT_BUNDLE_IDENTIFIER');
assert(pbxproj.includes('IPHONEOS_DEPLOYMENT_TARGET = 16.0'), 'Xcode project must target iOS 16.0+');
assert(pbxproj.includes('productType = "com.apple.product-type.application"'), 'Xcode project must define an application target');
assert(pbxproj.includes('path = web'), 'Xcode project must bundle the web resource folder');
const scheme = fs.readFileSync(path.join(ROOT_DIR, 'Kumone.xcodeproj/xcshareddata/xcschemes/Kumone.xcscheme'), 'utf-8');
assert(scheme.includes('BlueprintName = "Kumone"'), 'Shared Kumone scheme must exist');
console.log('  ✓ Xcode project and shared scheme validated.');

// 3. Validate Info.plist
const plistContent = fs.readFileSync(path.join(ROOT_DIR, 'Kumone/Resources/Info.plist'), 'utf-8');
assert(plistContent.includes('<string>audio</string>'), 'Info.plist must declare audio in UIBackgroundModes');
assert(plistContent.includes('NSAllowsArbitraryLoads'), 'Info.plist must configure NSAppTransportSecurity');
assert(plistContent.includes('orpheus'), 'Info.plist must declare orpheus URL scheme');
console.log('  ✓ Info.plist background modes and permissions validated.');

// 4. Validate Swift Sources for Core Subsystems
const bridgeContent = fs.readFileSync(path.join(ROOT_DIR, 'Kumone/Bridge/KumoneIOSBridge.swift'), 'utf-8');
assert(bridgeContent.includes('WKScriptMessageHandler'), 'KumoneIOSBridge must conform to WKScriptMessageHandler');
assert(bridgeContent.includes('asyncHttpRequest'), 'KumoneIOSBridge must support asyncHttpRequest');
assert(bridgeContent.includes('playAudio'), 'KumoneIOSBridge must support playAudio');
assert(bridgeContent.includes('"data": bodyText'), 'HTTP proxy must return Android-compatible `data` field');
assert(bridgeContent.includes('"cookies": cookies'), 'HTTP proxy must return Set-Cookie values');

const audioContent = fs.readFileSync(path.join(ROOT_DIR, 'Kumone/Audio/AudioPlayerManager.swift'), 'utf-8');
assert(audioContent.includes('AVAudioSession.sharedInstance()'), 'AudioPlayerManager must configure AVAudioSession');
assert(audioContent.includes('MPNowPlayingInfoCenter'), 'AudioPlayerManager must support MPNowPlayingInfoCenter');
assert(audioContent.includes('MPRemoteCommandCenter'), 'AudioPlayerManager must support MPRemoteCommandCenter');
console.log('  ✓ Swift audio and WebKit bridge implementations validated.');

// 5. Crypto fallback must match Windows/Node weapi/eapi (WKWebView has no node crypto)
const iosCrypto = require(path.join(ROOT_DIR, 'Kumone/Resources/web/lib/crypto.js'));
const json = String.raw`{"a":1,"中文":"x","csrf_token":""}`;
assert.strictEqual(
  iosCrypto.weapiJs(json).params,
  '/l1h2jkQoD4EUEIqo0GV8iPAF/ELo5N5dtabFdU9AXjIo6UqTRXg7VbIGmg3IpMTxeVaQbzzC3Qj3a6UpPQGwAbuUNQ7EeMTAFotyNZtxgA='
);
assert.strictEqual(
  iosCrypto.eapiJs('/api/test', json).params,
  '4DC723619A991588865191FD2F319BADEE9D82DED756FAF81718E6CE08BB71F2C4601D07128D00DB9BD72874C343B530930B71BB58E3ECC222F1E26BC6ABC97E1F900BDA20E3392CD422873B10E676D73FF8662A89B1101642C72A6BB91B2D151301E8A009DA24A4D62DDFB070D282AE'
);
console.log('  ✓ Browser AES weapi/eapi fallback matches Swift/Windows vectors.');

// 5. Validate Web Assets
const appJs = fs.readFileSync(path.join(ROOT_DIR, 'Kumone/Resources/web/app.js'), 'utf-8');
assert(appJs.includes('window.webkit.messageHandlers.kumoneBridge'), 'web/app.js must support iOS messageHandlers');
assert(appJs.includes('onNativePlaybackProgress'), 'web/app.js must register onNativePlaybackProgress');
assert(appJs.includes('playNextTrack(true)'), 'web/app.js remote-next hook must call playNextTrack');

const clientJs = fs.readFileSync(path.join(ROOT_DIR, 'Kumone/Resources/web/lib/client.js'), 'utf-8');
assert(clientJs.includes('window.webkit.messageHandlers.kumoneBridge'), 'client.js must route HTTP through the iOS native bridge');
assert(clientJs.includes("action: 'asyncHttpRequest'"), 'client.js must post asyncHttpRequest to iOS');
assert(clientJs.includes("action: 'setPreference'"), 'client.js must persist cookies through the iOS bridge');

const apiJs = fs.readFileSync(path.join(ROOT_DIR, 'Kumone/Resources/web/lib/api.js'), 'utf-8');
assert(apiJs.includes("cellphone: cleanPhone"), 'api.js sendCaptcha must use cellphone param for /sms/captcha/sent');
console.log('  ✓ Web UI & Bridge integration validated.');

console.log('\n🎉 [iOS Smoke Test] ALL CHECKS PASSED!\n');
