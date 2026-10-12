# Parked: BE Unconventional HQ's GitHub Actions workflows

These are copies of BE Unconventional HQ's workflows (deploy to Cloudflare,
the YouTube, Instagram, Substack and media-kit syncs, analytics, WebSub,
indexing, CI). They came into this monorepo with the HQ site in 326da6c.

They are parked here on purpose, outside `.github/workflows/`, so GitHub
never runs them from this repository.

**The live beunconventionalhq.com is built and deployed from the original
`HeyThisIsAndrew/BeUnconventionalHQ` repository, on Cloudflare (not GitHub
Pages).** That repository's own workflows are the ones in charge. If these
copies ran here too, two repositories would deploy the same Cloudflare
Worker and push synced content to two places, and whichever ran last would
win.

Do not move these back into `.github/workflows/` until Andrew decides HQ's
home is this monorepo. When he does: fix their pnpm setup first (every one
failed at `pnpm/action-setup` with "No pnpm version is specified"), point
them at `sites/be-unconventional-hq/`, and switch the original
repository's workflows off in the same change.
