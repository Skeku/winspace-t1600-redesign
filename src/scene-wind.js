// Wind shader for the dusk scene: warm luminous air filaments, stretched and
// advected left to right by fbm noise, composited over the photo with screen
// blending. Isolated Three.js leaf; returns a dispose function and pauses
// itself while the scene is off screen.
import {
  Scene,
  OrthographicCamera,
  WebGLRenderer,
  PlaneGeometry,
  ShaderMaterial,
  Mesh,
} from 'three'

const FRAG = /* glsl */ `
  precision mediump float;
  varying vec2 vUv;
  uniform float uTime;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 3; i++) {
      v += a * noise(p);
      p *= 2.1;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec2 uv = vUv;
    // the flow field wobbles each filament's height as it races along
    float wobble = fbm(vec2(uv.x * 3.0 - uTime * 1.1, uv.y * 5.0)) * 0.6;
    float n = fbm(vec2(uv.x * 2.2 - uTime * 0.8, uv.y * 11.0 + wobble));
    float streak = smoothstep(0.48, 0.88, n);
    // a slower, wider second layer for depth
    float n2 = fbm(vec2(uv.x * 1.3 - uTime * 0.45 + 7.0, uv.y * 6.0 + wobble * 0.6));
    float streak2 = smoothstep(0.52, 0.9, n2);
    // strongest through the middle band, faded at top and bottom edges
    float band = smoothstep(0.02, 0.28, uv.y) * smoothstep(0.98, 0.62, uv.y);
    float a = (streak * 0.55 + streak2 * 0.35) * band;
    vec3 warm = mix(vec3(0.9, 0.84, 0.7), vec3(0.82, 0.66, 0.3), 0.4);
    gl_FragColor = vec4(warm * a, a);
  }
`

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`

export function initSceneWind(canvas, sectionEl) {
  const scene = new Scene()
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1)
  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: false })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))

  const material = new ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: { uTime: { value: 0 } },
    transparent: true,
    depthTest: false,
  })
  scene.add(new Mesh(new PlaneGeometry(2, 2), material))

  const resize = () => {
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false)
  }
  resize()
  window.addEventListener('resize', resize)

  let running = true
  let raf = 0
  const tick = (t) => {
    raf = requestAnimationFrame(tick)
    if (!running) return
    material.uniforms.uTime.value = t / 1000
    renderer.render(scene, camera)
  }
  raf = requestAnimationFrame(tick)

  const io = new IntersectionObserver(([e]) => { running = e.isIntersecting }, { threshold: 0 })
  io.observe(sectionEl)

  return () => {
    cancelAnimationFrame(raf)
    io.disconnect()
    window.removeEventListener('resize', resize)
    material.dispose()
    renderer.dispose()
  }
}
