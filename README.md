# Ailene Tungala Tugna — Portfolio

Editorial one-page portfolio for marketing, partnerships and operations work
across Abu Dhabi, Dubai and Manila.

```
.
├── index.html                 # markup
├── styles.css                 # design system + all components
├── script.js                  # interaction, animation, contact form
├── supabase-config.js         # project URL, key, email destination
├── img/                       # web-optimised photography
│   ├── hero.jpg               # hero
│   ├── about.jpg              # about portrait
│   ├── wide.jpg               # full-bleed band
│   └── portrait.jpg           # services + contact
├── supabase/
│   ├── schema.sql             # tables + row level security
│   ├── config.toml
│   └── functions/notify-contact/index.ts   # emails each submission
└── SETUP.md                   # ← contact form / email setup
```

## Running it

It is a static site with no build step. Open `index.html`, or serve the folder:

```bash
python -m http.server 8000
```

`file://` works too, but a local server is closer to production.

## Contact form &amp; visit log

Submissions are written to Supabase and emailed to **brentreed623@gmail.com**.
A second table, `page_visits`, logs a lightweight, cookie-free record of who
checks the site — timestamp, referrer, browser, screen size, no IP address.
Neither table is created yet — **see [SETUP.md](SETUP.md)** for the steps that
finish the pipeline. Until then the form gracefully falls back to a pre-filled
email link, and visit logging just no-ops.

## Images

`img/` holds the versions the site loads: resized and JPEG-encoded from the
source PNGs, 7.2 MB → 574 KB with no visible quality loss. The originals are
kept alongside them.

Each photo also has a 20-pixel blurred placeholder inlined in `index.html`, so
the layout is never empty while a photo downloads — the blur cross-fades into
the real image.

To swap a photo, replace the file in `img/` keeping the same name and roughly
the same aspect ratio. If the crop sits wrong, adjust the `object-position` for
that image in `styles.css`.

## Design

| Token | Value | Used for |
|---|---|---|
| `--ivory` | `#F7F2EA` | page background |
| `--bone` | `#EFE7DA` | alternating sections |
| `--char` / `--char-deep` | `#0A1D4B` / `#071539` | header, dark sections, footer |
| `--crimson` | `#8E1C24` | accent, drawn from the photography |
| `--gold` | `#B99B6B` | rules, secondary accent |

Type is Bodoni Moda (display), Inter (text) and Pinyon Script (the hero line).

## Interaction

Scroll progress bar · solid navy header with hover dropdowns for About and
Services · scrollspy nav · full-screen mobile drawer · parallax on the
bleed band · staggered scroll reveals · accordions for the career timeline
and project ledger · SVG icons that draw themselves · counters that count up
· infinite client marquee · carousel with dots, arrows, keyboard and swipe ·
floating-label form with live validation · back-to-top.

Everything above is disabled under `prefers-reduced-motion: reduce`.

## Browser support

Modern evergreen browsers. Verified in Chromium at 1440px and 390px: no console
errors, no horizontal overflow, all assets resolving.
