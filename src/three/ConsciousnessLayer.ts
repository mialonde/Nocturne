/**
 * ConsciousnessLayer — supplemental visual layer for the 6D Consciousness Simulator.
 *
 * Adds geometry to an existing THREE.Scene and must be disposed when the cosmos
 * theme is deactivated.
 *
 * The six "dimensions" are represented artistically as:
 *   1. Spatial depth        – layered translucent planes with parallax
 *   2. Temporal flow        – slow procedural deformation via time uniforms
 *   3. State transitions    – smooth lerp between 3 configuration presets
 *   4. Relational geometry  – faint edge threads between distant structure points
 *   5. Phase variation      – per-object colour / opacity oscillation offsets
 *   6. Observer interaction – parallax response to camera position
 */
import * as THREE from 'three'

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v))
}

function damp(current: number, target: number, lambda: number, dt: number): number {
  return THREE.MathUtils.lerp(current, target, 1 - Math.exp(-lambda * dt))
}

function smoothstep(t: number): number {
  const s = clamp(t, 0, 1)
  return s * s * (3 - 2 * s)
}

function createRng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s += 0x6d2b79f5
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ── Shaders ──────────────────────────────────────────────────────────────────

const membraneVert = /* glsl */ `
uniform float uTime;
uniform float uPhase;
uniform float uDeform;
varying vec2 vUv;
varying float vNoise;

float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float noise(vec2 p){vec2 i=floor(p);vec2 f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}

void main(){
  vUv=uv;
  vec2 flow=uv*2.8+vec2(uTime*0.023,-uTime*0.017);
  float n=noise(flow)*0.6+noise(flow*2.1+3.7)*0.3+noise(flow*4.5+11.0)*0.1;
  vNoise=n;
  vec3 pos=position;
  pos.z+=n*uDeform*sin(uTime*0.11+uPhase);
  pos.x+=noise(flow*1.6+5.0)*uDeform*0.3;
  pos.y+=noise(flow*1.8+9.0)*uDeform*0.25;
  gl_Position=projectionMatrix*modelViewMatrix*vec4(pos,1.0);
}
`

const membraneFrag = /* glsl */ `
uniform vec3 uColor;
uniform float uAlpha;
uniform float uTime;
uniform float uPhase;
uniform float uEdge;
varying vec2 vUv;
varying float vNoise;

void main(){
  vec2 c=vUv-0.5;
  float dist=length(c);
  float edge=smoothstep(0.48,0.18,dist);
  float fringe=smoothstep(0.48,0.46,dist)*(1.0-edge);
  float shimmer=0.82+0.18*sin(vNoise*6.28+uTime*0.34+uPhase);
  float alpha=edge*shimmer*uAlpha+fringe*uEdge*shimmer;
  gl_FragColor=vec4(uColor*shimmer,alpha);
}
`

const echoVert = /* glsl */ `
uniform float uTime;
uniform float uOffset;
varying vec2 vUv;

void main(){
  vUv=uv;
  vec3 pos=position;
  pos.z+=sin(uTime*0.07+uOffset)*0.15;
  gl_Position=projectionMatrix*modelViewMatrix*vec4(pos,1.0);
}
`

const echoFrag = /* glsl */ `
uniform vec3 uColor;
uniform float uAlpha;
uniform float uTime;
uniform float uOffset;
varying vec2 vUv;

void main(){
  vec2 c=vUv-0.5;
  float hex=max(abs(c.x*1.15),max(abs(c.x*0.6+c.y),abs(c.x*0.6-c.y)));
  float inner=smoothstep(0.46,0.30,hex);
  float ring=smoothstep(0.47,0.44,hex)*(1.0-inner);
  float pulse=0.6+0.4*sin(uTime*0.19+uOffset);
  gl_FragColor=vec4(uColor*pulse,(inner*0.06+ring*0.25)*uAlpha);
}
`

const threadVert = /* glsl */ `
attribute float aPhase;
uniform float uTime;
varying float vPhase;
varying float vProgress;

void main(){
  vPhase=aPhase;
  vProgress=position.x;
  gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
}
`

const threadFrag = /* glsl */ `
uniform vec3 uColor;
uniform float uAlpha;
uniform float uTime;
varying float vPhase;
varying float vProgress;

void main(){
  float ends=smoothstep(0.0,0.12,vProgress)*smoothstep(1.0,0.88,vProgress);
  float flicker=0.5+0.5*sin(uTime*0.28+vPhase*6.28);
  gl_FragColor=vec4(uColor,ends*flicker*uAlpha);
}
`

const partVert = /* glsl */ `
attribute float aPhase;
attribute float aSize;
uniform float uTime;
uniform float uPixelRatio;
varying float vAlpha;

void main(){
  vec3 pos=position;
  float t=uTime*0.04+aPhase;
  pos.x+=sin(t*1.3+aPhase)*0.22;
  pos.y+=cos(t*1.1+aPhase*0.7)*0.18;
  pos.z+=sin(t*0.9+aPhase*1.2)*0.14;
  gl_Position=projectionMatrix*modelViewMatrix*vec4(pos,1.0);
  float dist=length((modelViewMatrix*vec4(pos,1.0)).xyz);
  gl_PointSize=aSize*uPixelRatio*(220.0/max(dist,0.5));
  vAlpha=0.6+0.4*sin(uTime*0.22+aPhase);
}
`

const partFrag = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying float vAlpha;

void main(){
  vec2 uv=gl_PointCoord-0.5;
  float r=dot(uv,uv);
  if(r>0.25) discard;
  float alpha=smoothstep(0.25,0.05,r)*vAlpha*uOpacity;
  gl_FragColor=vec4(uColor,alpha);
}
`

const cageVert = /* glsl */ `
varying vec3 vNormal;
varying vec3 vViewDir;
uniform float uTime;

void main() {
  vNormal = normalize(normalMatrix * normal);
  vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
  vViewDir = normalize(-mvPos.xyz);
  gl_Position = projectionMatrix * mvPos;
}
`;

const cageFrag = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uEdgeColor;
uniform float uAlpha;
uniform float uTime;
varying vec3 vNormal;
varying vec3 vViewDir;

void main() {
  float fresnel = pow(1.0 - abs(dot(vNormal, vViewDir)), 2.5);
  float pulse = 0.85 + 0.15 * sin(uTime * 0.45);
  vec3 col = mix(uColor, uEdgeColor, fresnel * 0.85) * pulse;
  float alpha = (0.04 + fresnel * 0.38) * uAlpha * pulse;
  gl_FragColor = vec4(col, alpha);
}
`;

const tesseractEdgeVert = /* glsl */ `
uniform float uTime;
varying float vProg;

void main() {
  vProg = position.y;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const tesseractEdgeFrag = /* glsl */ `
uniform vec3 uColor;
uniform float uAlpha;
uniform float uTime;

void main() {
  float shimmer = 0.78 + 0.22 * sin(uTime * 0.52);
  gl_FragColor = vec4(uColor * shimmer, uAlpha * shimmer);
}
`;

const tesseractNodeVert = /* glsl */ `
uniform float uPixelRatio;
uniform float uTime;
varying float vShimmer;

void main() {
  vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPos;
  float dist = length(mvPos.xyz);
  gl_PointSize = uPixelRatio * (64.0 / max(dist, 0.8));
  vShimmer = 0.8 + 0.2 * sin(uTime * 0.75 + position.x * 2.0);
}
`;

const tesseractNodeFrag = /* glsl */ `
uniform vec3 uColor;
uniform float uAlpha;
varying float vShimmer;

void main() {
  vec2 coord = gl_PointCoord - 0.5;
  float r = dot(coord, coord);
  if (r > 0.25) discard;
  float core = smoothstep(0.25, 0.02, r);
  gl_FragColor = vec4(uColor * vShimmer * 1.25, core * uAlpha * vShimmer);
}
`;

// 4D hypercube vertex coordinates (16 vertices)
const TESSERACT_4D_VERTICES: [number, number, number, number][] = []
for (let i = 0; i < 16; i++) {
  TESSERACT_4D_VERTICES.push([
    (i & 1) ? 1 : -1,
    (i & 2) ? 1 : -1,
    (i & 4) ? 1 : -1,
    (i & 8) ? 1 : -1,
  ])
}

// 32 edges of a 4D hypercube
const TESSERACT_EDGES: [number, number][] = []
for (let i = 0; i < 16; i++) {
  for (let bit = 1; bit < 16; bit <<= 1) {
    const j = i ^ bit
    if (i < j) {
      TESSERACT_EDGES.push([i, j])
    }
  }
}

// ── Preset states for State Drift ────────────────────────────────────────────

interface DriftPreset {
  membraneScales: number[]
  membraneRotations: [number, number, number][]
  planePositions: [number, number, number][]
  connectionAlpha: number
  echoAlpha: number
}

const PRESETS: DriftPreset[] = [
  {
    membraneScales: [3.2, 2.4, 1.8, 4.0, 1.4],
    membraneRotations: [[0.0,0.0,0.0],[0.4,0.2,0.1],[0.9,-0.3,0.5],[-0.3,0.6,-0.2],[1.2,0.8,-0.4]],
    planePositions: [[0,0,-4],[-3,1.5,-7],[2.5,-1,-11],[-1.5,-2.5,-15],[1,2,-20]],
    connectionAlpha: 0.28, echoAlpha: 0.18,
  },
  {
    membraneScales: [2.6, 3.8, 2.2, 1.6, 3.0],
    membraneRotations: [[0.3,0.5,-0.1],[-0.2,0.8,0.3],[0.6,0.1,-0.6],[1.0,-0.4,0.7],[-0.5,0.3,0.9]],
    planePositions: [[0.5,-0.5,-5],[2.5,2,-8],[-2,0.5,-13],[1,-2,-17],[-1,1.5,-22]],
    connectionAlpha: 0.18, echoAlpha: 0.32,
  },
  {
    membraneScales: [4.2, 1.6, 3.0, 2.0, 2.8],
    membraneRotations: [[-0.2,0.3,0.6],[0.7,-0.5,-0.2],[0.2,0.9,0.4],[-0.6,0.1,1.1],[0.4,-0.7,0.3]],
    planePositions: [[-0.5,1,-3.5],[3,-1,-6],[-1.5,2,-10],[0.5,0.5,-14],[-2,-1,-18]],
    connectionAlpha: 0.38, echoAlpha: 0.10,
  },
]

// ── Object descriptors ────────────────────────────────────────────────────────

interface MembraneObj {
  mesh: THREE.Mesh
  mat: THREE.ShaderMaterial
  phase: number
  currentScale: number
  targetScale: number
  currentRot: THREE.Euler
  targetRot: THREE.Euler
  currentPos: THREE.Vector3
  targetPos: THREE.Vector3
}

interface EchoObj {
  mesh: THREE.Mesh
  mat: THREE.ShaderMaterial
  currentAlpha: number
  targetAlpha: number
}

interface ConnObj {
  line: THREE.Line
  mat: THREE.ShaderMaterial
  currentAlpha: number
  targetAlpha: number
  baseAlpha: number
}

interface PartSet {
  points: THREE.Points
  mat: THREE.ShaderMaterial
}

// ── Main class ────────────────────────────────────────────────────────────────

export class ConsciousnessLayer {
  private readonly scene: THREE.Scene
  private readonly group = new THREE.Group()
  private disposed = false

  // Geometry (shared, disposed in dispose())
  private readonly planeGeom: THREE.PlaneGeometry
  private readonly hexGeom: THREE.PlaneGeometry

  // Central Multidimensional Hyper-Cell (4D Tesseract + Translucent Cage)
  private readonly hypercellGroup = new THREE.Group()
  private tesseractEdgeGeom: THREE.BufferGeometry | null = null
  private tesseractEdgeMat: THREE.ShaderMaterial | null = null
  private tesseractNodeGeom: THREE.BufferGeometry | null = null
  private tesseractNodeMat: THREE.ShaderMaterial | null = null
  private cageGeom: THREE.IcosahedronGeometry | null = null
  private cageMat: THREE.ShaderMaterial | null = null
  private cageMesh: THREE.Mesh | null = null
  private edgePositions = new Float32Array(32 * 2 * 3)
  private nodePositions = new Float32Array(16 * 3)

  // Objects
  private readonly membranes: MembraneObj[] = []
  private readonly echoes: EchoObj[] = []
  private readonly connections: ConnObj[] = []
  private readonly parts: PartSet[] = []
  // Tracking per-connection geometries for disposal
  private readonly connGeoms: THREE.BufferGeometry[] = []

  // Drift state
  private driftTimer = 0
  private readonly driftInterval = 30
  private fromPreset = 0
  private toPreset   = 1
  private driftProg  = 0

  // Phase alignment
  private alignTimer = 0
  private readonly alignInterval = 55
  private alignActive = false
  private alignProg   = 0

  constructor(scene: THREE.Scene, reducedMotion: boolean) {
    this.scene = scene
    scene.add(this.group)

    this.planeGeom = new THREE.PlaneGeometry(1, 1, 48, 48)
    this.hexGeom   = new THREE.PlaneGeometry(1, 1, 6, 6)

    this.buildHyperCell()
    this.buildMembranes()
    this.buildEchoes()
    this.buildConnections()
    this.buildParticles(reducedMotion)
  }

  // ── Builders ──────────────────────────────────────────────────────────────

  private buildHyperCell(): void {
    // 4D Tesseract lines (32 edges)
    this.tesseractEdgeGeom = new THREE.BufferGeometry()
    this.tesseractEdgeGeom.setAttribute(
      'position',
      new THREE.BufferAttribute(this.edgePositions, 3),
    )
    this.tesseractEdgeMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color('#c8bfe8') },
        uAlpha: { value: 0.38 },
      },
      vertexShader: tesseractEdgeVert,
      fragmentShader: tesseractEdgeFrag,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    })
    const tesseractLines = new THREE.LineSegments(
      this.tesseractEdgeGeom,
      this.tesseractEdgeMat,
    )
    tesseractLines.renderOrder = 8
    tesseractLines.frustumCulled = false
    this.hypercellGroup.add(tesseractLines)

    // 4D Tesseract vertex nodes (16 vertices)
    this.tesseractNodeGeom = new THREE.BufferGeometry()
    this.tesseractNodeGeom.setAttribute(
      'position',
      new THREE.BufferAttribute(this.nodePositions, 3),
    )
    this.tesseractNodeMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: window.devicePixelRatio || 1 },
        uColor: { value: new THREE.Color('#e8e2ff') },
        uAlpha: { value: 0.65 },
      },
      vertexShader: tesseractNodeVert,
      fragmentShader: tesseractNodeFrag,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    })
    const tesseractNodes = new THREE.Points(
      this.tesseractNodeGeom,
      this.tesseractNodeMat,
    )
    tesseractNodes.renderOrder = 9
    tesseractNodes.frustumCulled = false
    this.hypercellGroup.add(tesseractNodes)

    // Outer translucent glass cage
    this.cageGeom = new THREE.IcosahedronGeometry(2.1, 1)
    this.cageMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color('#2a1f52') },
        uEdgeColor: { value: new THREE.Color('#c8bfe8') },
        uAlpha: { value: 0.42 },
      },
      vertexShader: cageVert,
      fragmentShader: cageFrag,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    })
    this.cageMesh = new THREE.Mesh(this.cageGeom, this.cageMat)
    this.cageMesh.renderOrder = 7
    this.cageMesh.frustumCulled = false
    this.hypercellGroup.add(this.cageMesh)

    this.group.add(this.hypercellGroup)
  }

  private buildMembranes(): void {
    const rng = createRng(3141)
    const preset = PRESETS[0]!
    for (let i = 0; i < 5; i++) {
      const phase  = rng() * Math.PI * 2
      const deform = 0.18 + rng() * 0.32
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          uTime:   { value: 0 },
          uPhase:  { value: phase },
          uDeform: { value: deform },
          uColor:  { value: new THREE.Color('#c8bfe8') },
          uAlpha:  { value: 0.10 + rng() * 0.12 },
          uEdge:   { value: 0.30 + rng() * 0.28 },
        },
        vertexShader:   membraneVert,
        fragmentShader: membraneFrag,
        transparent: true, depthWrite: false, depthTest: true,
        side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false,
      })
      const mesh = new THREE.Mesh(this.planeGeom, mat)
      mesh.renderOrder = 10 + i
      mesh.frustumCulled = false
      this.group.add(mesh)

      const r = preset.membraneRotations[i] ?? [0,0,0]
      const p = preset.planePositions[i]    ?? [0,0,-5]
      const s = preset.membraneScales[i]    ?? 2.5
      const curRot = new THREE.Euler(r[0], r[1], r[2])
      const curPos = new THREE.Vector3(p[0], p[1], p[2])
      mesh.scale.setScalar(s)
      mesh.rotation.copy(curRot)
      mesh.position.copy(curPos)

      this.membranes.push({
        mesh, mat, phase,
        currentScale: s, targetScale: s,
        currentRot: curRot.clone(), targetRot: curRot.clone(),
        currentPos: curPos.clone(), targetPos: curPos.clone(),
      })
    }
  }

  private buildEchoes(): void {
    const rng = createRng(2718)
    for (let i = 0; i < 6; i++) {
      const offset = rng() * Math.PI * 2
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          uTime:   { value: 0 },
          uOffset: { value: offset },
          uColor:  { value: new THREE.Color('#2a1f52') },
          uAlpha:  { value: 0.5 },
        },
        vertexShader: echoVert, fragmentShader: echoFrag,
        transparent: true, depthWrite: false, depthTest: false,
        side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false,
      })
      const mesh = new THREE.Mesh(this.hexGeom, mat)
      mesh.renderOrder = 5 + i
      mesh.frustumCulled = false
      const angle  = (i / 6) * Math.PI * 2
      const radius = 2.2 + rng() * 2.8
      const scale  = 1.6 + rng() * 2.4
      mesh.position.set(Math.cos(angle)*radius*0.9, Math.sin(angle)*radius*0.55, -2.5 - rng()*4)
      mesh.scale.setScalar(scale)
      mesh.rotation.z = angle
      this.group.add(mesh)
      this.echoes.push({ mesh, mat, currentAlpha: 0.5, targetAlpha: 0.18 })
    }
  }

  private buildConnections(): void {
    const rng = createRng(1618)
    const pts = Array.from({ length: 8 }, () => new THREE.Vector3(
      (rng()-0.5)*8, (rng()-0.5)*6, (rng()-0.5)*10-3,
    ))
    for (let i = 0; i < pts.length; i++) {
      const j = (i + 2 + Math.floor(rng()*3)) % pts.length
      const a = pts[i]!, b = pts[j]!
      const segs = 40
      const positions = new Float32Array((segs+1)*3)
      const phasesArr = new Float32Array(segs+1)
      for (let k = 0; k <= segs; k++) {
        const t = k / segs
        const mid = new THREE.Vector3().lerpVectors(a, b, t)
        mid.z += Math.sin(t * Math.PI) * (rng()-0.5) * 2.5
        positions[k*3]=mid.x; positions[k*3+1]=mid.y; positions[k*3+2]=mid.z
        phasesArr[k] = t
      }
      const geom = new THREE.BufferGeometry()
      geom.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      geom.setAttribute('aPhase',   new THREE.BufferAttribute(phasesArr, 1))
      this.connGeoms.push(geom)

      const baseAlpha = 0.10 + rng()*0.12
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          uTime:  { value: 0 },
          uColor: { value: new THREE.Color('#a8a0cc') },
          uAlpha: { value: baseAlpha },
        },
        vertexShader: threadVert, fragmentShader: threadFrag,
        transparent: true, depthWrite: false, depthTest: false,
        blending: THREE.AdditiveBlending, toneMapped: false,
      })
      const line = new THREE.Line(geom, mat)
      line.renderOrder = 4
      line.frustumCulled = false
      this.group.add(line)
      this.connections.push({ line, mat, currentAlpha: baseAlpha, targetAlpha: baseAlpha, baseAlpha })
    }
  }

  private buildParticles(reducedMotion: boolean): void {
    const configs = [
      { count: reducedMotion ? 120 : 360, seed: 1111, spread: 7,  opacity: 0.52, size: 1.8 },
      { count: reducedMotion ? 50  : 140, seed: 2222, spread: 14, opacity: 0.26, size: 3.2 },
    ]
    for (const cfg of configs) {
      const rng = createRng(cfg.seed)
      const positions = new Float32Array(cfg.count*3)
      const phasesArr = new Float32Array(cfg.count)
      const sizes     = new Float32Array(cfg.count)
      for (let i = 0; i < cfg.count; i++) {
        const theta = rng()*Math.PI*2
        const phi   = Math.acos(2*rng()-1)
        const r     = cfg.spread*(0.3+Math.pow(rng(), 0.7))
        positions[i*3]   = Math.sin(phi)*Math.cos(theta)*r
        positions[i*3+1] = Math.sin(phi)*Math.sin(theta)*r*0.65
        positions[i*3+2] = Math.cos(phi)*r
        phasesArr[i] = rng()*Math.PI*2
        sizes[i]     = cfg.size*(0.5+rng()*0.8)
      }
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          uTime:       { value: 0 },
          uColor:      { value: new THREE.Color('#a8a0cc') },
          uOpacity:    { value: cfg.opacity },
          uPixelRatio: { value: window.devicePixelRatio || 1 },
        },
        vertexShader: partVert, fragmentShader: partFrag,
        transparent: true, depthWrite: false, depthTest: true,
        blending: THREE.AdditiveBlending, toneMapped: false,
      })
      const geom = new THREE.BufferGeometry()
      geom.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      geom.setAttribute('aPhase',   new THREE.BufferAttribute(phasesArr, 1))
      geom.setAttribute('aSize',    new THREE.BufferAttribute(sizes, 1))
      const pts = new THREE.Points(geom, mat)
      pts.frustumCulled = false
      pts.renderOrder = 2
      this.group.add(pts)
      this.parts.push({ points: pts, mat })
    }
  }

  // ── Drift tick ────────────────────────────────────────────────────────────

  private tickDrift(dt: number): void {
    this.driftTimer += dt
    if (this.driftTimer >= this.driftInterval) {
      this.driftTimer = 0
      this.fromPreset = this.toPreset
      this.toPreset   = (this.toPreset + 1) % PRESETS.length
    }
    this.driftProg = clamp(this.driftTimer / this.driftInterval, 0, 1)
    const eased = smoothstep(this.driftProg)
    const from  = PRESETS[this.fromPreset]!
    const to    = PRESETS[this.toPreset]!

    for (let i = 0; i < this.membranes.length; i++) {
      const m  = this.membranes[i]!
      const sF = from.membraneScales[i]     ?? 2.5
      const sT = to.membraneScales[i]       ?? 2.5
      const rF = from.membraneRotations[i]  ?? [0,0,0]
      const rT = to.membraneRotations[i]    ?? [0,0,0]
      const pF = from.planePositions[i]     ?? [0,0,-5]
      const pT = to.planePositions[i]       ?? [0,0,-5]
      m.targetScale = THREE.MathUtils.lerp(sF, sT, eased)
      m.targetRot.set(
        THREE.MathUtils.lerp(rF[0], rT[0], eased),
        THREE.MathUtils.lerp(rF[1], rT[1], eased),
        THREE.MathUtils.lerp(rF[2], rT[2], eased),
      )
      m.targetPos.set(
        THREE.MathUtils.lerp(pF[0], pT[0], eased),
        THREE.MathUtils.lerp(pF[1], pT[1], eased),
        THREE.MathUtils.lerp(pF[2], pT[2], eased),
      )
    }
    const echoA = THREE.MathUtils.lerp(from.echoAlpha, to.echoAlpha, eased)
    for (const e of this.echoes) e.targetAlpha = echoA
    const connA = THREE.MathUtils.lerp(from.connectionAlpha, to.connectionAlpha, eased)
    for (const c of this.connections) c.targetAlpha = c.baseAlpha * (connA / 0.28)
  }

  private tickAlign(dt: number): void {
    this.alignTimer += dt
    if (this.alignTimer >= this.alignInterval) {
      this.alignTimer = 0
      this.alignActive = true
      this.alignProg = 0
    }
    if (!this.alignActive) return
    this.alignProg = clamp(this.alignProg + dt / 12, 0, 1)
    if (this.alignProg >= 1) { this.alignActive = false; return }
    const strength = smoothstep(this.alignProg) * (1 - smoothstep(this.alignProg))
    for (const m of this.membranes) {
      m.targetRot.x = THREE.MathUtils.lerp(m.targetRot.x, 0, strength * 0.38)
      m.targetRot.y = THREE.MathUtils.lerp(m.targetRot.y, 0, strength * 0.38)
    }
  }

  private updateHyperCell(elapsed: number, _dt: number, reducedMotion: boolean): void {
    if (!this.tesseractEdgeGeom || !this.tesseractNodeGeom || !this.cageMesh) return
    const speed = reducedMotion ? 0.35 : 1.0

    // Smoothly phase-aligned or independent 4D rotations
    let rate1 = 0.12 * speed
    let rate2 = 0.088 * speed
    let rate3 = 0.064 * speed

    if (this.alignActive) {
      // In phase alignment, rates harmonize
      const lockProg = smoothstep(this.alignProg) * (1 - smoothstep(this.alignProg))
      rate1 = THREE.MathUtils.lerp(rate1, 0.08 * speed, lockProg * 0.7)
      rate2 = THREE.MathUtils.lerp(rate2, 0.08 * speed, lockProg * 0.7)
      rate3 = THREE.MathUtils.lerp(rate3, 0.08 * speed, lockProg * 0.7)
    }

    const a1 = elapsed * rate1
    const a2 = elapsed * rate2
    const a3 = elapsed * rate3

    const cosA1 = Math.cos(a1), sinA1 = Math.sin(a1)
    const cosA2 = Math.cos(a2), sinA2 = Math.sin(a2)
    const cosA3 = Math.cos(a3), sinA3 = Math.sin(a3)

    const projected: [number, number, number][] = []
    const scale = 1.35

    for (let i = 0; i < 16; i++) {
      const [x0, y0, z0, w0] = TESSERACT_4D_VERTICES[i]!
      // XW plane rotation
      const x1 = x0 * cosA1 - w0 * sinA1
      const w1 = x0 * sinA1 + w0 * cosA1
      // YW plane rotation
      const y1 = y0 * cosA2 - w1 * sinA2
      const w2 = y0 * sinA2 + w1 * cosA2
      // ZW plane rotation
      const z1 = z0 * cosA3 - w2 * sinA3
      const w3 = z0 * sinA3 + w2 * cosA3

      const S = (1.45 / (2.6 - w3 * 0.68)) * scale
      projected.push([x1 * S, y1 * S, z1 * S])
    }

    // Update edge lines
    const posArr = this.edgePositions
    for (let e = 0; e < 32; e++) {
      const [i, j] = TESSERACT_EDGES[e]!
      const pA = projected[i]!
      const pB = projected[j]!
      const off = e * 6
      posArr[off + 0] = pA[0]
      posArr[off + 1] = pA[1]
      posArr[off + 2] = pA[2]
      posArr[off + 3] = pB[0]
      posArr[off + 4] = pB[1]
      posArr[off + 5] = pB[2]
    }
    const edgeAttr = this.tesseractEdgeGeom.getAttribute('position') as THREE.BufferAttribute
    edgeAttr.needsUpdate = true

    // Update nodes
    const nodeArr = this.nodePositions
    for (let i = 0; i < 16; i++) {
      const p = projected[i]!
      const off = i * 3
      nodeArr[off + 0] = p[0]
      nodeArr[off + 1] = p[1]
      nodeArr[off + 2] = p[2]
    }
    const nodeAttr = this.tesseractNodeGeom.getAttribute('position') as THREE.BufferAttribute
    nodeAttr.needsUpdate = true

    // Rotate outer cage
    const cageSpeed = reducedMotion ? 0.015 : 0.04
    this.cageMesh.rotation.x = elapsed * cageSpeed * 0.8
    this.cageMesh.rotation.y = elapsed * cageSpeed
    this.cageMesh.rotation.z = elapsed * cageSpeed * 0.6

    // Update time uniforms
    if (this.tesseractEdgeMat) this.tesseractEdgeMat.uniforms.uTime.value = elapsed
    if (this.tesseractNodeMat) this.tesseractNodeMat.uniforms.uTime.value = elapsed
    if (this.cageMat) this.cageMat.uniforms.uTime.value = elapsed
  }

  // ── Public API ────────────────────────────────────────────────────────────

  update(elapsed: number, dt: number, cameraPos: THREE.Vector3, reducedMotion: boolean): void {
    if (this.disposed) return
    const speed = reducedMotion ? 0.2 : 1
    this.tickDrift(dt * speed)
    this.tickAlign(dt * speed)
    this.updateHyperCell(elapsed, dt, reducedMotion)

    const px = cameraPos.x * 0.16
    const py = cameraPos.y * 0.12

    for (const m of this.membranes) {
      m.currentScale     = damp(m.currentScale, m.targetScale, 0.55, dt)
      m.currentRot.x     = damp(m.currentRot.x, m.targetRot.x, 0.42, dt)
      m.currentRot.y     = damp(m.currentRot.y, m.targetRot.y, 0.42, dt)
      m.currentRot.z     = damp(m.currentRot.z, m.targetRot.z, 0.42, dt)
      m.currentPos.x     = damp(m.currentPos.x, m.targetPos.x, 0.42, dt)
      m.currentPos.y     = damp(m.currentPos.y, m.targetPos.y, 0.42, dt)
      m.currentPos.z     = damp(m.currentPos.z, m.targetPos.z, 0.42, dt)
      m.mesh.scale.setScalar(m.currentScale)
      m.mesh.rotation.copy(m.currentRot)
      m.mesh.position.copy(m.currentPos)
      // Parallax
      const df = 1 / (1 + Math.abs(m.currentPos.z) * 0.04)
      m.mesh.position.x += px * df
      m.mesh.position.y += py * df
      m.mat.uniforms.uTime.value = elapsed
    }
    for (const e of this.echoes) {
      e.currentAlpha = damp(e.currentAlpha, e.targetAlpha, 0.6, dt)
      e.mat.uniforms.uAlpha.value = e.currentAlpha
      e.mat.uniforms.uTime.value  = elapsed
    }
    for (const c of this.connections) {
      c.currentAlpha = damp(c.currentAlpha, c.targetAlpha, 0.5, dt)
      c.mat.uniforms.uAlpha.value = c.currentAlpha
      c.mat.uniforms.uTime.value  = elapsed
    }
    for (const p of this.parts) {
      p.mat.uniforms.uTime.value = elapsed
    }
  }

  setColors(primary: THREE.Color, _secondary: THREE.Color, accent: THREE.Color, echo: THREE.Color): void {
    for (const m of this.membranes)   m.mat.uniforms.uColor.value.copy(primary)
    for (const e of this.echoes)      e.mat.uniforms.uColor.value.copy(echo)
    for (const c of this.connections) c.mat.uniforms.uColor.value.copy(accent)
    for (const p of this.parts)       p.mat.uniforms.uColor.value.copy(accent)
    if (this.tesseractEdgeMat) this.tesseractEdgeMat.uniforms.uColor.value.copy(accent)
    if (this.tesseractNodeMat) this.tesseractNodeMat.uniforms.uColor.value.copy(primary)
    if (this.cageMat) {
      this.cageMat.uniforms.uColor.value.copy(echo)
      this.cageMat.uniforms.uEdgeColor.value.copy(primary)
    }
  }

  setPixelRatio(dpr: number): void {
    for (const p of this.parts) p.mat.uniforms.uPixelRatio.value = dpr
    if (this.tesseractNodeMat) this.tesseractNodeMat.uniforms.uPixelRatio.value = dpr
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.scene.remove(this.group)
    // Membranes use shared planeGeom — only dispose materials
    for (const m of this.membranes) m.mat.dispose()
    this.planeGeom.dispose()
    // Echoes use shared hexGeom
    for (const e of this.echoes) e.mat.dispose()
    this.hexGeom.dispose()
    // Connections each own their geom
    for (const g of this.connGeoms) g.dispose()
    for (const c of this.connections) c.mat.dispose()
    // Particles own their geom
    for (const p of this.parts) {
      p.points.geometry.dispose()
      p.mat.dispose()
    }
    // Hypercell
    this.tesseractEdgeGeom?.dispose()
    this.tesseractEdgeMat?.dispose()
    this.tesseractNodeGeom?.dispose()
    this.tesseractNodeMat?.dispose()
    this.cageGeom?.dispose()
    this.cageMat?.dispose()
  }
}
