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

## The counters

The three figures on the page, public repositories, contributions this year, and
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

There are no tests and no linter. The things most worth checking by hand after a
change are that the page still renders with the webfont blocked, that it works
at phone width, and that `node .github/scripts/update-stats.js` still finds all
three counters:

```bash
REPOS=0 CONTRIB=0 CI=0 node .github/scripts/update-stats.js index.html
```

That writes zeros, so discard the result with `git checkout index.html`. It is
worth running after any edit near the counters, because the workflow failing is
how you would otherwise find out, a day later.
