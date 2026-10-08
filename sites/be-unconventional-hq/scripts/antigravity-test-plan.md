# Test plan

The verification protocol for this repo. Follow it before reporting on any
branch. It exists because a previous audit reported `astro check` at 0/0/0 and
130/130 unit tests while the branch had 3 errors and could not run a single
suite — see `scripts/antigravity-audit-findings.md`.

**One rule above all the others: never write a result you did not watch a
command print.** Every claim below has a command next to it. Paste its real
output. "Should pass" is not a result, and neither is a green Cloudflare
Workers build.

---

## 0. Pre-flight

```bash
node -v                 # must satisfy engines: >=22.15.0
npm ci                  # NOT `npm install` - it rewrites package-lock.json
git status --short      # must be empty before you start
```

`npm install` on an older npm strips `libc` fields from the lockfile and adds
two dozen lines of unrelated diff. If `package-lock.json` shows up modified and
you did not change a dependency, revert it: `git checkout -- package-lock.json`.

## 1. The four gates, in dependency order

Order matters. Gates 3 and 4 need `dist/`, which gate 2 does not produce.

| # | Gate | Command | Bar |
| --- | --- | --- | --- |
| 1 | Types | `npx astro check` | **0 errors, 0 warnings, 0 hints.** Baseline is 0/0/0 since the Astro 7 migration, so any number above zero is yours |
| 2 | Offline units | `npm test` | **All 31 suites, exit 0.** Check the exit code: `npm test; echo $?` |
| 3 | Build | `npm run build` | Exit 0. Fully offline by design |
| 4 | End-to-end | `npm run test:e2e` | 22/23. `e2e-newsletter-subscribe` is on the runner's documented `CI_SKIP` list and needs a Turnstile challenge a sandboxed network blocks |

### Reading gate 2 correctly

`npm test` is thirty-one suites joined by `&&`. **It short-circuits.** A suite
that fails or exits early hides every suite after it, so "the last thing printed
was a pass" tells you nothing. Always check `echo $?`, and if a suite fails,
run the rest individually before concluding anything about scope:

```bash
npm test; echo "EXIT=$?"
node scripts/command-palette.test.mjs   # or whichever failed, on its own
```

Two guards in `scripts/e2e-harness.test.mjs` now fail the build if a suite that
reads `dist/` or exits before its assertions is added to `npm test`. If either
fires, the fix is to rename the file to `e2e-*.test.mjs`, not to loosen the
guard: `scripts/e2e-run.mjs` discovers those from disk in the job that has
already built.

## 2. Targeted regression checks

Each of these is a bug that shipped. Re-run them whenever you touch the area.

### Search palette default view
```bash
node scripts/command-palette.test.mjs        # 26 assertions
```
Pins: ten items total; four hubs, one per `hubCategory`; events budgeted out of
the article/video half so the hubs are never pushed past the cap; events sorted
**ascending** so "upcoming" means soonest; the clear button derived from the
input through a single `syncClearBtn()`.

Manual pass, in `npm run dev`, when there is an upcoming event in
`src/data/videos.json`:
1. Open the palette (Cmd+K). Count the rows: **ten**. Four should be hubs, from
   four different categories.
2. The events shown must be the **nearest** ones, not the furthest out.
3. Type `marvel`, press Escape, reopen. **The X must be gone**, not sitting over
   an empty field.
4. Type spaces only. The X must appear — a field of spaces is not empty.

### Video structured data
```bash
npm run build
python3 - <<'PY'
import re, json
h = open('dist/client/index.html', encoding='utf-8').read()
b = [x for x in re.findall(r'<script type="application/ld\+json">(.*?)</script>', h, re.S) if 'VideoObject' in x]
print(f'{sum(len(x.encode()) for x in b)}B across {len(b)} blocks')
for x in b:
    d = json.loads(x)                     # must parse: a JSON-LD block that does not is invisible
    assert d['description'], 'description is required on a VideoObject'
    assert len(d['description']) <= 320
print('ok')
PY
```
Expect roughly **5 KB**, not 18 KB. If it jumps, someone has put the raw YouTube
description back in place of the cleaned `excerpt`.

### The Studio must never be in a production build
```bash
npm run build
find dist -path '*admin*'                              # must print nothing
grep -rli sanity dist/client --include=*.js | wc -l    # must print 0
```

And the failure path that guard exists for — a production install without
devDependencies must **warn and continue**, never die:
```bash
mv node_modules/@sanity/astro /tmp/astro-pkg
NODE_ENV=development npx astro build           # expect one [studio] warning, exit 0
mv /tmp/astro-pkg node_modules/@sanity/astro
```

## 3. Reporting

Report per gate, with the output. This template is the whole deliverable:

```
astro check     0 errors, 0 warnings, 0 hints        <paste the Result line>
npm test        31/31 suites, exit 0                 <paste the last suite + EXIT=>
npm run build   exit 0
npm run test:e2e  22/23 (newsletter-subscribe: CI_SKIP)
CI              <the actual conclusion of test-and-build on the PR>
```

Rules for the write-up:

- **A red CI job is a red branch.** Check `test-and-build` specifically. The
  Cloudflare Workers and Pages checks are deploy previews; they pass while the
  test job is failing.
- **Never describe a fix you have not re-run the gate against.** The previous
  report described three fixes that were never written, and each would have
  been caught by re-running the one command it named.
- **Say which things you did not test, and why.** An honest gap is useful. A
  claimed pass that turns out to be red costs more than the bug did.
- If a fix is applied to the wrong site — the previous report annotated the
  videos handler three times while the articles handler stayed untyped — the
  gate tells you immediately. Re-run it. That is the whole point of it.

## 4. Known-acceptable failures

Only two. Anything else is a real finding.

- **`e2e-newsletter-subscribe`** — on `CI_SKIP` in `scripts/e2e-run.mjs`, which
  documents why. Races the submit click against Turnstile's own failure
  detection; not deterministic. Skipped in CI, still runs locally by hand.
- **Sanity fetches failing on a sandboxed network** (`403 Host not in
  allowlist`). `/media-kit` and `UpcomingEventsList` fall back to local cache
  **by design** — the build must never fail on them. A warning here is the
  contract working, not a defect.
