(() => {
  'use strict';
  const core = globalThis.OldYouTube;
  const flags = {
    hideShorts: 'data-oy-shorts', hidePlayables: 'data-oy-playables',
    hideAutoDubbed: 'data-oy-auto-dubbed', hideMixes: 'data-oy-mixes',
    videoFrames: 'data-oy-frames',
    hideTopics: 'data-oy-topics', hidePromotions: 'data-oy-promotions', cleanSearch: 'data-oy-search',
  };
  const cards = [
    'ytd-rich-item-renderer', 'ytd-video-renderer', 'ytd-grid-video-renderer',
    'ytd-compact-video-renderer', 'yt-lockup-view-model',
    'ytd-radio-renderer', 'ytd-compact-radio-renderer', 'ytd-playlist-renderer',
    'ytd-grid-playlist-renderer', 'ytd-compact-playlist-renderer',
    'ytm-shorts-lockup-view-model-v2', 'ytd-guide-entry-renderer', 'ytd-mini-guide-entry-renderer',
    'yt-tab-shape', 'yt-chip-cloud-chip-renderer', 'ytd-search-filter-renderer',
  ].join(',');
  let preferences = core.settings();
  let rememberedFilter = null;
  let ready = false;
  let lastURL = '';
  let scanTimer;
  let observer;
  let pendingNativeFilter = false;
  let nativeFilterTimer;

  function applyFlags() {
    if (!document.documentElement) return;
    for (const [key, attribute] of Object.entries(flags)) {
      document.documentElement.toggleAttribute(attribute, ready && preferences.enabled && preferences[key]);
    }
    globalThis.OldYouTubeFrames.setEnabled(ready && preferences.enabled && preferences.videoFrames);
  }

  function classify(card) {
    // Current desktop navigation can be a button-like anchor with no href.
    if (card.matches('ytd-guide-entry-renderer, ytd-mini-guide-entry-renderer, yt-tab-shape, yt-chip-cloud-chip-renderer, ytd-search-filter-renderer')) {
      const label = (card.querySelector('a[title]')?.getAttribute('title') || card.getAttribute('tab-title') || card.textContent).trim();
      if (label === 'Shorts') return 'shorts';
      if (label === 'Playables' || label === 'Watch & Play') return 'playables';
    }
    // Check link targets, not video titles. This works across YouTube languages.
    const links = card.querySelectorAll('a[href]');
    for (const link of links) {
      const url = core.youtubeURL(link.href);
      if (!url) continue;
      if (/^\/shorts(?:\/|$)/.test(url.pathname)) return 'shorts';
      if (/^\/playables(?:\/|$)/.test(url.pathname)) return 'playables';
    }
    if (card.querySelector('[overlay-style="SHORTS"]')) return 'shorts';
    return null;
  }

  function scan() {
    scanTimer = undefined;
    if (!ready || !preferences.enabled) return;
    for (const card of document.querySelectorAll(cards)) {
      const kind = classify(card);
      if (kind) {
        if (card.getAttribute('data-oy-card') !== kind) card.setAttribute('data-oy-card', kind);
      } else {
        card.removeAttribute('data-oy-card');
      }
      // A rich item can wrap a whole shelf: filter its individual cards instead.
      const collection = card.matches('ytd-rich-item-renderer') && card.querySelectorAll('yt-lockup-view-model').length > 1;
      card.toggleAttribute('data-oy-dubbed-card', !collection && hasAutoDubbedBadge(card));
      card.toggleAttribute('data-oy-mix-card', !collection && isMixCard(card));
    }
    // New YouTube search shelves use view-model elements instead of shelf renderers.
    // Keep Shorts independent of the search-cleanup switch.
    for (const shelf of document.querySelectorAll('ytd-search grid-shelf-view-model')) {
      const shorts = shelf.querySelector('ytm-shorts-lockup-view-model, ytm-shorts-lockup-view-model-v2, a[href^="/shorts/"]');
      shelf.toggleAttribute('data-oy-search-shelf', !shorts);
    }
    globalThis.OldYouTubeFrames.scan();
  }

  function hasAutoDubbedBadge(card) {
    const badges = card.querySelectorAll('badge-shape, yt-badge-view-model:not(:has(badge-shape)), ytd-badge-supported-renderer');
    return [...badges].some(badge => !badge.closest('[hidden], [aria-hidden="true"]') &&
      [badge.textContent, badge.getAttribute('aria-label'), badge.getAttribute('label'), badge.getAttribute('title')]
        .some(core.isAutoDubbedLabel));
  }

  function isMixCard(card) {
    if (card.matches('ytd-radio-renderer, ytd-compact-radio-renderer')) return true;
    // Only thumbnail/title destinations count; a description can link to a mix.
    const links = card.querySelectorAll('a#video-title[href], a#thumbnail[href], a.ytLockupMetadataViewModelTitle[href], a.ytLockupViewModelContentImage[href]');
    return [...links].some(link => core.isMixURL(link.href));
  }

  function scheduleScan() {
    if (!scanTimer && ready && preferences.enabled) scanTimer = setTimeout(scan, 80);
  }

  function remember(filter) {
    const safe = core.validFilter(filter);
    if (!preferences.enabled || !preferences.videoSearch || !preferences.rememberFilters || safe === null || safe === rememberedFilter) return;
    rememberedFilter = safe;
    chrome.storage.local.set({ searchFilter: safe }).catch(() => {});
  }

  function navigate() {
    if (!ready || lastURL === location.href) return;
    lastURL = location.href;
    if (preferences.enabled) {
      const short = preferences.hideShorts && core.shortDestination(location.href);
      if (short) { location.replace(short); return; }
      const url = new URL(location.href);
      if (pendingNativeFilter && url.pathname === '/results') {
        clearTimeout(nativeFilterTimer);
        pendingNativeFilter = false;
        remember(url.searchParams.get('sp') ?? '');
        scheduleScan();
        return;
      }
      if (url.pathname === '/results' && url.searchParams.has('sp')) remember(url.searchParams.get('sp'));
      const search = core.searchDestination(location.href, preferences, rememberedFilter);
      if (search) { location.replace(search); return; }
    }
    scheduleScan();
  }

  // Capture an explicit All/type/date choice before YouTube's SPA handles the link.
  // Never cancel it or reinterpret an intentionally selected channel/playlist filter.
  document.addEventListener('click', event => {
    if (!ready || !preferences.enabled || event.defaultPrevented || event.button !== 0 ||
        event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const element = event.target instanceof Element ? event.target : null;
    const choice = element?.closest('ytd-search-filter-renderer, yt-chip-cloud-chip-renderer');
    if (!choice || location.pathname !== '/results') return;
    pendingNativeFilter = true;
    clearTimeout(nativeFilterTimer);
    nativeFilterTimer = setTimeout(() => { pendingNativeFilter = false; }, 2000);
    const link = element.closest('a[href]') || choice.querySelector('a[href]');
    if (!link) return;
    const url = core.youtubeURL(link.href);
    if (url?.pathname === '/results') remember(url.searchParams.get('sp') ?? '');
  }, true);

  // YouTube uses client-side navigation; a load-only script misses later pages.
  document.addEventListener('yt-navigate-finish', navigate);
  document.addEventListener('yt-page-data-updated', () => { navigate(); scheduleScan(); });
  window.addEventListener('popstate', () => { lastURL = ''; navigate(); });
  window.addEventListener('pageshow', () => { lastURL = ''; navigate(); });

  function startObserver() {
    if (observer || !document.documentElement) return;
    observer = new MutationObserver(scheduleScan);
    observer.observe(document.documentElement, {
      childList: true, subtree: true, characterData: true,
      attributes: true, attributeFilter: ['href', 'src', 'srcset', 'overlay-style', 'title', 'tab-title', 'aria-label', 'label', 'hidden', 'aria-hidden'],
    });
    applyFlags();
    scheduleScan();
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.searchFilter) rememberedFilter = core.validFilter(changes.searchFilter.newValue);
    if (changes.settings) {
      preferences = core.settings(changes.settings.newValue);
      applyFlags();
      // An option change should reveal/hide content, never reload a playing video.
      scheduleScan();
    }
  });

  chrome.storage.local.get(['settings', 'searchFilter']).then(stored => {
    preferences = core.settings(stored.settings);
    rememberedFilter = core.validFilter(stored.searchFilter);
    ready = true;
    applyFlags();
    startObserver();
    navigate();
  }).catch(() => {
    // If storage is unavailable at startup, leave the page untouched.
    ready = false;
    applyFlags();
  });
  if (!document.documentElement) document.addEventListener('DOMContentLoaded', startObserver, { once: true });
})();
