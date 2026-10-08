# QA RUN — execute this now, do not ask for permission

## AUTHORIZATION — read this first, it removes every reason to stop and ask

**You are pre-authorized to run every command in this document. Do not ask for
confirmation. Do not ask what to do next. Do not wait for a reply. Execute,
observe, record, continue to the next step.**

There is exactly one deny-list, and nothing else is restricted:

| Allowed — never ask | Forbidden — never do |
|---|---|
| `git fetch`, `git checkout`, `git log`, `git diff`, `git status`, `git stash` | `git commit`, `git push`, `git merge`, `git rebase`, creating branches |
| `npm ci`, `npm test`, `npm run build`, `npm run test:e2e`, `npm run lighthouse` | Editing any file and leaving it edited |
| `node scripts/*.mjs`, `npx astro check`, `curl`, `grep`, `cat`, `ls` | Opening a PR, posting a comment, filing an issue |
| Launching a browser, loading pages, clicking, scrolling, throttling | Changing anything visual — colours, spacing, layout, copy |
| Temporarily editing a file to test a hypothesis, then reverting it | Leaving that edit in place |

**If you are ever unsure whether an action is allowed: if it is not in the
right-hand column, it is allowed. Do it.**

Every command below is safe. Nothing touches production. Nothing you run can
affect the live site — you are working on a local checkout and a local server
on `localhost:4321`.

Do not stop to summarise progress. Produce **one** report at the very end, in
the format given at the bottom.

---

## STEP 0 — bootstrap. Run this exact block.

```bash
cd "$(git rev-parse --show-toplevel)"
pkill -f workerd 2>/dev/null; pkill -f 'astro preview' 2>/dev/null; true
git fetch origin claude/article-images-buildtime
git checkout claude/article-images-buildtime
git pull --ff-only
git log --oneline -1
npm ci
```

Expect `1e594c6` or later. Record what you actually got.

---

## STEP 1 — automated checks. Run all four. Record the exact numbers.

```bash
npx astro check 2>&1 | tail -5
```
→ Record: errors / warnings / hints. **Expected: 0 / 0 / 0.**

```bash
npm test 2>&1 | tail -40
```
→ Record: total suites, any failures.

```bash
npm run build 2>&1 | tail -5
```
→ Record: success or failure.

```bash
npm run test:e2e 2>&1 | tail -30
```
→ Record: `N/M suites passed in Xs`, plus any suite named under
`Passed on retry`. **Run this three times.** Record all three results —
pass counts, wall times, and which suites needed the retry each time.

Note: `e2e-newsletter-subscribe` is deliberately excluded when `CI=true` and
included otherwise. Locally you will see 20 suites. That is correct.

---

## STEP 2 — the article gallery on a phone. This is the highest-value test.

This exact surface shipped broken once: images were blank and stayed blank
while sliding. Do not skip it, and do not substitute reasoning for measurement.

```bash
npm run build && npm run preview
```

Then, in a browser at `http://localhost:4321`:

1. Open `/intel/spider-man-brand-new-day-review`.
2. Set network throttling to **Fast 3G** and CPU throttling to **4×**.
3. Hard-reload. Time how long until the hero image is visible.
4. Scroll to the image gallery. Click an image to open the lightbox.
5. **Slide through every image.** For each one, record the time from swipe to
   the image being fully painted.
6. Record any image that shows blank for more than one second.

Then repeat all of 1–6 on `main`:

```bash
git stash; git checkout main; npm run build && npm run preview
```

and compare. **Report both sets of numbers side by side.** Return with
`git checkout claude/article-images-buildtime` when done.

Expected on the branch: images served from `/article-images/…`, roughly 262 KB
total instead of 22.54 MB.

---

## STEP 3 — verify the claims. Each is a command; run it and record the output.

```bash
# Article images: where does each one come from?
npm run build >/dev/null 2>&1
grep -o 'src="[^"]*"' dist/client/intel/spider-man-brand-new-day-review/index.html \
  | sed 's/.*src="//;s/"//' | sed 's|^\(https\?://[^/]*\).*|\1|' | sort | uniq -c | sort -rn
```
Expected: 10 local `/article-images/…`, 6 `substackcdn.com`, 1 `wsrv.nl`, 3 relative.

```bash
# Page integrity vs main — these must be IDENTICAL on both branches.
for f in figure "<p" img; do
  printf '%s: ' "$f"
  grep -o "$f" dist/client/intel/spider-man-brand-new-day-review/index.html | wc -l
done
```
Expected: 6 figures, 73 paragraphs, 20 images.

```bash
# Instagram: recompute the feed filter yourself.
node -e "
const p=require('./src/data/instagram.json');
const t=p.filter(x=>x.isSharedToFeed===true).length;
const f=p.filter(x=>x.isSharedToFeed===false).length;
const u=p.filter(x=>x.isSharedToFeed===undefined).length;
console.log({total:p.length, sharedToFeed:t, reelsTabOnly:f, noField:u});
console.log('hidden:', p.filter(x=>x.isSharedToFeed===false).map(x=>x.permalink));
"
```
Expected: 50 total, 38 shared, 3 reels-only, 9 no-field. Then confirm none of
those 3 permalinks appear in `dist/client/index.html`.

```bash
# No test key leaked into a production build.
git stash list; grep -c '1x00000000000000000000AA' dist/client/index.html
# The production site key rotated in #190, Managed -> Invisible. Read the
# current one out of wrangler.jsonc rather than trusting this line.
grep -c '0x4AAAAAAElijhmIA5xTA1CM' dist/client/index.html
```
Expected: **0** test-key occurrences, **1 or more** production-key occurrences.
Anything else is a **BLOCKING** finding — report it immediately and loudly.

---

## STEP 4 — hunt tests that cannot fail. Four have already been found here.

For each guard below: break the thing it protects, run the test, confirm it
goes **red**, then revert and confirm with `git status` that the tree is clean.

```bash
# 1. The article hero must fall back to the original URL.
sed -i 's/heroImageSources?.src || article.image/heroImageSources?.src/' 'src/pages/intel/[slug].astro'
node scripts/articles.test.mjs 2>&1 | grep -E '✗|FAILED|All .* tests passed'
git checkout 'src/pages/intel/[slug].astro'

# 2. Unknown Instagram visibility must mean VISIBLE.
sed -i 's/return post?.isSharedToFeed !== false;/return post?.isSharedToFeed === true;/' src/lib/instagram-visibility.ts
node scripts/instagram-visibility.test.mjs 2>&1 | grep -E '✗|passed, .* failed'
git checkout src/lib/instagram-visibility.ts

# 3. CI must disable the Chrome sandbox.
sed -i "s/const isCI = ci === 'true' || ci === '1';/const isCI = false;/" scripts/e2e-browser.mjs
node scripts/e2e-harness.test.mjs 2>&1 | grep -E '✗|passed, .* failed'
git checkout scripts/e2e-browser.mjs

git status --porcelain    # MUST be empty. If it is not, revert until it is.
```

Report any guard that stayed **green**. Then go looking for others — known
patterns in this repository:

- a guard that matches its own **comment prose** rather than code;
- a guard that passes **vacuously** because the data it inspects is empty;
- a guard whose condition is already satisfied by the **environment** it runs
  in (e.g. a root container, or a blocked host).

---

## STEP 5 — performance. Numbers, not adjectives.

```bash
npm run lighthouse 2>&1 | tail -20            # mobile
npm run lighthouse -- --desktop 2>&1 | tail -20
```

Run each **three times**, report the median.

Then the one number nobody has. Production desktop scores **88**, with
FCP 0.5s, LCP 0.7s, TBT **280ms**, CLS 0.002, SI 1.1s. Only TBT is bad, and it
is third-party analytics.

**Load `https://beunconventionalhq.com` in a browser with a performance profile
recording, and attribute that 280 ms per script in milliseconds** — GTM, gtag,
the Cloudflare beacon, Partytown, and our own bundles, separately. Neither CI
nor the developer sandbox can measure this; you are the only one who can.

Do **not** recommend deferring analytics. That decision is already taken
deliberately: it would recover most of the points but stop counting visitors
who leave without interacting. Propose it only with a measurement showing the
tracking loss is smaller than assumed.

---

## STEP 6 — things that have broken before. Check each; they are cheap.

On `http://localhost:4321`, at iPhone size:

1. Load `/`, rotate to landscape. The hero must fill the viewport exactly.
2. Load `/`, scroll down, reload. The hero must still fill it.
3. Click the logo from `/feed` → must navigate to `/`. Click the
   "BE Unconventional HQ" wordmark on any page → must scroll to top, not
   navigate.
4. Open the video modal, close with ESC. Reopen, close with the X.
5. Load `/`, and confirm no invisible overlay swallows taps anywhere.
6. Check the Instagram rail on `/` — 10 tiles, no duplicates, no broken images.

---

## REQUIRED OUTPUT — one report, at the end, in this order

1. **VERDICT: GO or NO-GO** on merging PR #126.
2. **Commit you actually tested.**
3. **Environment**: which of these hosts your sandbox could reach —
   `challenges.cloudflare.com`, `googletagmanager.com`, `substackcdn.com`,
   `substack-post-media.s3.amazonaws.com`, `cdninstagram.com`, `i.ytimg.com`,
   `wsrv.nl`. **A pass on anything touching a blocked host is not evidence.
   Say so explicitly.** This has produced wrong conclusions three times.
4. **Numbers**: astro check (e/w/h), npm test, e2e ×3 with retry names,
   Lighthouse mobile ×3 and desktop ×3.
5. **The gallery result** — branch vs `main`, throttled, per-slide times.
6. **TBT attribution table** — ms per script.
7. **Blocking defects** — `file:line`, reproduction, observed vs expected,
   measurement. Mark each *introduced by this PR* or *pre-existing on main*.
8. **Non-blocking findings**, ranked.
9. **Tests that cannot fail** — any guard that stayed green when broken.
10. **What you could not verify, and why.** Did you use real iOS Safari?
11. **Where you disagree with Claude**, each with the measurement behind it.

Finish with `git status --porcelain` output proving the tree is clean.

Be adversarial. "Looks fine" is not a finding. A defect without a reproduction
is not a finding. If you think it is safe to merge, say GO and say why.
