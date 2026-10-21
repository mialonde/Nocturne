import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { THEMES, type ThemeConfig } from '../config/themes'
import type {
  BreathPattern,
  BreathPhase,
  BreathState,
  CaptureConfig,
  CaptureHandle,
  ExperienceMode,
  QualitySetting,
  ThemeId,
  VisualSettings,
} from '../types'
import {
  auraFragmentShader,
  auraVertexShader,
  backgroundFragmentShader,
  backgroundVertexShader,
  gradeShader,
  orbFragmentShader,
  orbVertexShader,
  particleFragmentShader,
  particleVertexShader,
  waveFragmentShader,
  waveVertexShader,
} from './shaders'
import { ConsciousnessLayer } from './ConsciousnessLayer'

interface ThemeRuntime {
  backgroundTop: THREE.Color
  backgroundBottom: THREE.Color
  backgroundAccent: THREE.Color
  fog: THREE.Color
  orbInner: THREE.Color
  orbMid: THREE.Color
  orbEdge: THREE.Color
  particle: THREE.Color
  ring: THREE.Color
  halo: THREE.Color
  shard: THREE.Color
  keyLight: THREE.Color
  fillLight: THREE.Color
  particleFactor: number
  ringOpacity: number
  haloStrength: number
  distortion: number
  bloom: number
  veil: number
}

export interface CaptureTelemetry {
  theme: string
  mode: string
  leftHz: number
  rightHz: number
  beatHz: number
}

export interface EnvironmentOptions {
  container: HTMLElement
  initialTheme: ThemeId
  visuals: VisualSettings
  initialMode: ExperienceMode
  initialBreathRunning: boolean
  initialBreathPattern: BreathPattern
  getCaptureTelemetry?: () => CaptureTelemetry
  onContextLost?: (lost: boolean) => void
  onCaptureError?: (message: string) => void
  onBreathPhase?: (phase: BreathPhase, cycle: number) => void
}

interface ParticleLayer {
  points: THREE.Points
  material: THREE.ShaderMaterial
  baseCount: number
  drift: number
  opacity: number
}

interface RingLine {
  line: THREE.LineLoop
  factor: number
}

interface Shard {
  mesh: THREE.Mesh
  radius: number
  speed: number
  phase: number
  height: number
  tilt: number
  rpm: number
}

interface Wave {
  mesh: THREE.Mesh
  material: THREE.ShaderMaterial
  start: number
  active: boolean
  seed: number
}

interface CaptureState {
  renderer: THREE.WebGLRenderer
  composer: EffectComposer | null
  bloomPass: UnrealBloomPass | null
  gradePass: ShaderPass | null
  camera: THREE.PerspectiveCamera
  canvas: HTMLCanvasElement
  stream: MediaStream
  manualTrack: (MediaStreamTrack & { requestFrame?: () => void }) | null
  width: number
  height: number
  fps: number
  lastRender: number
  overlay: CaptureOverlay | null
}

interface CaptureOverlay {
  scene: THREE.Scene
  camera: THREE.OrthographicCamera
  mesh: THREE.Mesh
  material: THREE.MeshBasicMaterial
  texture: THREE.CanvasTexture
  canvas: HTMLCanvasElement
  context: CanvasRenderingContext2D
  lastDraw: number
}

interface ComposerBundle {
  composer: EffectComposer
  bloomPass: UnrealBloomPass | null
  gradePass: ShaderPass | null
}

const PHASE_ORDER: BreathPhase[] = ['inhale', 'hold', 'exhale', 'rest']
const QUALITY_CAPS: Record<'high' | 'balanced' | 'low', number> = {
  high: 2,
  balanced: 1.5,
  low: 1.1,
}
const QUALITY_DENSITY: Record<'high' | 'balanced' | 'low', number> = {
  high: 1,
  balanced: 0.72,
  low: 0.4,
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function damp(current: number, target: number, lambda: number, dt: number): number {
  return THREE.MathUtils.lerp(current, target, 1 - Math.exp(-lambda * dt))
}

function smoothstep(value: number): number {
  const t = clamp(value, 0, 1)
  return t * t * (3 - 2 * t)
}

function createRng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state += 0x6d2b79f5
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function themeRuntime(config: ThemeConfig): ThemeRuntime {
  const palette = config.palette
  return {
    backgroundTop: new THREE.Color(palette.backgroundTop),
    backgroundBottom: new THREE.Color(palette.backgroundBottom),
    backgroundAccent: new THREE.Color(palette.backgroundAccent),
    fog: new THREE.Color(palette.fog),
    orbInner: new THREE.Color(palette.orbInner),
    orbMid: new THREE.Color(palette.orbMid),
    orbEdge: new THREE.Color(palette.orbEdge),
    particle: new THREE.Color(palette.particle),
    ring: new THREE.Color(palette.ring),
    halo: new THREE.Color(palette.halo),
    shard: new THREE.Color(palette.shard),
    keyLight: new THREE.Color(palette.keyLight),
    fillLight: new THREE.Color(palette.fillLight),
    particleFactor: palette.particleFactor,
    ringOpacity: palette.ringOpacity,
    haloStrength: palette.haloStrength,
    distortion: palette.distortion,
    bloom: palette.bloom,
    veil: palette.veil,
  }
}

export function getCaptureDimensions(
  aspect: CaptureConfig['aspect'],
  resolution: CaptureConfig['resolution'],
): { width: number; height: number } {
  const landscape = {
    720: { width: 1280, height: 720 },
    1080: { width: 1920, height: 1080 },
    1440: { width: 2560, height: 1440 },
  }[resolution]
  if (aspect === '16:9') return { ...landscape }
  if (aspect === '9:16') return { width: landscape.height, height: landscape.width }
  return { width: landscape.height, height: landscape.height }
}

function createGlowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas 2D is unavailable.')
  const gradient = context.createRadialGradient(128, 128, 2, 128, 128, 126)
  gradient.addColorStop(0, 'rgba(255,255,255,0.85)')
  gradient.addColorStop(0.18, 'rgba(255,255,255,0.33)')
  gradient.addColorStop(0.46, 'rgba(255,255,255,0.085)')
  gradient.addColorStop(1, 'rgba(255,255,255,0)')
  context.fillStyle = gradient
  context.fillRect(0, 0, 256, 256)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.minFilter = THREE.LinearFilter
  texture.generateMipmaps = false
  return texture
}

export class Environment3D {
  private readonly options: EnvironmentOptions
  private readonly container: HTMLElement
  private readonly scene: THREE.Scene
  private readonly camera: THREE.PerspectiveCamera
  private readonly renderer: THREE.WebGLRenderer
  private readonly clockStart = performance.now()
  private composer: EffectComposer | null = null
  private bloomPass: UnrealBloomPass | null = null
  private gradePass: ShaderPass | null = null
  private readonly currentTheme: ThemeRuntime
  private readonly targetTheme: ThemeRuntime
  private visuals: VisualSettings
  private mode: ExperienceMode
  private breathPattern: BreathPattern
  private breathRunning: boolean
  private phaseIndex = 0
  private phaseElapsed = 0
  private cycleCount = 0
  private breathTarget = 0.46
  private breathValue = 0.46
  private disposed = false
  private rafId = 0
  private lastFrame = performance.now()
  private elapsed = 0
  private width = 1
  private height = 1
  private currentDpr = 1
  private activeTier: 'high' | 'balanced' | 'low'
  private qualityMode: QualitySetting
  private autoPerfElapsed = 0
  private autoPerfFrames = 0
  private hasAutoDowngraded = false
  private contextLost = false
  private pointer = new THREE.Vector2()
  private pointerCurrent = new THREE.Vector2()
  private cameraDistance = 5.2
  private capture: CaptureState | null = null
  private resizeObserver: ResizeObserver | null = null
  private outputAnalyser: AnalyserNode | null = null
  private micAnalyser: AnalyserNode | null = null
  private outputTimeData: Uint8Array<ArrayBuffer> | null = null
  private micTimeData: Uint8Array<ArrayBuffer> | null = null
  private smoothedAudio = 0
  private smoothedMic = 0
  private lastPulseTime = -10
  private clickFlash = 0
  private lastBeat = 10
  private consciousnessLayer: ConsciousnessLayer | null = null
  private currentThemeId: ThemeId = 'dusk'

  private readonly backgroundMaterial: THREE.ShaderMaterial
  private readonly orbMaterial: THREE.ShaderMaterial
  private readonly auraMaterial: THREE.ShaderMaterial
  private readonly particleLayers: ParticleLayer[] = []
  private readonly ringLines: RingLine[] = []
  private readonly ringGroup: THREE.Group
  private readonly orbBreathGroup: THREE.Group
  private readonly orb: THREE.Mesh
  private readonly aura: THREE.Mesh
  private readonly halo: THREE.Sprite
  private readonly mist: THREE.Sprite
  private readonly haloMaterial: THREE.SpriteMaterial
  private readonly mistMaterial: THREE.SpriteMaterial
  private readonly shards: Shard[] = []
  private readonly shardMaterial: THREE.MeshPhysicalMaterial
  private readonly shardGeometry: THREE.IcosahedronGeometry
  private readonly keyLight: THREE.PointLight
  private readonly fillLight: THREE.PointLight
  private readonly ambientLight: THREE.AmbientLight
  private readonly waves: Wave[] = []
  private readonly waveGeometry: THREE.PlaneGeometry
  private readonly fog: THREE.FogExp2

  // Interactive camera orbit & controls
  private orbitTheta = 0
  private orbitPhi = Math.PI / 2
  private targetOrbitTheta = 0
  private targetOrbitPhi = Math.PI / 2
  private velocityTheta = 0
  private velocityPhi = 0
  private zoomOffset = 0
  private targetZoomOffset = 0
  private autoDrift = true
  private isDraggingCamera = false
  private lastDragX = 0
  private lastDragY = 0
  private dragDistance = 0
  private touchStartPinchDist = 0
  private touchStartZoom = 0

  private readonly handlePointerMove = (event: PointerEvent) => {
    const width = window.innerWidth || 1
    const height = window.innerHeight || 1
    this.pointerTargetFromClient(event.clientX, event.clientY, width, height)

    if (this.isDraggingCamera) {
      const dx = event.clientX - this.lastDragX
      const dy = event.clientY - this.lastDragY
      this.lastDragX = event.clientX
      this.lastDragY = event.clientY
      this.dragDistance += Math.hypot(dx, dy)
      const sens = 0.0042
      this.targetOrbitTheta -= dx * sens
      this.targetOrbitPhi = clamp(this.targetOrbitPhi - dy * sens, 0.22, Math.PI - 0.22)
      this.velocityTheta = -dx * sens * 14
      this.velocityPhi = -dy * sens * 14
    }
  }

  private readonly handlePointerLeave = () => {
    this.isDraggingCamera = false
    this.pointer.set(0, 0)
  }

  private readonly handleCanvasPointerDown = (event: PointerEvent) => {
    if (event.button !== 0 && event.pointerType !== 'touch') return
    this.isDraggingCamera = true
    this.lastDragX = event.clientX
    this.lastDragY = event.clientY
    this.dragDistance = 0
    this.velocityTheta = 0
    this.velocityPhi = 0
  }

  private readonly handleCanvasPointerUp = () => {
    if (this.isDraggingCamera) {
      this.isDraggingCamera = false
      if (this.dragDistance < 6) {
        this.triggerWave()
      }
    }
  }

  private readonly handleWheel = (event: WheelEvent) => {
    event.preventDefault()
    const delta = event.deltaY * 0.003
    this.targetZoomOffset = clamp(this.targetZoomOffset + delta, -2.2, 5.5)
  }

  private readonly handleTouchStart = (event: TouchEvent) => {
    if (event.touches.length === 2) {
      const t0 = event.touches[0]!
      const t1 = event.touches[1]!
      this.touchStartPinchDist = Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY)
      this.touchStartZoom = this.targetZoomOffset
    }
  }

  private readonly handleTouchMove = (event: TouchEvent) => {
    if (event.touches.length === 2 && this.touchStartPinchDist > 0) {
      const t0 = event.touches[0]!
      const t1 = event.touches[1]!
      const dist = Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY)
      const diff = (this.touchStartPinchDist - dist) * 0.008
      this.targetZoomOffset = clamp(this.touchStartZoom + diff, -2.2, 5.5)
    }
  }

  private readonly handleContextLost = (event: Event) => {
    event.preventDefault()
    this.contextLost = true
    if (this.rafId) cancelAnimationFrame(this.rafId)
    this.rafId = 0
    this.options.onContextLost?.(true)
  }

  private readonly handleContextRestored = () => {
    this.contextLost = false
    this.lastFrame = performance.now()
    this.options.onContextLost?.(false)
    if (!this.rafId && !this.disposed) this.startLoop()
  }

  private readonly handleWindowResize = () => {
    this.resize()
  }

  constructor(options: EnvironmentOptions) {
    this.options = options
    this.container = options.container
    this.visuals = { ...options.visuals }
    this.mode = options.initialMode
    this.breathPattern = { ...options.initialBreathPattern }
    this.breathRunning = options.initialBreathRunning && options.initialMode === 'breath'
    this.qualityMode = options.visuals.quality
    this.activeTier = this.chooseInitialTier()

    const bounds = this.container.getBoundingClientRect()
    this.width = Math.max(1, bounds.width || window.innerWidth)
    this.height = Math.max(1, bounds.height || window.innerHeight)

    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(42, this.width / this.height, 0.08, 130)
    this.cameraDistance = this.computeCameraDistance(this.width / this.height)
    this.camera.position.set(0, 0, this.cameraDistance)
    this.camera.lookAt(0, 0, 0)

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      stencil: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: false,
    })
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.08
    this.renderer.setClearColor('#010205', 1)
    this.renderer.domElement.className = 'environment-canvas'
    this.renderer.domElement.setAttribute('aria-hidden', 'true')
    this.renderer.domElement.tabIndex = -1
    this.container.appendChild(this.renderer.domElement)
    this.renderer.domElement.addEventListener('webglcontextlost', this.handleContextLost, false)
    this.renderer.domElement.addEventListener('webglcontextrestored', this.handleContextRestored, false)
    this.renderer.domElement.addEventListener('pointerdown', this.handleCanvasPointerDown)
    window.addEventListener('pointerup', this.handleCanvasPointerUp, { passive: true })
    this.renderer.domElement.addEventListener('wheel', this.handleWheel, { passive: false })
    this.renderer.domElement.addEventListener('touchstart', this.handleTouchStart, { passive: true })
    this.renderer.domElement.addEventListener('touchmove', this.handleTouchMove, { passive: true })
    window.addEventListener('pointermove', this.handlePointerMove, { passive: true })
    window.addEventListener('pointerup', this.handlePointerLeave, { passive: true })
    window.addEventListener('resize', this.handleWindowResize, { passive: true })
    document.addEventListener('pointerleave', this.handlePointerLeave, { passive: true })

    this.currentTheme = themeRuntime(THEMES[options.initialTheme])
    this.targetTheme = themeRuntime(THEMES[options.initialTheme])
    this.currentThemeId = options.initialTheme

    this.fog = new THREE.FogExp2(this.currentTheme.fog.getHex(), 0.028)
    this.scene.fog = this.fog

    this.backgroundMaterial = this.createBackground()
    this.orbMaterial = this.createOrb()
    this.auraMaterial = this.createAura()
    this.ringGroup = new THREE.Group()
    this.orbBreathGroup = new THREE.Group()
    this.scene.add(this.orbBreathGroup)
    const haloTexture = createGlowTexture()

    this.haloMaterial = new THREE.SpriteMaterial({
      map: haloTexture,
      color: this.currentTheme.halo.clone(),
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    })
    this.halo = new THREE.Sprite(this.haloMaterial)
    this.halo.scale.set(8.4, 8.4, 1)
    this.halo.renderOrder = -4
    this.scene.add(this.halo)

    this.mistMaterial = new THREE.SpriteMaterial({
      map: haloTexture.clone(),
      color: this.currentTheme.backgroundAccent.clone(),
      transparent: true,
      opacity: 0.055,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    })
    this.mist = new THREE.Sprite(this.mistMaterial)
    this.mist.scale.set(16, 12, 1)
    this.mist.position.set(-2.2, -1.3, -8)
    this.mist.renderOrder = -3
    this.scene.add(this.mist)

    this.orb = this.createOrbMesh()
    this.aura = this.createAuraMesh()
    this.orbBreathGroup.add(this.aura)
    this.orbBreathGroup.add(this.orb)

    this.ringGroup.position.set(0, 0, 0)
    this.scene.add(this.ringGroup)
    this.createRings()

    this.createParticles()

    this.shardGeometry = new THREE.IcosahedronGeometry(0.1, 0)
    this.shardMaterial = new THREE.MeshPhysicalMaterial({
      color: this.currentTheme.shard.clone(),
      emissive: this.currentTheme.keyLight.clone().multiplyScalar(0.14),
      emissiveIntensity: 0.8,
      metalness: 0.68,
      roughness: 0.18,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
    this.createShards()

    this.ambientLight = new THREE.AmbientLight(this.currentTheme.fillLight, 0.42)
    this.keyLight = new THREE.PointLight(this.currentTheme.keyLight, 2.6, 18, 1.7)
    this.keyLight.position.set(2.7, 2.1, 3.4)
    this.fillLight = new THREE.PointLight(this.currentTheme.fillLight, 1.8, 16, 1.8)
    this.fillLight.position.set(-3.1, -1.8, 2.2)
    this.scene.add(this.ambientLight, this.keyLight, this.fillLight)

    this.waveGeometry = new THREE.PlaneGeometry(6.4, 6.4)
    this.createWaves()

    this.applyQuality()
    this.createComposer()
    this.composer?.render(0)
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.resize())
      this.resizeObserver.observe(this.container)
    }
    // Activate cosmos layer if initial theme requires it.
    if (options.initialTheme === 'cosmos') {
      this.activateConsciousnessLayer()
    }
    this.animate(performance.now())
  }

  private chooseInitialTier(): 'high' | 'balanced' | 'low' {
    if (this.qualityMode !== 'auto') return this.qualityMode
    const coarsePointer =
      typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches
    const cores = navigator.hardwareConcurrency ?? 4
    const small = window.innerWidth < 800
    if (coarsePointer || small) return cores >= 8 ? 'balanced' : 'low'
    if (cores <= 4) return 'balanced'
    return 'high'
  }

  private applyQuality(): void {
    const cap = QUALITY_CAPS[this.activeTier]
    const dpr = Math.min(window.devicePixelRatio || 1, cap)
    this.currentDpr = Math.max(0.75, dpr)
    this.renderer.setPixelRatio(this.currentDpr)
    this.renderer.setSize(this.width, this.height, false)
    if (this.composer) {
      this.composer.setPixelRatio(this.currentDpr)
      this.composer.setSize(this.width, this.height)
    }
    if (this.bloomPass) {
      this.bloomPass.enabled = this.activeTier !== 'low'
    }
    for (const layer of this.particleLayers) {
      layer.material.uniforms.uPixelRatio.value = this.currentDpr
    }
    this.consciousnessLayer?.setPixelRatio(this.currentDpr)
  }

  private resize(): void {
    if (this.disposed) return
    const bounds = this.container.getBoundingClientRect()
    const nextWidth = Math.max(1, Math.floor(bounds.width || window.innerWidth))
    const nextHeight = Math.max(1, Math.floor(bounds.height || window.innerHeight))
    if (nextWidth === this.width && nextHeight === this.height) return
    this.width = nextWidth
    this.height = nextHeight
    this.camera.aspect = nextWidth / nextHeight
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(nextWidth, nextHeight, false)
    if (this.composer) {
      this.composer.setSize(nextWidth, nextHeight)
    }
  }

  private createComposer(): void {
    try {
      this.composer = this.buildComposer(
        this.renderer,
        this.camera,
        this.width,
        this.height,
        this.currentDpr,
      ).composer
      const passes = this.composer.passes
      this.bloomPass =
        (passes.find((pass) => pass instanceof UnrealBloomPass) as UnrealBloomPass | undefined) ?? null
      this.gradePass = (passes.find((pass) => pass instanceof ShaderPass) as ShaderPass | undefined) ?? null
    } catch (error) {
      console.warn('Nocturne: post-processing unavailable, rendering directly.', error)
      this.composer = null
      this.bloomPass = null
      this.gradePass = null
    }
  }

  private buildComposer(
    renderer: THREE.WebGLRenderer,
    camera: THREE.Camera,
    width: number,
    height: number,
    pixelRatio: number,
  ): ComposerBundle {
    const composer = new EffectComposer(renderer)
    const renderPass = new RenderPass(this.scene, camera)
    composer.addPass(renderPass)
    let bloomPass: UnrealBloomPass | null = null
    try {
      bloomPass = new UnrealBloomPass(
        new THREE.Vector2(width * pixelRatio, height * pixelRatio),
        this.visuals.bloom * this.currentTheme.bloom,
        0.46,
        0.72,
      )
      composer.addPass(bloomPass)
    } catch (error) {
      console.warn('Nocturne: bloom unavailable.', error)
    }
    const gradePass = new ShaderPass(gradeShader)
    gradePass.uniforms.uContrast.value = this.visuals.contrast
    gradePass.uniforms.uVignette.value = 0.22 + this.visuals.intensity * 0.07
    composer.addPass(gradePass)
    composer.addPass(new OutputPass())
    composer.setPixelRatio(pixelRatio)
    composer.setSize(width, height)
    return { composer, bloomPass, gradePass }
  }

  private createBackground(): THREE.ShaderMaterial {
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTop: { value: this.currentTheme.backgroundTop.clone() },
        uBottom: { value: this.currentTheme.backgroundBottom.clone() },
        uAccent: { value: this.currentTheme.backgroundAccent.clone() },
        uTime: { value: 0 },
        uVeil: { value: this.currentTheme.veil },
      },
      vertexShader: backgroundVertexShader,
      fragmentShader: backgroundFragmentShader,
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      toneMapped: false,
    })
    const geometry = new THREE.SphereGeometry(65, 48, 32)
    const mesh = new THREE.Mesh(geometry, material)
    mesh.renderOrder = -100
    mesh.frustumCulled = false
    this.scene.add(mesh)
    return material
  }

  private createOrb(): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uDistortion: { value: this.currentTheme.distortion },
        uAudio: { value: 0 },
        uMic: { value: 0 },
        uPulse: { value: 10 },
        uBreath: { value: 0 },
        uInner: { value: this.currentTheme.orbInner.clone() },
        uMid: { value: this.currentTheme.orbMid.clone() },
        uEdge: { value: this.currentTheme.orbEdge.clone() },
        uIntensity: { value: this.visuals.intensity },
        uContrast: { value: this.visuals.contrast },
        uOpacity: { value: 0.38 },
      },
      vertexShader: orbVertexShader,
      fragmentShader: orbFragmentShader,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: true,
    })
  }

  private createOrbMesh(): THREE.Mesh {
    const detail = window.innerWidth < 800 ? 4 : 5
    const geometry = new THREE.IcosahedronGeometry(1.24, detail)
    const mesh = new THREE.Mesh(geometry, this.orbMaterial)
    mesh.renderOrder = 2
    mesh.frustumCulled = false
    return mesh
  }

  private createAura(): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: this.currentTheme.orbEdge.clone() },
        uStrength: { value: 0.24 },
        uTime: { value: 0 },
      },
      vertexShader: auraVertexShader,
      fragmentShader: auraFragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      toneMapped: false,
    })
  }

  private createAuraMesh(): THREE.Mesh {
    const geometry = new THREE.SphereGeometry(1.58, 64, 44)
    const mesh = new THREE.Mesh(geometry, this.auraMaterial)
    mesh.renderOrder = 1
    mesh.frustumCulled = false
    return mesh
  }

  private createRings(): void {
    const configs = [
      { radius: 1.86, tiltX: 1.08, tiltY: 0.08, tiltZ: -0.14, factor: 0.75 },
      { radius: 2.18, tiltX: 1.33, tiltY: -0.12, tiltZ: 0.25, factor: 0.48 },
      { radius: 2.62, tiltX: 0.72, tiltY: 0.48, tiltZ: 0.6, factor: 0.32 },
      { radius: 3.18, tiltX: 1.16, tiltY: -0.32, tiltZ: -0.55, factor: 0.2 },
      { radius: 3.78, tiltX: 0.5, tiltY: 0.52, tiltZ: 0.18, factor: 0.12 },
    ]
    for (const config of configs) {
      const segments = 256
      const positions = new Float32Array((segments + 1) * 3)
      for (let index = 0; index <= segments; index += 1) {
        const angle = (index / segments) * Math.PI * 2
        positions[index * 3] = Math.cos(angle) * config.radius
        positions[index * 3 + 1] = Math.sin(angle) * config.radius
        positions[index * 3 + 2] = 0
      }
      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      const material = new THREE.LineBasicMaterial({
        color: this.currentTheme.ring.clone(),
        transparent: true,
        opacity: this.currentTheme.ringOpacity * config.factor,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      })
      const line = new THREE.LineLoop(geometry, material)
      line.rotation.set(config.tiltX, config.tiltY, config.tiltZ)
      line.userData.speed = 0.006 + (configs.indexOf(config) + 1) * 0.002
      this.ringGroup.add(line)
      this.ringLines.push({ line, factor: config.factor })
    }
  }

  private createParticles(): void {
    const layerConfigs = [
      { count: 900, seed: 4231, size: [1.1, 3.4], drift: 0.24, opacity: 0.72 },
      { count: 2500, seed: 9831, size: [0.7, 2.2], drift: 0.42, opacity: 0.52 },
      { count: 2600, seed: 3371, size: [0.4, 1.4], drift: 0.7, opacity: 0.38 },
    ]
    layerConfigs.forEach((config, layerIndex) => {
      const random = createRng(config.seed)
      const positions = new Float32Array(config.count * 3)
      const sizes = new Float32Array(config.count)
      const phases = new Float32Array(config.count)
      const seeds = new Float32Array(config.count)
      for (let index = 0; index < config.count; index += 1) {
        let x = 0
        let y = 0
        let z = 0
        if (layerIndex === 0) {
          const radius = 2.6 + Math.pow(random(), 0.6) * 4.8
          const theta = random() * Math.PI * 2
          const phi = Math.acos(2 * random() - 1)
          x = Math.sin(phi) * Math.cos(theta) * radius
          y = Math.sin(phi) * Math.sin(theta) * radius * 0.82
          z = Math.cos(phi) * radius * 0.8
        } else if (layerIndex === 1) {
          const radius = 5.5 + Math.pow(random(), 0.72) * 11
          const theta = random() * Math.PI * 2
          const phi = Math.acos(2 * random() - 1)
          x = Math.sin(phi) * Math.cos(theta) * radius
          y = Math.sin(phi) * Math.sin(theta) * radius * 0.9
          z = Math.cos(phi) * radius
        } else {
          const radius = 12 + Math.pow(random(), 0.7) * 23
          const theta = random() * Math.PI * 2
          const phi = Math.acos(2 * random() - 1)
          x = Math.sin(phi) * Math.cos(theta) * radius
          y = Math.sin(phi) * Math.sin(theta) * radius
          z = Math.cos(phi) * radius
        }
        positions[index * 3] = x
        positions[index * 3 + 1] = y
        positions[index * 3 + 2] = z
        sizes[index] =
          config.size[0] + Math.pow(random(), 1.7) * (config.size[1] - config.size[0])
        phases[index] = random() * Math.PI * 2
        seeds[index] = random()
      }
      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
      geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1))
      geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1))
      geometry.setDrawRange(0, config.count)
      const material = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uPixelRatio: { value: this.currentDpr },
          uAudio: { value: 0 },
          uMic: { value: 0 },
          uDrift: { value: config.drift },
          uColor: { value: this.currentTheme.particle.clone() },
          uOpacity: { value: config.opacity },
        },
        vertexShader: particleVertexShader,
        fragmentShader: particleFragmentShader,
        transparent: true,
        depthWrite: false,
        depthTest: true,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      })
      const points = new THREE.Points(geometry, material)
      points.frustumCulled = false
      points.renderOrder = layerIndex
      this.scene.add(points)
      this.particleLayers.push({
        points,
        material,
        baseCount: config.count,
        drift: config.drift,
        opacity: config.opacity,
      })
    })
  }

  private createShards(): void {
    const random = createRng(7142)
    for (let index = 0; index < 7; index += 1) {
      const mesh = new THREE.Mesh(this.shardGeometry, this.shardMaterial)
      const scale = 0.55 + random() * 0.85
      mesh.scale.setScalar(scale)
      mesh.renderOrder = 3
      this.scene.add(mesh)
      this.shards.push({
        mesh,
        radius: 2.2 + random() * 1.8,
        speed: 0.015 + random() * 0.025,
        phase: random() * Math.PI * 2,
        height: (random() - 0.5) * 1.7,
        tilt: (random() - 0.5) * 0.8,
        rpm: 0.1 + random() * 0.3,
      })
    }
  }

  private createWaves(): void {
    for (let index = 0; index < 6; index += 1) {
      const material = new THREE.ShaderMaterial({
        uniforms: {
          uColor: { value: this.currentTheme.orbEdge.clone() },
          uProgress: { value: 1 },
          uOpacity: { value: 0 },
          uSeed: { value: Math.random() },
        },
        vertexShader: waveVertexShader,
        fragmentShader: waveFragmentShader,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      })
      const mesh = new THREE.Mesh(this.waveGeometry, material)
      mesh.visible = false
      mesh.renderOrder = 8
      mesh.frustumCulled = false
      this.scene.add(mesh)
      this.waves.push({ mesh, material, start: -100, active: false, seed: material.uniforms.uSeed.value })
    }
  }

  private activateConsciousnessLayer(): void {
    if (this.consciousnessLayer) return
    try {
      this.consciousnessLayer = new ConsciousnessLayer(this.scene, this.visuals.reducedMotion)
      this.consciousnessLayer.setPixelRatio(this.currentDpr)
      const theme = this.currentTheme
      this.consciousnessLayer.setColors(theme.orbEdge, theme.ring, theme.particle, theme.halo)
    } catch (error) {
      console.warn('Nocturne: ConsciousnessLayer could not be created.', error)
      this.consciousnessLayer = null
    }
  }

  setTheme(theme: ThemeId): void {
    const config = THEMES[theme]
    const next = themeRuntime(config)
    const wasNotCosmos = this.currentThemeId !== 'cosmos'
    const isNowCosmos  = theme === 'cosmos'
    this.currentThemeId = theme

    // Activate or dispose the consciousness layer as needed.
    if (isNowCosmos && !this.consciousnessLayer) {
      this.activateConsciousnessLayer()
    } else if (!isNowCosmos && this.consciousnessLayer) {
      this.consciousnessLayer.dispose()
      this.consciousnessLayer = null
    }
    void wasNotCosmos

    this.targetTheme.backgroundTop.copy(next.backgroundTop)
    this.targetTheme.backgroundBottom.copy(next.backgroundBottom)
    this.targetTheme.backgroundAccent.copy(next.backgroundAccent)
    this.targetTheme.fog.copy(next.fog)
    this.targetTheme.orbInner.copy(next.orbInner)
    this.targetTheme.orbMid.copy(next.orbMid)
    this.targetTheme.orbEdge.copy(next.orbEdge)
    this.targetTheme.particle.copy(next.particle)
    this.targetTheme.ring.copy(next.ring)
    this.targetTheme.halo.copy(next.halo)
    this.targetTheme.shard.copy(next.shard)
    this.targetTheme.keyLight.copy(next.keyLight)
    this.targetTheme.fillLight.copy(next.fillLight)
    this.targetTheme.particleFactor = next.particleFactor
    this.targetTheme.ringOpacity = next.ringOpacity
    this.targetTheme.haloStrength = next.haloStrength
    this.targetTheme.distortion = next.distortion
    this.targetTheme.bloom = next.bloom
    this.targetTheme.veil = next.veil
  }

  setVisualSettings(settings: VisualSettings): void {
    const previous = this.visuals
    this.visuals = { ...settings }
    if (settings.quality !== previous.quality) {
      this.qualityMode = settings.quality
      this.activeTier =
        settings.quality === 'auto' ? this.chooseInitialTier() : settings.quality
      this.hasAutoDowngraded = false
      this.autoPerfElapsed = 0
      this.autoPerfFrames = 0
      this.applyQuality()
    }
    if (this.bloomPass) {
      this.bloomPass.strength = this.visuals.bloom * this.currentTheme.bloom
    }
    if (this.gradePass) {
      this.gradePass.uniforms.uContrast.value = this.visuals.contrast
      this.gradePass.uniforms.uVignette.value = 0.22 + this.visuals.intensity * 0.07
    }
    this.orbMaterial.uniforms.uContrast.value = this.visuals.contrast
    this.orbMaterial.uniforms.uIntensity.value = this.visuals.intensity
  }

  setPracticeState(mode: ExperienceMode, running: boolean, pattern: BreathPattern): void {
    const wasBreathing = this.mode === 'breath'
    if (mode === 'breath' && !wasBreathing) {
      this.phaseIndex = 0
      this.phaseElapsed = 0
      this.cycleCount = 0
      this.breathTarget = 0
      this.breathValue = 0
    }
    this.mode = mode
    this.breathRunning = mode === 'breath' && running
    this.breathPattern = { ...pattern }
    if (mode !== 'breath') {
      this.breathRunning = false
    }
  }

  resetBreathing(): void {
    this.phaseIndex = 0
    this.phaseElapsed = 0
    this.cycleCount = 0
    this.breathValue = 0
    this.breathTarget = 0
  }

  getBreathState(): BreathState {
    const enabled = this.mode === 'breath'
    const durations = this.phaseDurations()
    const phase = PHASE_ORDER[this.phaseIndex] ?? 'inhale'
    const duration = durations[phase]
    const phaseProgress = duration <= 0 ? 1 : clamp(this.phaseElapsed / duration, 0, 1)
    const completed = PHASE_ORDER.slice(0, this.phaseIndex).reduce(
      (sum, key) => sum + durations[key],
      0,
    )
    const cycleDuration = Math.max(0.1, durations.inhale + durations.hold + durations.exhale + durations.rest)
    return {
      enabled,
      running: enabled && this.breathRunning,
      phase,
      phaseProgress,
      cycleProgress: clamp((completed + this.phaseElapsed) / cycleDuration, 0, 1),
      phaseRemainingMs: Math.max(0, (duration - this.phaseElapsed) * 1000),
      cycleCount: this.cycleCount,
    }
  }

  private phaseDurations(): Record<BreathPhase, number> {
    return {
      inhale: Math.max(1, this.breathPattern.inhale),
      hold: Math.max(0, this.breathPattern.hold),
      exhale: Math.max(1, this.breathPattern.exhale),
      rest: Math.max(0, this.breathPattern.rest),
    }
  }

  setAnalyzers(output: AnalyserNode | null, microphone: AnalyserNode | null): void {
    this.outputAnalyser = output
    this.micAnalyser = microphone
    this.outputTimeData = null
    this.micTimeData = null
  }

  private readAnalyser(
    analyser: AnalyserNode | null,
    buffer: Uint8Array<ArrayBuffer> | null,
  ): { level: number; data: Uint8Array<ArrayBuffer> | null } {
    if (!analyser || analyser.context.state !== 'running') return { level: 0, data: buffer }
    const nextBuffer =
      buffer && buffer.length === analyser.fftSize ? buffer : new Uint8Array(analyser.fftSize)
    analyser.getByteTimeDomainData(nextBuffer)
    let sum = 0
    for (let index = 0; index < nextBuffer.length; index += 1) {
      const centered = (nextBuffer[index] - 128) / 128
      sum += centered * centered
    }
    return {
      level: clamp(Math.sqrt(sum / nextBuffer.length) * 5.8, 0, 1),
      data: nextBuffer,
    }
  }

  private updateBreathing(dt: number, elapsed: number): void {
    if (this.mode !== 'breath') {
      const slow = elapsed * (this.visuals.reducedMotion ? 0.14 : 0.22)
      const target = 0.46 + Math.sin(slow) * (this.visuals.reducedMotion ? 0.12 : 0.22)
      this.breathTarget = clamp(target, 0.2, 0.74)
      this.breathValue = damp(this.breathValue, this.breathTarget, 0.9, dt)
      return
    }

    const durations = this.phaseDurations()
    if (this.breathRunning) {
      this.phaseElapsed += dt
      let guard = 0
      while (this.phaseElapsed >= durations[PHASE_ORDER[this.phaseIndex]] && guard < 12) {
        guard += 1
        this.phaseElapsed -= durations[PHASE_ORDER[this.phaseIndex]]
        this.phaseIndex = (this.phaseIndex + 1) % PHASE_ORDER.length
        if (this.phaseIndex === 0) this.cycleCount += 1
        const nextPhase = PHASE_ORDER[this.phaseIndex]
        this.options.onBreathPhase?.(nextPhase, this.cycleCount)
        if (durations[nextPhase] <= 0) {
          continue
        }
      }
    }

    const phase = PHASE_ORDER[this.phaseIndex]
    const duration = durations[phase]
    const progress = duration <= 0 ? 1 : clamp(this.phaseElapsed / duration, 0, 1)
    if (phase === 'inhale') this.breathTarget = smoothstep(progress)
    else if (phase === 'hold') this.breathTarget = 1
    else if (phase === 'exhale') this.breathTarget = 1 - smoothstep(progress)
    else this.breathTarget = 0
    this.breathValue = damp(this.breathValue, this.breathTarget, this.breathRunning ? 4.2 : 2.4, dt)
  }

  private computeCameraDistance(aspect: number): number {
    const portraitScale = aspect < 1 ? Math.pow(1 / Math.max(0.4, aspect), 0.8) : 1
    const modeFactor = this.mode === 'breath' ? 0.95 : this.mode === 'binaural' ? 0.98 : 1
    const movementFactor = this.visuals.reducedMotion ? 0.96 : 1
    return clamp(5.2 * portraitScale * modeFactor * movementFactor, 4.8, 13)
  }

  private pointerTargetFromClient(clientX: number, clientY: number, width: number, height: number): void {
    this.pointer.set((clientX / width) * 2 - 1, -((clientY / height) * 2 - 1))
  }

  private triggerWave(): void {
    if (this.disposed) return
    const now = performance.now() * 0.001
    this.lastPulseTime = now
    this.clickFlash = 1
    const wave = this.waves.find((item) => !item.active) ?? this.waves[0]
    if (!wave) return
    wave.active = true
    wave.start = now
    wave.seed = Math.random()
    wave.mesh.visible = true
    wave.mesh.position.set(0, 0, 0.45)
    wave.mesh.scale.setScalar(this.mode === 'breath' ? 1.08 : 1)
    wave.material.uniforms.uSeed.value = wave.seed
    wave.material.uniforms.uOpacity.value = 0.48
  }

  resetView(): void {
    this.targetOrbitTheta = 0
    this.targetOrbitPhi = Math.PI / 2
    this.targetZoomOffset = 0
    this.velocityTheta = 0
    this.velocityPhi = 0
  }

  setAutoDrift(enabled: boolean): void {
    this.autoDrift = enabled
  }

  isAutoDriftEnabled(): boolean {
    return this.autoDrift
  }

  private updateCamera(dt: number): void {
    const aspect = this.width / this.height
    const reduced = this.visuals.reducedMotion

    // Pointer parallax
    const pointerStrength = reduced ? 0 : 0.22
    const pointerDamping = 1.8
    this.pointerCurrent.x = damp(this.pointerCurrent.x, this.pointer.x, pointerDamping, dt)
    this.pointerCurrent.y = damp(this.pointerCurrent.y, this.pointer.y, pointerDamping, dt)

    // Inertia decay
    this.velocityTheta = damp(this.velocityTheta, 0, 4.2, dt)
    this.velocityPhi = damp(this.velocityPhi, 0, 4.2, dt)
    this.targetOrbitTheta += this.velocityTheta * dt
    this.targetOrbitPhi = clamp(this.targetOrbitPhi + this.velocityPhi * dt, 0.22, Math.PI - 0.22)

    // Autonomous slow orbital drift when hands-free
    if (this.autoDrift && !this.isDraggingCamera) {
      const driftSpeed = reduced ? 0.008 : 0.022
      this.targetOrbitTheta += driftSpeed * dt
    }

    // Smooth spherical interpolation
    this.orbitTheta = damp(this.orbitTheta, this.targetOrbitTheta, 4.5, dt)
    this.orbitPhi = damp(this.orbitPhi, this.targetOrbitPhi, 4.5, dt)
    this.zoomOffset = damp(this.zoomOffset, this.targetZoomOffset, 3.8, dt)

    const baseDistance = this.computeCameraDistance(aspect)
    const currentDistance = clamp(baseDistance + this.zoomOffset, 3.2, 18)
    this.cameraDistance = currentDistance

    // Subtle parallax offset
    const parallaxX = this.pointerCurrent.x * pointerStrength
    const parallaxY = this.pointerCurrent.y * pointerStrength * 0.7

    // Spherical to Cartesian
    const sinPhi = Math.sin(this.orbitPhi)
    const cosPhi = Math.cos(this.orbitPhi)
    const sinTheta = Math.sin(this.orbitTheta)
    const cosTheta = Math.cos(this.orbitTheta)

    this.camera.position.x = currentDistance * sinPhi * sinTheta + parallaxX
    this.camera.position.y = currentDistance * cosPhi + parallaxY
    this.camera.position.z = currentDistance * sinPhi * cosTheta
    this.camera.lookAt(0, 0, 0)
  }

  private updateTheme(dt: number): void {
    const blend = 1 - Math.exp(-1.55 * dt)
    const current = this.currentTheme
    const target = this.targetTheme
    current.backgroundTop.lerp(target.backgroundTop, blend)
    current.backgroundBottom.lerp(target.backgroundBottom, blend)
    current.backgroundAccent.lerp(target.backgroundAccent, blend)
    current.fog.lerp(target.fog, blend)
    current.orbInner.lerp(target.orbInner, blend)
    current.orbMid.lerp(target.orbMid, blend)
    current.orbEdge.lerp(target.orbEdge, blend)
    current.particle.lerp(target.particle, blend)
    current.ring.lerp(target.ring, blend)
    current.halo.lerp(target.halo, blend)
    current.shard.lerp(target.shard, blend)
    current.keyLight.lerp(target.keyLight, blend)
    current.fillLight.lerp(target.fillLight, blend)
    current.particleFactor = damp(current.particleFactor, target.particleFactor, 1.4, dt)
    current.ringOpacity = damp(current.ringOpacity, target.ringOpacity, 1.4, dt)
    current.haloStrength = damp(current.haloStrength, target.haloStrength, 1.4, dt)
    current.distortion = damp(current.distortion, target.distortion, 1.4, dt)
    current.bloom = damp(current.bloom, target.bloom, 1.4, dt)
    current.veil = damp(current.veil, target.veil, 1.4, dt)
  }

  private applyThemeToScene(elapsed: number): void {
    const theme = this.currentTheme
    const visuals = this.visuals
    this.scene.fog = this.fog
    this.fog.color.copy(theme.fog)
    this.fog.density = 0.024 + theme.veil * 0.007
    this.renderer.setClearColor(theme.backgroundBottom, 1)

    const backgroundUniforms = this.backgroundMaterial.uniforms
    backgroundUniforms.uTop.value.copy(theme.backgroundTop)
    backgroundUniforms.uBottom.value.copy(theme.backgroundBottom)
    backgroundUniforms.uAccent.value.copy(theme.backgroundAccent)
    backgroundUniforms.uTime.value = elapsed
    backgroundUniforms.uVeil.value = theme.veil * (0.55 + visuals.intensity * 0.5)

    const orbUniforms = this.orbMaterial.uniforms
    orbUniforms.uTime.value = elapsed
    orbUniforms.uDistortion.value = theme.distortion * (0.58 + visuals.intensity * 0.7)
    orbUniforms.uIntensity.value = visuals.intensity
    orbUniforms.uContrast.value = visuals.contrast
    orbUniforms.uInner.value.copy(theme.orbInner)
    orbUniforms.uMid.value.copy(theme.orbMid)
    orbUniforms.uEdge.value.copy(theme.orbEdge)
    orbUniforms.uAudio.value = this.smoothedAudio
    orbUniforms.uMic.value = this.smoothedMic
    orbUniforms.uBreath.value = this.breathValue
    const pulseAge = performance.now() * 0.001 - this.lastPulseTime
    orbUniforms.uPulse.value = pulseAge > 0 && pulseAge < 3 ? pulseAge : 10

    const isCosmos = this.currentThemeId === 'cosmos'
    this.orb.scale.setScalar(isCosmos ? 0.32 : 1)
    this.aura.scale.setScalar(isCosmos ? 0.42 : 1)
    this.ringGroup.visible = !isCosmos

    const auraUniforms = this.auraMaterial.uniforms
    auraUniforms.uColor.value.copy(theme.orbEdge)
    auraUniforms.uStrength.value =
      0.22 + theme.haloStrength * 0.1 + this.smoothedAudio * 0.08
    auraUniforms.uTime.value = elapsed

    this.haloMaterial.color.copy(theme.halo)
    this.haloMaterial.opacity = 0.16 + theme.haloStrength * 0.15 + this.breathValue * 0.025
    this.halo.scale.setScalar(7.2 + this.breathValue * 0.8)
    this.mistMaterial.color.copy(theme.backgroundAccent)
    this.mistMaterial.opacity = 0.045 + theme.veil * 0.025
    this.mist.position.x = -2.2 + Math.sin(elapsed * 0.022) * 0.5
    this.mist.position.y = -1.3 + Math.cos(elapsed * 0.029) * 0.35

    this.keyLight.color.copy(theme.keyLight)
    this.fillLight.color.copy(theme.fillLight)
    this.ambientLight.color.copy(theme.fillLight)
    const lightLift = 1 + this.smoothedAudio * 0.8 + this.smoothedMic * 1.2 + this.clickFlash * 0.5
    this.keyLight.intensity = (2.15 + visuals.intensity * 0.5) * lightLift
    this.fillLight.intensity = 1.35 + theme.haloStrength * 0.35 + this.smoothedMic * 0.9
    this.ambientLight.intensity = 0.34 + visuals.intensity * 0.1

    this.shardMaterial.color.copy(theme.shard)
    this.shardMaterial.emissive.copy(theme.keyLight).multiplyScalar(0.12)
    this.shardMaterial.opacity = 0.34 + visuals.intensity * 0.2

    for (const ring of this.ringLines) {
      const material = ring.line.material as THREE.LineBasicMaterial
      material.color.copy(theme.ring)
      material.opacity =
        theme.ringOpacity * ring.factor * (0.58 + visuals.intensity * 0.58) * (1 + this.smoothedAudio * 0.22)
    }

    for (const layer of this.particleLayers) {
      layer.material.uniforms.uColor.value.copy(theme.particle)
      layer.material.uniforms.uAudio.value = this.smoothedAudio
      layer.material.uniforms.uMic.value = this.smoothedMic
      layer.material.uniforms.uOpacity.value =
        layer.opacity * (0.58 + visuals.intensity * 0.5) * (0.9 + this.smoothedAudio * 0.12)
    }

    for (const wave of this.waves) {
      wave.material.uniforms.uColor.value.copy(theme.orbEdge)
    }

    if (this.bloomPass) {
      this.bloomPass.strength =
        visuals.bloom * theme.bloom * (visuals.reducedMotion ? 0.84 : 1) * 0.9
      this.bloomPass.radius = 0.42
    }
    if (this.gradePass) {
      this.gradePass.uniforms.uContrast.value = visuals.contrast
      this.gradePass.uniforms.uVignette.value = 0.2 + visuals.intensity * 0.08
    }
  }

  private updateParticleDensity(): void {
    const tierFactor = QUALITY_DENSITY[this.activeTier]
    const countFactor = clamp(
      this.visuals.particleDensity *
        this.currentTheme.particleFactor *
        tierFactor *
        (this.visuals.reducedMotion ? 0.72 : 1),
      0.015,
      1,
    )
    for (const layer of this.particleLayers) {
      layer.points.geometry.setDrawRange(0, Math.floor(layer.baseCount * countFactor))
    }
  }

  private updateOrbit(elapsed: number, dt: number): void {
    const beat = this.lastBeat ?? 10
    const beatInfluence = clamp(0.65 + beat / 60, 0.65, 1.35)
    const speedScale = this.visuals.reducedMotion ? 0.25 : 1
    for (const ring of this.ringLines) {
      const lineSpeed = (ring.line.userData.speed as number) ?? 0.008
      ring.line.rotation.z += lineSpeed * dt * speedScale * beatInfluence
      ring.line.rotation.x += lineSpeed * 0.18 * dt * speedScale
    }
    this.ringGroup.rotation.y = Math.sin(elapsed * 0.026) * 0.17
    this.ringGroup.rotation.x = Math.cos(elapsed * 0.02) * 0.06
    const ringBreath = 1 + this.breathValue * 0.025
    this.ringGroup.scale.setScalar(ringBreath)

    const breathScale = 1 + this.breathValue * 0.075 + this.smoothedAudio * 0.012
    this.orbBreathGroup.scale.setScalar(breathScale)
    this.orb.rotation.y = elapsed * 0.028 * speedScale
    this.orb.rotation.x = Math.sin(elapsed * 0.021) * 0.11 * speedScale
    this.orbBreathGroup.rotation.z = Math.sin(elapsed * 0.017) * 0.035 * speedScale
    this.orbBreathGroup.position.y = Math.sin(elapsed * 0.04) * 0.035 * (this.visuals.reducedMotion ? 0.3 : 1)

    for (const layer of this.particleLayers) {
      layer.material.uniforms.uTime.value = elapsed
      layer.material.uniforms.uDrift.value = layer.drift * (this.visuals.reducedMotion ? 0.3 : 1)
    }

    for (const shard of this.shards) {
      shard.phase += shard.speed * dt * speedScale
      const x = Math.cos(shard.phase) * shard.radius
      const z = Math.sin(shard.phase) * shard.radius * 0.62
      const y = shard.height + Math.sin(shard.phase * 0.7) * 0.42
      shard.mesh.position.set(x, y, z)
      shard.mesh.rotation.x += dt * shard.rpm * speedScale
      shard.mesh.rotation.y += dt * (shard.rpm * 0.7 + shard.tilt) * speedScale
    }

    for (const wave of this.waves) {
      if (!wave.active) continue
      const age = elapsed - wave.start
      const progress = clamp(age / 2.9, 0, 1)
      wave.material.uniforms.uProgress.value = progress
      wave.material.uniforms.uOpacity.value = 0.5 * (1 - progress * 0.6)
      wave.mesh.quaternion.copy(this.camera.quaternion)
      if (progress >= 1) {
        wave.active = false
        wave.mesh.visible = false
      }
    }

    this.clickFlash = damp(this.clickFlash, 0, 3.2, dt)
  }

  setBinauralReadout(_carrier: number, beat: number): void {
    this.lastBeat = beat
  }

  private updateModes(dt: number): void {
    const output = this.readAnalyser(this.outputAnalyser, this.outputTimeData)
    this.outputTimeData = output.data
    const mic = this.readAnalyser(this.micAnalyser, this.micTimeData)
    this.micTimeData = mic.data
    this.smoothedAudio = damp(this.smoothedAudio, output.level, 6, dt)
    this.smoothedMic = damp(this.smoothedMic, mic.level, 7, dt)
  }

  private checkPerformance(dt: number): void {
    if (this.qualityMode !== 'auto' || this.hasAutoDowngraded) return
    // Ignore page start-up: shader compilation and the first texture uploads
    // are not representative of steady-state GPU capability.
    if (this.elapsed < 2.5) return
    this.autoPerfElapsed += dt
    this.autoPerfFrames += 1
    if (this.autoPerfElapsed < 2.5) return
    const fps = this.autoPerfFrames / this.autoPerfElapsed
    this.autoPerfElapsed = 0
    this.autoPerfFrames = 0
    if (fps < 36) {
      this.activeTier =
        this.activeTier === 'high' ? 'balanced' : this.activeTier === 'balanced' ? 'low' : 'low'
      this.hasAutoDowngraded = this.activeTier === 'low'
      this.applyQuality()
    }
  }

  private startLoop(): void {
    if (this.rafId || this.disposed) return
    this.lastFrame = performance.now()
    this.rafId = requestAnimationFrame(this.animate)
  }

  private animate = (now: number): void => {
    if (this.disposed) return
    this.rafId = requestAnimationFrame(this.animate)
    const realDelta = (now - this.lastFrame) / 1000
    this.lastFrame = now
    const dt = clamp(realDelta, 0.0001, 0.05)
    this.elapsed = (now - this.clockStart) / 1000

    // Include slow frames instead of silently ignoring them: the previous
    // <120 ms gate made adaptive quality unreachable on genuinely slow GPUs.
    // Skip only a very large gap, which usually means the tab was backgrounded.
    if (!document.hidden && realDelta < 2) this.checkPerformance(realDelta)
    this.updateModes(dt)
    this.updateBreathing(dt, this.elapsed)
    this.updateTheme(dt)
    this.updateCamera(dt)
    this.applyThemeToScene(this.elapsed)
    this.updateParticleDensity()
    this.updateOrbit(this.elapsed, dt)

    // Update consciousness layer for cosmos theme.
    if (this.consciousnessLayer) {
      const theme = this.currentTheme
      this.consciousnessLayer.setColors(
        theme.orbEdge,
        theme.ring,
        theme.particle,
        theme.halo,
      )
      this.consciousnessLayer.update(
        this.elapsed,
        dt,
        this.camera.position,
        this.visuals.reducedMotion,
      )
    }

    if (!this.contextLost && this.composer) {
      this.composer.render(dt)
    } else if (!this.contextLost) {
      this.renderer.render(this.scene, this.camera)
    }

    // Request frame times rarely land exactly on 1000/fps. A strict threshold
    // skipped two display frames whenever rAF jittered below 30 fps, silently
    // turning a 30 fps take into a 20–25 fps one. The small tolerance keeps the
    // cadence on the nearest display frame without exceeding the target.
    if (this.capture && now - this.capture.lastRender >= (1000 / this.capture.fps) * 0.9) {
      this.capture.lastRender = now
      this.renderCapture(now)
    }
  }

  private renderCapture(now: number): void {
    const capture = this.capture
    if (!capture) return
    try {
      const aspect = capture.width / capture.height
      const captureDistance = this.computeCameraDistance(aspect)
      const scalar = captureDistance / Math.max(0.01, this.camera.position.length())
      capture.camera.position.copy(this.camera.position).multiplyScalar(scalar)
      capture.camera.position.z = Math.max(capture.camera.position.z, 0.1)
      capture.camera.aspect = aspect
      capture.camera.fov = this.camera.fov
      capture.camera.up.copy(this.camera.up)
      capture.camera.lookAt(0, 0, 0)
      capture.camera.updateProjectionMatrix()

      if (capture.bloomPass) {
        capture.bloomPass.strength = this.visuals.bloom * this.currentTheme.bloom * 0.95
      }
      if (capture.gradePass) {
        capture.gradePass.uniforms.uContrast.value = this.visuals.contrast
        capture.gradePass.uniforms.uVignette.value = 0.2 + this.visuals.intensity * 0.08
      }
      if (capture.composer) {
        capture.composer.render(1 / capture.fps)
      } else {
        capture.renderer.render(this.scene, capture.camera)
      }

      if (capture.overlay) {
        this.drawCaptureOverlay(capture.overlay, now)
        capture.renderer.autoClear = false
        capture.renderer.clearDepth()
        capture.renderer.render(capture.overlay.scene, capture.overlay.camera)
        capture.renderer.autoClear = true
      }

      if (capture.manualTrack?.requestFrame) {
        capture.manualTrack.requestFrame()
      }
    } catch (error) {
      console.error('Nocturne: capture frame failed.', error)
      this.options.onCaptureError?.('The recording surface stopped rendering. End the recording to keep your file.')
    }
  }

  private drawCaptureOverlay(overlay: CaptureOverlay, now: number): void {
    if (now - overlay.lastDraw < 800) return
    overlay.lastDraw = now
    const telemetry = this.options.getCaptureTelemetry?.()
    const context = overlay.context
    const width = overlay.canvas.width
    const height = overlay.canvas.height
    context.clearRect(0, 0, width, height)
    if (!telemetry) return
    const margin = Math.round(Math.min(width, height) * 0.055)
    const sans = '"Manrope", "Helvetica Neue", Arial, sans-serif'
    const serif = '"Cormorant Garamond", Georgia, serif'
    const wordSize = Math.max(16, Math.round(height * 0.024))
    const microSize = Math.max(10, Math.round(height * 0.012))
    const bodySize = Math.max(11, Math.round(height * 0.014))

    context.save()
    context.textBaseline = 'middle'
    context.fillStyle = 'rgba(226, 236, 243, 0.82)'
    context.font = `400 ${wordSize}px ${serif}`
    context.fillText('NOCTURNE', margin, margin)
    context.strokeStyle = 'rgba(197, 218, 230, 0.3)'
    context.lineWidth = 1
    context.beginPath()
    context.moveTo(margin, margin + wordSize * 0.9)
    context.lineTo(margin + width * 0.09, margin + wordSize * 0.9)
    context.stroke()

    context.fillStyle = 'rgba(193, 212, 224, 0.55)'
    context.font = `500 ${microSize}px ${sans}`
    context.fillText(telemetry.theme.toUpperCase(), margin, height - margin - bodySize * 2.2)
    context.fillText(telemetry.mode.toUpperCase(), margin, height - margin - bodySize * 0.9)

    context.textAlign = 'right'
    context.font = `400 ${bodySize}px ${sans}`
    context.fillStyle = 'rgba(206, 222, 232, 0.64)'
    context.fillText(
      `L ${telemetry.leftHz.toFixed(1)} Hz   R ${telemetry.rightHz.toFixed(1)} Hz`,
      width - margin,
      height - margin - bodySize * 1.7,
    )
    context.fillStyle = 'rgba(164, 190, 205, 0.42)'
    context.font = `400 ${microSize}px ${sans}`
    context.fillText(
      `BINAURAL DIFFERENCE ${telemetry.beatHz.toFixed(1)} Hz`,
      width - margin,
      height - margin - bodySize * 0.4,
    )
    context.restore()
    overlay.texture.needsUpdate = true
  }

  private createCaptureOverlay(width: number, height: number): CaptureOverlay {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas 2D is unavailable for the capture overlay.')
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.minFilter = THREE.LinearFilter
    texture.magFilter = THREE.LinearFilter
    texture.generateMipmaps = false
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    })
    const geometry = new THREE.PlaneGeometry(2, 2)
    const mesh = new THREE.Mesh(geometry, material)
    const scene = new THREE.Scene()
    scene.add(mesh)
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 2)
    camera.position.z = 1
    return {
      scene,
      camera,
      mesh,
      material,
      texture,
      canvas,
      context,
      lastDraw: -10000,
    }
  }

  startCapture(config: CaptureConfig): CaptureHandle {
    if (this.capture) this.stopCapture()
    const { width, height } = getCaptureDimensions(config.aspect, config.resolution)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    canvas.style.cssText = `position:fixed;left:-10000px;top:0;width:${width}px;height:${height}px;opacity:0;pointer-events:none;`
    canvas.setAttribute('aria-hidden', 'true')
    document.body.appendChild(canvas)

    let renderer: THREE.WebGLRenderer | null = null
    let composer: EffectComposer | null = null
    let bloomPass: UnrealBloomPass | null = null
    let gradePass: ShaderPass | null = null
    let overlay: CaptureOverlay | null = null
    let stream: MediaStream | null = null
    let manualTrack: (MediaStreamTrack & { requestFrame?: () => void }) | null = null

    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: false,
        stencil: false,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: false,
      })
      renderer.setPixelRatio(1)
      renderer.setSize(width, height, false)
      renderer.outputColorSpace = THREE.SRGBColorSpace
      renderer.toneMapping = THREE.ACESFilmicToneMapping
      renderer.toneMappingExposure = 1.08
      renderer.setClearColor(this.currentTheme.backgroundBottom, 1)

      const captureCamera = this.camera.clone() as THREE.PerspectiveCamera
      captureCamera.aspect = width / height
      captureCamera.updateProjectionMatrix()

      // A capture renderer owns a separate WebGL context and therefore a
      // separate shader cache. Compile before the MediaRecorder clock starts so
      // first-take shader compilation cannot eat the opening seconds.
      renderer.compile(this.scene, captureCamera)

      try {
        const bundle = this.buildComposer(renderer, captureCamera, width, height, 1)
        composer = bundle.composer
        bloomPass = bundle.bloomPass
        gradePass = bundle.gradePass
      } catch (error) {
        console.warn('Nocturne: capture post-processing unavailable.', error)
        composer = null
      }

      if (config.includeOverlay) {
        overlay = this.createCaptureOverlay(width, height)
      }

      if (typeof canvas.captureStream !== 'function') {
        throw new Error('Canvas capture is not supported by this browser.')
      }

      const initialStream = canvas.captureStream(0)
      const initialTrack = initialStream.getVideoTracks()[0] as
        | (MediaStreamTrack & { requestFrame?: () => void })
        | undefined
      if (initialTrack && typeof initialTrack.requestFrame === 'function') {
        stream = initialStream
        manualTrack = initialTrack
      } else {
        initialTrack?.stop()
        initialStream.getTracks().forEach((track) => track.stop())
        stream = canvas.captureStream(config.fps)
        const fallbackTrack = stream.getVideoTracks()[0]
        if (!fallbackTrack) throw new Error('The browser did not create a video track for capture.')
      }

      this.capture = {
        renderer,
        composer,
        bloomPass,
        gradePass,
        camera: captureCamera,
        canvas,
        stream,
        manualTrack,
        width,
        height,
        fps: config.fps,
        lastRender: -1000,
        overlay,
      }
      // Ensure the first video frame exists before MediaRecorder is constructed.
      this.renderCapture(performance.now())
      const finalStream = stream
      return { canvas, stream: finalStream, dimensions: { width, height } }
    } catch (error) {
      stream?.getTracks().forEach((track) => track.stop())
      composer?.dispose()
      if (overlay) {
        overlay.texture.dispose()
        overlay.material.dispose()
        overlay.mesh.geometry.dispose()
      }
      renderer?.dispose()
      renderer?.forceContextLoss()
      canvas.remove()
      this.capture = null
      throw error
    }
  }

  stopCapture(): void {
    const capture = this.capture
    if (!capture) return
    this.capture = null
    capture.stream.getTracks().forEach((track) => track.stop())
    capture.stream = new MediaStream()
    if (capture.overlay) {
      capture.overlay.texture.dispose()
      capture.overlay.material.dispose()
      capture.overlay.mesh.geometry.dispose()
    }
    capture.composer?.dispose()
    capture.bloomPass?.dispose()
    capture.renderer.dispose()
    capture.renderer.forceContextLoss()
    capture.canvas.remove()
  }

  isCapturing(): boolean {
    return this.capture !== null
  }

  getCaptureSize(): { width: number; height: number } | null {
    return this.capture ? { width: this.capture.width, height: this.capture.height } : null
  }

  getBreathValue(): number {
    return this.breathValue
  }

  getSceneStats(): { drawCalls: number; triangles: number; width: number; height: number } {
    return {
      drawCalls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
      width: this.width,
      height: this.height,
    }
  }

  private clearScene(): void {
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Points || object instanceof THREE.Line) {
        object.geometry.dispose()
        const material = object.material
        if (Array.isArray(material)) {
          material.forEach((item) => item.dispose())
        } else {
          material.dispose()
        }
      }
    })
    this.haloMaterial.map?.dispose()
    this.mistMaterial.map?.dispose()
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.stopCapture()
    if (this.rafId) cancelAnimationFrame(this.rafId)
    this.rafId = 0
    window.removeEventListener('pointermove', this.handlePointerMove)
    window.removeEventListener('pointerup', this.handlePointerLeave)
    window.removeEventListener('resize', this.handleWindowResize)
    document.removeEventListener('pointerleave', this.handlePointerLeave)
    this.renderer.domElement.removeEventListener('webglcontextlost', this.handleContextLost)
    this.renderer.domElement.removeEventListener(
      'webglcontextrestored',
      this.handleContextRestored,
    )
    this.renderer.domElement.removeEventListener('pointerdown', this.handleCanvasPointerDown)
    window.removeEventListener('pointerup', this.handleCanvasPointerUp)
    this.renderer.domElement.removeEventListener('wheel', this.handleWheel)
    this.renderer.domElement.removeEventListener('touchstart', this.handleTouchStart)
    this.renderer.domElement.removeEventListener('touchmove', this.handleTouchMove)
    this.resizeObserver?.disconnect()
    this.composer?.dispose()
    this.bloomPass?.dispose()
    this.clearScene()
    this.consciousnessLayer?.dispose()
    this.consciousnessLayer = null
    this.renderer.dispose()
    this.renderer.domElement.remove()
    this.shardGeometry.dispose()
    this.shardMaterial.dispose()
    this.waveGeometry.dispose()
    this.haloMaterial.dispose()
    this.mistMaterial.dispose()
  }
}
