/* Shared by the isolated content script, popup, and Node's regression tests. */
(() => {
  'use strict';

  const DEFAULTS = Object.freeze({
    enabled: true,
    hideShorts: true,
    hidePlayables: true,
    hideAutoDubbed: true,
    hideMixes: true,
    hideTopics: true,
    hidePromotions: true,
    cleanSearch: true,
    videoSearch: true,
    rememberFilters: true,
  });
  const VIDEO_FILTER = 'EgIQAQ==';

  function settings(value) {
    return Object.fromEntries(Object.entries(DEFAULTS).map(([key, fallback]) =>
      [key, typeof value?.[key] === 'boolean' ? value[key] : fallback]));
  }

  function isStandard(value) {
    const normalized = settings(value);
    return Object.keys(DEFAULTS).every(key => key === 'enabled' || normalized[key] === DEFAULTS[key]);
  }

  function validFilter(value) {
    // Only native, short base64 filter values. Never persist a query or whole URL.
    if (typeof value !== 'string' || value.length > 512) return null;
    let decoded;
    try { decoded = decodeURIComponent(value); } catch { return null; }
    return /^[A-Za-z0-9_+/=-]*$/.test(decoded) ? value : null;
  }

  function youtubeURL(value) {
    try {
      const url = new URL(value, 'https://www.youtube.com');
      return url.protocol === 'https:' && url.hostname === 'www.youtube.com' ? url : null;
    } catch { return null; }
  }

  function shortDestination(value) {
    const url = youtubeURL(value);
    const match = url?.pathname.match(/^\/shorts\/([\w-]{11})\/?$/);
    if (!match) return null;
    url.pathname = '/watch';
    url.searchParams.set('v', match[1]);
    return url.href;
  }

  function isMixURL(value) {
    const url = youtubeURL(value);
    return !!url && ['/watch', '/playlist'].includes(url.pathname) &&
      /^RD[\w-]+$/.test(url.searchParams.get('list') || '');
  }

  function isAutoDubbedLabel(value) {
    return typeof value === 'string' && /^auto[\s\u2010-\u2015-]*dubbed$/i.test(value.trim());
  }

  function searchDestination(value, preferences, rememberedFilter) {
    const url = youtubeURL(value);
    if (!preferences.enabled || !preferences.videoSearch || url?.pathname !== '/results' ||
        !url.searchParams.has('search_query') || url.searchParams.has('sp')) return null;
    const saved = validFilter(rememberedFilter);
    const filter = preferences.rememberFilters && saved !== null ? saved : VIDEO_FILTER;
    // An explicitly chosen native All filter is a valid remembered preference.
    if (!filter) return null;
    url.searchParams.set('sp', filter);
    return url.href;
  }

  const api = { DEFAULTS, VIDEO_FILTER, settings, isStandard, validFilter, youtubeURL, shortDestination, isMixURL, isAutoDubbedLabel, searchDestination };
  globalThis.OldYouTube = Object.freeze(api);
  if (typeof module !== 'undefined') module.exports = api;
})();
