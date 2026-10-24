(() => {
  'use strict';
  const core = globalThis.OldYouTube;
  let preferences = core.settings();
  const enabled = document.querySelector('#enabled');
  const reset = document.querySelector('#reset');
  const fields = [...document.querySelectorAll('[data-setting]')];
  const feedback = document.querySelector('#feedback');
  let busy = true;

  function render() {
    enabled.setAttribute('aria-checked', String(preferences.enabled));
    enabled.disabled = busy;
    reset.disabled = busy;
    document.querySelector('#status').textContent = preferences.enabled ? 'On' : 'Off';
    for (const field of fields) { field.checked = preferences[field.dataset.setting]; field.disabled = busy; }
  }

  async function save(next, restore = false) {
    busy = true;
    feedback.textContent = '';
    render();
    try {
      await chrome.storage.local.set({ settings: next, ...(restore ? {searchFilter: null} : {}) });
      preferences = next;
    } catch {
      feedback.textContent = 'Couldn’t save settings. Try again.';
    } finally { busy = false; render(); }
  }

  enabled.addEventListener('click', () => save({ ...preferences, enabled: !preferences.enabled }));
  for (const field of fields) field.addEventListener('change', () => save({ ...preferences, [field.dataset.setting]: field.checked }));
  reset.addEventListener('click', () => save(core.settings(), true));
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.settings) { preferences = core.settings(changes.settings.newValue); render(); }
  });
  chrome.storage.local.get('settings').then(stored => {
    preferences = core.settings(stored.settings);
    busy = false;
    render();
  }).catch(() => { feedback.textContent = 'Couldn’t load settings. Reopen the extension to try again.'; });
})();
