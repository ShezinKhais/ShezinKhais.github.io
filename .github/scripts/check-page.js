// Loads the site in a real browser and checks the things a reader would notice:
//   - no script errors on load, in either theme;
//   - axe finds no serious or critical accessibility problems, in the dark
//     theme, the light theme, and with reduced motion;
//   - every demo opens from its shared link, and printing the page with one open
//     puts that demo on the sheet with an address that rebuilds the same run.
// It only uses the page as a visitor first sees it: it opens the project demos
// and nothing else.
//
// Usage: node check-page.js <site-dir>   (needs playwright and axe-core installed
// beside it, and a Chromium playwright can launch)

const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.resolve(process.argv[2] || '.');
const AXE = require.resolve('axe-core/axe.min.js');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.pdf': 'application/pdf', '.xml': 'application/xml', '.txt': 'text/plain' };

const server = http.createServer((req, res) => {
  let p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(root)) { res.statusCode = 403; return res.end(); }
  if (p.endsWith('/')) p += 'index.html';
  fs.readFile(p, (err, data) => {
    if (err) { res.statusCode = 404; return res.end(); }
    res.setHeader('content-type', TYPES[path.extname(p)] || 'application/octet-stream');
    res.end(data);
  });
});

let failures = 0;
const fail = msg => { console.error('FAIL ' + msg); failures++; };
const pass = msg => console.log('ok   ' + msg);

(async () => {
  await new Promise(r => server.listen(0, r));
  const base = `http://localhost:${server.address().port}/`;
  const browser = await chromium.launch();

  const open = async (opts, hash = '') => {
    const ctx = await browser.newContext(opts);
    const page = await ctx.newPage();
    // offline runs can serve the text-layout library from a local copy
    if (process.env.PRETEXT_DIR) await page.route(/cdn\.jsdelivr\.net\/npm\/@chenglou\/pretext@[^/]+\/dist\/(.*)/,
      r => r.fulfill({ path: path.join(process.env.PRETEXT_DIR, r.request().url().split('/dist/')[1]), contentType: 'text/javascript' }));
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(base + hash, { waitUntil: 'load' });
    await page.waitForTimeout(1500);
    return { ctx, page, errors };
  };

  const axe = async (label, opts, prep) => {
    const { ctx, page, errors } = await open(opts);
    if (prep) await page.evaluate(prep);
    await page.addScriptTag({ path: AXE });
    const res = await page.evaluate(async () => {
      const r = await axe.run(document, { resultTypes: ['violations'] });
      return r.violations.filter(v => v.impact === 'serious' || v.impact === 'critical')
        .map(v => `${v.id} (${v.impact}): ${v.nodes.length} element(s), e.g. ${v.nodes[0].target.join(' ')}`);
    });
    if (errors.length) fail(`${label}: script errors: ${errors.join('; ')}`);
    if (res.length) fail(`${label}: accessibility\n  ` + res.join('\n  ')); else pass(`${label}: no serious accessibility problems`);
    await ctx.close();
  };

  await axe('dark theme', { colorScheme: 'dark' });
  await axe('light theme', { colorScheme: 'light' });
  await axe('reduced motion', { colorScheme: 'light', reducedMotion: 'reduce' });

  // every demo opens from its shared link without a script error
  for (const d of ['cc', 'hd', 'el', 'fa']) {
    const { ctx, page, errors } = await open({}, `#d=${d}`);
    const shown = await page.evaluate(k => !document.getElementById(k + 'Demo').hidden, d);
    if (!shown) fail(`demo ${d} did not open from its link`);
    else if (errors.length) fail(`demo ${d}: script errors: ${errors.join('; ')}`);
    else pass(`demo ${d} opens from its link`);
    await ctx.close();
  }

  // printing with a demo open carries it onto the sheet, with a link that rebuilds it
  {
    const { ctx, page } = await open({}, '#d=cc&g=2');
    await page.evaluate(async () => { document.getElementById('ccRun').click(); await new Promise(r => setTimeout(r, 1500)); });
    await page.evaluate(() => dispatchEvent(new Event('beforeprint')));
    const figs = await page.evaluate(() => [...document.querySelectorAll('.printfig code')].map(c => c.textContent));
    await page.evaluate(() => dispatchEvent(new Event('afterprint')));
    if (figs.length !== 1) fail(`print: expected 1 figure, found ${figs.length}`);
    else {
      const hash = figs[0].split('#')[1] || '';
      const p = new URLSearchParams(hash);
      if (p.get('d') === 'cc' && p.get('g') === '2') pass('print: the open demo is on the sheet with a link that rebuilds it');
      else fail(`print: the link does not rebuild the run: ${figs[0]}`);
    }
    await ctx.close();
  }

  await browser.close();
  server.close();
  if (failures) { console.error(`${failures} check(s) failed`); process.exit(1); }
})().catch(e => { console.error(e); process.exit(1); });
