const { test } = require('node:test');
const assert = require('node:assert/strict');
const core = require('../extension/core.js');

test('first install and newly added settings use the full standard preset', () => {
  assert.ok(Object.values(core.settings()).every(Boolean));
  assert.deepEqual(core.settings({ hideShorts: false, enabled: 'false', unknown: true }), {
    ...core.DEFAULTS, hideShorts: false,
  });
  assert.ok(core.isStandard({ enabled: false }));
  assert.equal(core.isStandard({ cleanSearch: false }), false);
  const upgraded = core.settings({ enabled: true, hideShorts: false });
  assert.equal(upgraded.hideAutoDubbed, true);
  assert.equal(upgraded.hideMixes, true);
  assert.equal(upgraded.hideShorts, false);
});

test('plain searches default to Videos, with query and other parameters intact', () => {
  const url = new URL(core.searchDestination('https://www.youtube.com/results?search_query=bread+%26+butter&foo=bar', core.DEFAULTS));
  assert.equal(url.searchParams.get('sp'), core.VIDEO_FILTER);
  assert.equal(url.searchParams.get('search_query'), 'bread & butter');
  assert.equal(url.searchParams.get('foo'), 'bar');
  assert.equal(core.searchDestination(url.href, core.DEFAULTS), null, 'redirect is idempotent');
});

test('explicit native filters, including All, are never overridden', () => {
  for (const sp of ['EgIQAg%3D%3D', 'EgIQAQ%253D%253D', '']) {
    assert.equal(core.searchDestination(`https://www.youtube.com/results?search_query=bread&sp=${sp}`, core.DEFAULTS), null);
  }
});

test('remembered filters carry forward; restore, disabled and All behave distinctly', () => {
  const search = 'https://www.youtube.com/results?search_query=bread';
  assert.equal(new URL(core.searchDestination(search, core.DEFAULTS, 'EgIQAg==')).searchParams.get('sp'), 'EgIQAg==');
  assert.equal(core.searchDestination(search, core.DEFAULTS, ''), null);
  assert.equal(new URL(core.searchDestination(search, core.DEFAULTS, null)).searchParams.get('sp'), core.VIDEO_FILTER);
  assert.equal(new URL(core.searchDestination(search, { ...core.DEFAULTS, rememberFilters: false }, 'EgIQAg==')).searchParams.get('sp'), core.VIDEO_FILTER);
  assert.equal(core.searchDestination(search, { ...core.DEFAULTS, enabled: false }), null);
  assert.equal(core.searchDestination(search, { ...core.DEFAULTS, videoSearch: false }), null);
});

test('untrusted, corrupt and unrelated destinations fail open', () => {
  for (const url of ['https://example.com/results?search_query=x', 'javascript:alert(1)', 'https://www.youtube.com/watch?v=abcdefghijk', 'https://www.youtube.com/results']) {
    assert.equal(core.searchDestination(url, core.DEFAULTS), null);
  }
  for (const value of ['https://evil.example', '%broken', 'a'.repeat(513), 12, {}]) assert.equal(core.validFilter(value), null);
});

test('shared Shorts become normal watch links without losing timestamp or playlist', () => {
  const url = new URL(core.shortDestination('https://www.youtube.com/shorts/abcdefghijk?t=20&list=PLtest#section'));
  assert.equal(url.pathname, '/watch');
  assert.equal(url.searchParams.get('v'), 'abcdefghijk');
  assert.equal(url.searchParams.get('t'), '20');
  assert.equal(url.searchParams.get('list'), 'PLtest');
  assert.equal(url.hash, '#section');
  assert.equal(core.shortDestination(url.href), null);
  assert.equal(core.shortDestination('https://evil.example/shorts/abcdefghijk'), null);
  assert.equal(core.shortDestination('https://www.youtube.com/shorts/not-valid'), null);
});

test('generated mixes are distinguished from regular playlist and unrelated links', () => {
  for (const url of ['/watch?v=abcdefghijk&list=RDabcdefghijk&start_radio=1', '/playlist?list=RDMM', '/watch?v=abcdefghijk&list=RDAMVMabcdefghijk']) {
    assert.equal(core.isMixURL(url), true, url);
  }
  for (const url of ['/watch?v=abcdefghijk', '/playlist?list=PLabcdefghijk', '/playlist?list=WL', '/playlist?list=LL', '/results?list=RDabcdefghijk', 'https://example.com/watch?list=RDabcdefghijk']) {
    assert.equal(core.isMixURL(url), false, url);
  }
});

test('auto-dubbed detection requires an exact badge label', () => {
  for (const label of ['Auto-dubbed', ' Auto-dubbed ', 'Auto\u2011dubbed', 'Auto dubbed']) assert.equal(core.isAutoDubbedLabel(label), true);
  for (const label of ['Why auto-dubbed videos sound bad', 'Auto-dubbed explained', 'Dubbed', 'HD', null, undefined]) assert.equal(core.isAutoDubbedLabel(label), false);
});

test('video frames use only regular YouTube video IDs and skip playlist artwork', () => {
  assert.equal(core.videoFrameURL('/watch?v=abcdefghijk'), 'https://i.ytimg.com/vi/abcdefghijk/hq2.jpg');
  for (const url of ['/watch?v=short', '/watch?v=abcdefghijk&list=PLtest', '/playlist?list=PLtest', '/shorts/abcdefghijk', 'https://example.com/watch?v=abcdefghijk', 'javascript:alert(1)']) {
    assert.equal(core.videoFrameURL(url), null, url);
  }
});
