'use strict';

const params = new URLSearchParams(location.search);
const error = params.get('error') || 'Setup failed, but no error details were provided.';
const platform = params.get('platform') || 'unknown';
const version = params.get('version') || 'unknown';

document.getElementById('platformField').value = platform;
document.getElementById('versionField').value = version;
document.getElementById('errorField').value = error;
document.getElementById('details').value = [
  `Platform: ${platform}`,
  `ScreenBuddy version: ${version}`,
  '',
  'Setup error:',
  error
].join('\n');

document.getElementById('supportForm').addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && event.target.id === 'email') {
    event.preventDefault();
    event.currentTarget.requestSubmit();
  }
});
