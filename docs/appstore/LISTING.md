# Apple App Store listing — copy-paste kit

Assets in this folder:

| File | Where it goes in App Store Connect |
| --- | --- |
| `appicon-1024.png` | App icon (1024×1024, opaque — Apple forbids transparency) |
| `screenshot-ipad13-1..3.png` | iPad 13" screenshots (2048×2732) |
| `screenshot-iphone67-1..3.png` | iPhone 6.7" screenshots (1290×2796) |

The .swiftpm shell in `tablet/apple/` also needs the icon: drop
`appicon-1024.png` into the app's asset catalog / AppIcon slot before
archiving (the GitHub Actions `ios.yml` build picks it up from the project).

## Name (30 chars max)

    LetterMyComic

## Subtitle (30 chars max)

    Comic Lettering Studio

## Promotional text (170 chars max)

    Word balloons that behave like ink, 600+ comic fonts, SFX warps, Tuck
    Back, and print-ready export — pen-first comic lettering on iPad.

## Description

Use the full description from `../playstore/LISTING.md` — it fits Apple's
4000-char limit as-is.

## Keywords (100 chars max)

    comic,lettering,manga,speech balloon,webcomic,sfx,font,letterer,graphic novel,print,cbz

## Other fields

- **Category:** Graphics & Design (secondary: Productivity)
- **Price:** Free
- **Privacy policy URL:** https://lettermycomic.com/privacy
- **Support URL:** https://lettermycomic.com/faq
- **App privacy (nutrition label):** Contact Info → Email (account only,
  linked to identity, not used for tracking). Artwork stays on-device.
- **Age rating:** answer the questionnaire honestly; if screenshots show
  mature comic art expect 12+/17 — swap tamer art if that matters.
- **Review notes:** mention the demo account so the reviewer can open the
  studio without paying, and that the app is a native shell around the
  LetterMyComic studio with pen-first input (palm rejection, pinch zoom),
  offline autosave, and OS file handling for .lmc projects. Apple guideline
  4.2 (minimum functionality) pushes back on bare wrappers — the .lmc file
  handling, pen input and installed-app behaviours are the points to make.
