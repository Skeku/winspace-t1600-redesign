import './style.css'
import '@fontsource-variable/archivo/wdth.css'
import '@fontsource/space-grotesk'
import '@fontsource/space-grotesk/500.css'
import '@fontsource/caveat/500.css'
import '@fontsource/caveat/700.css'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'

gsap.registerPlugin(ScrollTrigger)
// Exposed for prototype debugging in the console.
window.gsap = gsap
window.ScrollTrigger = ScrollTrigger

/* ---------- split display words into chars ----------
   Outer span: scroll-driven fade. Inner span: load intro.
   Separate layers so the two tweens never fight over start values. */
function splitChars(el) {
  const text = el.textContent
  el.textContent = ''
  const chars = []
  for (const ch of text) {
    const outer = document.createElement('span')
    outer.className = 'char'
    const inner = document.createElement('span')
    inner.className = 'char-in'
    inner.textContent = ch
    outer.append(inner)
    el.append(outer)
    chars.push(outer)
  }
  return chars
}

/* ---------- detail lightbox with zoom ---------- */
const lightbox = document.querySelector('.lightbox')
const lightboxImg = document.querySelector('.lightbox-img')
const lightboxStage = document.querySelector('.lightbox-stage')
const lightboxClose = document.querySelector('.lightbox-cerrar')
let lightboxLastFocus = null

function openLightbox(src, alt, trigger) {
  lightboxImg.src = src
  lightboxImg.alt = alt
  lightboxLastFocus = trigger
  lightbox.hidden = false
  document.documentElement.style.overflow = 'hidden'
  lightboxClose.focus()
}

function closeLightbox() {
  lightbox.hidden = true
  lightbox.classList.remove('is-zoomed')
  lightboxImg.style.transform = ''
  document.documentElement.style.overflow = ''
  if (lightboxLastFocus) lightboxLastFocus.focus()
}

lightboxStage.addEventListener('click', (e) => {
  if (e.target !== lightboxImg) { closeLightbox(); return }
  const zoomed = lightbox.classList.toggle('is-zoomed')
  if (zoomed) {
    const r = lightboxImg.getBoundingClientRect()
    const ox = ((e.clientX - r.left) / r.width) * 100
    const oy = ((e.clientY - r.top) / r.height) * 100
    lightboxImg.style.transformOrigin = `${ox}% ${oy}%`
    lightboxImg.style.transform = 'scale(2.4)'
  } else {
    lightboxImg.style.transform = ''
  }
})
lightboxClose.addEventListener('click', closeLightbox)
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !lightbox.hidden) closeLightbox() })

/* ---------- accordion slider ----------
   Hover/focus expands a strip; clicking the expanded strip opens the zoom. */
const caption = document.querySelector('.accordion-caption')
document.querySelectorAll('.strip').forEach((strip) => {
  const activate = () => {
    document.querySelectorAll('.strip').forEach((t) => t.classList.remove('is-active'))
    strip.classList.add('is-active')
    caption.textContent = strip.dataset.caption
  }
  strip.addEventListener('pointerenter', activate)
  strip.addEventListener('focus', activate)
  strip.addEventListener('click', () => {
    if (strip.classList.contains('is-active')) {
      const img = strip.querySelector('img')
      openLightbox(img.src, img.alt, strip)
    } else {
      activate()
    }
  })
})

/* ---------- loader + page-transition curtain (guglieri-style wipe) ---------- */
const curtain = document.querySelector('.curtain')
const curtainNum = document.querySelector('.curtain-num')
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

/* Design variant flag, persisted. The rounded media variant is the DEFAULT
   (chosen by Armando 2026-07-31); ?sharp restores the original all-sharp
   design and ?rounded=shell shows the full sensiq page-shell, for comparison. */
const flagParams = new URLSearchParams(location.search)
if (flagParams.has('rounded')) {
  localStorage.setItem('t1600-variant', flagParams.get('rounded') === 'shell' ? 'shell' : 'rounded')
}
if (flagParams.has('sharp')) localStorage.setItem('t1600-variant', 'sharp')
const variant = localStorage.getItem('t1600-variant') || 'rounded'
if (variant !== 'sharp') document.body.classList.add('rounded')
if (variant === 'shell') document.body.classList.add('rounded-shell')

/* ---------- lazy video activation queue ----------
   Secondary videos ship with data-src only. Activating one (assigning src)
   takes a lease; at most 2 leases run at once. A lease frees on loadeddata or
   error; a timeout frees it too but marks the element stalled so it is never
   re-queued. The cap limits concurrent activations, not underlying HTTP
   transfers. Under reduced motion nothing is activated: posters carry it. */
const videoQueue = (() => {
  const pending = []
  const seen = new Set()
  const MAX = 2
  let active = 0
  const dispatch = () => {
    while (active < MAX && pending.length) {
      const { el, onReady } = pending.shift()
      active++
      let done = false
      const release = () => {
        if (done) return
        done = true
        clearTimeout(stallTimer)
        active--
        dispatch()
      }
      const stallTimer = setTimeout(release, 8000)
      el.addEventListener('loadeddata', () => { release(); onReady?.(el) }, { once: true })
      el.addEventListener('error', release, { once: true })
      el.src = el.dataset.src
    }
  }
  return {
    enqueue(videos, onReady) {
      if (reduceMotion) return
      videos.forEach((el) => {
        if (!el.dataset.src || seen.has(el)) return
        seen.add(el)
        pending.push({ el, onReady })
      })
      dispatch()
    },
  }
})()
// Exposed for prototype debugging, like gsap/ScrollTrigger above.
window.videoQueue = videoQueue
let loaderDone = false
const loaderCallbacks = []
function onLoaderDone(cb) {
  if (loaderDone) cb()
  else loaderCallbacks.push(cb)
}

function bootLoader() {
  const video = document.querySelector('.hero-video')
  if (reduceMotion) {
    curtain.remove()
    loaderDone = true
    loaderCallbacks.forEach((cb) => cb())
    return
  }

  const measure = () => {
    if (video.readyState >= 3) return 1
    try {
      if (video.buffered.length && video.duration) return video.buffered.end(0) / video.duration
    } catch { /* buffered can throw before metadata */ }
    return 0
  }

  let target = 0
  let shown = 0
  let finished = false
  // floor ramp so the counter always moves, even on instant cache hits
  gsap.to({}, {
    duration: 2.6,
    ease: 'power1.out',
    onUpdate() { target = Math.max(target, this.progress() * 90) },
  })
  const poll = setInterval(() => { target = Math.max(target, measure() * 100) }, 150)
  video.addEventListener('canplaythrough', () => { target = 100 }, { once: true })
  setTimeout(() => { target = 100 }, 4500) // hard cap: never hold the door

  const finish = () => {
    if (finished) return
    finished = true
    clearInterval(poll)
    curtainNum.textContent = '100'
    setFill(1)
    curtain.classList.add('is-full')
    gsap.timeline({
      onComplete: () => { curtain.style.display = 'none' },
    })
      .to('.curtain-inner', { autoAlpha: 0, y: -20, duration: 0.35, ease: 'power2.in' }, 0.15)
      .to(curtain, { yPercent: -100, duration: 0.85, ease: 'power4.inOut' }, 0.35)
    // release the hero intro just as the curtain clears the type
    gsap.delayedCall(0.6, () => {
      loaderDone = true
      loaderCallbacks.forEach((cb) => cb())
    })
  }

  // the gold literally fills the screen, bottom-up, as the page loads
  const setFill = gsap.quickSetter('.curtain-fill', 'scaleY')
  const tick = () => {
    if (finished) return
    requestAnimationFrame(tick)
    shown += (target - shown) * 0.1
    curtainNum.textContent = String(Math.round(shown))
    setFill(shown / 100)
    curtain.classList.toggle('is-full', shown > 55)
    if (shown > 99.2) finish()
  }
  requestAnimationFrame(tick)
}
bootLoader()

// outbound links leave through the same curtain
document.querySelectorAll('a[data-wipe]').forEach((a) => {
  a.addEventListener('click', (e) => {
    if (reduceMotion) return // plain navigation
    e.preventDefault()
    const url = a.href
    curtain.style.display = 'grid'
    curtain.classList.add('is-full')
    gsap.set('.curtain-fill', { scaleY: 1 })
    gsap.set('.curtain-inner', { autoAlpha: 0 })
    gsap.fromTo(curtain, { yPercent: 100 }, {
      yPercent: 0,
      duration: 0.6,
      ease: 'power4.inOut',
      onComplete: () => { window.location.assign(url) },
    })
  })
})

/* ---------- partner pitch: fanned deck of notes, hover-to-copy ----------
   The five notes fan out like a hand of cards pivoting from below the desk
   (transform-origin sits under the card). The front card stands straight;
   the rest spread to both sides, receding in scale and dropping slightly. */
const noteStack = [...document.querySelectorAll('.note')] // last = front
const FAN_SLOTS = [-2, 2, -1, 1] // side slots for the four cards behind

function notePoses() {
  const n = noteStack.length
  let slot = 0
  return noteStack.map((el, i) => {
    const front = i === n - 1
    const pos = front ? 0 : FAN_SLOTS[slot++ % FAN_SLOTS.length]
    return {
      el,
      x: pos * 78,
      y: Math.abs(pos) * 30,
      rot: pos * 8.5,
      scale: front ? 1 : 1 - Math.abs(pos) * 0.05,
      z: front ? 30 : 20 - Math.abs(pos),
    }
  })
}

function layoutNotes(animate) {
  notePoses().forEach((p) => {
    gsap.to(p.el, {
      x: p.x,
      y: p.y,
      rotation: p.rot,
      scale: p.scale,
      zIndex: p.z,
      duration: animate && !reduceMotion ? 0.65 : 0,
      ease: 'back.out(1.4)',
      overwrite: 'auto',
    })
  })
}
layoutNotes(false)

/* handwritten index: highlights the front note, click brings an angle forward */
const indexItems = [...document.querySelectorAll('.index-item')]
let noteCycling = false
function syncIndex() {
  const frontTag = noteStack[noteStack.length - 1].querySelector('.note-tag').textContent
  indexItems.forEach((b) => b.classList.toggle('is-active', b.dataset.angle === frontTag))
}
syncIndex()

function bringToFront(el) {
  if (el === noteStack[noteStack.length - 1] || noteCycling) return
  noteCycling = true
  const idx = noteStack.indexOf(el)
  noteStack.splice(idx, 1)
  noteStack.push(el)
  if (reduceMotion) {
    layoutNotes(false)
    syncIndex()
    noteCycling = false
    return
  }
  gsap.timeline({ onComplete: () => { noteCycling = false } })
    .to(el, { y: -110, rotation: 0, rotationX: 0, rotationY: 0, scale: 1.03, duration: 0.32, ease: 'power2.out' })
    .add(() => { layoutNotes(true); syncIndex() })
}

indexItems.forEach((b) => {
  b.addEventListener('click', () => {
    const target = noteStack.find((n) => n.querySelector('.note-tag').textContent === b.dataset.angle)
    if (target) bringToFront(target)
  })
})

/* hover tooltip on the front note; clicking the note copies its message */
const copyTip = document.querySelector('.copy-tip')
const stackEl = document.querySelector('.pitch-stack')
const tipX = gsap.quickTo(copyTip, 'x', { duration: 0.25, ease: 'power2' })
const tipY = gsap.quickTo(copyTip, 'y', { duration: 0.25, ease: 'power2' })
let tipTimer = null

/* the front card leans toward the pointer (3D tilt over the fan) */
const tiltOk = !reduceMotion && window.matchMedia('(pointer: fine)').matches
let tiltTarget = null
let tiltRy = null
let tiltRx = null

stackEl.addEventListener('pointermove', (e) => {
  const front = noteStack[noteStack.length - 1]
  const overFront = e.target === front || front.contains(e.target)
  const r = stackEl.getBoundingClientRect()
  tipX(e.clientX - r.left + 18)
  tipY(e.clientY - r.top + 20)
  gsap.to(copyTip, { autoAlpha: overFront ? 1 : 0, duration: 0.2, overwrite: 'auto' })
  if (tiltOk && !noteCycling) {
    if (tiltTarget !== front) {
      if (tiltTarget) gsap.to(tiltTarget, { rotationX: 0, rotationY: 0, duration: 0.4 })
      tiltTarget = front
      tiltRy = gsap.quickTo(front, 'rotationY', { duration: 0.55, ease: 'power2' })
      tiltRx = gsap.quickTo(front, 'rotationX', { duration: 0.55, ease: 'power2' })
    }
    tiltRy(((e.clientX - r.left) / r.width - 0.5) * 10)
    tiltRx(-((e.clientY - r.top) / r.height - 0.5) * 8)
  }
})
stackEl.addEventListener('pointerleave', () => {
  gsap.to(copyTip, { autoAlpha: 0, duration: 0.2, overwrite: 'auto' })
  if (tiltTarget) {
    gsap.to(tiltTarget, { rotationX: 0, rotationY: 0, duration: 0.6, ease: 'power3.out' })
    tiltTarget = null
  }
})

noteStack.forEach((el) => el.addEventListener('click', async () => {
  if (el !== noteStack[noteStack.length - 1]) { bringToFront(el); return }
  const text = [...el.querySelectorAll('p:not(.note-tag)')].map((p) => p.textContent).join('\n\n')
  try {
    await navigator.clipboard.writeText(text)
    copyTip.textContent = 'Copied. Good luck.'
    copyTip.classList.add('is-copied')
    clearTimeout(tipTimer)
    tipTimer = setTimeout(() => {
      copyTip.textContent = 'Copy message'
      copyTip.classList.remove('is-copied')
    }, 2000)
  } catch {
    copyTip.textContent = 'Select and copy'
  }
}))

/* ---------- geometry · ride-character radar (comparison) ----------
   Categorical palette validated with the dataviz six-checks script against the
   obsidian surface, in this fixed order (violet separates green and rose for
   deutan vision); dash patterns are the secondary encoding. All figures are
   illustrative examples; the visible note says so. Legend buttons toggle each
   rival on/off over the chart. */
const RIDE_AXES = ['Aero', 'Sprint', 'Climbing', 'Handling', 'Endurance', 'Comfort']
// Every series wears the same mark format (solid stroke + translucent fill +
// vertex dots); only the hue changes. The validated palette passes adjacent
// CVD separation on its own, so no secondary dash encoding is required.
const RIDE_SERIES = [
  { name: 'T1600 Ultra', stroke: '#b08a35', fill: 'rgba(176, 138, 53, 0.2)', on: true, v: [9, 9, 8.5, 8.5, 8, 7] },
  { name: 'Tarmac SL8', stroke: '#5585c9', fill: 'rgba(85, 133, 201, 0.14)', on: true, v: [8.5, 8.5, 9, 9, 7.5, 7.5] },
  { name: 'Aeroad CFR', stroke: '#3fa374', fill: 'rgba(63, 163, 116, 0.14)', on: true, v: [9, 9, 7.5, 8, 8, 6.5] },
  { name: 'Madone SLR', stroke: '#8a7bd8', fill: 'rgba(138, 123, 216, 0.14)', on: false, v: [9, 8.5, 8, 8.5, 8.5, 7.5] },
  { name: 'S5', stroke: '#bd5f77', fill: 'rgba(189, 95, 119, 0.14)', on: false, v: [9.5, 9, 7, 8, 7.5, 6.5] },
]

function buildRadar(svg) {
  const NS = 'http://www.w3.org/2000/svg'
  const cx = 210
  const cy = 180
  const R = 118
  const MAX = 10
  const pt = (i, r) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / RIDE_AXES.length
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]
  }
  const el = (tag, attrs) => {
    const n = document.createElementNS(NS, tag)
    for (const k in attrs) n.setAttribute(k, attrs[k])
    svg.append(n)
    return n
  }
  for (let ring = 1; ring <= 4; ring++) {
    el('polygon', {
      points: RIDE_AXES.map((_, i) => pt(i, (R * ring) / 4).join(',')).join(' '),
      fill: 'none',
      stroke: 'rgba(242, 239, 232, 0.1)',
      'stroke-width': 1,
    })
  }
  RIDE_AXES.forEach((_, i) => {
    const [x, y] = pt(i, R)
    el('line', { x1: cx, y1: cy, x2: x, y2: y, stroke: 'rgba(242, 239, 232, 0.1)', 'stroke-width': 1 })
  })
  RIDE_SERIES.forEach((s, idx) => {
    const seriesPts = s.v.map((v, i) => pt(i, (R * v) / MAX))
    const poly = el('polygon', {
      points: seriesPts.map((p) => p.join(',')).join(' '),
      fill: s.fill,
      stroke: s.stroke,
      'stroke-width': 2,
      'stroke-linejoin': 'round',
      class: 'radar-series',
      'data-idx': idx,
    })
    if (!s.on) poly.style.opacity = '0'
    // vertex dots with a surface ring so they read over the web
    seriesPts.forEach(([x, y]) => {
      const ring = el('circle', { cx: x, cy: y, r: 5.5, fill: '#0b0a08', class: 'radar-dot', 'data-idx': idx })
      const dot = el('circle', { cx: x, cy: y, r: 3.5, fill: s.stroke, class: 'radar-dot', 'data-idx': idx })
      if (!s.on) { ring.style.opacity = '0'; dot.style.opacity = '0' }
    })
  })
  RIDE_AXES.forEach((label, i) => {
    const [x, y] = pt(i, R + 26)
    const anchor = Math.abs(x - cx) < 8 ? 'middle' : x > cx ? 'start' : 'end'
    const name = el('text', { x, y: y + 4, 'text-anchor': anchor, class: 'radar-label' })
    name.textContent = label
  })
}

const radarSvg = document.querySelector('.radar-svg')
if (radarSvg) {
  buildRadar(radarSvg)
  const seriesOn = RIDE_SERIES.map((s) => s.on)
  const nodesOf = (i) => radarSvg.querySelectorAll(`[data-idx="${i}"]`)
  const fxDur = reduceMotion ? 0 : 0.35

  // one place decides every series' opacity: hidden 0, visible 1, and while a
  // legend item is hovered/focused the other visible series dim to 0.15
  const applyOpacities = (focusIdx = null) => {
    RIDE_SERIES.forEach((_, i) => {
      let target = seriesOn[i] ? 1 : 0
      if (focusIdx !== null && i !== focusIdx && seriesOn[i]) target = 0.15
      nodesOf(i).forEach((n) => gsap.to(n, { opacity: target, duration: fxDur, overwrite: 'auto' }))
    })
  }

  // readout: the focused bike's six figures, mirrored beside the legend
  const readoutName = document.querySelector('.readout-name')
  const readoutGrid = document.querySelector('.readout-grid')
  const setReadout = (idx) => {
    const s = RIDE_SERIES[idx]
    readoutName.textContent = s.name
    readoutName.style.setProperty('--swatch', s.stroke)
    readoutGrid.replaceChildren(...RIDE_AXES.map((axis, i) => {
      const row = document.createElement('div')
      const dt = document.createElement('dt')
      dt.textContent = axis
      const dd = document.createElement('dd')
      dd.textContent = s.v[i]
      row.append(dt, dd)
      return row
    }))
  }
  setReadout(0)

  document.querySelectorAll('.radar-legend button').forEach((b) => {
    const idx = Number(b.dataset.series)
    b.setAttribute('aria-pressed', String(seriesOn[idx]))
    b.classList.toggle('is-off', !seriesOn[idx])
    b.addEventListener('click', () => {
      seriesOn[idx] = !seriesOn[idx]
      b.setAttribute('aria-pressed', String(seriesOn[idx]))
      b.classList.toggle('is-off', !seriesOn[idx])
      if (seriesOn[idx] && !reduceMotion) {
        // subtle pop: the overlay grows in from the web's center
        nodesOf(idx).forEach((n) =>
          gsap.fromTo(n, { scale: 0.72, svgOrigin: '210 180' }, { scale: 1, duration: 0.6, ease: 'power3.out', overwrite: 'auto' })
        )
      }
      setReadout(seriesOn[idx] ? idx : 0)
      applyOpacities(seriesOn[idx] ? idx : null)
    })
    const focusOn = () => { if (seriesOn[idx]) { setReadout(idx); applyOpacities(idx) } }
    const focusOff = () => { setReadout(0); applyOpacities(null) }
    b.addEventListener('pointerenter', focusOn)
    b.addEventListener('focus', focusOn)
    b.addEventListener('pointerleave', focusOff)
    b.addEventListener('blur', focusOff)
  })
}

/* ---------- geometry: real chart data from winspace.cc, per size ---------- */
const GEO = {
  XS: { stack: 500, reach: 371, tt: 507, ha: '70.7°', sa: '74.8°', wb: 967, height: '155-163 cm' },
  S: { stack: 512, reach: 378, tt: 522, ha: '71.5°', sa: '74.3°', wb: 971, height: '163-171 cm' },
  M: { stack: 525, reach: 388, tt: 538, ha: '72°', sa: '74°', wb: 975, height: '171-179 cm' },
  L: { stack: 546, reach: 398, tt: 556, ha: '72.5°', sa: '73.8°', wb: 987, height: '179-186 cm' },
  XL: { stack: 566, reach: 413, tt: 582, ha: '72.9°', sa: '73.4°', wb: 1004, height: '186-193 cm' },
}

document.querySelectorAll('.size-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.size-btn').forEach((b) => b.classList.remove('is-active'))
    btn.classList.add('is-active')
    const d = GEO[btn.dataset.size]
    const fields = { stack: d.stack, reach: d.reach, tt: d.tt, ha: d.ha, sa: d.sa, wb: d.wb, height: d.height }
    Object.entries(fields).forEach(([k, v]) => {
      const el = document.querySelector(`[data-geo="${k}"]`)
      if (!el) return
      el.textContent = v
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        gsap.fromTo(el, { autoAlpha: 0.2, y: 6 }, { autoAlpha: 1, y: 0, duration: 0.35, ease: 'power2.out', overwrite: 'auto' })
      }
    })
  })
})

/* ---------- riders marquee: duplicate content for a seamless -50% loop ---------- */
const ridersTrack = document.querySelector('.riders-track')
ridersTrack.innerHTML += ridersTrack.innerHTML
ridersTrack.querySelectorAll('img, video').forEach((el) => el.setAttribute('aria-hidden', 'true'))

// story clips only run while the section is on screen
const storyVideos = [...ridersTrack.querySelectorAll('video')]
let ridersVisible = false
const ridersIo = new IntersectionObserver(
  ([e]) => {
    ridersVisible = e.isIntersecting
    storyVideos.forEach((v) => {
      if (!v.src) return
      if (e.isIntersecting) v.play().catch(() => {})
      else v.pause()
    })
  },
  { threshold: 0.1 }
)
ridersIo.observe(document.querySelector('.riders'))

// hydrate the story clips well before the section arrives (posters until then)
const ridersHydrate = new IntersectionObserver(([e]) => {
  if (!e.isIntersecting) return
  ridersHydrate.disconnect()
  videoQueue.enqueue(storyVideos, (v) => { if (ridersVisible) v.play().catch(() => {}) })
}, { rootMargin: '150% 0px' })
ridersHydrate.observe(document.querySelector('.riders'))

/* ---------- fullscreen menu (guglieri-style section fades) ---------- */
const burger = document.querySelector('.nav-burger')
const menuEl = document.querySelector('.menu')
const menuLinks = [...menuEl.querySelectorAll('a')]
let menuOpen = false

function openMenu() {
  menuOpen = true
  menuEl.hidden = false
  burger.classList.add('is-open')
  burger.setAttribute('aria-expanded', 'true')
  burger.setAttribute('aria-label', 'Close menu')
  document.documentElement.style.overflow = 'hidden'
  if (!reduceMotion) {
    gsap.fromTo(menuEl, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.35, ease: 'power2.out' })
    gsap.fromTo(menuLinks, { autoAlpha: 0, y: 36 }, { autoAlpha: 1, y: 0, duration: 0.55, stagger: 0.055, ease: 'power3.out', delay: 0.08 })
  }
  menuLinks[0].focus()
}

function closeMenu(instant) {
  menuOpen = false
  burger.classList.remove('is-open')
  burger.setAttribute('aria-expanded', 'false')
  burger.setAttribute('aria-label', 'Open menu')
  document.documentElement.style.overflow = ''
  if (reduceMotion || instant) {
    menuEl.hidden = true
    return
  }
  gsap.to(menuEl, { autoAlpha: 0, duration: 0.3, ease: 'power2.in', onComplete: () => { menuEl.hidden = true; gsap.set(menuEl, { clearProps: 'all' }) } })
}

burger.addEventListener('click', () => (menuOpen ? closeMenu() : openMenu()))
// anywhere on the open overlay closes it, except the menu options themselves
menuEl.addEventListener('click', (e) => {
  if (!e.target.closest('.menu-list a')) closeMenu()
})
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && menuOpen) closeMenu() })

/* ---------- cursor dot (fine pointers, motion allowed) ---------- */
if (!reduceMotion && window.matchMedia('(pointer: fine)').matches) {
  const dot = document.createElement('div')
  dot.className = 'cursor-dot'
  dot.setAttribute('aria-hidden', 'true')
  document.body.append(dot)
  document.body.classList.add('has-dot')
  gsap.set(dot, { xPercent: 0, autoAlpha: 0 })
  const dx = gsap.quickTo(dot, 'x', { duration: 0.18, ease: 'power2' })
  const dy = gsap.quickTo(dot, 'y', { duration: 0.18, ease: 'power2' })
  window.addEventListener('pointermove', (e) => {
    gsap.to(dot, { autoAlpha: 1, duration: 0.2, overwrite: 'auto' })
    dx(e.clientX)
    dy(e.clientY)
  })
  document.addEventListener('mouseleave', () => gsap.to(dot, { autoAlpha: 0, duration: 0.3 }))
  document.addEventListener('mouseover', (e) => {
    const interactive = e.target.closest('a, button')
    gsap.to(dot, { scale: interactive ? 2.3 : 1, opacity: interactive ? 0.65 : 1, duration: 0.25 })
  })
}

// Section links: the opaque menu doubles as the fade curtain. While it covers
// the screen we jump instantly, then fade the menu away over the new section.
menuLinks.filter((a) => a.hasAttribute('data-menu')).forEach((a) => {
  a.addEventListener('click', (e) => {
    e.preventDefault()
    const target = document.querySelector(a.getAttribute('href'))
    if (!target) { closeMenu(); return }
    if (reduceMotion) {
      closeMenu(true)
      target.scrollIntoView()
      return
    }
    gsap.timeline()
      .to(menuLinks, { autoAlpha: 0, y: -20, duration: 0.25, stagger: 0.02, ease: 'power2.in' })
      .add(() => { window.lenis?.scrollTo(target, { immediate: true, force: true }) })
      .add(() => closeMenu(), '+=0.15')
  })
})

/* ---------- wind-tunnel streaklines behind the bento ----------
   Thin gold air streaks slipping left to right at different speeds, the way
   airflow is visualized in a tunnel. Pauses off-screen. */
function initWindField(canvas, sectionEl, staticFrame) {
  const ctx = canvas.getContext('2d')
  const dpr = Math.min(window.devicePixelRatio, 2)
  let w = 0
  let h = 0
  let streaks = []
  const seed = (i) => {
    const rnd = Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1
    const rnd2 = Math.abs(Math.sin(i * 78.233) * 12543.85) % 1
    return {
      y: 0.04 + rnd * 0.92,
      len: 90 + rnd2 * 240,
      speed: 60 + rnd * 190,
      alpha: 0.1 + rnd2 * 0.3,
      offset: rnd2 * 4000,
      thick: rnd > 0.85 ? 2 : 1,
    }
  }
  const resize = () => {
    w = canvas.clientWidth
    h = canvas.clientHeight
    canvas.width = w * dpr
    canvas.height = h * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    streaks = Array.from({ length: Math.round(h / 34) }, (_, i) => seed(i + 1))
  }
  resize()
  window.addEventListener('resize', resize)

  const paint = (t) => {
    ctx.clearRect(0, 0, w, h)
    for (const s of streaks) {
      const x = ((t * s.speed + s.offset) % (w + s.len)) - s.len
      const y = s.y * h
      const g = ctx.createLinearGradient(x, 0, x + s.len, 0)
      g.addColorStop(0, 'rgba(201, 162, 75, 0)')
      g.addColorStop(0.75, `rgba(230, 200, 120, ${s.alpha})`)
      g.addColorStop(1, 'rgba(201, 162, 75, 0)')
      ctx.fillStyle = g
      ctx.fillRect(x, y, s.len, s.thick)
    }
  }

  if (staticFrame) {
    paint(2.5)
    return
  }

  let running = true
  const tick = (now) => {
    requestAnimationFrame(tick)
    if (!running) return
    paint(now / 1000)
  }
  requestAnimationFrame(tick)
  const io = new IntersectionObserver(([e]) => { running = e.isIntersecting }, { threshold: 0 })
  io.observe(sectionEl)
}

const mm = gsap.matchMedia()

mm.add(
  {
    desktop: '(min-width: 768px) and (prefers-reduced-motion: no-preference)',
    mobile: '(max-width: 767px) and (prefers-reduced-motion: no-preference)',
    reduce: '(prefers-reduced-motion: reduce)',
  },
  (ctx) => {
    const { desktop, reduce } = ctx.conditions

    const heroVideo = document.querySelector('.hero-video')

    if (reduce) {
      heroVideo.addEventListener('loadedmetadata', () => { heroVideo.currentTime = 3 }, { once: true })
      return
    }

    /* ===== inertia scroll (Lenis driven by GSAP's ticker) ===== */
    const lenis = new Lenis({ lerp: 0.09 })
    window.lenis = lenis
    lenis.on('scroll', ScrollTrigger.update)
    const lenisRaf = (time) => { lenis.raf(time * 1000) }
    gsap.ticker.add(lenisRaf)
    gsap.ticker.lagSmoothing(0)

    /* speed distortion: fast scroll bends the whole page organically.
       A turbulence displacement map (non-uniform warp) chained to a vertical
       gaussian blur (directional motion blur) rides Lenis' live velocity,
       with only a whisper of skew underneath. The SVG filter is detached
       whenever the page is at rest so it costs nothing while idle. */
    gsap.set('main', { transformOrigin: '50% 50%' })
    const pageSkew = gsap.quickTo('main', 'skewY', { duration: 0.5, ease: 'power3' })
    const clampSkew = gsap.utils.clamp(-3, 3)

    /* two tiers: skew + directional blur are the default response; the organic
       turbulence warp only wakes up past a much higher velocity, so normal
       fast scrolling stays crisp and only a violent flick bends the page */
    const warpNode = document.querySelector('#speed-warp feDisplacementMap')
    const blurNode = document.querySelector('#speed-warp feGaussianBlur')
    const mainEl = document.querySelector('main')
    const speedFx = { blur: 0, warp: 0 }
    let filterOn = false
    const renderSpeedFx = () => {
      if (speedFx.blur > 0.015 || speedFx.warp > 0.01) {
        if (!filterOn) {
          mainEl.style.filter = 'url(#speed-warp)'
          filterOn = true
        }
        warpNode.setAttribute('scale', (speedFx.warp * 60).toFixed(1))
        blurNode.setAttribute('stdDeviation', `0 ${(speedFx.blur * 7).toFixed(2)}`)
      } else if (filterOn) {
        mainEl.style.filter = ''
        filterOn = false
      }
    }
    const blurTo = gsap.quickTo(speedFx, 'blur', { duration: 0.45, ease: 'power3', onUpdate: renderSpeedFx })
    const warpTo = gsap.quickTo(speedFx, 'warp', { duration: 0.5, ease: 'power3', onUpdate: renderSpeedFx })
    let speedIdleTimer = null
    lenis.on('scroll', (l) => {
      const v = Math.abs(l.velocity)
      blurTo(gsap.utils.clamp(0, 1, v / 70))
      warpTo(gsap.utils.clamp(0, 1, (v - 95) / 75)) // dormant until ~95, full at ~170
      pageSkew(clampSkew(l.velocity * 0.05))
      // safety decay: instant jumps (menu links) emit no trailing events, so
      // force everything back to rest once the stream goes quiet
      clearTimeout(speedIdleTimer)
      speedIdleTimer = setTimeout(() => {
        blurTo(0)
        warpTo(0)
        pageSkew(0)
      }, 140)
    })

    // In-page anchors ride the same inertia instead of jumping.
    // Menu links are handled separately: they use the fade transition.
    document.querySelectorAll('a[href^="#"]:not([data-menu])').forEach((a) => {
      a.addEventListener('click', (e) => {
        const target = document.querySelector(a.getAttribute('href'))
        if (!target) return
        e.preventDefault()
        lenis.scrollTo(target, { offset: -20 })
      })
    })

    /* ===== hero intro: per-char rise, gated on the loader curtain ===== */
    const words = document.querySelectorAll('.hero-word')
    words.forEach((w) => splitChars(w))
    const intro = gsap.timeline({ paused: true })
    intro
      .from('.hero-word .char-in', {
        yPercent: 115,
        opacity: 0,
        duration: 0.9,
        stagger: 0.035,
        ease: 'power3.out',
      }, 0)
      .from('.hero-sub-in', { autoAlpha: 0, y: 16, duration: 0.9, ease: 'power3.out' }, 0.6)
      .from('.hero-copy .cta', { autoAlpha: 0, y: 16, duration: 0.7, ease: 'power3.out' }, 0.8)
    onLoaderDone(() => intro.play())

    /* ===== hero · looping film, camera pulls back as you scroll =====
       The film plays on its own: reveal once, then the orbit loops (we jump
       back past the dark intro so the loop never goes black). Scroll does not
       scrub anymore; it pulls the camera away from the screen instead. */
    const LOOP_START = 3.2
    heroVideo.addEventListener('timeupdate', () => {
      if (heroVideo.duration && heroVideo.currentTime >= heroVideo.duration - 0.12) {
        heroVideo.currentTime = LOOP_START
      }
    })
    onLoaderDone(() => {
      heroVideo.play().catch(() => {})
      gsap.delayedCall(1, () => {
        if (heroProgress < 0.015) gsap.to('.hero-cue', { autoAlpha: 1, duration: 0.6 })
      })
    })

    let heroProgress = 0
    let cueGone = false
    ScrollTrigger.create({
      trigger: '.hero',
      start: 'top top',
      end: 'bottom bottom',
      onUpdate: (self) => {
        heroProgress = self.progress
        if (!cueGone && self.progress > 0.02) {
          cueGone = true
          gsap.to('.hero-cue', { autoAlpha: 0, duration: 0.3, overwrite: 'auto' })
        }
      },
    })

    // the pull-back: the full-bleed film shrinks until it docks exactly
    // into the empty center cell of the mosaic
    const centerCell = document.querySelector('.cell-center')
    gsap.fromTo('.hero-zoom', { scale: 1 }, {
      scale: () => centerCell.getBoundingClientRect().width / window.innerWidth,
      ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom bottom', scrub: true, invalidateOnRefresh: true },
    })

    // Master scrub timeline: giant type dissolves per-char, then three
    // marketing captions ride the orbit.
    const heroTl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom bottom', scrub: true },
    })
    heroTl.to('.hero-word .char', { opacity: 0, y: -16, stagger: 0.0022, duration: 0.1 }, 0.02)
    heroTl.to('.hero-sub', { opacity: 0, duration: 0.08 }, 0.02)
    heroTl.to('.hero-copy .cta', { opacity: 0, pointerEvents: 'none', duration: 0.08 }, 0.03)

    const captionWindows = [
      [0.22, 0.4],
      [0.48, 0.66],
      [0.74, 0.93],
    ]
    document.querySelectorAll('.hero-caption').forEach((el, i) => {
      const [a, b] = captionWindows[i]
      const fade = (b - a) * 0.3
      heroTl.fromTo(el, { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: fade }, a)
      heroTl.to(el, { autoAlpha: 0, y: -30, duration: fade }, b - fade)
    })

    /* ===== mosaic reveal: cells drift in organically around the docking film =====
       Each cell slides in from its own scattered direction with a slight twist
       and a back.out overshoot, so the grid assembles with inertia instead of
       a linear fade-up. Deterministic seeds: same choreography every load. */
    const cells = gsap.utils.toArray('.cell:not(.cell-center)')
    const order = [0, 7, 2, 5, 1, 6, 3, 4] // scattered, not sequential
    const cellSeed = (i) => {
      const r1 = Math.abs(Math.sin((i + 1) * 12.9898) * 43758.5453) % 1
      const r2 = Math.abs(Math.sin((i + 1) * 78.233) * 12543.85) % 1
      return { r1, r2 }
    }
    order.forEach((cellIdx, i) => {
      const el = cells[cellIdx]
      if (!el) return
      const { r1, r2 } = cellSeed(cellIdx)
      heroTl.fromTo(el,
        {
          autoAlpha: 0,
          x: (r1 - 0.5) * 280,
          y: (r2 - 0.5) * 180 + (r2 > 0.5 ? 90 : -90),
          rotation: (r1 - 0.5) * 16,
          scale: 0.88,
        },
        { autoAlpha: 1, x: 0, y: 0, rotation: 0, scale: 1, duration: 0.16, ease: 'back.out(1.6)' },
        0.28 + i * 0.06)
    })

    /* the settled mosaic answers the pointer: each clip drifts at its own
       depth with a long ease, so the grid feels suspended, not printed */
    if (desktop && window.matchMedia('(pointer: fine)').matches) {
      const driftLayers = cells
        .map((el, i) => {
          const vid = el.querySelector('video')
          if (!vid) return null
          const { r1, r2 } = cellSeed(i)
          gsap.set(vid, { scale: 1.09 })
          return {
            depth: 8 + r1 * 14,
            dirX: r2 > 0.5 ? 1 : -1,
            x: gsap.quickTo(vid, 'x', { duration: 1.1, ease: 'power3' }),
            y: gsap.quickTo(vid, 'y', { duration: 1.1, ease: 'power3' }),
          }
        })
        .filter(Boolean)
      document.querySelector('.hero-sticky').addEventListener('pointermove', (e) => {
        const nx = e.clientX / window.innerWidth - 0.5
        const ny = e.clientY / window.innerHeight - 0.5
        driftLayers.forEach((l) => {
          l.x(nx * l.depth * l.dirX * 2)
          l.y(ny * l.depth * 1.4)
        })
      })
    }

    // all hero media plays only while the hero is on screen
    const cellVideos = [...document.querySelectorAll('.cell video')]
    let heroVisible = true
    onLoaderDone(() => {
      // the hero film is buffered by the loader; hydrate the mosaic on idle
      // network so every cell is ready before the pull-back reveals it
      const kick = () => videoQueue.enqueue(cellVideos, (v) => { if (heroVisible) v.play().catch(() => {}) })
      if ('requestIdleCallback' in window) requestIdleCallback(kick, { timeout: 2500 })
      else setTimeout(kick, 1200)
    })
    const heroIo = new IntersectionObserver(([e]) => {
      heroVisible = e.isIntersecting
      ;[heroVideo, ...cellVideos].forEach((v) => {
        if (!v.src) return
        if (e.isIntersecting) v.play().catch(() => {})
        else v.pause()
      })
    }, { threshold: 0 })
    heroIo.observe(document.querySelector('.hero-sticky'))

    /* ===== hero · gold dust overlay (desktop, lazy) ===== */
    let disposeParticles = null
    if (desktop) {
      import('./hero-particles.js').then(({ initHeroParticles }) => {
        disposeParticles = initHeroParticles(
          document.querySelector('.hero-canvas'),
          document.querySelector('.hero-sticky')
        )
      })
    }

    /* ===== numbers · reveal + count-up ===== */
    document.querySelectorAll('.stat').forEach((stat) => {
      const num = stat.querySelector('.stat-num')
      gsap.from(stat, {
        autoAlpha: 0,
        y: 40,
        duration: 0.9,
        ease: 'power3.out',
        scrollTrigger: { trigger: stat, start: 'top 82%', once: true },
        onStart: () => {
          if (!num) return
          const end = parseFloat(num.dataset.count)
          const decimals = parseInt(num.dataset.decimals || '0', 10)
          const counter = { v: 0 }
          gsap.to(counter, {
            v: end,
            duration: 1.4,
            ease: 'power2.out',
            onUpdate: () => { num.textContent = counter.v.toFixed(decimals) },
          })
        },
      })
    })

    /* ===== contour field: lines draw themselves as the bento scrolls through ===== */
    /* ===== wind-tunnel field behind the bento ===== */
    initWindField(document.querySelector('.stats-wind'), document.querySelector('.stats'), false)

    /* ===== geometry · radar reveal: each series grows from the web's center ===== */
    if (document.querySelector('.radar-series')) {
      gsap.from('.radar-series', {
        svgOrigin: '210 180',
        scale: 0.25,
        opacity: 0,
        duration: 1,
        stagger: 0.18,
        ease: 'power3.out',
        scrollTrigger: { trigger: '.geo-radar', start: 'top 82%', once: true },
      })
      gsap.from('.radar-dot', {
        transformOrigin: '50% 50%',
        scale: 0,
        duration: 0.5,
        stagger: 0.04,
        delay: 0.2,
        ease: 'back.out(2)',
        scrollTrigger: { trigger: '.geo-radar', start: 'top 82%', once: true },
      })
    }

    /* ===== riders · infinite drag marquee with elastic inertia =====
       Auto-drifts left; grab and throw it either way. The track skews with
       the live velocity and springs back elastically as the momentum dies. */
    {
      const marqueeEl = document.querySelector('.riders-marquee')
      const track = document.querySelector('.riders-track')
      let half = 0
      const measure = () => { half = track.scrollWidth / 2 }
      measure()
      window.addEventListener('resize', measure)

      const BASE = 0.55 // auto-drift, px per 60fps frame
      let pos = 0
      let momentum = 0
      let dragging = false
      let lastX = 0
      let frameDx = 0
      let elasticFired = true
      // reassigned after each elastic release: overwriting a quickTo's tween
      // kills it for good, so a fresh one is built when the elastic settles
      let skewTo = gsap.quickTo(track, 'skewX', { duration: 0.7, ease: 'power3' })
      const clampSkew = gsap.utils.clamp(-12, 12)

      marqueeEl.addEventListener('pointerdown', (e) => {
        dragging = true
        elasticFired = false
        lastX = e.clientX
        frameDx = 0
        marqueeEl.classList.add('is-dragging')
        marqueeEl.setPointerCapture(e.pointerId)
      })
      marqueeEl.addEventListener('pointermove', (e) => {
        if (!dragging) return
        frameDx = e.clientX - lastX
        lastX = e.clientX
        pos -= frameDx
        momentum = -frameDx
      })
      const endDrag = () => {
        if (!dragging) return
        dragging = false
        marqueeEl.classList.remove('is-dragging')
      }
      marqueeEl.addEventListener('pointerup', endDrag)
      marqueeEl.addEventListener('pointercancel', endDrag)

      gsap.ticker.add((t, dt) => {
        if (!ridersVisible && !dragging) return
        const f = dt / 16.7
        if (dragging) {
          skewTo(clampSkew(-frameDx * 1.1))
          frameDx *= 0.8 // straighten while the pointer holds still
        } else {
          momentum *= Math.pow(0.95, f)
          pos += (BASE + momentum) * f
          if (Math.abs(momentum) > 2) {
            skewTo(clampSkew(momentum * 0.8))
          } else if (!elasticFired) {
            elasticFired = true
            gsap.to(track, {
              skewX: 0,
              duration: 1.2,
              ease: 'elastic.out(1, 0.45)',
              overwrite: 'auto',
              onComplete: () => { skewTo = gsap.quickTo(track, 'skewX', { duration: 0.7, ease: 'power3' }) },
            })
          }
        }
        pos = ((pos % half) + half) % half
        gsap.set(track, { x: -pos })
      })
    }

    /* ===== pitch · the deck is dealt as the section arrives ===== */
    {
      const poses = notePoses()
      poses.forEach((p) => {
        gsap.set(p.el, { y: 640, x: p.x * 0.25, rotation: p.rot * 2.4, rotationX: 42, autoAlpha: 0, zIndex: p.z })
      })
      ScrollTrigger.create({
        trigger: '.pitch',
        start: 'top 75%',
        once: true,
        onEnter: () => {
          const tl = gsap.timeline()
          poses.forEach((p, i) => {
            tl.to(p.el, {
              y: p.y,
              x: p.x,
              rotation: p.rot,
              rotationX: 0,
              autoAlpha: 1,
              scale: p.scale,
              duration: 0.9,
              ease: 'back.out(1.2)',
            }, i * 0.11)
          })
        },
      })
    }

    /* ===== gallery entrance: strips rise in sequence ===== */
    gsap.from('.strip', {
      autoAlpha: 0,
      yPercent: 14,
      duration: 0.8,
      stagger: 0.09,
      ease: 'power3.out',
      scrollTrigger: { trigger: '.accordion', start: 'top 78%', once: true },
    })

    /* ===== section titles ===== */
    gsap.utils.toArray('.section-title').forEach((el) => {
      gsap.from(el, {
        autoAlpha: 0,
        y: 30,
        duration: 0.8,
        ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 85%', once: true },
      })
    })

    /* ===== scene · wind shader over the dusk photo (lazy) ===== */
    let disposeWind = null
    ScrollTrigger.create({
      trigger: '.scene',
      start: 'top bottom',
      once: true,
      onEnter: () => {
        import('./scene-wind.js').then(({ initSceneWind }) => {
          disposeWind = initSceneWind(
            document.querySelector('.scene-wind'),
            document.querySelector('.scene')
          )
        })
      },
    })

    /* ===== scene · zoom parallax ===== */
    gsap.fromTo(
      '.scene-frame img',
      { scale: 1.15 },
      {
        scale: 1,
        ease: 'none',
        scrollTrigger: { trigger: '.scene', start: 'top bottom', end: 'bottom top', scrub: true },
      }
    )
    gsap.from('.scene-copy > *', {
      autoAlpha: 0,
      y: 30,
      duration: 0.9,
      stagger: 0.12,
      ease: 'power3.out',
      scrollTrigger: { trigger: '.scene', start: 'top 60%', once: true },
    })

    /* ===== reserve · reveal + bike pointer tilt ===== */
    gsap.from('.reserve > *', {
      autoAlpha: 0,
      y: 40,
      duration: 0.9,
      stagger: 0.15,
      ease: 'power3.out',
      scrollTrigger: { trigger: '.reserve', start: 'top 70%', once: true },
    })

    if (desktop && window.matchMedia('(pointer: fine)').matches) {
      const bike = document.querySelector('.reserve-bike')
      const bx = gsap.quickTo(bike, 'x', { duration: 0.6, ease: 'power3' })
      const by = gsap.quickTo(bike, 'y', { duration: 0.6, ease: 'power3' })
      document.querySelector('.reserve').addEventListener('pointermove', (e) => {
        const nx = e.clientX / window.innerWidth - 0.5
        const ny = e.clientY / window.innerHeight - 0.5
        bx(nx * -20)
        by(ny * -12)
      })

      /* magnetic CTAs */
      document.querySelectorAll('.nav-cta, .cta-primary').forEach((el) => {
        const xTo = gsap.quickTo(el, 'x', { duration: 0.4, ease: 'power3' })
        const yTo = gsap.quickTo(el, 'y', { duration: 0.4, ease: 'power3' })
        el.addEventListener('pointermove', (e) => {
          const r = el.getBoundingClientRect()
          xTo(gsap.utils.clamp(-8, 8, (e.clientX - r.left - r.width / 2) * 0.3))
          yTo(gsap.utils.clamp(-6, 6, (e.clientY - r.top - r.height / 2) * 0.3))
        })
        el.addEventListener('pointerleave', () => { xTo(0); yTo(0) })
      })
    }

    /* ===== footer · particle logo (desktop, lazy, rebuilt on resize) ===== */
    let disposeFooter = null
    if (desktop) {
      let footerBooted = false
      const bootFooter = () => {
        import('./footer-particles.js').then(({ initFooterParticles }) => {
          const footerEl = document.querySelector('.site-footer')
          footerEl.classList.add('has-canvas')
          return initFooterParticles(document.querySelector('.footer-canvas'), footerEl)
        }).then((dispose) => { disposeFooter = dispose })
      }
      ScrollTrigger.create({
        trigger: 'main',
        start: 'bottom bottom',
        once: true,
        onEnter: () => {
          footerBooted = true
          bootFooter()
        },
      })
      // the sampled layout depends on canvas size: rebuild after resizes
      let resizeT = null
      window.addEventListener('resize', () => {
        if (!footerBooted) return
        clearTimeout(resizeT)
        resizeT = setTimeout(() => {
          if (disposeFooter) { disposeFooter(); disposeFooter = null }
          bootFooter()
        }, 350)
      })
    }

    /* ===== footer · gold reveal parallax =====
       The page only scrolls --footer-h past main's bottom, so the scrub range
       must be exactly the footer's height or the tween never completes and the
       footer links are left translated below the viewport. */
    gsap.from('.footer-inner', {
      y: '16vh',
      opacity: 0.4,
      ease: 'none',
      scrollTrigger: {
        trigger: 'main',
        start: 'bottom bottom',
        end: () => `+=${document.querySelector('.site-footer').offsetHeight}`,
        scrub: true,
        invalidateOnRefresh: true,
      },
    })

    return () => {
      if (disposeParticles) disposeParticles()
      if (disposeFooter) disposeFooter()
      if (disposeWind) disposeWind()
      gsap.ticker.remove(lenisRaf)
      lenis.destroy()
    }
  }
)
