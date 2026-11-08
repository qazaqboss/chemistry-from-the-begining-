const { chromium, devices } = require('playwright');
const fs = require('fs');
const LESSONS = ["intro","atom","shells","periodic","bonds","molecules","states","reactions","mole","solutions","redox","crystals","organic","nuclear"];
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  const all = new Map(); // sentence -> set of sources
  const addAll = (arr, src) => arr.forEach((s) => { s = s.trim(); if (!s) return; if (!all.has(s)) all.set(s, new Set()); all.get(s).add(src); });
  for (const dev of ['desk', 'phone']) {
    const ctx = await b.newContext(dev === 'phone' ? { ...devices['iPhone 13'] } : { viewport: { width: 1300, height: 850 } });
    await ctx.addInitScript(() => localStorage.setItem('guideHello', 'true'));
    const p = await ctx.newPage();
    p.on('pageerror', (e) => console.error('ERR', e.message));
    await p.goto('http://localhost:8765/#home', { waitUntil: 'networkidle' });
    for (const mode of ['adult', 'kid']) {
      await p.click(`[data-mode=${mode}]`).catch(() => p.evaluate((m) => document.querySelector(`[data-mode=${m}]`).click(), mode));
      const pages = ['home', 'course', 'lab', 'glossary', ...LESSONS.map((l) => 'lesson-' + l), ...Array.from({ length: 118 }, (_, i) => 'element-' + (i + 1))];
      for (const pg of pages) {
        await p.evaluate((h) => { location.hash = h; }, '#' + pg);
        await p.waitForTimeout(pg.startsWith('element') ? 150 : 600);
        const r = await p.evaluate(async (pg) => {
          const g = await import('/js/guide.js');
          const out = g.guideCorpus();
          const ex = [];
          const sels = pg === 'home' ? '.el, .legend button, .hero-stats .stat, .lesson-card, .pt-tools select, .pt-view, [data-mode], #themeBtn, .nav a, .brand, .pt .gap'
            : pg.startsWith('element') ? '.el-tile, .prop, .shell-bar, .stage, [data-term], .chip, .kid-box'
            : pg === 'glossary' ? '[data-term], .card' : pg.startsWith('lesson') ? '[data-term], .formula, .callout, .kid-box, .stage, .quiz, .toc, .say-sec, .coef, .atom-count' : '.chip, .stage, .lesson-card, .progress';
          const exEl = [];
          document.querySelectorAll(sels).forEach((el) => { try { (el.matches('.el') ? exEl : ex).push(...g.explainCorpus(el)); } catch (e) {} });
          return { out, ex, exEl };
        }, pg);
        addAll(r.out, pg); addAll(r.ex, 'x:' + pg); addAll(r.exEl, 'x:element-cell');
      }
      // glossary popover "Послушать"
      const gl = await p.evaluate(async (mode) => {
        const { GLOSSARY } = await import('/js/data/glossary.js');
        const g = await import('/js/guide.js');
        const arr = Array.isArray(GLOSSARY) ? GLOSSARY : Object.values(GLOSSARY);
        return arr.flatMap((t) => g.speechSentences(`${t.term}. ${mode === 'kid' ? t.kid : t.def + ' Проще говоря: ' + t.kid}`));
      }, mode);
      addAll(gl, 'pop');
      console.error(dev, mode, all.size);
    }
    await ctx.close();
  }
  const arr = [...all.entries()].map(([s, src]) => ({ s, src: [...src].slice(0, 3), n: src.size }));
  fs.writeFileSync(process.env.SP + '/corpus.json', JSON.stringify(arr, null, 0));
  const chars = arr.reduce((a, x) => a + x.s.length, 0);
  console.log('sentences', arr.length, 'chars', chars);
  await b.close();
})();
