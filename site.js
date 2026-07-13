'use strict';

const RELEASES = 'https://downloads.screenbudy.orbitboyzz.me/releases/';
const FALLBACK_VERSION = '0.1.6';

function urlsFor(version) {
  return {
    win32: `${RELEASES}ScreenBuddy-Setup-${version}.exe`,
    macArm64: `${RELEASES}ScreenBuddy-${version}-arm64.dmg`,
    macX64: `${RELEASES}ScreenBuddy-${version}-x64.dmg`
  };
}

async function latestVersion() {
  try {
    const res = await fetch(`${RELEASES}latest.yml`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`latest.yml: HTTP ${res.status}`);
    const text = await res.text();
    const match = text.match(/^version:\s*([\w.-]+)/m);
    if (!match) throw new Error('latest.yml: no version field found');
    return match[1];
  } catch (err) {
    console.warn('[site] Could not fetch latest version, using fallback:', err);
    return FALLBACK_VERSION;
  }
}

function renderDownloadLinks(version) {
  const downloads = urlsFor(version);
  const platform = navigator.userAgentData?.platform || navigator.platform || '';
  const link = document.getElementById('downloadLink');
  const alt = document.getElementById('altDownload');

  if (/mac/i.test(platform)) {
    link.textContent = 'Download for Mac';
    link.href = downloads.macArm64;
    if (alt) alt.innerHTML = `Apple Silicon (M1/M2/M3/M4) build above. Intel Mac? <a href="${downloads.macX64}" rel="noopener">Download the Intel build</a> instead.`;
  } else {
    link.textContent = 'Download for Windows';
    link.href = downloads.win32;
    if (alt) alt.innerHTML = `Also on Mac — <a href="${downloads.macArm64}" rel="noopener">Apple Silicon</a> or <a href="${downloads.macX64}" rel="noopener">Intel</a>.`;
  }
}

renderDownloadLinks(FALLBACK_VERSION);
latestVersion().then(version => renderDownloadLinks(version));

if (location.hostname.startsWith('support.')) {
  location.replace('/support.html' + location.search);
}
