// Re-derives every figure in .github/claims.json from the project it describes,
// at the head of that project's default branch, and checks the page still says
// it. A figure that has drifted on either side fails the run, so the copy cannot
// quietly go stale.
//
// Usage: node .github/scripts/verify-claims.js [index.html]   (needs git, python3)

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

const owner = process.env.OWNER || 'ShezinKhais';
const page = fs.readFileSync(process.argv[2] || 'index.html', 'utf8');
const { claims } = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'claims.json'), 'utf8'));
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'claims-'));
const local = process.env.CLAIMS_REPOS;   // a folder of existing clones, for running it offline

let bad = 0;
const cloned = new Map();
for (const c of claims) {
  if (!page.includes(c.page)) { console.error(`the page no longer says "${c.page}"`); bad++; continue; }
  let dir = cloned.get(c.repo);
  if (!dir) {
    dir = local ? path.join(local, c.repo) : path.join(work, c.repo);
    if (!local) execSync(`git clone -q --depth 1 https://github.com/${owner}/${c.repo} ${JSON.stringify(dir)}`);
    cloned.set(c.repo, dir);
  }
  const got = Number(execSync(c.derive, { cwd: dir, shell: '/bin/bash' }).toString().trim());
  if (got !== c.value) { console.error(`${c.repo}: "${c.page}" says ${c.value}, the repo now gives ${got}`); bad++; }
  else console.log(`${c.repo}: ${c.value} holds`);
}
fs.rmSync(work, { recursive: true, force: true });
if (bad) process.exit(1);
