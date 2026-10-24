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
  const dubbed=popup.getByRole('checkbox',{name:'No Robot Dubs',exact:true});
  const mixes=popup.getByRole('checkbox',{name:'No Endless Mixes',exact:true});
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
  await popup.getByRole('checkbox',{name:'No Topic Clutter',exact:true}).uncheck();
  await expect(page.locator('#frosted-glass')).toHaveCSS('height','112px');
  await assertUncovered();
  await popup.getByRole('checkbox',{name:'No Topic Clutter',exact:true}).check();
  await expect(page.locator('#frosted-glass')).toHaveCSS('height','56px');
  await assertUncovered();
  await page.evaluate(()=>document.documentElement.style.setProperty('--ytd-masthead-height','64px'));
  await expect(page.locator('#frosted-glass')).toHaveCSS('height','64px');
  await assertUncovered();
  // YouTube retains hidden browse pages while navigating to a watch page.
  await page.evaluate(()=>{document.querySelector('ytd-browse').hidden=true;history.pushState({},'', '/watch?v=abcdefghijk');document.dispatchEvent(new Event('yt-navigate-finish'));});
  await expect(page.locator('#frosted-glass')).toHaveCSS('height','112px');
});

const stillImage = (width=480,height=360,color='#ea7800') => `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="${color}"/></svg>`;
const originalImage = `data:image/svg+xml;base64,${Buffer.from(stillImage(480,270,'#0070dd')).toString('base64')}`;
const thumbnailFixture = `<!doctype html><html><head><title>Video frame fixture</title><style>
body{margin:0}ytd-video-renderer,yt-lockup-view-model{display:block}a{display:block;width:240px;height:135px;position:relative}img{display:block;width:240px;height:135px;object-fit:cover}.ytThumbnailViewModelImage{position:absolute;inset:0}#duration{position:absolute;bottom:0;right:0;color:white;background:black}#offscreen{margin-top:3000px}
</style></head><body>
<ytd-video-renderer><a id="thumbnail" href="/watch?v=abcdefghijk"><yt-image><img id="img" src="${originalImage}" srcset="${originalImage} 1x"></yt-image><span id="duration">10:00</span></a></ytd-video-renderer>
<yt-lockup-view-model id="modern"><a class="ytLockupViewModelContentImage" href="/watch?v=lmnopqrstuv"><div class="ytThumbnailViewModelImage"><img src="${originalImage}"></div></a></yt-lockup-view-model>
<yt-lockup-view-model id="playlist-thumb"><a class="ytLockupViewModelContentImage" href="/watch?v=abcdefghijk&list=PLtest"><div class="ytThumbnailViewModelImage"><img src="${originalImage}"></div></a></yt-lockup-view-model>
<yt-lockup-view-model id="live-thumb"><a class="ytLockupViewModelContentImage" href="/watch?v=11111111111"><div class="ytThumbnailViewModelImage"><img src="${originalImage}"></div><badge-shape>LIVE</badge-shape></a></yt-lockup-view-model>
<a href="/@channel"><img id="avatar" src="${originalImage}"></a>
<ytd-video-renderer id="offscreen"><a id="thumbnail" href="/watch?v=22222222222"><yt-image><img id="img" src="${originalImage}"></yt-image></a></ytd-video-renderer>
</body></html>`;

test('video frames replace visible artwork, preserve sources and controls, and restore immediately', async ({setup})=>{
  const {context,page,popup}=setup;
  const requests=[];
  await context.route('https://i.ytimg.com/vi/*/hq2.jpg',route=>{requests.push(route.request().url());return route.fulfill({contentType:'image/svg+xml',body:stillImage()});});
  await context.route('https://www.youtube.com/',route=>route.fulfill({contentType:'text/html',body:thumbnailFixture}));
  await popup.locator('summary').click();
  const option=popup.getByRole('checkbox',{name:'No Thumbnail Bait',exact:true});
  await expect(option).toBeChecked();
  await option.uncheck();
  await page.goto('https://www.youtube.com/');
  const image=page.locator('body > ytd-video-renderer img').first();
  await expect(image).toBeVisible();
  const original=await image.screenshot();
  await option.check();
  await expect(image).toHaveCSS('content','url("https://i.ytimg.com/vi/abcdefghijk/hq2.jpg")');
  await expect(page.locator('#modern img')).toHaveAttribute('data-oy-frame','');
  expect(await image.screenshot()).not.toEqual(original);
  await expect(image).toHaveAttribute('src',originalImage);
  await expect(image).toHaveAttribute('srcset',`${originalImage} 1x`);
  await expect(page.locator('#duration')).toBeVisible();
  expect(await page.locator('#duration').evaluate(e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.left+2,r.top+2));})).toBe(true);
  for(const id of ['playlist-thumb','live-thumb','avatar','offscreen']) await expect(page.locator(`#${id} img, img#${id}`)).not.toHaveAttribute('data-oy-frame');
  expect(requests).toHaveLength(2);
  await option.uncheck();
  await expect(image).toHaveCSS('content','normal');
  expect(await image.screenshot()).toEqual(original);
  await option.check();
  await expect(image).toHaveAttribute('data-oy-frame','');
  await popup.getByRole('switch').click();
  await expect(image).not.toHaveAttribute('data-oy-frame');
  await expect(image).toHaveCSS('content','normal');
  await popup.getByRole('switch').click();
  await expect(image).toHaveAttribute('data-oy-frame','');
  expect(await popup.locator('body').evaluate(e=>e.offsetHeight)).toBeLessThanOrEqual(600);
  await page.locator('#offscreen a').scrollIntoViewIfNeeded();
  await expect(page.locator('#offscreen img')).toHaveAttribute('data-oy-frame','');
});

test('missing frames and recycled cards never keep stale artwork or retry endlessly', async ({setup})=>{
  const {context,page,popup}=setup;
  const requests=[];
  await context.route('https://i.ytimg.com/vi/*/hq2.jpg',route=>{
    const url=route.request().url();requests.push(url);
    if(url.includes('/lmnopqrstuv/'))return route.fulfill({contentType:'image/svg+xml',body:stillImage(120,90)});
    if(url.includes('/33333333333/'))return route.fulfill({status:404,body:''});
    return route.fulfill({contentType:'image/svg+xml',body:stillImage()});
  });
  await context.route('https://www.youtube.com/',route=>route.fulfill({contentType:'text/html',body:thumbnailFixture}));
  await page.goto('https://www.youtube.com/');
  const image=page.locator('body > ytd-video-renderer img').first();
  await expect(image).toHaveAttribute('data-oy-frame','');
  await expect.poll(()=>requests.some(url=>url.includes('/lmnopqrstuv/'))).toBe(true);
  await expect(page.locator('#modern img')).not.toHaveAttribute('data-oy-frame');
  await page.evaluate(()=>{
    const a=document.querySelector('a#thumbnail');a.href='/watch?v=33333333333';
    a.querySelector('img').src='data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="480" height="270"><rect width="480" height="270" fill="green"/></svg>';
    a.querySelector('img').removeAttribute('srcset');
  });
  await expect(image).not.toHaveAttribute('data-oy-frame');
  await expect.poll(()=>requests.some(url=>url.includes('/33333333333/'))).toBe(true);
  await page.evaluate(()=>document.querySelector('a#thumbnail').href='/watch?v=abcdefghijk');
  await expect(image).toHaveAttribute('data-oy-frame','');
  await popup.locator('summary').click();await popup.getByRole('checkbox',{name:'No Thumbnail Bait',exact:true}).uncheck();
  await expect(image).toHaveCSS('content','normal');
  await expect(image).toHaveAttribute('src',/fill="green"/);
  await expect(image).not.toHaveAttribute('srcset');
  expect(requests.filter(url=>url.includes('/lmnopqrstuv/'))).toHaveLength(1);
  expect(requests.filter(url=>url.includes('/33333333333/'))).toHaveLength(1);
});
