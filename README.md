# Winspace T1600 Ultra · Obsidian Gold

A cinematic scrolltelling landing page for the Winspace T1600 Ultra road bike, built as a
**redesign exercise** by [Armando Sotoca](https://x.com/Skeku), designer and amateur cyclist.

**Live:** https://t1600-obsidian-gold.netlify.app

> Not affiliated with Winspace. Product names, specs and prices come from
> [winspace.cc](https://www.winspace.cc); brand assets belong to Winspace and are used here
> for a non-commercial portfolio exercise only.

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Bundler | [Vite 5](https://vitejs.dev) | Instant dev server, hashed production bundles, lazy chunks |
| Runtime | Vanilla JS (no framework) | The page is one document; a framework would only add weight |
| Animation | [GSAP 3 + ScrollTrigger](https://gsap.com) | Scroll choreography, pinning, scrubbed timelines |
| Smooth scroll | [Lenis](https://github.com/darkroomengineering/lenis) (driven by GSAP's ticker) | Inertia scroll that ScrollTrigger stays in sync with |
| WebGL | [Three.js](https://threejs.org) (lazy chunks) | Hero gold-dust particles, footer particle wordmark, wind shader |
| Type | [Raveo](https://github.com/jakubfoglar/raveo) (self-hosted woff2), [Archivo Variable](https://fonts.google.com/specimen/Archivo), [Caveat](https://fonts.google.com/specimen/Caveat) via [Fontsource](https://fontsource.org) | Display + UI + handwriting |
| Dev server | [Express](https://expressjs.com) | Vite middleware in dev, static `dist/` in prod |
| Media pipeline | [ffmpeg-static](https://github.com/eugeneware/ffmpeg-static) (`npm run prepare-videos`) | Re-encodes raw generated video for the web |
| Generated media | [Magnific](https://www.magnific.com) | Product-referenced imagery and video for the exercise |
| Hosting | [Netlify](https://www.netlify.com) (static `dist/`) | Headers configured in `netlify.toml` |

## Feature map

- **Hero (300vh):** looping orbit film; scroll pulls the camera back until the film docks
  into the empty center cell of a 3x3 video mosaic. Cells assemble organically (scattered
  directions, back-out overshoot) and drift with the pointer at per-cell depths.
- **Speed distortion:** fast scrolling shears the page (skewY) and adds directional motion
  blur; violent flicks wake a turbulence displacement warp. Both ride Lenis' live velocity
  through an SVG filter that is detached from the DOM while the page is at rest.
- **Race numbers:** bento grid with count-up stats, full build specs and a wind-tunnel
  streakline canvas behind it.
- **Race geometry:** bento with the official geometry chart, size selector wired to real
  per-size data, and an interactive radar chart comparing ride character against rival
  superbikes (togglable series, validated categorical palette, illustrative data).
- **Get closer:** accordion gallery with lightbox zoom at native resolution.
- **Built against the wind:** full-bleed dusk scene with scrubbed zoom parallax and a
  WebGL wind shader (two layers of fbm-advected filaments, screen-blended).
- **Riders are talking:** infinite draggable phone-mockup marquee with momentum and an
  elastic skew that follows the drag velocity.
- **Pitch your partner:** five handwritten notes dealt into a 3D card fan as the section
  enters the viewport; the front card tilts toward the pointer; click copies the message.
- **Footer:** fixed gold reveal; the wordmark is rebuilt from spring-physics particles
  that flee the cursor.
- **Design variants:** the rounded media language is the default; `?sharp` restores the
  original all-sharp design and `?rounded=shell` shows a sensiq-style page-shell variant
  (every section as a rounded plate). Flags persist in localStorage.

## Performance playbook

Things this project does that are worth stealing:

1. **Encode video for how it is actually consumed.** The hero film was originally encoded
   with every frame as a keyframe (`-g 1`) to make `currentTime` scrubbing instant. When
   the design moved from scrubbing to linear playback, re-encoding with a normal 2s GOP
   took the file from **14 MB to 4.1 MB** at the same visual quality.
2. **Ship `data-src`, not `src`.** The 22 secondary `<video>` elements hydrate through an
   activation queue: at most 2 concurrent activations, a lease freed on `loadeddata` or
   error, stalled elements never re-queued. Under `prefers-reduced-motion` nothing is ever
   activated, so the network cost disappears along with the motion.
3. **Detach expensive filters at rest.** The speed-warp SVG filter would cost paint time
   even at zero strength, so the `filter` property is removed whenever scroll velocity dies
   (with a watchdog for instant jumps that emit no trailing events).
4. **Lazy-load WebGL per section.** Three.js lives in its own chunk and each canvas module
   (`hero-particles`, `footer-particles`, `scene-wind`) is imported only when its section
   approaches. Every rAF loop pauses via IntersectionObserver when off-screen and caps
   `devicePixelRatio` at 1.5-2.
5. **Preload the display font.** `Raveo-Display-ExtraBold.woff2` is preloaded in the head:
   it paints the loader counter and every headline, so it is on the critical path.
6. **Animate transforms and opacity only.** All scroll choreography is transform-based;
   ambient background depth is done with pre-blurred radial gradients animated with
   `transform` (no `filter: blur` layers).
7. **Cache immutable assets hard.** Hashed `/assets/*` get `max-age=31536000, immutable`;
   media gets a week (see `netlify.toml`).
8. **quickTo gotcha:** killing a `gsap.quickTo` tween with `overwrite` breaks it silently;
   if another tween must own the property temporarily, recreate the quickTo afterwards.

## Accessibility

- Full `prefers-reduced-motion` branch: no pins, no scrub, no autoplaying video, static
  footer, curtain removed, chart rendered complete.
- Keyboard: focus-visible outlines throughout, dialog semantics for menu and lightbox with
  Escape and focus restoration, `aria-pressed` toggles on the radar legend.
- The radar palette passed a 6-check categorical validation (CVD separation, lightness
  band, chroma floor, contrast) against the obsidian surface.

## Security notes

- Static site, no backend, no third-party requests at runtime: everything is self-hosted.
- CSP locked to `'self'` (plus `data:` images for the SVG grain and inline styles for the
  critical CSS), `frame-ancestors 'none'`, nosniff and referrer policy in `netlify.toml`.
- External links use `rel="noopener noreferrer"`.

## Running locally

```bash
npm install
npm run dev        # Express + Vite middleware on :5174
npm run build      # production bundle in dist/
npm run start      # serve dist/
npm run prepare-videos  # re-encode raw video sources (needs assets-raw/, not in repo)
```

## Credits

- Design and build: **Armando Sotoca** ([@Skeku](https://x.com/Skeku))
- [Raveo](https://github.com/jakubfoglar/raveo) typeface by Jakub Foglar (free license)
- [Archivo](https://fonts.google.com/specimen/Archivo), [Caveat](https://fonts.google.com/specimen/Caveat)
  and [Space Grotesk](https://fonts.google.com/specimen/Space+Grotesk) served via
  [Fontsource](https://fontsource.org)
- Product photography and specs from [winspace.cc](https://www.winspace.cc) (property of Winspace)
- All other imagery and video (orbit film, mosaic clips, rider stories, dusk scene) was
  generated with [Magnific](https://www.magnific.com) for this exercise
- Animation by [GSAP](https://gsap.com), smooth scroll by
  [Lenis](https://github.com/darkroomengineering/lenis), WebGL by [Three.js](https://threejs.org),
  bundled with [Vite](https://vitejs.dev), hosted on [Netlify](https://www.netlify.com)

No license is granted for the media assets; the code is available to read and learn from.
