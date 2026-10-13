// Made by U2derscore //
document.addEventListener('DOMContentLoaded', () => {
  const versionEl = document.getElementById('version');
  if (versionEl && chrome?.runtime) {
    versionEl.textContent = chrome.runtime.getManifest().version;
  }
});