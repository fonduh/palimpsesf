const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const base = process.env.TEST_URL || 'http://127.0.0.1:8877/';
const root = path.resolve(__dirname, '..');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && m.text().startsWith('[hero]')) errors.push(m.text()); });
    // Expose closure state only in this intercepted test response, never in production.
    await page.route('**/hero.js?*', async route => {
      const original = await (await route.fetch()).text();
      const hook = `window.__qa={get parcels(){return PARCS},get state(){return PST},get phase(){return PHASE},
        photoEntries,pnlEntries,inRange,openPanel,buildRing,rotateRing,bad:PBAD,good:PGOOD,
        setRange(a,b){YLO=a;YHI=b;window.__stackRefilter()},
        hit(p){return hitParcel(sxOf(p.ucx),syOf(p.ucy))},
        reveal(){maskX.fillStyle='#fff';maskX.fillRect(0,0,maskCv.width,maskCv.height)}};`;
      await route.fulfill({ body: original.replace(/\}\)\(\);\s*$/, hook + '\n})();'), contentType: 'application/javascript' });
    });
    // Deterministic external failure: a Planning URL alone must never light a parcel.
    await page.route('https://sfplanninggis.org/**', route => route.fulfill({ status: 404, body: '' }));
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__qa?.parcels?.length > 0);
    await page.locator('#word').click();
    await page.waitForFunction(() => window.__qa.phase === 'prompt');
    await page.locator('#sfs').click();
    await page.waitForSelector('#explore');
    await page.mouse.move(850, 600);
    await page.waitForFunction(() => window.__qa.phase === 'final');
    const inventory = await page.evaluate(() => {
      const q = window.__qa;
      const p = q.parcels.find(p => !p.lm && p.ph.length >= 2);
      const enriched = {ph:p.ph,lm:{timeline:[]}};
      if(q.photoEntries(enriched).length!==p.ph.length)throw Error('Landmark lost indexed photographs');
      if(q.photoEntries({ph:[[1900,'missing','missing']],lm:null}).length)throw Error('Missing local asset accepted');
      const remoteOnly=q.parcels.filter(p=>p.entries.every(e=>e.now));
      if(remoteOnly.some(q.inRange))throw Error('Unloaded remote image lit a parcel');
      for (const [lo,hi] of [[1848,2026],[1848,1850],[1900,1910],[2026,2026]]) {
        q.setRange(lo,hi);
        for(const p of q.parcels){
          const expected=p.entries.filter(e=>q.good.has(e.u)&&!q.bad.has(e.u)&&(e.now?hi===2026:!e.y||(e.y>=lo&&e.y<=hi)));
          if(q.inRange(p)!==Boolean(expected.length)||q.pnlEntries(p).length!==expected.length)throw Error('Filter mismatch '+p.b);
        }
      }
      q.setRange(1848,2026);
      const undated=q.parcels.find(p=>p.entries.some(e=>!e.y));
      q.setRange(2026,2026);
      if(!q.inRange(undated))throw Error('Undated photograph incorrectly hidden');
      q.setRange(1848,2026);
      return {candidates:q.parcels.length,visible:q.parcels.filter(q.inRange).length,remoteOnly:remoteOnly.length};
    });
    console.log('Parcel and year-filter checks:', inventory);
    for (const n of [1,2,3,54]) {
      await page.evaluate(n => {
        const q=window.__qa, p=q.parcels.find(p=>q.pnlEntries(p).length>=n);
        q.openPanel(p);q.buildRing(q.pnlEntries(p).slice(0,n));q.reveal();
      },n);
      await page.waitForFunction(()=>document.querySelector('.pnlcard.front img')?.naturalWidth>0);
      for(const focus of [0,n-1]) {
        await page.evaluate(i=>window.__qa.rotateRing(i),focus);
        for(const wait of [100,650]) {
          await page.waitForTimeout(wait);
          const upright=await page.evaluate(()=>[...document.querySelectorAll('.pnlcard')].filter(c=>+getComputedStyle(c).opacity>.05).every(c=>{
            const m=new DOMMatrix(getComputedStyle(c).transform);return m.m11>0&&m.m22>0&&Math.abs(m.m23)<.001;
          }));
          assert(upright, `Text inverted in ${n}-photo stack`);
        }
      }
      await page.screenshot({path:`/tmp/palimpsesf-stack-${n}.png`});
    }
    // A failed last image must disappear from rendering AND hit testing, not just its card.
    await page.route('**/geotag/thumbs/52.jpg', route=>route.fulfill({status:404,body:''}));
    await page.evaluate(()=>window.__qa.openPanel(window.__qa.parcels.find(p=>p.b==='3608075')));
    await page.waitForFunction(()=>window.__qa.bad.has('geotag/thumbs/52.jpg'));
    await page.waitForTimeout(700);
    assert(await page.evaluate(()=>{const q=window.__qa,p=q.parcels.find(p=>p.b==='3608075');return !q.inRange(p)&&q.hit(p)?.b!==p.b&&q.state===null}));
    assert.equal(await page.locator('#pnlring').evaluate(el=>getComputedStyle(el).transform),'none');
    // Changing years while a stack is open must also clear its images.
    await page.evaluate(()=>{const q=window.__qa;const p=q.parcels.find(p=>!p.lm&&p.entries.length===1&&p.entries[0].y===1981&&q.inRange(p));q.openPanel(p);q.setRange(1848,1850)});
    assert.equal(await page.locator('.pnlcard').count(),0);
    assert(await page.locator('.pnlnote').isVisible());
    assert.deepEqual(errors,[]);
    console.log('PASS: intro, year filters, undated images, missing assets, remote failures, failed last image, empty stack, upright 1/2/3/54-card transitions.');
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1});
