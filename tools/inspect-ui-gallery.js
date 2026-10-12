/* Browser inspection of the static reference gallery, not game logic. */
const fs = require('fs'), path = require('path');
let chromium;
try { ({chromium} = require('playwright')); } catch {
  ({chromium} = require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
}
(async () => {
  const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
  const browser = await chromium.launch({headless: true, ...(fs.existsSync(edge) ? {executablePath: edge} : {})});
  try {
    const page = await browser.newPage({viewport: {width: 1440, height: 960}});
    const errors = [], missing = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('response', r => { if (r.status() >= 400) missing.push({url: r.url(), status: r.status()}); });
    await page.goto('http://127.0.0.1:8899/docs/ui-reference/review.html');
    await page.waitForFunction(() => document.querySelectorAll('.card').length > 0);
    const total = await page.locator('.card').count();
    const loadedImages = await page.evaluate(async () => {
      const entries = await (await fetch('SCREENS.json')).json();
      return Promise.all(entries.map(s => new Promise(resolve => {
        const img = new Image();
        img.onload = () => resolve({id:s.id, loaded:img.naturalWidth>0});
        img.onerror = () => resolve({id:s.id, loaded:false});
        img.src = s.image;
      })));
    });
    await page.selectOption('#filter', 'ready');
    const available = await page.locator('.card').count();
    await page.locator('.card img').first().click();
    await page.waitForFunction(() => document.querySelector('#preview').open && document.querySelector('#full').naturalWidth > 0);
    await page.keyboard.press('Escape');
    const dialogClosed = await page.locator('#preview').evaluate(e => !e.open);
    await page.screenshot({path: path.resolve(__dirname, '../docs/ui-reference/GALLERY-CHECK.png')});
    await page.setViewportSize({width: 390, height: 844});
    const noHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
    const report = {total, available, loadedImages, dialogClosed, noHorizontalOverflow, errors, missing};
    fs.writeFileSync(path.resolve(__dirname, '../docs/ui-reference/GALLERY-REPORT.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    if (!dialogClosed || !noHorizontalOverflow || errors.length || missing.length || loadedImages.some(x=>!x.loaded)) process.exitCode = 1;
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
