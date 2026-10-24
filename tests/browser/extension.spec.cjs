const { test: base, expect, chromium } = require('@playwright/test');
const { mkdtemp, rm } = require('node:fs/promises');
const { existsSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const brave = '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser';
const extension = path.resolve(__dirname, '../../extension');

const fixture = `<!doctype html><html><head><title>YouTube test fixture</title><style>
body{font:16px sans-serif} ytd-browse,ytd-search,ytd-rich-section-renderer,ytd-reel-shelf-renderer,ytd-video-renderer,ytd-rich-item-renderer,ytd-shelf-renderer,grid-shelf-view-model,ytd-feed-filter-chip-bar-renderer,ytd-guide-entry-renderer,yt-tab-shape{display:block;padding:8px;margin:4px} a{color:#222} [hidden]{display:none!important}
</style></head><body>
<ytd-guide-entry-renderer id="short-nav"><a title="Shorts" role="link">Shorts</a></ytd-guide-entry-renderer>
<ytd-browse>
<ytd-rich-grid-renderer><div id="header"><ytd-feed-filter-chip-bar-renderer id="chips">Music Gaming Cooking</ytd-feed-filter-chip-bar-renderer></div></ytd-rich-grid-renderer>
<ytd-rich-section-renderer id="games"><a href="/playables/game123">Watch & Play</a></ytd-rich-section-renderer>
<ytd-statement-banner-renderer id="promo">Try Premium</ytd-statement-banner-renderer>
<ytd-rich-item-renderer id="regular"><a href="/watch?v=abcdefghijk">Ordinary gaming video</a></ytd-rich-item-renderer>
<ytd-rich-item-renderer id="short-card"><a href="/shorts/abcdefghijk">Short video</a></ytd-rich-item-renderer>
<yt-tab-shape id="channel-short-tab"><a href="/@baker/shorts">Shorts</a></yt-tab-shape>
<ytd-rich-item-renderer id="dubbed"><yt-lockup-view-model><a class="ytLockupMetadataViewModelTitle" href="/watch?v=lmnopqrstuv">Train arrival</a><yt-badge-view-model><badge-shape><div class="ytBadgeShapeText">Auto-dubbed</div></badge-shape></yt-badge-view-model></yt-lockup-view-model></ytd-rich-item-renderer>
<ytd-rich-item-renderer id="mix"><yt-lockup-view-model><a class="ytLockupMetadataViewModelTitle" href="/watch?v=abcdefghijk&list=RDabcdefghijk&start_radio=1">Mix – Music</a><div>Personalised mix for you</div></yt-lockup-view-model></ytd-rich-item-renderer>
<yt-lockup-view-model id="both"><a class="ytLockupViewModelContentImage" href="/watch?v=lmnopqrstuv&list=RDMM">Personalized mix</a><badge-shape>Auto-dubbed</badge-shape></yt-lockup-view-model>
<ytd-video-renderer id="dubbed-legacy"><a id="video-title" href="/watch?v=lmnopqrstuv">Legacy dubbed video</a><ytd-badge-supported-renderer aria-label="Auto-dubbed"></ytd-badge-supported-renderer></ytd-video-renderer>
<ytd-compact-radio-renderer id="radio">Generated mix</ytd-compact-radio-renderer>
<yt-lockup-view-model id="manual-playlist"><a class="ytLockupMetadataViewModelTitle" href="/playlist?list=PLabcdefghijk">My personalized mix</a></yt-lockup-view-model>
<ytd-video-renderer id="dubbed-title"><a id="video-title" href="/watch?v=lmnopqrstuv">Why auto-dubbed videos sound bad</a><div id="description"><a href="/playlist?list=RDabcdefghijk">Related mix</a></div></ytd-video-renderer>
<yt-lockup-view-model id="hidden-badge"><a class="ytLockupMetadataViewModelTitle" href="/watch?v=abcdefghijk">Ordinary video</a><yt-badge-view-model><badge-shape hidden>Auto-dubbed</badge-shape></yt-badge-view-model></yt-lockup-view-model>
<ytd-rich-item-renderer id="mixed-shelf"><yt-lockup-view-model id="shelf-dubbed"><badge-shape>Auto-dubbed</badge-shape></yt-lockup-view-model><yt-lockup-view-model id="shelf-regular"><a class="ytLockupMetadataViewModelTitle" href="/watch?v=abcdefghijk">Normal shelf video</a></yt-lockup-view-model></ytd-rich-item-renderer>
</ytd-browse>
<ytd-search>
<ytd-search-header-renderer><yt-chip-cloud-chip-renderer><a id="all-filter" href="/results?search_query=bread">All</a></yt-chip-cloud-chip-renderer><ytd-search-filter-renderer><a id="channels-filter" href="/results?search_query=bread&sp=EgIQAg%3D%3D">Channels</a></ytd-search-filter-renderer><yt-chip-cloud-chip-renderer id="button-filter"><button>Native All filter</button></yt-chip-cloud-chip-renderer><button>Filters</button></ytd-search-header-renderer>
<ytd-video-renderer id="result"><a href="/watch?v=abcdefghijk">Bread recipe</a></ytd-video-renderer>
<ytd-channel-renderer id="channel">Baker channel</ytd-channel-renderer>
<ytd-playlist-renderer id="playlist">Bread playlist</ytd-playlist-renderer>
<ytd-shelf-renderer id="related">People also watched</ytd-shelf-renderer>
<grid-shelf-view-model id="new-related"><a href="/watch?v=lmnopqrstuv">Explore more</a></grid-shelf-view-model>
<grid-shelf-view-model id="short-shelf"><ytm-shorts-lockup-view-model><a href="/shorts/abcdefghijk">Shorts</a></ytm-shorts-lockup-view-model></grid-shelf-view-model>
</ytd-search>
<div id="comments">Comments are still here</div>
</body></html>`;

const test = base.extend({
  setup: async ({}, use) => {
    const profile = await mkdtemp(path.join(tmpdir(), 'old-youtube-e2e-'));
    const executablePath = process.env.BROWSER_PATH || (existsSync(brave) ? brave : undefined);
    const context = await chromium.launchPersistentContext(profile, {
      executablePath, headless: true, channel: executablePath ? undefined : 'chromium',
      ignoreDefaultArgs: ['--disable-extensions'],
      args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`, '--disable-component-update', '--no-first-run'],
      viewport: { width: 1365, height: 900 },
    });
    try {
      const manager = await context.newPage();
      await manager.goto('chrome://extensions');
      const item = manager.locator('extensions-item').filter({hasText:'Old YouTube'});
      await expect(item).toBeVisible();
      const id = await item.getAttribute('id');
      await manager.close();
      const popup = await context.newPage();
      const errors = [];
      context.on('page', page => page.on('pageerror', error => errors.push(error.message)));
      popup.on('pageerror', error => errors.push(error.message));
      await popup.goto(`chrome-extension://${id}/popup.html`);
      await expect(popup.getByRole('switch')).toBeEnabled();
      await context.route('https://www.youtube.com/**', route => route.fulfill({contentType:'text/html',body:fixture}));
      const page = await context.newPage();
      await use({ context, popup, page, errors });
      expect(errors).toEqual([]);
    } finally { await context.close(); await rm(profile, { recursive: true, force: true }); }
  },
});

test('standard applies on first visit, leaves core features, and pauses reversibly', async ({ setup }) => {
  const {page,popup}=setup;
  await page.goto('https://www.youtube.com/');
  await expect(page.locator('html')).toHaveAttribute('data-oy-shorts','');
  for(const id of ['short-nav','short-card','short-shelf','channel-short-tab','games','chips','promo','related','new-related']) await expect(page.locator(`#${id}`)).toBeHidden();
  for(const id of ['regular','result','channel','playlist','comments']) await expect(page.locator(`#${id}`)).toBeVisible();
  await expect(page.getByRole('button',{name:'Filters',exact:true})).toBeVisible();
  await expect(popup.locator('#status')).toHaveText('On');
  await expect(popup.locator('#customize')).not.toHaveAttribute('open','');
  await popup.getByRole('switch').click();
  await expect(popup.locator('#status')).toHaveText('Off');
  for(const id of ['short-card','short-shelf','games','chips','related']) await expect(page.locator(`#${id}`)).toBeVisible();
  await popup.reload();
  await expect(popup.getByRole('switch')).toHaveAttribute('aria-checked','false');
  await popup.getByRole('switch').click();
  await expect(page.locator('#short-card')).toBeHidden();
  await popup.reload();
  await expect(popup.getByRole('switch')).toBeEnabled();
  expect(await popup.locator('body').evaluate(e=>e.getBoundingClientRect().height)).toBeLessThanOrEqual(600);
  await popup.setViewportSize({width:360,height:620});
  await popup.screenshot({path:path.join(tmpdir(),'old-youtube-popup.png'),fullPage:true});
});

test('new and recycled cards are classified after SPA updates', async ({ setup }) => {
  const {page}=setup;
  await page.goto('https://www.youtube.com/feed/subscriptions');
  await expect(page.locator('#short-card')).toBeHidden();
  await page.evaluate(()=>{
    document.querySelector('#short-card a').href='/watch?v=lmnopqrstuv';
    const card=document.createElement('yt-lockup-view-model');card.id='late-short';card.innerHTML='<a href="/shorts/lmnopqrstuv">New Short</a>';document.body.append(card);
    history.pushState({},'', '/@baker/videos');document.dispatchEvent(new Event('yt-navigate-finish'));
  });
  await expect(page.locator('#short-card')).toBeVisible();
  await expect(page.locator('#late-short')).toBeHidden();
});

test('default search, explicit native choices, remembered filters and restore', async ({ setup }) => {
  const {page,popup}=setup;
  await page.goto('https://www.youtube.com/results?search_query=bread');
  await expect(page).toHaveURL(/sp=EgIQAQ/);
  await expect(page.locator('#result')).toBeVisible();
  await page.locator('#channels-filter').click();
  await expect(page).toHaveURL(/sp=EgIQAg/);
  await page.goto('https://www.youtube.com/results?search_query=music');
  await expect(page).toHaveURL(/sp=EgIQAg/);
  await page.locator('#all-filter').click();
  await expect(page).toHaveURL('https://www.youtube.com/results?search_query=bread');
  await page.goto('https://www.youtube.com/results?search_query=new+search');
  await expect(page).not.toHaveURL(/sp=/);
  await popup.locator('summary').click();
  await popup.getByRole('button',{name:'Restore defaults'}).click();
  await expect(popup.getByRole('button',{name:'Restore defaults'})).toBeEnabled();
  await page.goto('https://www.youtube.com/results?search_query=reset');
  await expect(page).toHaveURL(/sp=EgIQAQ/);
});

test('optional override is immediate, persistent, and resettable', async ({ setup }) => {
  const {page,popup}=setup;
  await page.goto('https://www.youtube.com/');
  await expect(page.locator('#short-card')).toBeHidden();
  await popup.locator('summary').click();
  await popup.locator('[data-setting="hideShorts"]').uncheck();
  await expect(page.locator('#short-card')).toBeVisible();
  await expect(page.locator('#short-shelf')).toBeVisible();
  await expect(page.locator('#games')).toBeHidden();
  await expect(popup.locator('#status')).toHaveText('On');
  await popup.reload();
  await expect(popup.locator('[data-setting="hideShorts"]')).not.toBeChecked();
  await popup.locator('summary').click();
  await popup.getByRole('button',{name:'Restore defaults'}).click();
  await expect(page.locator('#short-card')).toBeHidden();
  await expect(popup.locator('#status')).toHaveText('On');
});

test('native filter buttons without href can choose All without being forced back to Videos', async ({ setup }) => {
  const {page}=setup;
  await page.goto('https://www.youtube.com/results?search_query=bread');
  await expect(page).toHaveURL(/sp=EgIQAQ/);
  await page.evaluate(()=>document.querySelector('#button-filter').addEventListener('click',()=>{
    history.pushState({},'', '/results?search_query=bread');
    document.dispatchEvent(new Event('yt-navigate-finish'));
  }));
  await page.getByRole('button',{name:'Native All filter',exact:true}).click();
  await expect(page).toHaveURL('https://www.youtube.com/results?search_query=bread');
  await page.goto('https://www.youtube.com/results?search_query=saved');
  await expect(page).toHaveURL('https://www.youtube.com/results?search_query=saved');
});

test('Shorts links redirect once, retaining timestamp, and pause prevents redirect', async ({ setup }) => {
  const {page,popup}=setup;
  await page.goto('https://www.youtube.com/shorts/abcdefghijk?t=20');
  await expect(page).toHaveURL('https://www.youtube.com/watch?t=20&v=abcdefghijk');
  await popup.getByRole('switch').click();
  await expect(popup.getByRole('switch')).toHaveAttribute('aria-checked','false');
  await page.goto('https://www.youtube.com/shorts/abcdefghijk');
  await expect(page).toHaveURL('https://www.youtube.com/shorts/abcdefghijk');
});

test('auto-dubbed videos and mixes hide by default with independent, persistent overrides', async ({ setup }) => {
  const {page,popup}=setup;
  // Simulate settings saved before these two options existed.
  await popup.evaluate(() => chrome.storage.local.set({settings:{enabled:true,hideShorts:false}}));
  await page.goto('https://www.youtube.com/');
  for(const id of ['dubbed','dubbed-legacy','mix','radio','both','shelf-dubbed']) await expect(page.locator(`#${id}`)).toBeHidden();
  for(const id of ['short-card','manual-playlist','dubbed-title','hidden-badge','mixed-shelf','shelf-regular','regular','playlist']) await expect(page.locator(`#${id}`)).toBeVisible();
  await popup.locator('summary').click();
  const dubbed=popup.getByRole('checkbox',{name:'Hide auto-dubbed videos',exact:true});
  const mixes=popup.getByRole('checkbox',{name:'Hide mixes',exact:true});
  await expect(dubbed).toBeChecked();
  await expect(mixes).toBeChecked();
  expect(await popup.locator('body').evaluate(e=>e.offsetHeight)).toBeLessThanOrEqual(600);
  await dubbed.uncheck();
  await expect(page.locator('#dubbed')).toBeVisible();
  await expect(page.locator('#both')).toBeHidden();
  await mixes.uncheck();
  for(const id of ['mix','radio','both']) await expect(page.locator(`#${id}`)).toBeVisible();
  await dubbed.check();
  await expect(page.locator('#both')).toBeHidden();
  await expect(page.locator('#mix')).toBeVisible();
  await popup.reload();
  await popup.locator('summary').click();
  await expect(dubbed).toBeChecked();
  await expect(mixes).not.toBeChecked();
  await popup.getByRole('button',{name:'Restore defaults'}).click();
  await expect(page.locator('#mix')).toBeHidden();
  await popup.getByRole('switch').click();
  for(const id of ['dubbed','mix','radio','both']) await expect(page.locator(`#${id}`)).toBeVisible();
  await popup.getByRole('switch').click();
  for(const id of ['dubbed','mix','radio','both']) await expect(page.locator(`#${id}`)).toBeHidden();
});

test('late badges and recycled mix/video cards update without hiding ordinary content', async ({ setup }) => {
  const {page}=setup;
  await page.goto('https://www.youtube.com/');
  await expect(page.locator('#dubbed')).toBeHidden();
  await page.evaluate(()=>{
    document.querySelector('#dubbed badge-shape div').textContent='HD';
    document.querySelector('#mix a').href='/playlist?list=PLabcdefghijk';
    document.querySelector('#dubbed-legacy ytd-badge-supported-renderer').setAttribute('aria-label','HD');
    document.querySelector('#hidden-badge badge-shape').removeAttribute('hidden');
    const card=document.createElement('ytd-compact-video-renderer');card.id='late-dubbed';card.innerHTML='<a id="video-title" href="/watch?v=abcdefghijk">New video</a><ytd-badge-supported-renderer>Auto-dubbed</ytd-badge-supported-renderer>';document.body.append(card);
  });
  for(const id of ['dubbed','dubbed-legacy','mix']) await expect(page.locator(`#${id}`)).toBeVisible();
  for(const id of ['hidden-badge','late-dubbed']) await expect(page.locator(`#${id}`)).toBeHidden();
  await page.evaluate(()=>{
    document.querySelector('#dubbed-legacy ytd-badge-supported-renderer').setAttribute('aria-label','Auto-dubbed');
    document.querySelector('#mix a').href='/watch?v=abcdefghijk&list=RDabcdefghijk';
    document.querySelector('#hidden-badge badge-shape').setAttribute('hidden','');
    document.querySelector('#late-dubbed ytd-badge-supported-renderer').remove();
  });
  for(const id of ['dubbed-legacy','mix']) await expect(page.locator(`#${id}`)).toBeHidden();
  for(const id of ['hidden-badge','late-dubbed']) await expect(page.locator(`#${id}`)).toBeVisible();
});

test('hiding topic chips keeps the first video row below the fixed header backdrop', async ({ setup }) => {
  const {context,page,popup}=setup;
  await context.route('https://www.youtube.com/',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><html><head><title>YouTube header layout</title><style>
    body{margin:0} ytd-app,ytd-page-manager,ytd-browse,ytd-rich-grid-renderer,ytd-rich-item-renderer,ytd-feed-filter-chip-bar-renderer{display:block}
    [hidden]{display:none!important} #masthead-container{position:fixed;inset:0 0 auto;height:var(--ytd-masthead-height,56px);z-index:2019;background:#111;color:white}
    #frosted-glass{position:fixed;inset:0 0 auto;height:112px;z-index:2018;background:#111}
    ytd-page-manager{margin-top:var(--ytd-masthead-height,56px)} ytd-feed-filter-chip-bar-renderer{height:56px}
    #contents{padding:24px} #first-thumbnail{display:block;width:320px;height:180px;background:#999}
  </style></head><body><ytd-app><div id="masthead-container">Search</div><div id="frosted-glass" class="with-chipbar"></div><ytd-page-manager><ytd-browse page-subtype="home"><ytd-rich-grid-renderer><div id="header"><ytd-feed-filter-chip-bar-renderer>Topic chips</ytd-feed-filter-chip-bar-renderer></div><div id="contents"><ytd-rich-item-renderer><a id="first-thumbnail" href="/watch?v=abcdefghijk">First video</a></ytd-rich-item-renderer></div></ytd-rich-grid-renderer></ytd-browse></ytd-page-manager></ytd-app></body></html>`}));
  await page.goto('https://www.youtube.com/');
  await expect(page.locator('#frosted-glass')).toHaveCSS('height','56px');
  const assertUncovered=async()=>{
    const geometry=await page.locator('#first-thumbnail').evaluate(e=>{
      const box=e.getBoundingClientRect();
      return {top:box.top,backdropBottom:document.querySelector('#frosted-glass').getBoundingClientRect().bottom,hit:document.elementFromPoint(box.left+4,box.top+4)?.id};
    });
    expect(geometry.backdropBottom).toBeLessThanOrEqual(geometry.top);
    expect(geometry.hit).toBe('first-thumbnail');
  };
  await assertUncovered();
  await popup.locator('summary').click();
  await popup.getByRole('checkbox',{name:'Hide topic chips',exact:true}).uncheck();
  await expect(page.locator('#frosted-glass')).toHaveCSS('height','112px');
  await assertUncovered();
  await popup.getByRole('checkbox',{name:'Hide topic chips',exact:true}).check();
  await expect(page.locator('#frosted-glass')).toHaveCSS('height','56px');
  await assertUncovered();
  await page.evaluate(()=>document.documentElement.style.setProperty('--ytd-masthead-height','64px'));
  await expect(page.locator('#frosted-glass')).toHaveCSS('height','64px');
  await assertUncovered();
  // YouTube retains hidden browse pages while navigating to a watch page.
  await page.evaluate(()=>{document.querySelector('ytd-browse').hidden=true;history.pushState({},'', '/watch?v=abcdefghijk');document.dispatchEvent(new Event('yt-navigate-finish'));});
  await expect(page.locator('#frosted-glass')).toHaveCSS('height','112px');
});
