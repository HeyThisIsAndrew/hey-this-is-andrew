# Google Indexing API notifier — runbook

Covers `scripts/notify-indexing-api.mjs` and the manual workflow it powers,
`.github/workflows/notify-indexing-api.yml`.

> **This is MANUAL only, as of 2026-08-28.** It used to run automatically at
> the end of `sync-articles.yml` on every run that published an article. That
> step is gone. Two reasons:
>
> 1. Automated submission of an unsupported content type is the part that
>    carries real policy risk. Google's docs say abuse of the API can cost you
>    access entirely. Firing by hand, for one URL, when it actually matters, is
>    a different risk profile from firing on a schedule forever.
> 2. It held the `content-sync-push` concurrency group for up to 10 minutes
>    while `--require-live` polled for the Cloudflare deploy, so the YouTube
>    and Instagram syncs queued behind every article publish.
>
> Nothing was lost. The step never fired in 101 runs of that workflow, and
> `GOOGLE_INDEXING_CREDENTIALS` was never configured, so the pipeline has been
> inert on GitHub's side its whole life.
>
> **Reach for Search Console's own "Request Indexing" button first.** It does
> the same job, with no API and no credential. This workflow exists for when
> you want it scripted, validated before it goes, and logged in the run
> history.

---

## 0. Read this before you build it

Google's Indexing API is documented to support **two** content types:
`JobPosting`, and `BroadcastEvent` embedded in a `VideoObject`. Google's own
wording is that the API "can only be used to crawl pages with either
JobPosting or BroadcastEvent". Editorial articles are not on that list, and
Google has said it may stop accepting unsupported formats without notice.

This site publishes neither type. So be clear about what this pipeline is:

- It is a **crawl hint**. Submitting an article URL returns HTTP 200 and gets
  logged in the API's own records. It is widely reported to shorten
  time-to-first-crawl. It is not a supported path to indexing and Google
  does not promise it does anything.
- It is **not** why an article gets indexed. Sitemap `lastmod`, internal
  linking and the site's overall crawl demand are.
- A green workflow run means "Google accepted the notification". It does
  **not** mean crawled, and it does not mean indexed. Check Search Console.

It costs one workflow step and no dependencies, and it is non-fatal by
construction, which is why it is worth having anyway. Do not let it displace
the things that actually move the needle. Those are in
`scripts/gsc-coverage-2026-08-26.md`.

### Quota

Default is **200 publish requests per day** per Google Cloud project, resetting
at midnight Pacific. Failed requests still consume quota; a 429 does not. Batch
requests do not save quota — ten URLs in one HTTP call is still ten. This site
publishes a handful of articles a week, so 200/day is roughly two orders of
magnitude more than needed. The quota-increase form exists but only applies to
the two supported content types, so it is not available to us.

Over quota returns **HTTP 429**, which the script retries with exponential
backoff and then reports as a failure. Nothing breaks; the article is still
in the sitemap.

---

## 1. Google Cloud Console — one-time setup

Do these in order. Step 4 blocks step 6.

1. **Create a project.** <https://console.cloud.google.com/projectcreate>
   Name it something you will recognise in two years, e.g. `buhq-indexing`.
   *Verify:* the project picker at the top of the console shows the new name.

2. **Enable the Indexing API.** With that project selected, go to
   **APIs & Services → Library**, search `Indexing API`, open it, click
   **Enable**.
   *Verify:* the button changes to **Manage** and the page shows a metrics tab.

3. **Create a service account.** **IAM & Admin → Service Accounts →
   Create service account**.
   - Name: `buhq-indexing`
   - Grant it **no** project roles. It does not need any. Its authority comes
     from Search Console, not from Google Cloud IAM. Skip the "Grant this
     service account access to project" step entirely.
   *Verify:* it appears in the Service Accounts list with an email ending
   `@buhq-indexing.iam.gserviceaccount.com`.

4. **Copy the service account email.** You need it in section 2.
   It is the `client_email` field, and it looks like
   `buhq-indexing@buhq-indexing.iam.gserviceaccount.com`.

5. **Create a JSON key.** Click the service account → **Keys** →
   **Add key → Create new key → JSON → Create**. A `.json` file downloads.
   *Verify:* opening it shows `"type": "service_account"`, a `client_email`
   and a `private_key`.

   **This file is a credential.** Do not put it in the repo, do not paste it
   into a chat, do not email it to yourself. `.gitignore` will not save you
   from a file you deliberately `git add`. Delete the download once section 3
   is done.

---

## 2. Google Search Console — the step everyone misses

The service account must be an **Owner** of the property. Not "Full", not
"Restricted". Owner. Anything less returns HTTP 403 on every call, with a
message about failing to verify URL ownership.

1. Open <https://search.google.com/search-console> and select the
   **beunconventionalhq.com** domain property.
2. **Settings → Users and permissions → Add user.**
3. Email address: paste the service account email from step 1.4.
4. Permission: **Owner**.
5. Click **Add**.

*Verify:* the service account email is listed with permission "Owner". If the
Add button rejects it, you are not an owner of the property yourself, or you
are on a URL-prefix property rather than the domain property.

**Why the domain property helps here:** it is DNS-verified and covers `http`,
`https`, `www`, apex and every subdomain at once. One Owner grant covers every
URL this script will ever submit. On a URL-prefix property you would need the
grant on the exact prefix.

---

## 3. GitHub — one-time setup

1. Repo → **Settings → Secrets and variables → Actions → New repository
   secret**.
2. Name: `GOOGLE_INDEXING_CREDENTIALS`
3. Value: the **entire contents** of the JSON key file from step 1.5. Open it
   in a text editor, select all, paste. Do not reformat it, do not strip the
   newlines inside `private_key`, do not wrap it in extra quotes.
4. Click **Add secret**.

*Verify:* run section 5's dry run. There is no way to read a secret back, so
the run is the only confirmation.

Then delete the downloaded `.json` from your machine.

---

## 4. Local use

```bash
# What would be submitted right now? (dry run, no credential needed)
node scripts/notify-indexing-api.mjs --url https://beunconventionalhq.com/intel/mortal-kombat-2-review

# Actually submit one URL by hand
GOOGLE_INDEXING_CREDENTIALS="$(cat ~/Downloads/buhq-indexing-abc123.json)" \
  node scripts/notify-indexing-api.mjs \
    --url https://beunconventionalhq.com/intel/mortal-kombat-2-review \
    --execute
```

The script is **dry-run by default**, the same contract as
`scripts/sync-youtube.mjs`. Nothing reaches Google without `--execute`.

Flags: `--url <url>` (repeatable), `--type URL_UPDATED|URL_DELETED`,
`--require-live`, `--live-timeout <seconds>`, `--execute`. Read the header of
`scripts/notify-indexing-api.mjs` for what each one is for.

`--snapshot <file>` and `--before <file>` also still exist. They computed the
diff between "articles that had pages before the sync ran" and "after", which
is what the old automatic step submitted. Nothing calls them now. They are
kept because they are covered by `scripts/indexing-api.test.mjs` and cost
nothing, and because a future "submit everything published this week" job
would want exactly that shape.

### What it will refuse

Only `https://beunconventionalhq.com/intel/<slug>` is submittable. Everything
else is rejected before any network call: other hosts, `http`, query strings,
fragments, path traversal, the `/intel` index itself, `/intel/topic/...`, and
the reserved slugs `topic` and `page`. The payload is treated as untrusted
because it can come from a `workflow_dispatch` box. See
`scripts/indexing-api.test.mjs`.

---

## 5. Verification run — did the whole chain fire?

1. **Dry run first, no secret involved.**
   Actions → *Sync Substack articles* → **Run workflow**, leave
   "Write articles.json" checked, leave the URL box empty.
   Expect: the run is green, and the *Notify* step is **skipped** because
   nothing new published. That is the correct result and it proves the
   snapshot/diff plumbing works.

2. **Force one real submission.**
   Same screen, put a real article URL in the
   "Optional: also submit this one URL" box, e.g.
   `https://beunconventionalhq.com/intel/mortal-kombat-2-review`
   → **Run workflow**.
   Expect: the *Notify* step runs, and the job summary at the bottom of the
   run shows `Submitted: 1/1` with the URL.

3. **Publish a real article on Substack**, then either wait for the next
   six-hourly sync or fire the workflow by hand.
   Expect, in order: the sync commits `articles.json` → Cloudflare builds and
   deploys → the Notify step waits for the new URL to answer 200 → it submits
   → the job summary lists it.

4. **Confirm from Google's side.** Search Console → **URL Inspection** → paste
   the article URL. Within a day or so "Last crawl" should have a date. If it
   still says the page is unknown after a few days, the submission did nothing
   for you, which is exactly the outcome section 0 warns about.

### When it does not work

| What you see | What it means |
| --- | --- |
| Step skipped | No new article published this run, and no manual URL given. Usually correct. |
| `GOOGLE_INDEXING_CREDENTIALS not configured` | Section 3 was not done, or the secret name is misspelled. |
| `not valid JSON` | The secret was pasted partially, or an editor mangled it. Re-paste the whole file. |
| **HTTP 403** | Section 2 was not done, or permission is not Owner, or the API is not enabled on the project that issued the key. The script prints all of these. |
| **HTTP 400** | Malformed URL or type. The validator should have caught it first, so read the message. |
| **HTTP 429** | Daily quota gone. Wait for midnight Pacific. |
| `SKIPPED ... still not answering 200` | The Cloudflare deploy took longer than 10 minutes, or the build failed. Check the deploy, then re-submit by hand with the URL box. |

---

## 6. Recurring maintenance

| Task | Cadence | Notes |
| --- | --- | --- |
| Service account JSON key rotation | Every 12 months | Create a new key, update the GitHub secret, delete the old key in Google Cloud. There is no expiry alarm; put it in a calendar. |
| Confirm the service account is still an Owner | After any Search Console permissions change | Losing Owner is silent until the next 403. |
| Quota check | Only if you start seeing 429 | Google Cloud → APIs & Services → Indexing API → Quotas. |
| Re-read section 0 | Whenever someone proposes expanding this | The supported-type limitation has not changed and is the reason not to build more on top of this. |
