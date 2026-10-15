# Screenshot and screencast slots

Generated from `src/data/screens.json` (the registry the pages and the audit read) by
`node scripts/screens-manifest.mjs`. Don't edit it by hand: change the JSON and rerun it. The audit fails while they differ.

**Rules:** a demo profile only, never real customer data. Images are PNG at 2x of the CSS size (the Size column),
named `public/screens/<id>-light@2x.png` and `public/screens/<id>-dark@2x.png` (the app in Light and in Dark). The
page swaps them with the visitor's colour scheme. Screencasts are `public/screens/<id>.mp4` (H.264), with
`<id>.vtt` English captions and `<id>-poster.png`. They never autoplay; no audio is needed.
A slot renders the moment all of its files exist. Until then the page shows a "Screenshot to come" card, and
`npm run test` lists it (`REELAY_RELEASE=1` makes it fatal).

**Help Center videos** are the slots marked *optional* (`help-tour-*`, `help-*`): one per tour step and guide,
written by `npm run help -- <app checkout>`, which also copies the app's help text and screenshots in. Record each
from the demo profile following that guide's steps. A guide shows its video the moment the files exist; until then it
shows nothing in its place, and the audit only counts them.

| Slot id | Kind | Themes | Size (px) | Page | What it shows | Files |
|---|---|---|---|---|---|---|
| `library-grid` | image | light, dark | 2880 × 1800 | `/features/library` | Library grid with hover-scrub, tile slider and page size | `library-grid-light@2x.png` `library-grid-dark@2x.png` |
| `download-sources` | image | light, dark | 2880 × 1800 | `/features/library` | Download Sources: one section per platform, add by @username or link | `download-sources-light@2x.png` `download-sources-dark@2x.png` |
| `command-center` | image | light, dark | 2880 × 1800 | `/features/pipeline` | Board with the Command Center open: player, readiness ring, platforms, Schedule | `command-center-light@2x.png` `command-center-dark@2x.png` |
| `board` | image | light, dark | 2880 × 1800 | `/features/pipeline` | The Board: four columns of tickets with coverage maps | `board-light@2x.png` `board-dark@2x.png` |
| `automations` | image | light, dark | 2880 × 1800 | `/features/automations` | Automations page with a rule and its Activity log | `automations-light@2x.png` `automations-dark@2x.png` |
| `agents-settings` | image | light, dark | 2880 × 1800 | `/ai` | Settings → AI agents: API address, Copy Access Key, Make a New Key | `agents-settings-light@2x.png` `agents-settings-dark@2x.png` |
| `accounts` | image | light, dark | 2880 × 1800 | `/` | Accounts: six equal platform cards (N of 6 connected), Snapchat as a strip below, Advanced Setup | `accounts-light@2x.png` `accounts-dark@2x.png` |
| `branding` | image | light, dark | 2880 × 1800 | `/` | Profile branding: logo and colours in Edit Profile & Branding | `branding-light@2x.png` `branding-dark@2x.png` |
| `google-consent` | image | light | 2880 × 1800 | `/reviewers` | Google consent screen showing the app name and requested scopes | `google-consent-light@2x.png` |
| `tiktok-login` | image | light | 2880 × 1800 | `/reviewers` | TikTok authorization screen showing the app name and requested scopes | `tiktok-login-light@2x.png` |
| `meta-login` | image | light | 2880 × 1800 | `/reviewers` | Meta authorization screen (Instagram, Threads or Facebook) showing the app name and permissions | `meta-login-light@2x.png` |
| `google-youtube-upload` | image | light | 2880 × 1800 | `/reviewers` | YouTube: youtube.upload in use (Board → a ticket → Post automatically to → YouTube) | `google-youtube-upload-light@2x.png` |
| `google-youtube-upload-demo` | video | light | 2880 × 1800 | `/reviewers` | Screencast: YouTube sign-in, then youtube.upload in use | `google-youtube-upload-demo.mp4` `google-youtube-upload-demo.vtt` `google-youtube-upload-demo-poster.png` |
| `google-youtube-readonly` | image | light | 2880 × 1800 | `/reviewers` | YouTube: youtube.readonly in use (Library → Download Sources (your connected channel) · Accounts → Channel Schedule → Load from YouTube · Board → refresh (Check YouTube for updates)) | `google-youtube-readonly-light@2x.png` |
| `google-youtube-readonly-demo` | video | light | 2880 × 1800 | `/reviewers` | Screencast: YouTube sign-in, then youtube.readonly in use | `google-youtube-readonly-demo.mp4` `google-youtube-readonly-demo.vtt` `google-youtube-readonly-demo-poster.png` |
| `tiktok-user-info-basic` | image | light | 2880 × 1800 | `/reviewers` | TikTok: user.info.basic in use (Accounts → TikTok card) | `tiktok-user-info-basic-light@2x.png` |
| `tiktok-user-info-basic-demo` | video | light | 2880 × 1800 | `/reviewers` | Screencast: TikTok sign-in, then user.info.basic in use | `tiktok-user-info-basic-demo.mp4` `tiktok-user-info-basic-demo.vtt` `tiktok-user-info-basic-demo-poster.png` |
| `tiktok-video-list` | image | light | 2880 × 1800 | `/reviewers` | TikTok: video.list in use (Not used in this version) | `tiktok-video-list-light@2x.png` |
| `tiktok-video-list-demo` | video | light | 2880 × 1800 | `/reviewers` | Screencast: TikTok sign-in, then video.list in use | `tiktok-video-list-demo.mp4` `tiktok-video-list-demo.vtt` `tiktok-video-list-demo-poster.png` |
| `instagram-business-basic` | image | light | 2880 × 1800 | `/reviewers` | Instagram: instagram_business_basic in use (Accounts → Instagram card) | `instagram-business-basic-light@2x.png` |
| `instagram-business-basic-demo` | video | light | 2880 × 1800 | `/reviewers` | Screencast: Instagram sign-in, then instagram_business_basic in use | `instagram-business-basic-demo.mp4` `instagram-business-basic-demo.vtt` `instagram-business-basic-demo-poster.png` |
| `threads-basic` | image | light | 2880 × 1800 | `/reviewers` | Threads: threads_basic in use (Accounts → Threads card) | `threads-basic-light@2x.png` |
| `threads-basic-demo` | video | light | 2880 × 1800 | `/reviewers` | Screencast: Threads sign-in, then threads_basic in use | `threads-basic-demo.mp4` `threads-basic-demo.vtt` `threads-basic-demo-poster.png` |
| `threads-content-publish` | image | light | 2880 × 1800 | `/reviewers` | Threads: threads_content_publish in use (Settings → Automatic posting → Threads, then Board → a ticket → Post automatically to → Threads) | `threads-content-publish-light@2x.png` |
| `threads-content-publish-demo` | video | light | 2880 × 1800 | `/reviewers` | Screencast: Threads sign-in, then threads_content_publish in use | `threads-content-publish-demo.mp4` `threads-content-publish-demo.vtt` `threads-content-publish-demo-poster.png` |
| `facebook-pages-show-list` | image | light | 2880 × 1800 | `/reviewers` | Facebook Pages: pages_show_list in use (Accounts → Facebook card → Sign in) | `facebook-pages-show-list-light@2x.png` |
| `facebook-pages-show-list-demo` | video | light | 2880 × 1800 | `/reviewers` | Screencast: Facebook Pages sign-in, then pages_show_list in use | `facebook-pages-show-list-demo.mp4` `facebook-pages-show-list-demo.vtt` `facebook-pages-show-list-demo-poster.png` |
| `facebook-pages-read-engagement` | image | light | 2880 × 1800 | `/reviewers` | Facebook Pages: pages_read_engagement in use (Accounts → Facebook card; checked again when a post goes out) | `facebook-pages-read-engagement-light@2x.png` |
| `facebook-pages-read-engagement-demo` | video | light | 2880 × 1800 | `/reviewers` | Screencast: Facebook Pages sign-in, then pages_read_engagement in use | `facebook-pages-read-engagement-demo.mp4` `facebook-pages-read-engagement-demo.vtt` `facebook-pages-read-engagement-demo-poster.png` |
| `facebook-pages-manage-posts` | image | light | 2880 × 1800 | `/reviewers` | Facebook Pages: pages_manage_posts in use (Settings → Automatic posting → Facebook, then Board → a ticket → Post automatically to → Facebook) | `facebook-pages-manage-posts-light@2x.png` |
| `facebook-pages-manage-posts-demo` | video | light | 2880 × 1800 | `/reviewers` | Screencast: Facebook Pages sign-in, then pages_manage_posts in use | `facebook-pages-manage-posts-demo.mp4` `facebook-pages-manage-posts-demo.vtt` `facebook-pages-manage-posts-demo-poster.png` |
| `google-demo` | video | light | 2880 × 1800 | `/reviewers` | Google review demo: sign in with Google, the consent screen, upload and schedule, the Board's refresh (Check YouTube for updates), Disconnect | `google-demo.mp4` `google-demo.vtt` `google-demo-poster.png` |
| `tiktok-demo` | video | light | 2880 × 1800 | `/reviewers` | TikTok review demo: Continue with TikTok, the authorization screen, the connected account card, Disconnect | `tiktok-demo.mp4` `tiktok-demo.vtt` `tiktok-demo-poster.png` |
| `meta-demo` | video | light | 2880 × 1800 | `/reviewers` | Meta review demo: Instagram, Threads and Facebook sign-in, each permission in use, Disconnect and data deletion | `meta-demo.mp4` `meta-demo.vtt` `meta-demo-poster.png` |
| `help-tour-profiles` | video *optional* | light | 2880 × 1800 | `/support` | Help video: Get Started, Pick a profile | `help-tour-profiles.mp4` `help-tour-profiles.vtt` `help-tour-profiles-poster.png` |
| `help-tour-library` | video *optional* | light | 2880 × 1800 | `/support` | Help video: Get Started, Bring videos in | `help-tour-library.mp4` `help-tour-library.vtt` `help-tour-library-poster.png` |
| `help-tour-prepare` | video *optional* | light | 2880 × 1800 | `/support` | Help video: Get Started, Prepare a video | `help-tour-prepare.mp4` `help-tour-prepare.vtt` `help-tour-prepare-poster.png` |
| `help-tour-readiness` | video *optional* | light | 2880 × 1800 | `/support` | Help video: Get Started, Check readiness | `help-tour-readiness.mp4` `help-tour-readiness.vtt` `help-tour-readiness-poster.png` |
| `help-tour-publish` | video *optional* | light | 2880 × 1800 | `/support` | Help video: Get Started, Publish or schedule | `help-tour-publish.mp4` `help-tour-publish.vtt` `help-tour-publish-poster.png` |
| `help-tour-find` | video *optional* | light | 2880 × 1800 | `/support` | Help video: Get Started, Find your work | `help-tour-find.mp4` `help-tour-find.vtt` `help-tour-find-poster.png` |
| `help-library-add` | video *optional* | light | 2880 × 1800 | `/support` | Help video: Add videos | `help-library-add.mp4` `help-library-add.vtt` `help-library-add-poster.png` |
| `help-library-sources` | video *optional* | light | 2880 × 1800 | `/support` | Help video: Download Sources | `help-library-sources.mp4` `help-library-sources.vtt` `help-library-sources-poster.png` |
| `help-library-select` | video *optional* | light | 2880 × 1800 | `/support` | Help video: Select and download | `help-library-select.mp4` `help-library-select.vtt` `help-library-select-poster.png` |
| `help-library-views` | video *optional* | light | 2880 × 1800 | `/support` | Help video: Filters and pages | `help-library-views.mp4` `help-library-views.vtt` `help-library-views-poster.png` |
| `help-library-files` | video *optional* | light | 2880 × 1800 | `/support` | Help video: Files and names | `help-library-files.mp4` `help-library-files.vtt` `help-library-files-poster.png` |
| `help-library-player` | video *optional* | light | 2880 × 1800 | `/support` | Help video: Watch a video | `help-library-player.mp4` `help-library-player.vtt` `help-library-player-poster.png` |
| `help-board-overview` | video *optional* | light | 2880 × 1800 | `/support` | Help video: The Board | `help-board-overview.mp4` `help-board-overview.vtt` `help-board-overview-poster.png` |
| `help-board-captions` | video *optional* | light | 2880 × 1800 | `/support` | Help video: Write captions | `help-board-captions.mp4` `help-board-captions.vtt` `help-board-captions-poster.png` |
| `help-board-readiness` | video *optional* | light | 2880 × 1800 | `/support` | Help video: Readiness | `help-board-readiness.mp4` `help-board-readiness.vtt` `help-board-readiness-poster.png` |
| `help-board-details` | video *optional* | light | 2880 × 1800 | `/support` | Help video: Details and video tools | `help-board-details.mp4` `help-board-details.vtt` `help-board-details-poster.png` |
| `help-board-find` | video *optional* | light | 2880 × 1800 | `/support` | Help video: Find, filter and archive | `help-board-find.mp4` `help-board-find.vtt` `help-board-find-poster.png` |
| `help-publish-which` | video *optional* | light | 2880 × 1800 | `/support` | Help video: Where Reelay posts | `help-publish-which.mp4` `help-publish-which.vtt` `help-publish-which-poster.png` |
| `help-accounts-connect` | video *optional* | light | 2880 × 1800 | `/support` | Help video: Connect an account | `help-accounts-connect.mp4` `help-accounts-connect.vtt` `help-accounts-connect-poster.png` |
| `help-publish-schedule` | video *optional* | light | 2880 × 1800 | `/support` | Help video: Schedule or publish | `help-publish-schedule.mp4` `help-publish-schedule.vtt` `help-publish-schedule-poster.png` |
| `help-publish-by-hand` | video *optional* | light | 2880 × 1800 | `/support` | Help video: Post by hand | `help-publish-by-hand.mp4` `help-publish-by-hand.vtt` `help-publish-by-hand-poster.png` |
| `help-auto-rules` | video *optional* | light | 2880 × 1800 | `/support` | Help video: Make a rule | `help-auto-rules.mp4` `help-auto-rules.vtt` `help-auto-rules-poster.png` |
| `help-auto-recipes` | video *optional* | light | 2880 × 1800 | `/support` | Help video: Quick-start recipes | `help-auto-recipes.mp4` `help-auto-recipes.vtt` `help-auto-recipes-poster.png` |
| `help-auto-test` | video *optional* | light | 2880 × 1800 | `/support` | Help video: Test, run and review | `help-auto-test.mp4` `help-auto-test.vtt` `help-auto-test-poster.png` |
| `help-profiles` | video *optional* | light | 2880 × 1800 | `/support` | Help video: Profiles | `help-profiles.mp4` `help-profiles.vtt` `help-profiles-poster.png` |
| `help-branding` | video *optional* | light | 2880 × 1800 | `/support` | Help video: Branding and themes | `help-branding.mp4` `help-branding.vtt` `help-branding-poster.png` |
| `help-settings-tips` | video *optional* | light | 2880 × 1800 | `/support` | Help video: Helpful tips | `help-settings-tips.mp4` `help-settings-tips.vtt` `help-settings-tips-poster.png` |
| `help-settings-posting` | video *optional* | light | 2880 × 1800 | `/support` | Help video: Automatic posting | `help-settings-posting.mp4` `help-settings-posting.vtt` `help-settings-posting-poster.png` |
| `help-settings-more` | video *optional* | light | 2880 × 1800 | `/support` | Help video: More settings | `help-settings-more.mp4` `help-settings-more.vtt` `help-settings-more-poster.png` |
| `help-privacy-local` | video *optional* | light | 2880 × 1800 | `/support` | Help video: Where your data lives | `help-privacy-local.mp4` `help-privacy-local.vtt` `help-privacy-local-poster.png` |
| `help-trouble` | video *optional* | light | 2880 × 1800 | `/support` | Help video: Fix common problems | `help-trouble.mp4` `help-trouble.vtt` `help-trouble-poster.png` |
