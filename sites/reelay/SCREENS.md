# Screenshot and screencast slots

Generated from `src/data/screens.json` (the registry the pages and the audit read). Regenerate this file when you change it.

**Rules:** a demo profile only, never real customer data. Images are PNG at 2x of the CSS size: 2880 × 1800 px, named
`public/screens/<id>-light@2x.png` and `public/screens/<id>-dark@2x.png` (app in Light and in Dark). Screencasts are
`public/screens/<id>.mp4` (H.264), with `<id>.vtt` English captions and `<id>-poster.png`. They never autoplay; no audio is needed.
Until a file exists the page shows a labelled placeholder, and `npm run test` lists it (`REELAY_RELEASE=1` makes it fatal).

| Slot id | Kind | Themes | Page | What it shows |
|---|---|---|---|---|
| `library-grid` | image | light, dark | `/features/library` | Library grid with hover-scrub, tile slider and page size |
| `download-sources` | image | light, dark | `/features/library` | Download Sources: one section per platform, add by @username or link |
| `command-center` | image | light, dark | `/features/pipeline` | Board with the Command Center open: player, readiness ring, platforms, Schedule |
| `board` | image | light, dark | `/features/pipeline` | The Board: four columns of tickets with coverage maps |
| `automations` | image | light, dark | `/features/automations` | Automations page with a rule and its Activity log |
| `agents-settings` | image | light, dark | `/ai` | Settings → AI agents: API address, Copy Access Key, Make a New Key |
| `accounts` | image | light, dark | `/` | Accounts: integration cards, N of 7 connected, Advanced Setup |
| `branding` | image | light, dark | `/` | Profile branding: logo and colours in Edit Profile & Branding |
| `google-consent` | image | light | `/reviewers` | Google consent screen showing the app name and requested scopes |
| `tiktok-login` | image | light | `/reviewers` | TikTok authorization screen showing the app name and requested scopes |
| `meta-login` | image | light | `/reviewers` | Meta authorization screen (Instagram, Threads or Facebook) showing the app name and permissions |
| `google-youtube-upload` | image | light | `/reviewers` | YouTube: youtube.upload in use (Board → a ticket → Post automatically to → YouTube) |
| `google-youtube-upload-demo` | video | light | `/reviewers` | Screencast: YouTube sign-in, then youtube.upload in use |
| `google-youtube-readonly` | image | light | `/reviewers` | YouTube: youtube.readonly in use (Library → Download Sources (your connected channel) · Accounts → Channel Schedule → Load from YouTube · Board → Check YouTube for Updates) |
| `google-youtube-readonly-demo` | video | light | `/reviewers` | Screencast: YouTube sign-in, then youtube.readonly in use |
| `tiktok-user-info-basic` | image | light | `/reviewers` | TikTok: user.info.basic in use (Accounts → TikTok card) |
| `tiktok-user-info-basic-demo` | video | light | `/reviewers` | Screencast: TikTok sign-in, then user.info.basic in use |
| `tiktok-video-list` | image | light | `/reviewers` | TikTok: video.list in use (Not used in this version) |
| `tiktok-video-list-demo` | video | light | `/reviewers` | Screencast: TikTok sign-in, then video.list in use |
| `instagram-business-basic` | image | light | `/reviewers` | Instagram: instagram_business_basic in use (Accounts → Instagram card) |
| `instagram-business-basic-demo` | video | light | `/reviewers` | Screencast: Instagram sign-in, then instagram_business_basic in use |
| `threads-basic` | image | light | `/reviewers` | Threads: threads_basic in use (Accounts → Threads card) |
| `threads-basic-demo` | video | light | `/reviewers` | Screencast: Threads sign-in, then threads_basic in use |
| `threads-content-publish` | image | light | `/reviewers` | Threads: threads_content_publish in use (Settings → Automatic posting → Threads, then Board → a ticket → Post automatically to → Threads) |
| `threads-content-publish-demo` | video | light | `/reviewers` | Screencast: Threads sign-in, then threads_content_publish in use |
| `facebook-pages-show-list` | image | light | `/reviewers` | Facebook Pages: pages_show_list in use (Accounts → Facebook card → Sign in) |
| `facebook-pages-show-list-demo` | video | light | `/reviewers` | Screencast: Facebook Pages sign-in, then pages_show_list in use |
| `facebook-pages-read-engagement` | image | light | `/reviewers` | Facebook Pages: pages_read_engagement in use (Accounts → Facebook card; checked again when a post goes out) |
| `facebook-pages-read-engagement-demo` | video | light | `/reviewers` | Screencast: Facebook Pages sign-in, then pages_read_engagement in use |
| `facebook-pages-manage-posts` | image | light | `/reviewers` | Facebook Pages: pages_manage_posts in use (Settings → Automatic posting → Facebook, then Board → a ticket → Post automatically to → Facebook) |
| `facebook-pages-manage-posts-demo` | video | light | `/reviewers` | Screencast: Facebook Pages sign-in, then pages_manage_posts in use |
| `google-demo` | video | light | `/reviewers` | Google review demo: sign in with Google, the consent screen, upload and schedule, Check YouTube for Updates, Disconnect |
| `tiktok-demo` | video | light | `/reviewers` | TikTok review demo: Continue with TikTok, the authorization screen, the connected account card, Disconnect |
| `meta-demo` | video | light | `/reviewers` | Meta review demo: Instagram, Threads and Facebook sign-in, each permission in use, Disconnect and data deletion |
