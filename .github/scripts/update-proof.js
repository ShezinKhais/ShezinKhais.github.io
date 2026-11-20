// Writes the receipt under each project card from the JSON collect-proof.sh
// produced: "CI passing · 102 tests in source · last commit 12 Nov 2026 · MIT".
// Each slot is found by its repo name and must match exactly once, as the
// counters must, so a markup change fails the run instead of leaving a stale
// line. A failing build is shown as when it was last green, not hidden.
//
// Usage: node .github/scripts/update-proof.js proof.json [index.html]

const fs = require('fs');

const proof = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const file = process.argv[3] || 'index.html';
let src = fs.readFileSync(file, 'utf8');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const day = iso => {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

let written = 0;
for (const [repo, p] of Object.entries(proof)) {
  if (!/^[A-Za-z0-9._-]+$/.test(repo)) { console.error(`refusing an odd repo name: ${repo}`); process.exit(1); }
  const parts = [];
  if (p.ci === 'passing') parts.push('CI passing');
  else if (p.ci === 'failing') parts.push(p.lastGreen ? `CI last green ${day(p.lastGreen)}` : 'CI failing');
  if (/^\d+$/.test(p.tests || '')) parts.push(`${p.tests} tests in source`);
  if (day(p.lastCommit)) parts.push(`last commit ${day(p.lastCommit)}`);
  if (p.licence) parts.push(`${p.licence} licence`);
  const text = esc(parts.join(' · '));

  const re = new RegExp(`(<p class="receipt" data-repo="${repo.replace(/[.]/g, '\\.')}">)[^<]*(</p>)`, 'g');
  const hits = src.match(re);
  if (!hits || hits.length !== 1) {
    console.error(`expected exactly 1 receipt slot for "${repo}", found ${hits ? hits.length : 0}`);
    process.exit(1);
  }
  src = src.replace(re, `$1${text}$2`);
  written++;
}
fs.writeFileSync(file, src);
console.log(`receipts written for ${written} projects`);
