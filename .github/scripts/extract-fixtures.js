// Pulls the demos' own inputs out of index.html, the graphs the Tarjan demo
// runs and the chord progressions the alignment demo compares, so the Python
// projects can be run on exactly the same inputs. Writes JSON to stdout.
//
// Usage: node .github/scripts/extract-fixtures.js index.html > fixtures.json

const fs = require('fs');
const vm = require('vm');

const src = fs.readFileSync(process.argv[2] || 'index.html', 'utf8');
const literal = name => {
  const start = src.indexOf(`const ${name} = [`);
  if (start < 0) throw new Error(`no ${name} in the page`);
  let i = src.indexOf('[', start), depth = 0;
  for (let j = i; j < src.length; j++) {
    if (src[j] === '[') depth++;
    else if (src[j] === ']' && --depth === 0) return src.slice(i, j + 1);
  }
  throw new Error(`unterminated ${name}`);
};
const ctx = { rep: (xs, n) => Array.from({ length: n }, () => xs).flat() };
const graphs = vm.runInNewContext(literal('CC_GRAPHS'), ctx);
const tracks = vm.runInNewContext(literal('TRACKS'), ctx);
process.stdout.write(JSON.stringify({
  graphs: graphs.map(g => ({ name: g.name, nodes: g.n, edges: g.e })),
  tracks: tracks.map(t => ({ name: t.name, seq: t.seq }))
}));
