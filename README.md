# Nicholas John · Portfolio site

A one-page portfolio with a scroll-driven 3D world (Three.js), animated reveals (GSAP), project cards and a Breakdowns list.
It's plain HTML, CSS and JavaScript, with no build step, so it can be hosted as-is on GitHub Pages, Netlify or Vercel.

## Files

| File | What it holds |
|---|---|
| `index.html` | All the page text: hero, about, experience, featured project, contact |
| `main.js` | The **project list** and **breakdown list** (top of the file), the 3D world, and the glitch transition |
| `gallery.js` | The curved 3D gallery of all work (opened from *Work*, *Enter the gallery*, *View all in 3D*) |
| `img/` | Project and breakdown images (stored locally so the 3D gallery can use them) |
| `style.css` | Colours, fonts and layout. Colours are the variables at the top (`--accent`, `--glow`, …) |
| `favicon.svg` | Browser tab icon |
| `404.html` | Page shown for a broken link |
| `serve.ps1` | Local preview server |

## Preview locally

```
powershell -ExecutionPolicy Bypass -File portfolio-site/serve.ps1
```
Then open http://localhost:8766

## Common edits

**Add or change a project.** In `main.js`, edit the `PROJECTS` list. Each project needs `title`, `role`, `text`, `img` (image URL) and `url` (link). `badge: 'Team'` is optional.

**Add or change a breakdown.** In `main.js`, edit the `BREAKDOWNS` list. Each one needs `title`, `sub`, `text`, `tags`, `date`, `img` and `url`.

**Change the featured project.** In `index.html`, edit the section marked `<!-- FEATURED -->`.

**Change bio, skills or experience.** In `index.html`, edit the `<!-- ABOUT -->` and `<!-- EXPERIENCE -->` sections.

**Change colours.** In `style.css`, edit `--accent` (torch orange) and `--glow` (Core purple) at the top.

**Images:** put new images in the `img/` folder and use paths like `img/my-project.jpg`. They must be local (not ArtStation links): ArtStation blocks its images from being used in 3D, so the gallery can't show linked ones. The gallery automatically includes CoreUndead, every entry in `PROJECTS` and every entry in `BREAKDOWNS`.

## Motion settings

Visitors who have "reduce motion" turned on (in Windows: *Settings > Accessibility > Visual effects > Animation effects* off) get a calmer version: no scroll easing or reveal animations, and a simple crossfade into the gallery instead of the glitch.
To preview the full version on such a computer, add `?motion=full` to the address, e.g. http://localhost:8766/?motion=full

## The 3D world

The floating islands are generated in code (`main.js`, section "World pieces"). They're a stand-in for a real level scene, to be revisited later. Things to tweak:
- `ISLANDS`: positions, sizes and decorations of each island
- `camPath` and `lookPath`: where the camera travels and looks as you scroll (one point per section)
- `core.position`: where the glowing Core floats

## Before going live

- [x] Contact method: email. To change the address, edit `CONTACT_EMAIL` near the top of `main.js`.
- [ ] Pick a host and connect the domain
