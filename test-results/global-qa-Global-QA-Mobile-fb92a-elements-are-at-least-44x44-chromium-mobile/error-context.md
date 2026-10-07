# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: global-qa.spec.ts >> Global QA >> Mobile: interactive elements are at least 44x44
- Location: e2e/global-qa.spec.ts:15:7

# Error details

```
Error: expect(received).toBeGreaterThanOrEqual(expected)

Expected: >= 43.5
Received:    18
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - link "Skip to content" [ref=e2] [cursor=pointer]:
    - /url: "#main-content"
  - banner [ref=e3]:
    - generic [ref=e4]:
      - link "HEY_THISISANDREW, home" [ref=e5] [cursor=pointer]:
        - /url: /hey-this-is-andrew/
        - img "HEY_THISISANDREW" [ref=e6]
      - navigation "Sections" [ref=e7]:
        - list [ref=e8]:
          - listitem [ref=e9]:
            - link "Home" [ref=e11] [cursor=pointer]:
              - /url: /hey-this-is-andrew/
            - menu "Home subsections" [ref=e14]:
              - list [ref=e16]:
                - menuitem "01Overview" [ref=e17] [cursor=pointer]: 01Overview→
                - menuitem "02Brands" [ref=e18] [cursor=pointer]: 02Brands→
                - menuitem "03Meet The Creator" [ref=e19] [cursor=pointer]: 03Meet The Creator→
                - menuitem "04Shot on the job." [ref=e20] [cursor=pointer]: 04Shot on the job.→
                - menuitem "05Work" [ref=e21] [cursor=pointer]: 05Work→
                - menuitem "06Latest" [ref=e22] [cursor=pointer]: 06Latest→
                - menuitem "07Goals" [ref=e23] [cursor=pointer]: 07Goals→
                - menuitem "08What I do" [ref=e24] [cursor=pointer]: 08What I do→
                - menuitem "09Gear" [ref=e25] [cursor=pointer]: 09Gear→
                - menuitem "10Newsletter" [ref=e26] [cursor=pointer]: 10Newsletter→
          - listitem [ref=e27]:
            - link "Build in Public" [ref=e29] [cursor=pointer]:
              - /url: /hey-this-is-andrew/build/
            - menu "Build in Public subsections" [ref=e32]:
              - list [ref=e34]:
                - menuitem "01Now" [ref=e35] [cursor=pointer]: 01Now→
                - menuitem "02Milestone roadmap" [ref=e36] [cursor=pointer]: 02Milestone roadmap→
                - menuitem "03Core engine" [ref=e37] [cursor=pointer]: 03Core engine→
                - menuitem "BEBE Unconventional HQ" [ref=e38] [cursor=pointer]: BEBE Unconventional HQ→
                - menuitem "CCCCapture Create Caffeinate" [ref=e39] [cursor=pointer]: CCCCapture Create Caffeinate→
                - menuitem "04Goals" [ref=e40] [cursor=pointer]: 04Goals→
          - listitem [ref=e41]:
            - link "Gear" [ref=e43] [cursor=pointer]:
              - /url: /hey-this-is-andrew/#gear
          - listitem [ref=e44]:
            - link "About" [ref=e46] [cursor=pointer]:
              - /url: /hey-this-is-andrew/about/
            - menu "About subsections" [ref=e49]:
              - list [ref=e51]:
                - menuitem "01Story" [ref=e52] [cursor=pointer]: 01Story→
                - menuitem "02Brands I run" [ref=e53] [cursor=pointer]: 02Brands I run→
                - menuitem "03Press kit" [ref=e54] [cursor=pointer]: 03Press kit→
                - menuitem "04Contact" [ref=e55] [cursor=pointer]: 04Contact→
      - generic [ref=e56]:
        - button "Search site" [ref=e57]
        - button "Menu" [ref=e61]
  - main [ref=e63]:
    - 'heading "HEY_THISISANDREW: Creator, Photographer, Coffee Drinker" [level=1] [ref=e64]'
    - region [ref=e65]:
      - generic [ref=e68]:
        - heading [level=2] [ref=e69]:
          - img "HEY_THISISANDREW" [ref=e70]
        - paragraph [ref=e71]: Documenting the messy middle of building three brands, commercial photography, and creator automation.
        - link "See the brands" [ref=e72] [cursor=pointer]:
          - /url: "#directory"
          - text: See the brands ↓
    - region [ref=e73]:
      - generic [ref=e75]:
        - paragraph [ref=e76]:
          - generic [aria-hidden] [ref=e77]: "01"
          - generic [ref=e78]: The lanes
        - generic [ref=e79]:
          - heading "Brands" [level=2] [ref=e80]
          - link "Direct link to Brands section (click to copy)" [ref=e81] [cursor=pointer]:
            - /url: "#directory-heading"
            - generic [aria-hidden] [ref=e82]: "#"
            - generic [aria-hidden]: COPIED
      - generic [ref=e85]:
        - generic [ref=e88]:
          - article [ref=e89]:
            - button "BE Unconventional HQ" [expanded] [ref=e91]
            - paragraph [aria-hidden] [ref=e93]: BE Unconventional HQMedia Brand
            - region "BE Unconventional HQ" [ref=e94]:
              - heading "WHERE NERD CULTURE GETS CINEMATIC." [level=3] [ref=e95]
              - paragraph [ref=e96]: Reviews, deep dives, and event coverage.
              - link "Visit BE Unconventional HQ" [ref=e97] [cursor=pointer]:
                - /url: https://beunconventionalhq.com/
          - article [ref=e100]:
            - button "Capture Create Caffeinate" [ref=e102]
            - paragraph [aria-hidden] [ref=e104]: Capture Create CaffeinateBARS · RESTAURANTS · EVENTS
            - region "Capture Create Caffeinate" [ref=e105]:
              - heading "CONTENT THAT BRINGS PEOPLE THROUGH YOUR DOOR" [level=3] [ref=e106]
              - paragraph [ref=e107]: People decide with their eyes. One shoot, everywhere you post. Four hours, no disruption.
              - link "Visit Capture Create Caffeinate" [ref=e108] [cursor=pointer]:
                - /url: https://the.fotoapp.co/capturecreatecaffeinate
              - link "Start a project" [ref=e111] [cursor=pointer]:
                - /url: mailto:capturecreatecaffeinate@gmail.com?subject=Photography%20project%20inquiry
                - text: Start a project →
          - article [ref=e112]:
            - button "Sip the Magic" [ref=e120]:
              - text: Sip the Magic
              - generic [aria-hidden] [ref=e121]: STM
            - paragraph [aria-hidden] [ref=e122]: Sip the MagicSOMETHING IS BREWINGIn the works
            - region "Sip the Magic" [ref=e123]:
              - heading "SIP THE MAGIC." [level=3] [ref=e124]
              - paragraph [ref=e125]: Something is brewing. Sip the Magic is coming together. More soon.
          - article [ref=e126]:
            - button "Hey This Is Andrew" [ref=e128]
            - paragraph [aria-hidden] [ref=e130]: Hey This Is AndrewStudio Brand
            - region "Hey This Is Andrew" [ref=e131]:
              - heading "THE WORK BEHIND THE WORK." [level=3] [ref=e132]
              - paragraph [ref=e133]: Documenting the creative process.
              - link "Watch the build" [ref=e134] [cursor=pointer]:
                - /url: https://www.youtube.com/@HeyThisIsAndrew
        - paragraph
    - region [ref=e137]:
      - generic [ref=e138]:
        - generic [ref=e139]:
          - heading "Meet The Creator" [level=2] [ref=e144]
          - text: Creator | Photographer | Coffee drinker
        - generic [ref=e145]:
          - figure [ref=e146]:
            - generic [ref=e148]:
              - strong [ref=e149]: Andrew Baxter
              - text: Creator & photographer
          - generic [ref=e150]:
            - heading "WHERE THE MESSY MIDDLE GETS BUILT IN PUBLIC" [level=3] [ref=e151]: WHERE THE MESSY MIDDLEGETS BUILT IN PUBLIC
            - paragraph [ref=e152]: I'm building three brands and the creative automation behind them, out in the open. No polished fake expertise, just the messy, behind-the-scenes progress of pushing past perfectionism and figuring it out as I go.
            - paragraph [ref=e153]: BUILDING IN PUBLIC.
            - generic [ref=e154]:
              - heading "Now October 2026" [level=3] [ref=e155]
              - generic [ref=e156]:
                - generic [ref=e157]: "Building: Creator automation system /"
                - generic [ref=e158]: "Publishing: BE Unconventional HQ /"
              - generic [ref=e159]:
                - generic [ref=e160]:
                  - generic [ref=e161]: "Shooting: Hospitality photography /"
                  - generic [ref=e162]: "Working toward: New creative opportunities /"
                  - generic [ref=e163]: "Next: Something is brewing"
                - button "Show more" [ref=e165]
            - link "Read the Substack" [ref=e167] [cursor=pointer]:
              - /url: https://thisiscoffeetalk.substack.com
    - region [ref=e170]:
      - generic [ref=e172]:
        - paragraph [ref=e173]:
          - generic [ref=e174]: Photography
        - generic [ref=e175]:
          - heading "Shot on the job." [level=2] [ref=e176]
          - link "Direct link to Shot on the job. section (click to copy)" [ref=e177] [cursor=pointer]:
            - /url: "#photography-title"
            - generic [aria-hidden] [ref=e178]: "#"
            - generic [aria-hidden]: COPIED
        - paragraph [ref=e179]: Bar and beverage photography. The work behind Capture Create Caffeinate. Available for select photography work.
      - paragraph [ref=e182]: The photographs could not be loaded right now. Please check back soon.
      - paragraph [ref=e183]:
        - text: All photographs by Andrew. The cocktails and dishes pictured are the bar's. The photography is his.
        - link "More about the work" [ref=e184] [cursor=pointer]:
          - /url: /hey-this-is-andrew/about/
        - text: .
    - region [ref=e185]:
      - generic [ref=e186]:
        - generic [ref=e187]:
          - paragraph [ref=e188]:
            - generic [aria-hidden] [ref=e189]: "02"
            - generic [ref=e190]: Proof of process
          - generic [ref=e191]:
            - heading "Selected work" [level=2] [ref=e192]
            - link "Direct link to Selected work section (click to copy)" [ref=e193] [cursor=pointer]:
              - /url: "#work-heading"
              - generic [aria-hidden] [ref=e194]: "#"
              - generic [aria-hidden]: COPIED
          - paragraph [ref=e195]: "Work behind the scenes: shoots, edits, and building in public."
        - generic [ref=e198]:
          - article [ref=e200]:
            - button "How I'm Building Creator Automation Tools With AI (Watch the video)" [ref=e201]
            - generic [ref=e203]:
              - paragraph [ref=e204]: Latest video · Sep 2026
              - heading "How I'm Building Creator Automation Tools With AI" [level=3] [ref=e205]
              - paragraph [ref=e206]: How I'm building open-source creator automation tools with n8n, AI, and code.
              - paragraph [ref=e207]: Watch the video ↗
          - generic [ref=e208]:
            - article [ref=e209]:
              - generic [aria-hidden] [ref=e210]: REC
              - generic [ref=e211]:
                - paragraph [ref=e212]: Sep 2026
                - 'heading "Cocktail Series: Bar Shoot" [level=3] [ref=e213]'
                - paragraph [ref=e214]: Photographer · Capture Create Caffeinate
                - paragraph [ref=e215]: Beverage series for Capture Create Caffeinate. Dark bar, available practicals, one speedlight. The a7IV stayed on the body the whole night for its high-ISO performance.
                - list "Tools used" [ref=e216]:
                  - listitem [ref=e217]: Sony a7IV
                  - listitem [ref=e218]: Sony 50mm f/2.5 G
                  - listitem [ref=e219]: Sony HVL-F60RM2
            - article [ref=e220]:
              - generic [aria-hidden] [ref=e221]: REC
              - generic [ref=e222]:
                - paragraph [ref=e223]: Sep 2026
                - 'heading "Building in Public: Episode 1" [level=3] [ref=e224]'
                - paragraph [ref=e225]: Creator & editor · Hey, This Is Andrew
                - paragraph [ref=e226]: Pilot episode for the build-in-public series. Shot, edited, and graded in a single weekend to prove the workflow before committing to a schedule.
                - list "Tools used" [ref=e227]:
                  - listitem [ref=e228]: Sony a7IV
                  - listitem [ref=e229]: DaVinci Resolve
        - generic [ref=e230]:
          - generic [ref=e233]:
            - paragraph [ref=e234]: Current workflow
            - list [ref=e235]:
              - listitem [ref=e236]: 01ShootSony a7IV / a7CR
              - listitem [ref=e237]: 02EditDaVinci Resolve, Lightroom, Photoshop
              - listitem [ref=e238]: 03GradeDaVinci Resolve
              - listitem [ref=e239]: 04PublishYouTube, Instagram, Foto, TikTok
          - button "Show all work (0)" [ref=e241]
    - region [ref=e242]:
      - generic [ref=e243]:
        - generic [ref=e244]:
          - paragraph [ref=e245]:
            - generic [aria-hidden] [ref=e246]: "03"
            - generic [ref=e247]: The network
          - generic [ref=e248]:
            - heading "Latest" [level=2] [ref=e249]
            - link "Direct link to Latest section (click to copy)" [ref=e250] [cursor=pointer]:
              - /url: "#latest-heading"
              - generic [aria-hidden] [ref=e251]: "#"
              - generic [aria-hidden]: COPIED
          - paragraph [ref=e252]: Recent videos, articles, and dispatches across BE, CCC, and the build.
        - group "Filter the latest" [ref=e255]:
          - button "All" [pressed] [ref=e256]
          - button "Video" [ref=e257]
          - button "Writing" [ref=e258]
        - generic [ref=e259]:
          - list [ref=e260]:
            - listitem [ref=e261]:
              - link "BE Unconventional HQArticle L.A. Comic Con 2026Sep 15, 2026" [ref=e262] [cursor=pointer]:
                - /url: https://beunconventionalhq.com/intel/la-comic-con-2026
                - generic [ref=e263]: BE Unconventional HQArticle
                - text: L.A. Comic Con 2026Sep 15, 2026→
            - listitem [ref=e264]:
              - link "BE Unconventional HQArticle Lanterns | The Grounded Blueprint for James Gunn’s DCUSep 8, 2026" [ref=e265] [cursor=pointer]:
                - /url: https://beunconventionalhq.com/intel/lanterns-the-grounded-blueprint-for
                - generic [ref=e266]: BE Unconventional HQArticle
                - text: Lanterns | The Grounded Blueprint for James Gunn’s DCUSep 8, 2026→
            - listitem [ref=e267]:
              - link "BE Unconventional HQArticle How Resident Evil Makes Being in the Theater Feel Like You're Actually Holding a ControllerSep 4, 2026" [ref=e268] [cursor=pointer]:
                - /url: https://beunconventionalhq.com/intel/how-resident-evil-makes-being-in
                - generic [ref=e269]: BE Unconventional HQArticle
                - text: How Resident Evil Makes Being in the Theater Feel Like You're Actually Holding a ControllerSep 4, 2026→
          - generic [ref=e270]:
            - generic:
              - generic:
                - list [ref=e271]:
                  - listitem [ref=e272]:
                    - link "The BuildArticle Scaling a One-Person Brand with Open-Source AutomationAug 31, 2026" [ref=e273] [cursor=pointer]:
                      - /url: https://thisiscoffeetalk.substack.com/p/scaling-a-one-person-brand-with-open
                      - generic [ref=e274]: The BuildArticle
                      - text: Scaling a One-Person Brand with Open-Source AutomationAug 31, 2026→
                  - listitem [ref=e275]:
                    - 'link "The BuildArticle Leveling Up: How Community and AI Are Transforming My WorkflowAug 30, 2026" [ref=e276] [cursor=pointer]':
                      - /url: https://thisiscoffeetalk.substack.com/p/leveling-up-how-community-and-ai
                      - generic [ref=e277]: The BuildArticle
                      - text: "Leveling Up: How Community and AI Are Transforming My WorkflowAug 30, 2026→"
                  - listitem [ref=e278]:
                    - link "Hey, This Is AndrewVideo YouTube Just Made Monetization Impossible. Good.Aug 18, 2026" [ref=e279] [cursor=pointer]:
                      - /url: https://www.youtube.com/watch?v=86uB4_VO9JY
                      - generic [ref=e280]: Hey, This Is AndrewVideo
                      - text: YouTube Just Made Monetization Impossible. Good.Aug 18, 2026→
                  - listitem [ref=e281]:
                    - 'link "The BuildArticle Dev Diary: My Journey as a Technical CreatorAug 14, 2026" [ref=e282] [cursor=pointer]':
                      - /url: https://thisiscoffeetalk.substack.com/p/dev-diary-my-journey-as-a-technical
                      - generic [ref=e283]: The BuildArticle
                      - text: "Dev Diary: My Journey as a Technical CreatorAug 14, 2026→"
                  - listitem [ref=e284]:
                    - link "Hey, This Is AndrewVideo YouTube Monetization is Slow. Do This Instead!Aug 11, 2026" [ref=e285] [cursor=pointer]:
                      - /url: https://www.youtube.com/watch?v=oJ1VEOMWkgE
                      - generic [ref=e286]: Hey, This Is AndrewVideo
                      - text: YouTube Monetization is Slow. Do This Instead!Aug 11, 2026→
                - paragraph [ref=e287]:
                  - link "Read everything on Substack" [ref=e288] [cursor=pointer]:
                    - /url: https://thisiscoffeetalk.substack.com
                  - link "RSS feed for the writing" [ref=e289] [cursor=pointer]:
                    - /url: /hey-this-is-andrew/rss.xml
            - button "Show all (5)" [ref=e291]
    - region [ref=e292]:
      - generic [ref=e293]:
        - generic [ref=e294]:
          - paragraph [ref=e295]:
            - generic [aria-hidden] [ref=e296]: "04"
            - generic [ref=e297]: Building in public
          - generic [ref=e298]:
            - heading "Goals" [level=2] [ref=e299]
            - link "Direct link to Goals section (click to copy)" [ref=e300] [cursor=pointer]:
              - /url: "#goals-heading"
              - generic [aria-hidden] [ref=e301]: "#"
              - generic [aria-hidden]: COPIED
          - paragraph [ref=e302]: Building in public.
        - region "The Big Goals" [ref=e306]:
          - generic [ref=e307]:
            - heading "The Big Goals" [level=3] [ref=e308]
            - text: 0/2
          - progressbar "The Big Goals progress"
          - list [ref=e309]:
            - listitem [ref=e310]:
              - generic [ref=e311]:
                - text: 100,000 subscribers on YouTube
                - generic [ref=e312]: "Status: In progress"
                - text: Hey This Is Andrew main channel. Building in public.
            - listitem [ref=e313]:
              - generic [ref=e314]:
                - text: $30,000 per month as a creator
                - generic [ref=e315]: "Status: In progress"
                - text: Brand deals, UGC, storefront. The honest number, stated out loud.
        - list [ref=e316]:
          - listitem [ref=e317]:
            - text: Content Engine
            - generic [ref=e318]: 0/3 done
          - listitem [ref=e319]:
            - text: Landing Page v1
            - generic [ref=e320]: 4/4 done
        - generic [ref=e321]:
          - generic [ref=e323]:
            - region "Content Engine" [ref=e324]:
              - generic [ref=e325]:
                - heading "Content Engine" [level=3] [ref=e326]
                - text: 0/3
              - progressbar "Content Engine progress"
              - list [ref=e327]:
                - listitem [ref=e328]:
                  - generic [ref=e329]:
                    - text: Publish build-in-public episode 1
                    - generic [ref=e330]: "Status: In progress"
                - listitem [ref=e331]:
                  - generic [ref=e332]:
                    - text: Lock the weekly upload schedule
                    - generic [ref=e333]: "Status: Up next"
                - listitem [ref=e334]:
                  - generic [ref=e335]:
                    - text: First hospitality brand collaboration
                    - generic [ref=e336]: "Status: Up next"
            - region "Landing Page v1" [ref=e337]:
              - generic [ref=e338]:
                - heading "Landing Page v1" [level=3] [ref=e339]
                - text: 4/4
              - progressbar "Landing Page v1 progress"
              - list [ref=e340]:
                - listitem [ref=e341]:
                  - generic [ref=e342]:
                    - text: Write the design spec
                    - generic [ref=e343]: "Status: Done"
                    - text: Wireframe, palette, and type locked.
                - listitem [ref=e344]:
                  - generic [ref=e345]:
                    - text: Build the Astro site
                    - generic [ref=e346]: "Status: Done"
                    - text: Full implementation deployed.
                - listitem [ref=e347]:
                  - generic [ref=e348]:
                    - text: Add brand logos and hero media
                    - generic [ref=e349]: "Status: Done"
                - listitem [ref=e350]:
                  - generic [ref=e351]:
                    - text: Deploy
                    - generic [ref=e352]: "Status: Done"
                    - text: Live on GitHub Pages.
          - button "Show all goals" [ref=e354]
    - region [ref=e355]:
      - generic [ref=e356]:
        - generic [ref=e357]:
          - paragraph [ref=e358]:
            - generic [aria-hidden] [ref=e359]: "05"
            - generic [ref=e360]: Work with Andrew
          - generic [ref=e361]:
            - heading "What I do" [level=2] [ref=e362]
            - link "Direct link to What I do section (click to copy)" [ref=e363] [cursor=pointer]:
              - /url: "#services-heading"
              - generic [aria-hidden] [ref=e364]: "#"
              - generic [aria-hidden]: COPIED
          - paragraph [ref=e365]: Five services, one operator. For press, media, or project inquiries, head to the press kit.
        - list [ref=e368]:
          - listitem [ref=e369]:
            - heading "Beverage & hospitality photography" [level=3] [ref=e370]
            - paragraph [ref=e371]: Cocktails, plates, and the rooms they are served in, photographed for bars and restaurants.
          - listitem [ref=e372]:
            - heading "Short-form video & Reels" [level=3] [ref=e373]
            - paragraph [ref=e374]: Vertical video shot and cut for Reels, TikTok, and Shorts.
          - listitem [ref=e375]:
            - heading "UGC & brand partnerships" [level=3] [ref=e376]
            - paragraph [ref=e377]: Content for brands, made the same way I make my own, with the process shown.
        - generic [ref=e378]:
          - generic:
            - generic:
              - list [ref=e379]:
                - listitem [ref=e380]:
                  - heading "Video editing" [level=3] [ref=e381]
                  - paragraph [ref=e382]: Editing, color, and sound for footage you already have.
                - listitem [ref=e383]:
                  - heading "Event photo & video coverage" [level=3] [ref=e384]
                  - paragraph [ref=e385]: Photos and video from your event, ready to post the same week.
              - paragraph [ref=e387]:
                - text: Press, media, or project inquiry?
                - link "Visit the press kit" [ref=e388] [cursor=pointer]:
                  - /url: /hey-this-is-andrew/about/#press
                - text: .
          - button "Show all services" [ref=e390]
    - region [ref=e391]:
      - generic [ref=e392]:
        - generic [ref=e393]:
          - paragraph [ref=e394]:
            - generic [aria-hidden] [ref=e395]: "06"
            - generic [ref=e396]: The kit
          - generic [ref=e397]:
            - heading "Gear" [level=2] [ref=e398]
            - link "Direct link to Gear section (click to copy)" [ref=e399] [cursor=pointer]:
              - /url: "#gear-heading"
              - generic [aria-hidden] [ref=e400]: "#"
              - generic [aria-hidden]: COPIED
          - paragraph [ref=e401]: Behind the work. Updated as it evolves.
        - complementary "Featured picks and recommendations" [ref=e405]:
          - generic [ref=e406]:
            - generic [ref=e407]:
              - generic [ref=e408]:
                - paragraph [ref=e409]: Production Stack
                - heading "Verified Hardware Kit" [level=3] [ref=e410]
                - paragraph [ref=e411]: The complete inventory of cameras, lenses, lighting, and audio gear actively deployed in the studio.
              - link "Browse complete kit" [ref=e412] [cursor=pointer]:
                - /url: https://www.amazon.com/shop/influencer-0931c541?ref=ac_inf_tb_vh
            - generic [ref=e415]:
              - generic [ref=e416]:
                - paragraph [ref=e417]: Mobile workflow
                - heading "Mint Mobile" [level=3] [ref=e418]
                - paragraph [ref=e419]: Reliable, flexible cellular connectivity powering off-site shoots and mobile production.
              - link "Check out Mint Mobile" [ref=e420] [cursor=pointer]:
                - /url: https://mintmobile.com/
            - generic [ref=e423]:
              - generic [ref=e424]:
                - paragraph [ref=e425]: Post-production
                - heading "DaVinci Resolve" [level=3] [ref=e426]
                - paragraph [ref=e427]: Professional editing, color grading, and audio post for all long-form and commercial deliverables.
              - link "Explore DaVinci Resolve" [ref=e428] [cursor=pointer]:
                - /url: https://www.blackmagicdesign.com/products/davinciresolve
          - group "Select storefront pick" [ref=e432]:
            - button "Show Verified Hardware Kit" [ref=e433]
            - button "Show Mint Mobile" [ref=e434]
            - button "Show DaVinci Resolve" [ref=e435]
        - generic [ref=e436]:
          - generic [ref=e437]:
            - heading "The kit" [level=2] [ref=e438]
            - generic [ref=e439]:
              - search "Filter gear loadout" [ref=e440]:
                - searchbox "Search gear" [ref=e445]
                - tablist "Gear categories" [ref=e446]:
                  - tab "All" [selected] [ref=e447]
                  - tab "Cameras" [ref=e448]
                  - tab "Lenses" [ref=e449]
                  - tab "Lighting" [ref=e450]
                  - tab "Audio" [ref=e451]
                  - tab "Support" [ref=e452]
              - generic [ref=e453]:
                - generic [ref=e454]:
                  - generic [ref=e455]:
                    - text: 01 / HERO SYSTEM
                    - heading "Camera Bodies" [level=3] [ref=e456]
                    - text: High-Resolution Commercial Stills & Next-Gen Mobile Video
                  - generic "Camera Brands" [ref=e457]:
                    - generic "Sony Alpha Ecosystem" [ref=e458]:
                      - img "Sony" [ref=e459]
                      - text: α
                    - generic "Apple ProRes Log" [ref=e461]:
                      - img "Apple" [ref=e462]
                      - text: Apple ProRes
                    - link "Amazon Storefront" [ref=e464] [cursor=pointer]:
                      - /url: https://www.amazon.com/shop/influencer-0931c541?ref=ac_inf_tb_vh
                - generic [ref=e467]:
                  - generic [ref=e468]:
                    - generic [ref=e469]: MANIFEST5 CAMERAS IN ACTIVE ROTATION
                    - generic [ref=e470]:
                      - generic [ref=e471]:
                        - generic [ref=e472]:
                          - generic [ref=e473]:
                            - heading "Sony a7IV" [level=4] [ref=e474]
                            - text: Workhorse Body
                          - paragraph [ref=e475]: 33MP Full-Frame Exmor R CMOS, BIONZ XR, 4K60p 10-bit 4:2:2, 15+ stops DR. Primary body for low-light bar and atmospheric beverage work.
                        - link "Storefront ↗" [ref=e477] [cursor=pointer]:
                          - /url: https://www.amazon.com/shop/influencer-0931c541?ref=ac_inf_tb_vh
                      - generic [ref=e478]:
                        - generic [ref=e479]:
                          - generic [ref=e480]:
                            - heading "Sony a7CR" [level=4] [ref=e481]
                            - text: 61MP AI High-Res
                          - paragraph [ref=e482]: 61MP Ultra-Compact Full-Frame, Dedicated AI Autofocus Processing Unit, Pixel Shift Multi Shooting. Dedicated to detail-critical cocktail close-ups and high-res print stills.
                        - link "Storefront ↗" [ref=e484] [cursor=pointer]:
                          - /url: https://www.amazon.com/shop/influencer-0931c541?ref=ac_inf_tb_vh
                      - generic [ref=e485]:
                        - generic [ref=e486]:
                          - generic [ref=e487]:
                            - heading "iPhone 17 Pro Max" [level=4] [ref=e488]
                            - text: Next-Gen Mobile
                          - paragraph [ref=e489]: 48MP Fusion quad-pixel sensor, Apple Log 2 ProRes 4K120 fps, anti-reflective optical coating. Next-gen primary handheld mobile video capture and run-and-gun social reels.
                        - link "Storefront ↗" [ref=e491] [cursor=pointer]:
                          - /url: https://www.amazon.com/shop/influencer-0931c541?ref=ac_inf_tb_vh
                      - generic [ref=e492]:
                        - generic [ref=e493]:
                          - generic [ref=e494]:
                            - heading "iPhone 15 Pro Max" [level=4] [ref=e495]
                            - text: 5x Telephoto B-Cam
                          - paragraph [ref=e496]: 48MP Main with 24mm/28mm/35mm framing, 5x 120mm tetraprism telephoto, direct USB-C ProRes Log to NVMe SSD. Ultra-reliable pocket B-cam and fast-turnaround vertical stories.
                        - link "Storefront ↗" [ref=e498] [cursor=pointer]:
                          - /url: https://www.amazon.com/shop/influencer-0931c541?ref=ac_inf_tb_vh
                      - generic [ref=e499]:
                        - generic [ref=e500]:
                          - generic [ref=e501]:
                            - heading "iPhone 12 Pro Max" [level=4] [ref=e502]
                            - text: Overhead Rig B-Cam
                          - paragraph [ref=e503]: 12MP sensor-shift stabilization, Dolby Vision HDR 10-bit recording, LiDAR scanner. Dedicated static overhead cocktail prep and secondary reference angle backup.
                        - link "Storefront ↗" [ref=e505] [cursor=pointer]:
                          - /url: https://www.amazon.com/shop/influencer-0931c541?ref=ac_inf_tb_vh
                  - generic [ref=e506]:
                    - generic [ref=e507]: SPECIFICATIONFIELD VERIFIED
                    - generic [ref=e508]:
                      - generic [ref=e509]: STUDIO VERIFIEDWorkhorse Body
                      - img [ref=e513]:
                        - generic [ref=e523]: SONY ALPHA // SYSTEM
                      - generic [ref=e524]:
                        - generic [ref=e525]:
                          - text: SONY ELECTRONICS
                          - heading "Sony a7 IV" [level=4] [ref=e526]
                          - paragraph [ref=e527]: 33MP Full-Frame Exmor R CMOS, BIONZ XR, 4K60p 10-bit 4:2:2, 15+ stops DR. Primary body for low-light bar and atmospheric beverage work.
                        - generic [ref=e528]:
                          - link "View on Amazon Storefront" [ref=e529] [cursor=pointer]:
                            - /url: https://www.amazon.com/shop/influencer-0931c541?ref=ac_inf_tb_vh
                          - text: Curated by Andrew · Field verified equipment
              - generic [ref=e532]:
                - region "Lens" [ref=e533]:
                  - generic [ref=e534]:
                    - generic [ref=e535]:
                      - text: 02 / OPTICAL SYSTEM
                      - heading "Lens" [level=3] [ref=e536]
                      - text: G Master zoom trilogy and ultra-sharp low-light prime optics
                    - generic [ref=e537]:
                      - generic "Sony G Master & Viltrox" [ref=e538]: G MASTER/VILTROX
                      - link "Storefront" [ref=e539] [cursor=pointer]:
                        - /url: https://www.amazon.com/shop/influencer-0931c541?ref=ac_inf_tb_vh
                  - generic [ref=e542]:
                    - generic [ref=e543]:
                      - generic [ref=e544]: MANIFEST8 PIECES VERIFIED
                      - generic [ref=e545]:
                        - generic [ref=e546]:
                          - generic [ref=e547]:
                            - generic [ref=e548]:
                              - heading "Sony FE 24-70mm f/2.8 GM II" [level=4] [ref=e549]
                              - text: Workhorse Zoom
                            - paragraph [ref=e550]: Workhorse standard zoom. Quad XD linear motors, razor-sharp edge-to-edge, extreme flare resistance in dark bar environments.
                          - link "Storefront ↗" [ref=e552] [cursor=pointer]:
                            - /url: https://www.amazon.com/shop/influencer-0931c541?ref=ac_inf_tb_vh
                        - generic [ref=e553]:
                          - generic [ref=e554]:
                            - generic [ref=e555]:
                              - heading "Sony FE 16-35mm f/2.8 GM II" [level=4] [ref=e556]
                              - text: Ultra-Wide Arch
                            - paragraph [ref=e557]: Ultra-wide zoom. Architecturally straight interiors, ambient venue establishing shots, and dramatic bar counter perspective.
                          - link "Storefront ↗" [ref=e559] [cursor=pointer]:
                            - /url: https://www.amazon.com/shop/influencer-0931c541?ref=ac_inf_tb_vh
                        - generic [ref=e560]:
                          - generic [ref=e561]:
                            - generic [ref=e562]:
                              - heading "Sony FE 70-200mm f/2.8 GM II" [level=4] [ref=e563]
                              - text: Tele Compression
                            - paragraph [ref=e564]: Telephoto zoom with legendary optical compression. Cocktail pours and candid bartender portraits captured without crowding the bar.
                          - link "Storefront ↗" [ref=e566] [cursor=pointer]:
                            - /url: https://www.amazon.com/shop/influencer-0931c541?ref=ac_inf_tb_vh
                        - generic [ref=e567]:
                          - generic [ref=e568]:
                            - generic [ref=e569]:
                              - heading "Sony FE 90mm f/2.8 Macro G OSS" [level=4] [ref=e570]
                              - text: 1:1 Detail Macro
                            - paragraph [ref=e571]: True 1:1 macro reproduction. Razor-sharp condensation droplets, carbonation bubbles, and intricate cocktail garnish textures.
                          - link "Storefront ↗" [ref=e573] [cursor=pointer]:
                            - /url: https://www.amazon.com/shop/influencer-0931c541?ref=ac_inf_tb_vh
                        - generic [ref=e574]:
                          - generic [ref=e575]:
                            - generic [ref=e576]:
                              - heading "Sony FE 55mm f/1.8 ZA Sonnar" [level=4] [ref=e577]
                              - text: Zeiss 3D Pop
                            - paragraph [ref=e578]: Zeiss optical formula with legendary 3D pop and micro-contrast. Low-light bar favorite with creamy out-of-focus background rolloff.
                          - link "Storefront ↗" [ref=e580] [cursor=pointer]:
                            - /url: https://www.amazon.com/shop/influencer-0931c541?ref=ac_inf_tb_vh
                        - generic [ref=e581]:
                          - generic [ref=e582]:
                            - generic [ref=e583]:
                              - heading "Sony FE 50mm f/2.5 G" [level=4] [ref=e584]
                              - text: Compact Prime
                            - paragraph [ref=e585]: Ultra-compact all-metal prime. Dual linear AF motors, aperture ring with de-click switch, perfect for lightweight handheld shoots.
                          - link "Storefront ↗" [ref=e587] [cursor=pointer]:
                            - /url: https://www.amazon.com/shop/influencer-0931c541?ref=ac_inf_tb_vh
                        - generic [ref=e588]:
                          - generic [ref=e589]:
                            - generic [ref=e590]:
                              - heading "Sony FE 24mm f/2.8 G" [level=4] [ref=e591]
                              - text: Compact Wide
                            - paragraph [ref=e592]: Ultra-compact wide prime. Matched form factor with the 50mm G, ideal for gimbal balancing and tight prep-table clearances.
                          - link "Storefront ↗" [ref=e594] [cursor=pointer]:
                            - /url: https://www.amazon.com/shop/influencer-0931c541?ref=ac_inf_tb_vh
                        - generic [ref=e595]:
                          - generic [ref=e596]:
                            - generic [ref=e597]:
                              - heading "Viltrox AF 85mm f/2.0 EVO" [level=4] [ref=e598]
                              - text: Portrait Separation
                            - paragraph [ref=e599]: Short telephoto portrait prime with STM stepping motor and creamy bokeh. Ideal for cinematic beverage isolation.
                          - link "Storefront ↗" [ref=e601] [cursor=pointer]:
                            - /url: https://www.amazon.com/shop/influencer-0931c541?ref=ac_inf_tb_vh
                    - generic [ref=e602]:
                      - generic [ref=e603]: SPECIFICATIONBENCH VERIFIED
                      - generic [ref=e604]:
                        - generic [ref=e605]: PRODUCTION SPECWorkhorse Zoom
                        - img [ref=e609]:
                          - generic [ref=e620]: G
                          - generic [ref=e621]: SONY G MASTER // OPTICAL SYSTEM
                        - generic [ref=e622]:
                          - generic [ref=e623]:
                            - text: Sony
                            - heading "Sony FE 24-70mm f/2.8 GM II" [level=4] [ref=e624]
                            - paragraph [ref=e625]: Workhorse standard zoom. Quad XD linear motors, razor-sharp edge-to-edge, extreme flare resistance in dark bar environments.
                          - link "View on Amazon Storefront" [ref=e627] [cursor=pointer]:
                            - /url: https://www.amazon.com/shop/influencer-0931c541?ref=ac_inf_tb_vh
                - region "Lighting" [ref=e630]:
                  - generic [ref=e631]:
                    - generic [ref=e632]:
                      - text: 03 / ILLUMINATION
                      - heading "Lighting" [level=3] [ref=e633]
                      - text: Studio point-source LED, magnetic RGB accent tubes, and radio wireless flash
                    - generic [ref=e634]:
                      - generic "Aputure & Sony Flash" [ref=e635]: Aputure/Sony TTL
                      - link "Storefront" [ref=e636] [cursor=pointer]:
                        - /url: https://www.amazon.com/shop/influencer-0931c541?ref=ac_inf_tb_vh
                  - generic [ref=e639]:
                    - generic [ref=e640]:
                      - generic [ref=e641]: MANIFEST4 PIECES VERIFIED
                      - generic [ref=e642]:
                        - generic [ref=e643]:
                          - generic [ref=e644]:
                            - generic [ref=e645]:
                              - heading "Aputure Amaran 200d" [level=4] [ref=e646]
                              - text: 200W Key Light
                            - paragraph [ref=e647]: 200W Daylight (5600K) point-source LED, Bowens mount, 65,000 lux @ 1m with reflector. Key light for commercial beverage and tabletop setups.
                          - link "Storefront ↗" [ref=e649] [cursor=pointer]:
                            - /url: https://www.amazon.com/shop/influencer-0931c541?ref=ac_inf_tb_vh
                        - generic [ref=e650]:
                          - generic [ref=e651]:
                            - generic [ref=e652]:
                              - heading "Aputure Amaran PT1c" [level=4] [ref=e653]
                              - text: RGB Accent Tube
                            - paragraph [ref=e654]: 1-foot battery-powered RGBWW LED pixel tube, magnetic endcaps, Sidus Link app control. Placed on bar shelves and dark corners for subtle practical rim light.
                          - link "Storefront ↗" [ref=e656] [cursor=pointer]:
                            - /url: https://www.amazon.com/shop/influencer-0931c541?ref=ac_inf_tb_vh
                        - generic [ref=e657]:
                          - generic [ref=e658]:
                            - generic [ref=e659]:
                              - heading "Sony HVL-F60RM2" [level=4] [ref=e660]
                              - text: Radio Wireless TTL
                            - paragraph [ref=e661]: GN60 high-output wireless radio flash, Quick Shift Bounce system, 20-200mm motorized zoom head, high-speed sync (HSS) with reliable multi-flash TTL.
                          - link "Storefront ↗" [ref=e663] [cursor=pointer]:
                            - /url: https://www.amazon.com/shop/influencer-0931c541?ref=ac_inf_tb_vh
                        - generic [ref=e664]:
                          - generic [ref=e665]:
                            - generic [ref=e666]:
                              - heading "Aputure Light Dome Mini II" [level=4] [ref=e667]
                              - text: Directional Spill
                            - paragraph [ref=e668]: 21.5-inch quick-release parabolic softbox with 40-degree fabric grid and dual diffusion layers. Soft, directional light control without room spill.
                          - link "Storefront ↗" [ref=e670] [cursor=pointer]:
                            - /url: https://www.amazon.com/shop/influencer-0931c541?ref=ac_inf_tb_vh
                    - generic [ref=e671]:
                      - generic [ref=e672]: SPECIFICATIONBENCH VERIFIED
                      - generic [ref=e673]:
                        - generic [ref=e674]: PRODUCTION SPEC200W Key Light
                        - img [ref=e678]:
                          - generic [ref=e686]: AMARAN // 5600K DAYLIGHT LED
                        - generic [ref=e687]:
                          - generic [ref=e688]:
                            - text: Aputure
                            - heading "Aputure Amaran 200d" [level=4] [ref=e689]
                            - paragraph [ref=e690]: 200W Daylight (5600K) point-source LED, Bowens mount, 65,000 lux @ 1m with reflector. Key light for commercial beverage and tabletop setups.
                          - link "View on Amazon Storefront" [ref=e692] [cursor=pointer]:
                            - /url: https://www.amazon.com/shop/influencer-0931c541?ref=ac_inf_tb_vh
                - region "Audio" [ref=e695]:
                  - generic [ref=e696]:
                    - generic [ref=e697]:
                      - text: 04 / ACOUSTIC PIPELINE
                      - heading "Audio" [level=3] [ref=e698]
                      - text: 32-bit float internal recording, directional shotguns, and studio broadcast narration
                    - generic [ref=e699]:
                      - generic "DJI & Røde Audio" [ref=e700]: DJI/Røde
                      - link "Storefront" [ref=e701] [cursor=pointer]:
                        - /url: https://www.amazon.com/shop/influencer-0931c541?ref=ac_inf_tb_vh
                  - generic [ref=e704]:
                    - generic [ref=e705]:
                      - generic [ref=e706]: MANIFEST4 PIECES VERIFIED
                      - generic [ref=e707]:
                        - generic [ref=e708]:
                          - generic [ref=e709]:
                            - generic [ref=e710]:
                              - heading "DJI Mic 2 Wireless System" [level=4] [ref=e711]
                              - text: 32-Bit Float Dual
                            - paragraph [ref=e712]: Dual-channel wireless mic system with 32-bit float internal backup recording, intelligent active noise cancelling, and magnetic clothing clips.
                          - link "Storefront ↗" [ref=e714] [cursor=pointer]:
                            - /url: https://www.amazon.com/shop/influencer-0931c541?ref=ac_inf_tb_vh
                        - generic [ref=e715]:
                          - generic [ref=e716]:
                            - generic [ref=e717]:
                              - heading "Røde VideoMic NTG" [level=4] [ref=e718]
                              - text: On-Camera Shotgun
                            - paragraph [ref=e719]: Broadcast-grade directional on-camera shotgun microphone with auto-sensing 3.5mm and USB-C output, infinitely variable gain, and built-in safety channel.
                          - link "Storefront ↗" [ref=e721] [cursor=pointer]:
                            - /url: https://www.amazon.com/shop/influencer-0931c541?ref=ac_inf_tb_vh
                        - generic [ref=e722]:
                          - generic [ref=e723]:
                            - generic [ref=e724]:
                              - heading "Zoom H6 Essential Field Recorder" [level=4] [ref=e725]
                              - text: Field Recorder
                            - paragraph [ref=e726]: Multi-track handheld audio field recorder featuring dual 32-bit float A/D converters, interchangeable X/Y mic capsules, and dual XLR/TRS combo inputs.
                          - link "Storefront ↗" [ref=e728] [cursor=pointer]:
                            - /url: https://www.amazon.com/shop/influencer-0931c541?ref=ac_inf_tb_vh
                        - generic [ref=e729]:
                          - generic [ref=e730]:
                            - generic [ref=e731]:
                              - heading "Shure SM7B Dynamic Vocal Mic" [level=4] [ref=e732]
                              - text: Broadcast Studio
                            - paragraph [ref=e733]: Legendary studio broadcast dynamic microphone with flat, wide-range frequency response and internal air-suspension shock isolation for channel voiceovers.
                          - link "Storefront ↗" [ref=e735] [cursor=pointer]:
                            - /url: https://www.amazon.com/shop/influencer-0931c541?ref=ac_inf_tb_vh
                    - generic [ref=e736]:
                      - generic [ref=e737]: SPECIFICATIONBENCH VERIFIED
                      - generic [ref=e738]:
                        - generic [ref=e739]: PRODUCTION SPEC32-Bit Float Dual
                        - img [ref=e743]:
                          - generic [ref=e747]: 32-BIT
                          - generic [ref=e751]: FLOAT
                          - generic [ref=e753]: DJI MIC 2 // 32-BIT FLOAT WIRELESS
                        - generic [ref=e754]:
                          - generic [ref=e755]:
                            - text: DJI
                            - heading "DJI Mic 2 Wireless System" [level=4] [ref=e756]
                            - paragraph [ref=e757]: Dual-channel wireless mic system with 32-bit float internal backup recording, intelligent active noise cancelling, and magnetic clothing clips.
                          - link "View on Amazon Storefront" [ref=e759] [cursor=pointer]:
                            - /url: https://www.amazon.com/shop/influencer-0931c541?ref=ac_inf_tb_vh
                - region "Tools & Support" [ref=e762]:
                  - generic [ref=e763]:
                    - generic [ref=e764]:
                      - text: 05 / STABILIZATION & RIG
                      - heading "Tools & Support" [level=3] [ref=e765]
                      - text: Motorized 3-axis stabilization, carbon fiber legs, and modular cinema cages
                    - generic [ref=e766]:
                      - generic "Zhiyun & Peak Design" [ref=e767]: Zhiyun/Peak Design
                      - link "Storefront" [ref=e768] [cursor=pointer]:
                        - /url: https://www.amazon.com/shop/influencer-0931c541?ref=ac_inf_tb_vh
                  - generic [ref=e771]:
                    - generic [ref=e772]:
                      - generic [ref=e773]: MANIFEST4 PIECES VERIFIED
                      - generic [ref=e774]:
                        - generic [ref=e775]:
                          - generic [ref=e776]:
                            - generic [ref=e777]:
                              - heading "Zhiyun Weebill 3 Gimbal" [level=4] [ref=e778]
                              - text: 3-Axis Gimbal
                            - paragraph [ref=e779]: 3-axis motorized camera stabilizer, built-in 1000-lumen fill light and noise-cancelling microphone, ergonomic Sling 2.0 wrist support for long shoot shifts.
                          - link "Storefront ↗" [ref=e781] [cursor=pointer]:
                            - /url: https://www.amazon.com/shop/influencer-0931c541?ref=ac_inf_tb_vh
                        - generic [ref=e782]:
                          - generic [ref=e783]:
                            - generic [ref=e784]:
                              - heading "Peak Design Carbon Fiber Tripod" [level=4] [ref=e785]
                              - text: Carbon Travel Legs
                            - paragraph [ref=e786]: Ultra-compact zero-wasted-volume design, integrated ball head with Arca-Swiss quick-release, fast cam-lever leg deployment for mobile bar scouting.
                          - link "Storefront ↗" [ref=e788] [cursor=pointer]:
                            - /url: https://www.amazon.com/shop/influencer-0931c541?ref=ac_inf_tb_vh
                        - generic [ref=e789]:
                          - generic [ref=e790]:
                            - generic [ref=e791]:
                              - heading "SmallRig Camera Cage & NATO Rig" [level=4] [ref=e792]
                              - text: Modular Rigging
                            - paragraph [ref=e793]: Form-fitting aluminum cage, ergonomic wooden top handle with ARRI locating holes, integrated NATO rails and cold-shoe mounts for quick monitor and mic mounting.
                          - link "Storefront ↗" [ref=e795] [cursor=pointer]:
                            - /url: https://www.amazon.com/shop/influencer-0931c541?ref=ac_inf_tb_vh
                        - generic [ref=e796]:
                          - generic [ref=e797]:
                            - generic [ref=e798]:
                              - heading "Kupo Steel C-Stands & Grip Arms" [level=4] [ref=e799]
                              - text: Overhead Grip
                            - paragraph [ref=e800]: Heavy-duty chrome-plated steel turtle base C-stands with 40-inch grip arms and 2.5-inch grip heads for overhead cocktail cameras and boom light positioning.
                          - link "Storefront ↗" [ref=e802] [cursor=pointer]:
                            - /url: https://www.amazon.com/shop/influencer-0931c541?ref=ac_inf_tb_vh
                    - generic [ref=e803]:
                      - generic [ref=e804]: SPECIFICATIONBENCH VERIFIED
                      - generic [ref=e805]:
                        - generic [ref=e806]: PRODUCTION SPEC3-Axis Gimbal
                        - img [ref=e810]:
                          - generic [ref=e816]: ZHIYUN & PEAK DESIGN // STABILIZATION
                        - generic [ref=e817]:
                          - generic [ref=e818]:
                            - text: Zhiyun
                            - heading "Zhiyun Weebill 3 Gimbal" [level=4] [ref=e819]
                            - paragraph [ref=e820]: 3-axis motorized camera stabilizer, built-in 1000-lumen fill light and noise-cancelling microphone, ergonomic Sling 2.0 wrist support for long shoot shifts.
                          - link "View on Amazon Storefront" [ref=e822] [cursor=pointer]:
                            - /url: https://www.amazon.com/shop/influencer-0931c541?ref=ac_inf_tb_vh
            - generic [ref=e825]:
              - generic [ref=e826]:
                - text: Specialty Coffee
                - heading "The Cafe Bar" [level=3] [ref=e827]
                - paragraph [ref=e828]: The commercial espresso and pour over bar that fuels the studio.
              - generic [ref=e829]:
                - generic [ref=e830]:
                  - generic [ref=e831]:
                    - paragraph [ref=e832]:
                      - generic [aria-hidden] [ref=e833]: "01"
                      - generic [ref=e834]: Equipment
                    - generic [ref=e835]:
                      - heading "Espresso & Brew Bar" [level=2] [ref=e836]
                      - link "Direct link to Espresso & Brew Bar section (click to copy)" [ref=e837] [cursor=pointer]:
                        - /url: "#espresso-heading"
                        - generic [aria-hidden] [ref=e838]: "#"
                        - generic [aria-hidden]: COPIED
                    - paragraph [ref=e839]: Prosumer hardware for milk drinks and filter coffee.
                  - generic [ref=e842]:
                    - generic [ref=e843]:
                      - generic [ref=e844]:
                        - generic [ref=e845]: Espresso MachineDual Thermoblock
                        - heading "Ascaso Steel Duo PID" [level=4] [ref=e846]
                        - paragraph [ref=e847]: Spain-built espresso machine with volumetric controls and precise thermal stability for commercial-grade extraction.
                      - link "Storefront Link" [ref=e848] [cursor=pointer]:
                        - /url: https://a.co/d/0i9uWbMj
                        - text: Storefront Link ↗
                    - generic [ref=e849]:
                      - generic [ref=e850]:
                        - generic [ref=e851]: Pour OverPID Control
                        - heading "Fellow Stagg EKG" [level=4] [ref=e852]
                        - paragraph [ref=e853]: Variable temperature gooseneck kettle, vital for repeatable pour over extraction temperatures.
                      - link "Storefront Link" [ref=e854] [cursor=pointer]:
                        - /url: https://a.co/d/0i9uWbMj
                        - text: Storefront Link ↗
                    - generic [ref=e855]:
                      - generic [ref=e856]:
                        - generic [ref=e857]: Filter BrewerImmersion + Drip
                        - heading "Hario Switch" [level=4] [ref=e858]
                        - paragraph [ref=e859]: Hybrid immersion and percolation brewer delivering the heavy body of a French press with the clean cup of a V60.
                      - link "Storefront Link" [ref=e860] [cursor=pointer]:
                        - /url: https://a.co/d/0i9uWbMj
                        - text: Storefront Link ↗
                    - generic [ref=e861]:
                      - generic [ref=e862]:
                        - generic [ref=e863]: Grinder64mm Flat Burrs
                        - heading "Fellow Ode Gen 2" [level=4] [ref=e864]
                        - paragraph [ref=e865]: Dedicated filter coffee grinder with anti-static technology and improved burr geometry for high-clarity pour overs.
                      - link "Storefront Link" [ref=e866] [cursor=pointer]:
                        - /url: https://a.co/d/0i9uWbMj
                        - text: Storefront Link ↗
                    - generic [ref=e867]:
                      - generic [ref=e868]:
                        - generic [ref=e869]: Precision Scale0.1g Resolution
                        - heading "Fellow Scale" [level=4] [ref=e870]
                        - paragraph [ref=e871]: Fast response ratio timer and gram-accurate scale keeping espresso brew recipes dialed in to within 0.1g tolerances.
                      - link "Storefront Link" [ref=e872] [cursor=pointer]:
                        - /url: https://a.co/d/0i9uWbMj
                        - text: Storefront Link ↗
                    - generic [ref=e873]:
                      - generic [ref=e874]:
                        - generic [ref=e875]: Specialty BeverageNitro Infusion
                        - heading "Nitro Press" [level=4] [ref=e876]
                        - paragraph [ref=e877]: Rapid nitrogen infusion dispenser for silky cold brew head, cocktail cascades, and craft beverage creations.
                      - link "Storefront Link" [ref=e878] [cursor=pointer]:
                        - /url: https://a.co/d/0i9uWbMj
                        - text: Storefront Link ↗
                    - generic [ref=e879]:
                      - generic [ref=e880]:
                        - generic [ref=e881]: Roaster of ChoiceSan Diego, CA
                        - heading "James Coffee Co." [level=4] [ref=e882]
                        - paragraph [ref=e883]: Single origins and house espresso blends crafted in Little Italy, San Diego. The daily driver fueling all content production.
                      - link "Visit Roaster" [ref=e885] [cursor=pointer]:
                        - /url: https://jamescoffeeco.com
                        - text: Visit Roaster ↗
                - complementary [ref=e886]:
                  - generic [ref=e887]:
                    - paragraph [ref=e888]:
                      - generic [aria-hidden] [ref=e889]: "02"
                      - generic [ref=e890]: Media
                    - generic [ref=e891]:
                      - heading "9:16 Reel Note" [level=2] [ref=e892]
                      - link "Direct link to 9:16 Reel Note section (click to copy)" [ref=e893] [cursor=pointer]:
                        - /url: "#reel-heading"
                        - generic [aria-hidden] [ref=e894]: "#"
                        - generic [aria-hidden]: COPIED
                    - paragraph [ref=e895]: Vertical beverage cinematography captured on Sony a7 IV with the Sony 90mm f/2.8 Macro lens.
                  - generic [ref=e898]:
                    - generic [ref=e899]:
                      - text: Project note
                      - paragraph [ref=e900]: Ascaso Espresso Extraction & Latte Art Workflow
                    - generic [ref=e901]:
                      - paragraph [ref=e902]: Native 9:16 vertical cinematography captured on Sony a7 IV with the Sony 90mm f/2.8 Macro lens.
                      - link "Shop Beverage Kit on Amazon" [ref=e903] [cursor=pointer]:
                        - /url: https://a.co/d/0i9uWbMj
                        - text: Shop Beverage Kit on Amazon ↗
          - button "Show all gear" [ref=e905]
    - region "Newsletter" [ref=e906]:
      - region [ref=e908]:
        - generic [ref=e909]:
          - heading "Notes from the build, by email" [level=3] [ref=e910]
          - paragraph [ref=e911]: What I'm making, what I'm learning, what broke, what's coming next. Short, occasional, no hype.
        - generic [ref=e912]:
          - text: Email address
          - generic [ref=e913]:
            - textbox "Email address" [ref=e914]:
              - /placeholder: you@example.com
            - button "Subscribe" [ref=e915]
          - paragraph [ref=e916]: Via Substack. Unsubscribe anytime.
  - contentinfo [ref=e917]:
    - generic [ref=e918]:
      - generic [ref=e919]:
        - link "HEY_THISISANDREW, home" [ref=e920] [cursor=pointer]:
          - /url: /hey-this-is-andrew/
          - img "HEY_THISISANDREW" [ref=e921]
        - paragraph [ref=e922]: Creator, photographer, coffee drinker.
      - navigation "Explore" [ref=e923]:
        - paragraph [ref=e924]: Explore
        - list [ref=e925]:
          - listitem [ref=e926]:
            - link "Home" [ref=e927] [cursor=pointer]:
              - /url: /hey-this-is-andrew/
          - listitem [ref=e928]:
            - link "Build in Public" [ref=e929] [cursor=pointer]:
              - /url: /hey-this-is-andrew/build/
          - listitem [ref=e930]:
            - link "Gear" [ref=e931] [cursor=pointer]:
              - /url: /hey-this-is-andrew/#gear
          - listitem [ref=e932]:
            - link "About" [ref=e933] [cursor=pointer]:
              - /url: /hey-this-is-andrew/about/
      - generic [ref=e934]:
        - paragraph [ref=e935]: Follow
        - list "Social links" [ref=e936]:
          - listitem [ref=e937]:
            - link "YouTube" [ref=e938] [cursor=pointer]:
              - /url: https://www.youtube.com/@HeyThisIsAndrew
          - listitem [ref=e942]:
            - link "Instagram" [ref=e943] [cursor=pointer]:
              - /url: https://www.instagram.com/hey_thisisandrew/
          - listitem [ref=e948]:
            - link "TikTok" [ref=e949] [cursor=pointer]:
              - /url: https://tiktok.com/@hey_thisisandrew
          - listitem [ref=e952]:
            - link "Threads" [ref=e953] [cursor=pointer]:
              - /url: https://www.threads.net/@hey_thisisandrew
          - listitem [ref=e956]:
            - link "Substack" [ref=e957] [cursor=pointer]:
              - /url: https://thisiscoffeetalk.substack.com/
          - listitem [ref=e960]:
            - link "LinkedIn" [ref=e961] [cursor=pointer]:
              - /url: https://www.linkedin.com/in/andrewlwyrbaxter/
    - generic [ref=e964]:
      - paragraph [ref=e965]: © 2026 Andrew Baxter. All rights reserved.
      - paragraph [ref=e966]:
        - link "Privacy" [ref=e967] [cursor=pointer]:
          - /url: /hey-this-is-andrew/privacy/
        - link "Sitemap" [ref=e968] [cursor=pointer]:
          - /url: /hey-this-is-andrew/sitemap/
      - paragraph [ref=e969]: Built in public with Astro.
      - paragraph [ref=e970]: All process, no perfectionism.
  - button "Back to top" [ref=e971]
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('Global QA', () => {
  4  |   const pages = ['/', '/build/', '/gear/', '/about/'];
  5  | 
  6  |   for (const p of pages) {
  7  |     test(`Page ${p} has no horizontal scroll`, async ({ page }) => {
  8  |       await page.goto(p);
  9  |       const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  10 |       const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
  11 |       if (scrollWidth > clientWidth) console.warn('Horizontal scroll detected on', p, scrollWidth, clientWidth);
  12 |     });
  13 |   }
  14 | 
  15 |   test('Mobile: interactive elements are at least 44x44', async ({ page, isMobile, viewport }) => {
  16 |     if (viewport?.width !== 390) test.skip();
  17 |     await page.goto('/');
  18 |     await page.waitForLoadState('networkidle');
  19 |     await page.waitForSelector('.expand-trigger', { state: 'visible' });
  20 |     const interactives = page.locator('a, button, input, [role="button"]');
  21 |     const count = await interactives.count();
  22 |     for (let i = 0; i < count; i++) {
  23 |       const box = await interactives.nth(i).boundingBox();
  24 |       if (!box) continue;
  25 |       if (box.width > 0 && box.height > 0) {
  26 |         if (!await interactives.nth(i).evaluate(el => el.classList.contains('skip-link'))) expect(box.width).toBeGreaterThanOrEqual(43.5);
  27 |         if ((box.height < 43.5 || box.width < 43.5) && !await interactives.nth(i).evaluate(el => el.classList.contains('skip-link') || el.closest('.skip-link'))) {
  28 |           const html = await interactives.nth(i).evaluate(el => el.outerHTML);
  29 |           console.log('Failing element:', html, box);
  30 |         }
  31 |         expect(box.width).toBeGreaterThanOrEqual(43.5);
> 32 |         if (!await interactives.nth(i).evaluate(el => el.classList.contains('skip-link'))) expect(box.height).toBeGreaterThanOrEqual(43.5);
     |                                                                                                               ^ Error: expect(received).toBeGreaterThanOrEqual(expected)
  33 |       }
  34 |     }
  35 |   });
  36 | 
  37 |   test('Expanders expand, focus, and deep-link', async ({ page }) => {
  38 |     await page.goto('/');
  39 |     const btn = page.locator('.expand-trigger').first();
  40 |     const targetId = await btn.getAttribute('aria-controls');
  41 |     if (!targetId) return;
  42 | 
  43 |     await btn.click();
  44 |     await expect(btn).toHaveAttribute('aria-expanded', 'true');
  45 |     await expect(page.locator(`#${targetId}`)).toBeVisible();
  46 |     await expect(page.url()).toContain(`#${targetId}`);
  47 | 
  48 |     await page.reload();
  49 |     await expect(page.locator('button[aria-controls="' + targetId + '"]')).toHaveAttribute('aria-expanded', 'true');
  50 |     await expect(page.locator(`#${targetId}`)).toBeVisible();
  51 |   });
  52 | 
  53 |   test('Dropdown fully visible without white bar overlap', async ({ page, isMobile }) => {
  54 |     if (isMobile) test.skip();
  55 |     await page.goto('/');
  56 |     await page.evaluate(() => {
  57 |       document.documentElement.style.height = '5000px';
  58 |       window.scrollTo(0, 3000);
  59 |       const progress = document.querySelector('#scroll-progress') as HTMLElement;
  60 |       if (progress) progress.style.transform = 'scaleX(1)';
  61 |     });
  62 |     const dropdownToggle = page.locator('.nav-link[aria-haspopup="true"]').first();
  63 |     await dropdownToggle.hover();
  64 |     const dropdown = page.locator('.dropdown-menu').first();
  65 |     await expect(dropdown).toBeVisible();
  66 | 
  67 |     // Check z-index manually
  68 |     const progressZ = await page.evaluate(() => {
  69 |       const p = document.querySelector('#scroll-progress');
  70 |       return p ? parseInt(window.getComputedStyle(p).zIndex) : 0;
  71 |     });
  72 |     const menuZ = await page.evaluate(() => {
  73 |       const m = document.querySelector('.dropdown-menu');
  74 |       return m ? parseInt(window.getComputedStyle(m).zIndex) : 0;
  75 |     });
  76 |     if (progressZ && menuZ) {
  77 |       expect(progressZ).toBeLessThan(menuZ);
  78 |     }
  79 |   });
  80 | 
  81 |   test('/press lands on /about/#press in view', async ({ page }) => {
  82 |     await page.goto('/press/');
  83 |     await page.waitForTimeout(2000);
  84 |     const url = page.url();
  85 |     expect(url).toContain('/about/#press');
  86 |     const press = page.locator('#press');
  87 |     await expect(press).toBeInViewport();
  88 |   });
  89 | 
  90 |   test('/work lands on /#work expanded', async ({ page }) => {
  91 |     await page.goto('/work/');
  92 |     await page.waitForURL('**/#work');
  93 |     const btn = page.locator('button[aria-controls="work-expanded"]');
  94 |     if (await btn.count() > 0) {
  95 |       await expect(btn).toHaveAttribute('aria-expanded', 'true');
  96 |     }
  97 |   });
  98 | });
  99 | 
```