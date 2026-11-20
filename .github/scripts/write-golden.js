// Writes the expected demo answers (from golden.py) into index.html, inside
// <script type="application/json" id="golden">. The block must appear exactly
// once, and the JSON must parse, or the run fails.
//
// Usage: node .github/scripts/write-golden.js golden.json [index.html]

const fs = require('fs');
const json = fs.readFileSync(process.argv[2], 'utf8').trim();
JSON.parse(json);
if (json.includes('</')) { console.error('refusing JSON that could close the script element'); process.exit(1); }
const file = process.argv[3] || 'index.html';
let src = fs.readFileSync(file, 'utf8');
const re = /(<script type="application\/json" id="golden">)[^<]*(<\/script>)/g;
const hits = src.match(re);
if (!hits || hits.length !== 1) { console.error(`expected exactly 1 golden block, found ${hits ? hits.length : 0}`); process.exit(1); }
src = src.replace(re, (_, a, b) => a + json + b);
fs.writeFileSync(file, src);
console.log('golden answers written');
