#!/usr/bin/env node
/**
 * Kumone Automated Version & Documentation Synchronizer
 * 
 * Synchronizes versions, download links, about screens, and maintainer metadata
 * across desktop targets (macOS, Windows, Linux), Web/PWA, and documentation (README.md, README_CN.md).
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');

// 1. Resolve Target Version
function getTargetVersion() {
  if (process.argv[2]) {
    return process.argv[2].replace(/^(v|windows-v|linux-v)/, '');
  }

  try {
    const gitTag = execSync('git describe --tags --match="v*" --abbrev=0', { cwd: ROOT_DIR, encoding: 'utf-8' }).trim();
    if (gitTag) {
      return gitTag.replace(/^(v|windows-v|linux-v)/, '');
    }
  } catch (_) {}

  try {
    const winPkg = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'windows', 'package.json'), 'utf-8'));
    if (winPkg.version) return winPkg.version;
  } catch (_) {}

  return '0.2.0';
}

const targetVersion = getTargetVersion();
console.log(`[Sync] 🚀 Synchronizing all desktop/web platforms and documentation to version: ${targetVersion}`);

let modifiedCount = 0;

function updateFile(relPath, transformFn) {
  const fullPath = path.join(ROOT_DIR, relPath);
  if (!fs.existsSync(fullPath)) return;
  const original = fs.readFileSync(fullPath, 'utf-8');
  const modified = transformFn(original);
  if (original !== modified) {
    fs.writeFileSync(fullPath, modified, 'utf-8');
    console.log(`  ✓ Updated: ${relPath}`);
    modifiedCount++;
  } else {
    console.log(`  - Up-to-date: ${relPath}`);
  }
}

function toSemVer(v) {
  const parts = v.split('.');
  if (parts.length > 3) {
    return `${parts[0]}.${parts[1]}.${parts[2]}`;
  }
  return v;
}

const pkgSemVer = toSemVer(targetVersion);

// 2. Synchronize package.json files
updateFile('windows/package.json', (content) => {
  return content.replace(/"version":\s*"[^"]+"/, `"version": "${pkgSemVer}"`);
});

updateFile('web/package.json', (content) => {
  return content.replace(/"version":\s*"[^"]+"/, `"version": "${pkgSemVer}"`);
});

// 3. Synchronize Web Frontend app.js version
const syncAppJs = (content) => {
  return content.replace(
    /版本\s*v[0-9.]+\s*·\s*雲の音\s*NetEase\s*Cloud\s*Music\s*client/g,
    `版本 v${targetVersion} · 雲の音 NetEase Cloud Music client`
  );
};
updateFile('web/app.js', syncAppJs);

// 4. Synchronize README.md & README_CN.md Download Links
updateFile('README.md', (content) => {
  return content
    // Windows download links
    .replace(/\[Releases\s*→\s*(?:windows-)?v[0-9.]+\]\(https:\/\/github\.com\/Yuxin-Qiao\/kumone\/releases\/tag\/[^)]+\)\s*\(Windows 10\/11 x64\):\s*`Kumone-Setup-[0-9.]+-x64\.exe`/g,
             `[Releases → v${targetVersion}](https://github.com/Yuxin-Qiao/kumone/releases/tag/v${targetVersion}) (Windows 10/11 x64): \`Kumone-Setup-${targetVersion}-x64.exe\``)
    // Linux download links
    .replace(/`Kumone-[0-9.]+-x86_64\.AppImage`/g, `\`Kumone-${targetVersion}-x86_64.AppImage\``)
    .replace(/`Kumone_[0-9.]+_amd64\.deb`/g, `\`Kumone_${targetVersion}_amd64.deb\``)
    .replace(/\.\/Kumone-[0-9.]+-x86_64\.AppImage/g, `./Kumone-${targetVersion}-x86_64.AppImage`)
    .replace(/Kumone_[0-9.]+_amd64\.deb/g, `Kumone_${targetVersion}_amd64.deb`);
});

updateFile('README_CN.md', (content) => {
  return content
    // Windows download links
    .replace(/\[Releases\s*→\s*(?:windows-)?v[0-9.]+\]\(https:\/\/github\.com\/Yuxin-Qiao\/kumone\/releases\/tag\/[^)]+\)\s*（Windows 10\/11 x64）：\s*安装包\s*`Kumone-Setup-[0-9.]+-x64\.exe`/g,
             `[Releases → v${targetVersion}](https://github.com/Yuxin-Qiao/kumone/releases/tag/v${targetVersion})（Windows 10/11 x64）：安装包 \`Kumone-Setup-${targetVersion}-x64.exe\``)
    // Linux download links
    .replace(/`Kumone-[0-9.]+-x86_64\.AppImage`/g, `\`Kumone-${targetVersion}-x86_64.AppImage\``)
    .replace(/`Kumone_[0-9.]+_amd64\.deb`/g, `\`Kumone_${targetVersion}_amd64.deb\``)
    .replace(/\.\/Kumone-[0-9.]+-x86_64\.AppImage/g, `./Kumone-${targetVersion}-x86_64.AppImage`)
    .replace(/Kumone_[0-9.]+_amd64\.deb/g, `Kumone_${targetVersion}_amd64.deb`);
});

console.log(`\n🎉 [Sync Complete] All platform targets & docs synchronized successfully (${modifiedCount} files updated).`);
