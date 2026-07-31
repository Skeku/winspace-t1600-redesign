// WINSPACE wordmark rebuilt from particles on the gold footer.
// Ink-dark points sit on their letterform targets, flee the cursor, and
// spring back. Isolated Three.js leaf; returns a dispose function.
import {
  Scene,
  OrthographicCamera,
  WebGLRenderer,
  BufferGeometry,
  BufferAttribute,
  Points,
  PointsMaterial,
} from 'three'

// Sample the real Winspace logo PNG (shield + wordmark, tagline row cropped)
// so the particle cloud matches the actual brand mark.
function sampleLogo(src, width, height) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const c = document.createElement('canvas')
      c.width = width
      c.height = height
      const ctx = c.getContext('2d')
      // Contained fit: the mark shows whole, as wide as the row allows.
      const scale = Math.min((width * 0.92) / img.naturalWidth, (height * 0.86) / img.naturalHeight)
      const dw = img.naturalWidth * scale
      const dh = img.naturalHeight * scale
      const x0 = (width - dw) / 2
      const y0 = (height - dh) / 2
      ctx.drawImage(img, x0, y0, dw, dh)
      const data = ctx.getImageData(0, 0, width, height).data
      const pts = []
      const step = 2
      for (let y = 0; y < height; y += step) {
        for (let x = 0; x < width; x += step) {
          if (data[(y * width + x) * 4 + 3] > 100) {
            const u = (x - x0) / dw
            const v = (y - y0) / dh
            if (v > 0.66 && u > 0.19) continue // tagline row, keep the shield tip
            pts.push([x - width / 2, height / 2 - y])
          }
        }
      }
      resolve(pts)
    }
    img.onerror = reject
    img.src = src
  })
}

export async function initFooterParticles(canvas, footerEl) {
  const W = canvas.clientWidth
  const H = canvas.clientHeight
  const targets = await sampleLogo('/img/winspace-logo.png', Math.floor(W / 2), Math.floor(H / 2))
  const COUNT = targets.length

  const scene = new Scene()
  const camera = new OrthographicCamera(-W / 4, W / 4, H / 4, -H / 4, 0.1, 10)
  camera.position.z = 5

  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: false })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(W, H, false)

  const pos = new Float32Array(COUNT * 3)
  const vel = new Float32Array(COUNT * 2)
  for (let i = 0; i < COUNT; i++) {
    pos[i * 3] = (Math.random() - 0.5) * W * 0.6
    pos[i * 3 + 1] = (Math.random() - 0.5) * H * 0.6
    pos[i * 3 + 2] = 0
  }

  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(pos, 3))
  const mat = new PointsMaterial({ size: 1.9, color: 0x141005, transparent: true, opacity: 0.92 })
  const points = new Points(geo, mat)
  scene.add(points)

  let mouseX = 1e5
  let mouseY = 1e5
  const onMove = (e) => {
    const r = canvas.getBoundingClientRect()
    mouseX = (e.clientX - r.left - r.width / 2) / 2
    mouseY = (r.height / 2 - (e.clientY - r.top)) / 2
  }
  const onLeave = () => { mouseX = 1e5; mouseY = 1e5 }
  footerEl.addEventListener('pointermove', onMove)
  footerEl.addEventListener('pointerleave', onLeave)

  let running = true
  let raf = 0
  const R = 34 // repulsion radius in scene units

  const tick = () => {
    raf = requestAnimationFrame(tick)
    if (!running) return
    const p = geo.attributes.position.array
    for (let i = 0; i < COUNT; i++) {
      const tx = targets[i][0]
      const ty = targets[i][1]
      let vx = vel[i * 2]
      let vy = vel[i * 2 + 1]
      // spring toward the letterform
      vx += (tx - p[i * 3]) * 0.02
      vy += (ty - p[i * 3 + 1]) * 0.02
      // flee the cursor
      const dx = p[i * 3] - mouseX
      const dy = p[i * 3 + 1] - mouseY
      const d2 = dx * dx + dy * dy
      if (d2 < R * R) {
        const d = Math.sqrt(d2) || 1
        const f = ((R - d) / R) * 2.4
        vx += (dx / d) * f
        vy += (dy / d) * f
      }
      vx *= 0.86
      vy *= 0.86
      vel[i * 2] = vx
      vel[i * 2 + 1] = vy
      p[i * 3] += vx
      p[i * 3 + 1] += vy
    }
    geo.attributes.position.needsUpdate = true
    renderer.render(scene, camera)
  }
  raf = requestAnimationFrame(tick)

  const io = new IntersectionObserver(([e]) => { running = e.isIntersecting }, { threshold: 0 })
  io.observe(canvas)

  return () => {
    cancelAnimationFrame(raf)
    io.disconnect()
    footerEl.removeEventListener('pointermove', onMove)
    footerEl.removeEventListener('pointerleave', onLeave)
    geo.dispose()
    mat.dispose()
    renderer.dispose()
  }
}
