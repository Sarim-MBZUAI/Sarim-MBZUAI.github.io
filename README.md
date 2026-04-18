# Sarim Hashmi — Personal Website

Personal academic site for Sarim Hashmi (Research Engineer, MBZUAI).
Static Astro build deployed to GitHub Pages.

Live URL (planned): https://sarim-mbzuai.github.io

---

## Stack

- **Framework**: Astro 4 (static output)
- **Styling**: Vanilla CSS with CSS variables (`public/styles/global.css`)
- **Fonts**: Instrument Serif (display), Newsreader (serif), Manrope (sans) — Google Fonts
- **Theme**: Light/dark toggle, persisted in `localStorage`
- **Deploy**: GitHub Actions → GitHub Pages (`.github/workflows/deploy.yml`)

## Structure

```
src/
├── pages/
│   ├── index.astro         # Home: about + featured publications
│   ├── publications.astro  # All publications
│   ├── experience.astro    # Work + independent projects
│   └── awards.astro        # Awards & achievements
├── components/
│   ├── Header.astro        # Nav + logo + theme toggle
│   ├── Footer.astro
│   ├── ThemeToggle.astro
│   ├── PublicationItem.astro
│   ├── ExperienceItem.astro
│   └── AwardItem.astro
├── layouts/
│   └── Layout.astro        # Base HTML + meta + theme bootstrap
└── data/
    ├── publications.json   # 7 entries, featured flag drives home-page list
    ├── experience.json     # 7 entries, work + independent projects
    └── awards.json         # 7 entries
public/
├── images/profile.jpg      # Placeholder portrait (replace with real photo)
├── cv/sarim_hashmi_cv.pdf  # Current CV
└── styles/global.css       # Global stylesheet
```

## Local development

```bash
npm install
npm run dev     # http://localhost:4321
npm run build   # static output in dist/
```

## Editing content

- **Publications** → edit `src/data/publications.json`. Set `featured: true` to show on the home page. `links` supports `paper`, `code`, `blog`, `website`.
- **Experience / projects** → edit `src/data/experience.json`. `link` can be `null` or a URL string.
- **Awards** → edit `src/data/awards.json`. Each entry: `title`, `description`, `date`.
- **Bio** → edit `src/pages/index.astro` (the `<section class="about-section">` block).

## Deployment

Push to `main` on a repo named `sarim-mbzuai.github.io` (or any GitHub Pages-enabled repo). The workflow in `.github/workflows/deploy.yml` will:
1. Install deps (`npm ci`)
2. Build (`npm run build`)
3. Publish `dist/` to GitHub Pages

If the repo name differs from `sarim-mbzuai.github.io`, update `site:` in `astro.config.mjs` to match.

---

## TODOs before launch

- [x] ~~Replace placeholder `public/images/profile.jpg` with a real portrait~~ (800×800 crop installed 2026-04-18)
- [x] ~~Confirm Google Scholar URL~~ (set to real profile)
- [x] ~~Confirm LinkedIn URL~~ (set to `/in/sarim-hashmi-b10b35136/`)
- [ ] Add `paper` / `code` / `website` URLs to each entry in `publications.json` (currently empty)
- [ ] Optionally add publication thumbnails under `public/images/publications/` and reference via `thumbnail: "/images/publications/foo.jpg"` in `publications.json`
- [ ] Confirm GitHub Pages repo name and update `astro.config.mjs` accordingly

---

## Changelog

**2026-04-18 (update 2)** — PhD-application rewrite
- Rewrote home-page bio to foreground research focus: **secure, private, strategic** machine learning, with emphasis on the security of LLM agents using retrieval, memory, and tools
- Surfaces PhD application intent and the "complete agent pipelines" framing
- Added `AdvSim2Real` entry to `experience.json` (adversarial simulation for agent systems)
- Locked in real Google Scholar and LinkedIn URLs
- Updated Layout default meta description to match new positioning

**2026-04-18** — Initial scaffold
- Forked structure from [hrdkbhatnagar.github.io](https://github.com/hrdkbhatnagar/hrdkbhatnagar.github.io) (Hardik Bhatnagar's Astro site)
- Kept palette, typography, dark-mode toggle, and responsive layout identical
- Swapped all content for Sarim's CV (`MY_CV.pdf`)
- Added two new pages not present in source: `/experience` (renamed from Hardik's Projects) and `/awards` (new)
- Navigation now surfaces all four pages; Hardik's site only showed Home + Publications
- Created new `AwardItem.astro` component; renamed `ProjectItem.astro` → `ExperienceItem.astro`
- Replaced author-highlight regex in `PublicationItem.astro` to match "Sarim" / "Hashmi"
- Populated `publications.json` (7), `experience.json` (7), `awards.json` (7) from CV
- Copied `MY_CV.pdf` → `public/cv/sarim_hashmi_cv.pdf`
- Generated placeholder `public/images/profile.jpg` with initials (SH) — later replaced with real portrait (center-cropped square, 800×800, ~48 KB)
