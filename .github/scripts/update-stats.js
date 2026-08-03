// Rewrites the three counters in index.html from values supplied in the
// environment. Each counter is located by the label that follows it, so the
// numbers can never be swapped by a change to the markup order.
//
// Usage: REPOS=9 CONTRIB=83 CI=7 node .github/scripts/update-stats.js [file]

const fs = require('fs');

const file = process.argv[2] || 'index.html';
const wanted = [
  ['public repositories', process.env.REPOS],
  ['contributions this year', process.env.CONTRIB],
  ['projects with CI suites', process.env.CI],
];

let src = fs.readFileSync(file, 'utf8');

for (const [label, value] of wanted) {
  if (!/^\d+$/.test(String(value || ''))) {
    console.error(`refusing to write a non-numeric value for "${label}": ${value}`);
    process.exit(1);
  }
  const esc = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(
    `(<b data-count=")\\d+("[^>]*>)\\d+(</b><span>${esc}</span>)`, 'g');
  const hits = src.match(re);
  if (!hits || hits.length !== 1) {
    console.error(`expected exactly 1 match for "${label}", found ${hits ? hits.length : 0}`);
    process.exit(1);
  }
  src = src.replace(re, `$1${value}$2` + '0' + '$3');
}

fs.writeFileSync(file, src);
console.log(`stats written: ${wanted.map(([l, v]) => `${v} ${l}`).join(', ')}`);
