// Gold dust field for the hero. Isolated Three.js leaf: init returns a
// dispose function, pauses itself when the hero leaves the viewport.
import {
  Scene,
  PerspectiveCamera,
  WebGLRenderer,
  BufferGeometry,
  BufferAttribute,
  Points,
  PointsMaterial,
  CanvasTexture,
  AdditiveBlending,
  Color,
} from 'three'

function makeSprite() {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const ctx = c.getContext('2d')
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.35, 'rgba(255,255,255,0.55)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 64, 64)
  return new CanvasTexture(c)
}

export function initHeroParticles(canvas, heroEl) {
  const COUNT = 1300
  const scene = new Scene()
  const camera = new PerspectiveCamera(55, 1, 0.1, 100)
  camera.position.z = 10

  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: false })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

  const positions = new Float32Array(COUNT * 3)
  const colors = new Float32Array(COUNT * 3)
  const seeds = new Float32Array(COUNT)
  const gold = new Color('#c9a24b')
  const bright = new Color('#f0d488')
  const tmp = new Color()

  for (let i = 0; i < COUNT; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 22
    positions[i * 3 + 1] = (Math.random() - 0.5) * 12
    positions[i * 3 + 2] = (Math.random() - 0.5) * 6
    seeds[i] = Math.random() * Math.PI * 2
    tmp.lerpColors(gold, bright, Math.random())
    colors[i * 3] = tmp.r
    colors[i * 3 + 1] = tmp.g
    colors[i * 3 + 2] = tmp.b
  }

  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(positions, 3))
  geo.setAttribute('color', new BufferAttribute(colors, 3))

  const mat = new PointsMaterial({
    size: 0.05,
    map: makeSprite(),
    vertexColors: true,
    transparent: true,
    opacity: 0.75,
    depthWrite: false,
    blending: AdditiveBlending,
    sizeAttenuation: true,
  })

  const points = new Points(geo, mat)
  scene.add(points)

  let width = 0
  let height = 0
  const resize = () => {
    width = canvas.clientWidth
    height = canvas.clientHeight
    renderer.setSize(width, height, false)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
  }
  resize()
  window.addEventListener('resize', resize)

  // pointer sway (whole field leans gently toward the cursor)
  let targetX = 0
  let targetY = 0
  const onPointer = (e) => {
    targetX = (e.clientX / window.innerWidth - 0.5) * 0.6
    targetY = (e.clientY / window.innerHeight - 0.5) * 0.4
  }
  heroEl.addEventListener('pointermove', onPointer)

  let running = true
  let raf = 0
  const pos = geo.attributes.position

  const tick = (t) => {
    raf = requestAnimationFrame(tick)
    if (!running) return
    const time = t * 0.00022
    for (let i = 0; i < COUNT; i++) {
      const s = seeds[i]
      // slow drift up-right plus per-particle sine wobble
      pos.array[i * 3] += 0.0016 + Math.sin(time * 2 + s) * 0.0006
      pos.array[i * 3 + 1] += 0.0009 + Math.cos(time * 1.6 + s * 1.3) * 0.0005
      if (pos.array[i * 3] > 11) pos.array[i * 3] = -11
      if (pos.array[i * 3 + 1] > 6.5) pos.array[i * 3 + 1] = -6.5
    }
    pos.needsUpdate = true
    points.rotation.y += (targetX * 0.25 - points.rotation.y) * 0.04
    points.rotation.x += (targetY * 0.2 - points.rotation.x) * 0.04
    renderer.render(scene, camera)
  }
  raf = requestAnimationFrame(tick)

  // pause when hero is off-screen or tab hidden
  const io = new IntersectionObserver(([e]) => { running = e.isIntersecting }, { threshold: 0 })
  io.observe(heroEl)
  const onVis = () => { running = !document.hidden }
  document.addEventListener('visibilitychange', onVis)

  return () => {
    cancelAnimationFrame(raf)
    io.disconnect()
    document.removeEventListener('visibilitychange', onVis)
    window.removeEventListener('resize', resize)
    heroEl.removeEventListener('pointermove', onPointer)
    geo.dispose()
    mat.map.dispose()
    mat.dispose()
    renderer.dispose()
  }
}
