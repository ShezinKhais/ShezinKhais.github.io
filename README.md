# shezinkhais.github.io

The portfolio site at [shezinkhais.github.io](https://shezinkhais.github.io/),
served by GitHub Pages straight from `main`.

The whole site is one file. `index.html` carries its own stylesheet and scripts
inline, so there is no build step, no bundler and no package manifest: editing
the file and pushing it is the deploy. Open it from disk and it is the site,
apart from the webfont, which is the only thing fetched from anywhere.

## What is in the repository

| File | What it is |
|---|---|
| `index.html` | The site. Roughly 48 KB of CSS and 410 KB of script, inline. |
| `404.html` | The not-found page, styled to match. |
| `cv.pdf` | Linked from the page. |
| `social.png` | The Open Graph preview image. |
| `robots.txt`, `sitemap.xml` | Crawler directions. |
| `.github/workflows/stats.yml` | Refreshes the three counters once a day. |
| `.github/scripts/update-stats.js` | Writes those counters into `index.html`. |
| `.github/scripts/collect-proof.sh` | Gathers each project's CI result, test count, last commit and licence. |
| `.github/scripts/update-proof.js` | Writes that line under each project card. |
| `.github/workflows/check.yml`, `.github/scripts/check-page.js`, `.htmlvalidate.json` | The checks every push and pull request runs. |
| `.github/workflows/golden.yml`, `.github/scripts/extract-fixtures.js`, `golden.py`, `write-golden.js` | Run the projects' own Python on the demos' inputs and write the answers into the page, for its "Check against the repo" buttons. |
| `.github/claims.json`, `.github/workflows/claims.yml`, `.github/scripts/verify-claims.js` | Re-derive every figure the page states about a project from its repo, weekly, and fail if they disagree. |

## The counters

The three figures on the page, public repositories, contributions in the last year, and
projects with CI suites, are not computed in the browser. A scheduled workflow
queries the GitHub API at 04:17 UTC daily, writes the numbers into `index.html`
and commits the result only if one of them moved. It can also be run by hand
from the Actions tab.

`update-stats.js` finds each counter by the label that follows it rather than by
position, so reordering the markup cannot silently swap two numbers. It refuses
to write a non-numeric value, and it exits non-zero unless each label matches
exactly once, so a markup change that breaks the anchor fails the run instead of
quietly leaving a stale figure on the page.

The commits that result are authored by `github-actions[bot]` and have messages
of the form `stats - 10 repos, 316 contributions, 8 with CI`.

## Working on it

```bash
python -m http.server 8000
```

Then open `http://127.0.0.1:8000`. A plain file open works too, but serving it
over localhost is closer to how it is actually delivered.

Every push and pull request runs `.github/workflows/check.yml`, which:

- validates the HTML;
- keeps the gzipped page under its size budget;
- dry-runs every script that writes into the page, so a broken anchor fails
  there rather than in the next day's stats run;
- loads the page in Chromium and runs axe in both themes and with reduced
  motion;
- opens each demo from its shared link;
- checks that printing with a demo open puts it on the sheet with a working
  link;
- checks the outbound links;
- runs Lighthouse with phone throttling, and fails if accessibility drops below
  90.

The tools are installed inside the job, so the repository still has no
package manifest. To run the browser checks locally, install `playwright` and
`axe-core` in a scratch folder, copy `.github/scripts/check-page.js` into it
and run `node check-page.js /path/to/this/repo`.

What still needs a person after a change: the page with the webfont blocked, and
the page at phone width.
