# Phase 1: proposed editorial metadata, for review

**Nothing in this file has been written to `src/data/videos.json`.** It is a
proposal. The machine-readable copy is `scripts/phase1-editorial-data.json`, and
on approval it applies in one pass.

The plumbing is already in and committed: `editorial.excerpt` exists on videos,
the Coverage Type dropdown now offers exactly the eight types the renderer
understands, and `getDisplayTagSlots()` reads `coverageType` above its pattern
table. So approving a row here is what makes it take effect.

---

## Four decisions I need from you before anything is written

### 1. I recommend leaving `badge2` empty on all 30

`badge2` and `coverageType` are read by the same slot, with `badge2` winning.
Filling both means one item carries its format in two fields that can disagree,
and CLAUDE.md already records where that ends: `coverageTags` and
`youtubeSyncKeywords` were two lists for one job and they drifted, so they were
merged into one.

`coverageType` is the classification. `badge2` should stay what it is now, an
escape hatch for the one item that needs to say something the eight types
cannot. Today that is none of them.

### 2. I recommend leaving `franchises` empty, and populating `series` instead

`franchises` is an empty array on all 30 documents and **nothing reads it**.
`hubs` is populated on all 30 and carries the same information in the slug
vocabulary the site already matches on (`dc-comics`, `marvel-comics`,
`hbo-max`). Filling `franchises` would create a second dictionary for one
concept before anything needs it.

`series` is different and it matters. It is the field that should drive the
Featured Series row in Phase 3, replacing the hardcoded `hasTag(i, 'lanterns')`
in `FeedGrid.astro`. Populating it is what makes that row switchable from the
CMS, which is the §31 requirement. Proposed below on 8 of the 30.

Proposed franchise values are in the JSON regardless, so if you want them
populated it is one flag away.

### 3. `featured` is yours to set, not mine

I have marked candidates below, and marked nothing in the JSON. Automating this
would make Featured mean "scored well", which is the opposite of what you said
it should mean.

### 4. There are two identical Lanterns Episode 5 documents

`youtube-dcsODyzLaug` (published) and `youtube-SmboKGSX5Ug` (retired), same
title, same date, same tags. The retired one never reaches the Feed, so this is
housekeeping rather than a bug. It is excluded from everything below, which is
why the table has 29 rows and not 30.

---

## The corrections this fixes

Six items are currently labelled wrongly or not at all. Four are factual errors
the reader can see:

| Title | Now | Proposed | Why |
|---|---|---|---|
| Boy Kills World! Out Of Theater Reaction | **REVIEW** | REACTION | A `review` tag on a reaction video. Also shows REVIEW where the brand goes. |
| Godzilla x Kong: The New Empire First Impression | **REVIEW** | FIRST IMPRESSION | Same stray tag. Same empty brand slot. |
| MONKEY MAN First Impression Out Of The Theater | **REVIEW** | FIRST IMPRESSION | Title says first impression. |
| Marvel Just Announced EVERYTHING for SDCC 2026 | **REVIEW** | NEWS | A slate announcement, matched on a `review` tag. |
| The Monkey - Movie Review | (nothing) | REVIEW + NEON | Tagged only "Movies, Film", so nothing resolved at all. |
| WonderCon Vlog Day 1 | (nothing) | VLOG | Nothing resolved. |

---

## Videos: proposed values

Columns are `coverageType` / `badge1` / `series`. `badge2` is blank everywhere
per decision 1; `franchises` is blank everywhere per decision 2.

Rows are newest first. **F?** marks my `featured` candidates.

### Current editorial (2026)

| # | Title | Type | badge1 | series | Excerpt (proposed) |
|---|---|---|---|---|---|
| 1 | Lanterns Episode 5 Review | REVIEW | *(DC, resolves)* | Lanterns | The Hal and John confrontation finally arrives, Zoe's Manhunter reveal pays off, and the season's penultimate stretch leaves Hal Jordan's fate deliberately unresolved. |
| 2 | Lanterns Episode 4 Review | REVIEW | *(DC)* | Lanterns | The detective structure that has carried the season pays off in its strongest episode yet, as the Manhunter reveal reframes everything the show has built. |
| 3 | Resident Evil: We Were Wrong **F?** | REACTION | *(SONY PICTURES)* | | Thirty minutes of Zach Cregger's Resident Evil screened early in Los Angeles, and the adaptation looks far more faithful to Capcom's survival horror than the discourse has assumed. |
| 4 | Lanterns Episode 2 Review | REVIEW | *(DC)* | Lanterns | Episode two trades spectacle for world building, using ring mechanics and construct work to establish what makes John Stewart a different kind of Green Lantern. |
| 5 | Lanterns Episode 3 Review | REVIEW | *(DC)* | Lanterns | A flashback episode that earns its place, turning John Stewart's backstory into the DCU's answer to Batman without losing the season's grounded register. |
| 6 | Lanterns Premiere Review | REVIEW | *(DC)* | Lanterns | The Green Lantern Corps enters James Gunn's DCU as a prestige detective drama, and the premiere makes a convincing case for the register. |
| 7 | X-Men ’97 Season 2 Review | REVIEW | *(MARVEL)* | X-Men ’97 | Season one reset what Marvel animation could carry. Season two has to hold that line against expectations it set itself. |
| 8 | Marvel's Wolverine Analysis **F?** | ANALYSIS | *(MARVEL)* | | Insomniac is aiming closer to Logan than to Spider-Man, which raises a question about where a character like Deadpool fits in a universe built on that tone. |
| 9 | Spider-Man Brand New Day Review **F?** | REVIEW | *(MARVEL)* | | A $927 million opening weekend has reset the conversation around the MCU. The film underneath it is Tom Holland's most complete performance in the role. |
| 10 | Marvel Just Announced EVERYTHING for SDCC 2026 | **NEWS** | *(MARVEL)* | | Marvel Studios returns to Hall H on the Saturday of San Diego Comic-Con 2026. Here is the full slate announced, and what each panel signals. |
| 11 | The Odyssey Trailer Reaction | REACTION | *(UNIVERSAL PICTURES)* | | Christopher Nolan's Homer adaptation was shot entirely on new IMAX film cameras, and the first trailer suggests a scale the format was built for. |
| 12 | Mortal Kombat 2 Review | REVIEW | *(WARNER BROS)* | | The sequel had one job: be everything the first film was not. Karl Urban's Johnny Cage is the clearest sign it understood the assignment. |

### Film criticism (2025)

| # | Title | Type | badge1 | series | Excerpt (proposed) |
|---|---|---|---|---|---|
| 13 | The Accountant 2 - Movie Review | REVIEW | *(PRIME VIDEO)* | | Ben Affleck and Jon Bernthal return for a sequel nobody asked for, which turns out to be most of its charm. |
| 14 | WARFARE (2025) Movie Review | REVIEW | *(A24)* | | Alex Garland reconstructs a single Navy SEAL mission in Ramadi from the memories of the men who were in it, and the reconstruction is the point. |
| 15 | SINNERS Movie Review | REVIEW | *(WARNER BROS)* | | Ryan Coogler's vampire film is his most confident work to date, anchored by Michael B. Jordan. The final act is the only thing keeping it from perfect. |
| 16 | The Amateur - Movie Review | REVIEW | *(20TH CENTURY)* | | Rami Malek plays a CIA analyst who makes himself a field agent, in a thriller whose unpredictability cuts both ways. |
| 17 | A Minecraft Movie - Movie Review | REVIEW | *(WARNER BROS)* | | The video game curse has claimed better properties. This one survives, largely by refusing to take itself seriously. |
| 18 | Locked (2025) - Movie Review | REVIEW | *(PARAMOUNT)* | | Bill Skarsgard spends ninety minutes trapped in Anthony Hopkins' luxury SUV, in a thriller considerably funnier than it was sold as. |
| 19 | The Monkey - Movie Review | **REVIEW** | **NEON** | | A cursed wind-up toy tears one family apart, then returns twenty-five years later to finish the job. The result leans far more comedy than horror. |

### Archive (2024)

| # | Title | Type | badge1 | series | Excerpt (proposed) |
|---|---|---|---|---|---|
| 20 | Alien: Romulus Movie Review | REVIEW | *(20TH CENTURY)* | | A long, deliberate build that arrives at gore rather than at scares. Not the worst Alien film, but not the correction the series needed. |
| 21 | The Umbrella Academy Season 4 Review | REVIEW | *(NETFLIX)* | The Umbrella Academy | The final season has to land four seasons of accumulated plot. A spoiler-free look at whether the farewell earns its ending. |
| 22 | Umbrella Academy S4 Premiere Vlog | **VLOG** | *(NETFLIX)* | The Umbrella Academy | On the black carpet for the final season, having also covered the premiere of the first. |
| 23 | Sausage Party Foodtopia Premiere BTS | **VLOG** | *(PRIME VIDEO)* | | Shooting the Foodtopia premiere at Hollywood Forever on an iPhone and an anamorphic lens, as a test of how far the kit goes. |
| 24 | Boy Kills World! Out Of Theater Reaction | **REACTION** | **LIONSGATE** | | An AMC Screen Unseen turned out to be Boy Kills World. A spoiler-free first response to Bill Skarsgard's action debut. |
| 25 | MONKEY MAN First Impression | **FIRST IMPRESSION** | *(UNIVERSAL PICTURES)* | | Dev Patel's directorial debut, spoiler free and straight out of the theater. |
| 26 | WonderCon Vlog Day 1 | **VLOG** | **WONDERCON** *(see note)* | | WonderCon has shrunk, and the industry names that once anchored it have not come back. A day on a floor that felt closer to GDC than to a comic convention. |
| 27 | Resident Alien: From SyFy Gem to Netflix Hit | ANALYSIS | *(NETFLIX)* | | Seasons one and two of the SyFy series are now on Netflix, where the show has found a considerably larger audience than it had. |
| 28 | Boy Kills World Trailer is INSANE! | REACTION | *(LIONSGATE)* | | The Boy Kills World trailer plays like nothing else in its release window, plus what to expect from this year's WonderCon panel. |
| 29 | Godzilla x Kong: The New Empire First Impression | **FIRST IMPRESSION** | **LEGENDARY** | | Straight out of the Hollywood premiere of The New Empire, with a spoiler-free first response. |

Bold = a change from what the site shows today. *(Italic)* = already resolves
correctly from tags, so `badge1` stays empty and the pattern table keeps
handling it. Setting it anyway would be harmless but it is one more value to
maintain for no gain.

---

## Five excerpts I do not trust, and why

These five source descriptions are one or two lines long, so my draft above is
largely inference rather than compression. **Please rewrite these five rather
than approving them**, or tell me to leave them empty, which renders the card
as title and metadata only and is honest.

| # | Title | The entire source description |
|---|---|---|
| 25 | MONKEY MAN First Impression | "Just saw Monkey Man and I gotta break it down for you! This is my SPOILER-FREE first impression reaction straight outta the theater." |
| 27 | Resident Alien | "Seasons 1 and 2 of Resident Alien are streaming on Netflix!" |
| 29 | Godzilla x Kong | "Attended the Hollywood Premiere of Godzilla x Kong: The New Empire and wanted to share my thoughts straight out of the theater." |
| 23 | Sausage Party BTS | Mostly a description of the camera and lens used. |
| 22 | Umbrella Academy Premiere | A personal note about attending, with no critical content. |

## Two classifications I am least sure of

**#3 Resident Evil (REACTION).** This is an exclusive early screening in Los
Angeles, which is real access reporting, and REACTION is in the bottom tier of
the priority order. Classifying it honestly by format buries one of the
strongest 2026 pieces. That is the system working as designed, and `featured`
is the correct override rather than mislabelling it. Flagging it so the demotion
is your decision and not a side effect.

**#22 Umbrella Academy Premiere (VLOG, not EVENT).** It documents attending a
premiere, which is event coverage, but the piece is about the experience of
being there rather than reporting on it, and you named it as creator-era
material. EVENT would rank it fourth; VLOG ranks it last. I went with VLOG. If
you read it as coverage, say so and it moves.

**#26 WonderCon badge1.** The brand slot means studio, franchise or platform,
and a convention is none of those. "WONDERCON | VLOG" reads correctly and is
informative, so I have proposed it, but it does widen what the slot means. Easy
to leave empty instead.

---

## Articles

**Ten of the twelve already have a usable standfirst** in their Substack
subtitle, and Phase 0 made the cards read it instead of the article body. Those
need nothing.

Two do:

| # | Title | Current excerpt | Problem |
|---|---|---|---|
| 11 | The Boys Season 5 Episode 5 | "⚠️ Spoilers for The Boys Season 5 Episode 5 Titled "One-Shots" below" | Not a standfirst. It is an in-page spoiler warning, and on a card the word "below" points at nothing. |
| 7 | The Viral Billboard Worked | "Netflix May Have Found Their New Hook" | A subhead at 37 characters. Reads as a fragment next to the others. |

Proposed overrides:

- **#11**: "Season five finally lets its separate threads collide, and the Seth Rogen episode is where the show remembers what it is for." **Contains spoilers in the source article, so this needs your eye.**
- **#7**: "The billboard stunt did its job. The film behind it turns out to be a better Netflix thriller than the campaign suggested."

Two more are thin subheads rather than standfirsts and would read better
rewritten, but they are not wrong and I have not proposed replacements:
**#1 L.A. Comic Con 2026** ("Why Downtown Los Angeles Holds the Blueprint for
Convention Culture") and **#6 LANTERNS Premiere Review** ("Why DC's New Series
Breaks the Comic Book Mold").

---

## Featured candidates

Marked **F?** above: Resident Evil early screening, Marvel's Wolverine analysis,
Spider-Man Brand New Day review. Plus the Lanterns package as a whole, which is
the Featured Series rather than a `featured` flag on any one item.

Your call entirely. I have set none of them.

---

## On approval

Tell me which rows to change and I will apply the JSON in one pass, rebuild,
and report the resulting metadata distribution. Corrections are easiest as
"row 22 should be EVENT", or mark up the JSON directly.

Phase 2 does not start until this is settled.
