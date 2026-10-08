# Archive

One-off scripts and session handoff documents kept for historical reference.
Nothing here is imported, executed, or referenced by the build, tests, or CI —
verified before archiving (epic #24, repo hygiene).

- `fix_imports.py`, `fix_mobile.py`, `migrate.py`, `patch_mobile_safari.py` —
  one-shot migration/patch scripts from early development; their changes are
  long merged.
- `test-admin-page.mjs`, `test-sanity.mjs` — ad-hoc probe scripts superseded by
  the `npm test` suites in `scripts/*.test.mjs`.
- `claude_mobile_video_bug_handoff.md`, `hero_trailer_isolation_handoff.md` —
  AI-session handoffs for the iOS trailer black-screen work. The fixes and
  their constraints now live in HeroTrailer.astro's comments and CLAUDE.md
  (which is the current source of truth for those rules).

Safe to delete outright whenever the owner wants; kept for archaeology.
