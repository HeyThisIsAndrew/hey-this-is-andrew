# Prompt for the Reelay app project: bring the app up to the website's design

Paste everything below the line into Claude Code, opened in the Reelay app repository (`HeyThisIsAndrew/reelay`).

---

The Reelay marketing site draws the app's screens in a cleaner, more spatial style: rounded panels, soft hairlines, tinted status pills, generous spacing and one clear action per card. It feels closer to visionOS than the app does today. The owner wants the real app to look like those renderings. Your job is to review them against the app and bring the app's UI up to them, starting with the Accounts page.

## Where to see the designs

- **Live:** https://heythisisandrew.github.io/hey-this-is-andrew/reelay/ . This is a preview build: noindex, and it still shows `{{PLACEHOLDER}}` operator details. The app renderings are on the home page (scroll through it) and on `/features/library/`, `/features/pipeline/` and `/features/automations/`.
- **Source:** the site lives in a different repository, `HeyThisIsAndrew/hey-this-is-andrew`, in the folder `sites/reelay/`. Look for a clone of it beside this repo first (for example `../hey-this-is-andrew`). If there is none, clone it read-only somewhere outside this repo:
  `git clone https://github.com/HeyThisIsAndrew/hey-this-is-andrew`
  Do not commit to that repository from this task.
- **To run it locally** (needs Node 22 and pnpm), from that repo's root:
  `pnpm install && pnpm --filter reelay dev`
  Then open http://localhost:3000.
- **Colours are already shared.** The renderings use `--app-*` tokens in `sites/reelay/src/styles/theme.css`, which were copied from this repo's `reelay/gui/theme.py` palettes. So the gap is layout, geometry and hierarchy, not colour.
- **Every rendering is sized in `em`** inside `sites/reelay/src/components/ui/AppWindow.astro`. With the base size at about 16 px:
  - 1em ≈ 16 px;
  - 0.75em gaps ≈ 12 px;
  - 0.9em card radius ≈ 14 px.

### Which website file draws which app screen

| Website scene (`sites/reelay/src/components/`) | App code (this repo) |
|---|---|
| `AccountsScene.astro` | `reelay/gui/accounts_page.py` |
| `LibraryGridScene.astro` | `reelay/gui/cards.py`, `chrome.py`, `download_page.py` |
| `ImportScene.astro` | `reelay/gui/download_page.py` |
| `SourcesScene.astro` | `reelay/gui/sources_panel.py` |
| `BoardScene.astro`, `InteractiveWorkflow.astro`, `ui/Coverage.astro` | `reelay/gui/board_page.py` and the board cards |
| `CommandCenterScene.astro`, `PlayerDemo.astro` | `reelay/gui/board_page.py`, `player.py`, `detail_panel.py` |
| `BrandingScene.astro` | `reelay/gui/branding.py`, `brand_widgets.py` |
| `SearchScene.astro` | the Board's archive search |
| `CaptionLab.astro`, `PublishSection.astro` | ticket copy and the hand-off (`post_panel.py`, `handoff_dialog.py`) |
| `ui/AppWindow.astro` | the window chrome |

## Ground rules

1. **This repo is the source of truth for behaviour.** The site was drawn to follow it. Copy the website's look, never its claims: if a rendering shows something the app can't do, don't build it to match. Report it, so the site can be corrected.
2. **Keep all four themes working:** Light, Dark, Black, and Custom (profile brand colours). Body text must keep at least 4.5:1 contrast in each.
3. **Keep or improve keyboard focus order and VoiceOver labels.**
4. **Run the test suite before you commit** (`pytest`; `tests/conftest.py` already runs Qt offscreen).
5. **Don't rename the app.** "Reelay" is taken and a new name is being chosen, but that is separate work.

## Task 1 (do this first): the Accounts page grid

### What's wrong

`AccountsPage._place_cards()` (`reelay/gui/accounts_page.py`, around lines 339-355) has three problems:
- It places 7 cards (YouTube plus TikTok, Instagram, Bluesky, Threads, Facebook and Snapchat) by filling columns: 3 columns at 1180 px and up, 2 at 720 px and up, otherwise 1. That gives rows of **3-3-1** or **2-2-2-1**.
- Each card is added with `Qt.AlignTop`, and `IntegrationCard` uses a `Maximum` vertical size policy. So every card is its own height, and the boxes in a row don't line up.
- Long help paragraphs (`HAND_OFF_TEXT`, `spec.help`), account lists and the expanded Advanced Setup all grow their card.

### The rule (owner's words)

Boxes must be evenly distributed at all times. Every row is full, and every card is the same size, however much each one holds. Nine cards are 3 + 3 + 3, never 4 + 4 + 1.

### The target

The target is exactly `AccountsScene.astro`. See it live in the "Accounts" chapter of the home page.

**Layout**
- The grid holds the six platforms you can sign in to: YouTube, TikTok, Instagram, Bluesky, Threads, Facebook.
- Six divides evenly at every width: 3 × 2 on wide windows, 2 × 3 on medium, 1 × 6 on narrow.

**Snapchat**
- Snapchat leaves the grid and becomes a full-width strip under it: the logo, "Snapchat", a "Posted by hand" pill and one line of copy. It has no sign-in, only a hand-posting note, and the seventh card is what forces the orphan.
- First confirm that `SignInButton("snapchat")` can never show a sign-in. If it can, stop and report that instead of moving the card.

**The connected count**
- The count comes from the grid's own cards: "N of 6 connected".

**Card anatomy**, identical for all six:
- **Header:** the 36 px logo; the platform name with a one-line mode under it ("Uploads and schedules", "Copy and paste", "Automatic posting on/off"); and the status pill, right-aligned.
- **One status line:** the account name or handle, or a short hint.
- **Footer**, pinned to the card's bottom edge with a stretch above it: one primary action, plus at most one quiet text button (YouTube's "Advanced Setup…").

**Equal size**
- Drop `Qt.AlignTop`.
- After layout, and on every refresh or resize, give every row the height of the tallest card's `sizeHint()`, using `setRowMinimumHeight` or a fixed height on every card.
- Columns stretch equally.

**Variable content must not grow a card**
- Long help text becomes one sentence plus a "Learn more" disclosure (a popover or tooltip sheet).
- More than one connected account collapses to "2 connected · Manage…".
- **Advanced Setup opens as a sheet or dialog**, not inline. Otherwise every card in the grid grows to the height of an expanded YouTube card.

**Column choice** goes through one pure helper, used by this page and any other card grid:

```python
def balanced_columns(count: int, max_columns: int) -> int:
    """The most columns (<= max_columns) that divide count evenly; 1 if none do."""
    return next(c for c in range(max_columns, 0, -1) if count % c == 0)
```

Here `max_columns` is 3, 2 or 1 by window width, as today. If a future change makes a count that only 1 divides (5, 7, 11…), fix the content: merge, split or move a card. Don't let the grid orphan it.

### Tests to add

- Unit tests for `balanced_columns`: (6, 3) → 3, (6, 2) → 2, (9, 3) → 3, (9, 2) → 1, (4, 3) → 2, (7, 3) → 1.
- A GUI test that builds `AccountsPage` offscreen at about 1300, 900 and 600 px wide and asserts three things:
  - every grid row has the same number of cards;
  - all card heights are equal;
  - Snapchat is not in the grid.

There is already a `tests/test_columns.py` for the Library's column maths; put these beside it, or in `test_gui.py`.

## Task 2: everywhere else

1. **Apply the same rule to every other card grid**:
   - Search for `QGridLayout` and `set_columns`.
   - In `sources_panel.py`, the four source platforms are 2 × 2 already. Keep them that way, through the helper.
   - Check the settings, automations and any dashboard tiles.
   - The Library's video grid is a paged content grid, where a short last row is normal. Leave it alone.
2. **Review each screen against its scene** (table above), side by side:
   - Screenshot the app at about 1440 × 900 in Dark and in Light, next to the live site at the same width.
   - List the differences per screen: radius, padding, gaps, borders, elevation, type sizes and weights, pill style, the number and placement of actions, alignment.
   - Then **show the owner that list and a plan before restyling broadly**.
3. **The visual language to move towards**, as the renderings draw it:
   - **Surfaces:** card radius about 14 px; 1 px hairline borders at low alpha instead of heavy frames; soft, low elevation.
   - **Spacing:** padding about 16-18 px inside cards; 12-14 px gaps between them.
   - **Hierarchy:** titles 600 weight; secondary lines muted and smaller; one primary action per card.
   - **Status pills:** rounded, with a tinted fill in the status colour (green connected, amber needs attention, neutral off).
   - **Platform marks:** logos at a consistent size in a fixed position.
   - **Columns and rows:** content top-aligned; actions bottom-aligned.
   - **Within Qt's means:** do it through `theme.py` and the QSS in `reelay/gui/styles`, without faking blur or translucency Qt can't do natively.

When you're done, report:
- what changed, with before and after screenshots;
- the test results;
- every place where a rendering shows something the app doesn't do.
