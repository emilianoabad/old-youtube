(() => {
  'use strict';
  const entries = new Map();
  const cache = new Map();
  let enabled = false;
  const selector = 'a#thumbnail[href], a.ytLockupViewModelContentImage[href]';

  function frameURL(link) {
    if (link.querySelector('[overlay-style="LIVE"], [overlay-style="UPCOMING"], .ytBadgeShapeThumbnailLive')) return null;
    const labels = link.querySelectorAll('badge-shape, ytd-thumbnail-overlay-time-status-renderer');
    if ([...labels].some(e => /^(live|upcoming|premiere)$/i.test(e.textContent.trim()))) return null;
    return globalThis.OldYouTube.videoFrameURL(link.href);
  }

  function clear(image) {
    image.removeAttribute('data-oy-frame');
    image.style.removeProperty('--oy-frame');
    observer.unobserve(image);
    entries.delete(image);
  }

  function available(url) {
    if (cache.has(url)) return cache.get(url);
    const result = new Promise(resolve => {
      const probe = new Image();
      probe.referrerPolicy = 'no-referrer';
      let timer;
      const finish = ok => {
        clearTimeout(timer);
        probe.onload = probe.onerror = null;
        if (!ok) probe.removeAttribute('src');
        resolve(ok);
      };
      // A missing still can return a successful HTTP response with a 120px placeholder.
      probe.onload = () => finish(probe.naturalWidth > 120 && probe.naturalHeight > 90);
      probe.onerror = () => finish(false);
      timer = setTimeout(() => finish(false), 8000);
      probe.src = url;
    });
    cache.set(url, result);
    if (cache.size > 200) cache.delete(cache.keys().next().value);
    return result;
  }

  const observer = new IntersectionObserver(changes => {
    for (const change of changes) {
      if (!enabled || !change.isIntersecting) continue;
      const image = change.target;
      const entry = entries.get(image);
      if (!entry || entry.started) continue;
      entry.started = true;
      observer.unobserve(image);
      available(entry.url).then(ok => {
        if (!ok || !enabled || !image.isConnected || entries.get(image) !== entry ||
            frameURL(entry.link) !== entry.url) return;
        image.style.setProperty('--oy-frame', `url("${entry.url}")`);
        image.setAttribute('data-oy-frame', '');
      });
    }
  }, { rootMargin: '200px' });

  function scan() {
    if (!enabled) return;
    // YouTube recycles cards and sometimes keeps a hidden page during SPA navigation.
    for (const [image, entry] of entries) {
      if (!image.isConnected || !entry.link.contains(image) || frameURL(entry.link) !== entry.url) clear(image);
    }
    for (const link of document.querySelectorAll(selector)) {
      const url = frameURL(link);
      if (!url) continue;
      const image = link.querySelector('.ytThumbnailViewModelImage img, yt-image img, img#img');
      if (!image || entries.has(image)) continue;
      entries.set(image, { link, url, started: false });
      observer.observe(image);
    }
  }

  function setEnabled(value) {
    enabled = value;
    if (!enabled) {
      observer.disconnect();
      for (const image of entries.keys()) clear(image);
    }
  }

  globalThis.OldYouTubeFrames = { scan, setEnabled };
})();
