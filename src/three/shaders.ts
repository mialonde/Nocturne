const simplexNoise = /* glsl */ `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 10.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
    i.z + vec4(0.0, i1.z, i2.z, 1.0))
    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
    + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}
`

export const backgroundVertexShader = /* glsl */ `
varying vec3 vDirection;

void main() {
  vDirection = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

export const backgroundFragmentShader = /* glsl */ `
uniform vec3 uTop;
uniform vec3 uBottom;
uniform vec3 uAccent;
uniform float uTime;
uniform float uVeil;

varying vec3 vDirection;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float softNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
    mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x),
    f.y
  );
}

void main() {
  vec3 dir = normalize(vDirection);
  float height = smoothstep(-0.62, 0.82, dir.y);
  vec3 color = mix(uBottom, uTop, height);

  float horizon = exp(-pow((dir.y + 0.1) * 2.8, 2.0));
  float crown = exp(-pow(length(dir.xz) * 1.12, 2.0));
  color += uAccent * horizon * 0.12 * uVeil;
  color += uAccent * crown * 0.035 * uVeil;

  vec2 flow = dir.xz * 3.4 + vec2(uTime * 0.004, -uTime * 0.002);
  float mist = softNoise(flow) * 0.55 + softNoise(flow * 2.3 + 17.0) * 0.25;
  color += uAccent * mist * 0.022;
  color += (hash21(gl_FragCoord.xy + uTime * 0.1) - 0.5) * 0.004;

  gl_FragColor = vec4(color, 1.0);
}
`

export const orbVertexShader = /* glsl */ `
uniform float uTime;
uniform float uDistortion;
uniform float uAudio;
uniform float uMic;
uniform float uPulse;
uniform float uBreath;

varying vec3 vNormalW;
varying vec3 vWorld;
varying vec3 vView;
varying float vNoise;
varying float vPulse;

${simplexNoise}

void main() {
  vec3 pos = position;
  float slow = uTime * 0.06;
  float n1 = snoise(pos * 1.7 + vec3(slow, -slow * 0.72, slow * 0.36));
  float n2 = snoise(pos * 3.45 + vec3(-slow * 0.8, slow * 0.94, slow * 0.5));
  float noise = n1 * 0.7 + n2 * 0.3;

  float pulseAge = max(0.0, uPulse);
  float ripple = sin(length(pos.xy) * 7.0 - pulseAge * 6.2) *
    exp(-pulseAge * 2.1) * 0.042;

  float micMotion = snoise(pos * 2.4 + vec3(uTime * 0.14)) * uMic * 0.075;
  float audioMotion = snoise(pos * 3.8 - vec3(uTime * 0.19)) * uAudio * 0.03;

  vec3 displaced = pos * (1.0 + noise * uDistortion + uBreath * 0.045 + ripple + micMotion + audioMotion);

  vec3 n = normalize(normal);
  vec3 helper = abs(n.y) < 0.96 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
  vec3 tangent = normalize(cross(n, helper));
  vec3 bitangent = normalize(cross(n, tangent));
  float nearbyA = snoise((pos + tangent * 0.055) * 2.8 + vec3(slow * 1.2));
  float nearbyB = snoise((pos + bitangent * 0.055) * 2.8 + vec3(slow * 1.2));
  vec3 perturbed = normalize(n - tangent * (nearbyA - noise) * 1.65 - bitangent * (nearbyB - noise) * 1.65);

  vec4 world = modelMatrix * vec4(displaced, 1.0);
  vWorld = world.xyz;
  vNormalW = normalize(mat3(modelMatrix) * perturbed);
  vView = normalize(cameraPosition - world.xyz);
  vNoise = noise;
  vPulse = ripple * 18.0;

  gl_Position = projectionMatrix * viewMatrix * world;
}
`

export const orbFragmentShader = /* glsl */ `
uniform vec3 uInner;
uniform vec3 uMid;
uniform vec3 uEdge;
uniform float uTime;
uniform float uIntensity;
uniform float uAudio;
uniform float uMic;
uniform float uContrast;
uniform float uOpacity;

varying vec3 vNormalW;
varying vec3 vWorld;
varying vec3 vView;
varying float vNoise;
varying float vPulse;

void main() {
  vec3 normal = normalize(vNormalW);
  vec3 viewDir = normalize(vView);
  float facing = abs(dot(normal, viewDir));
  float fresnel = pow(1.0 - facing, 2.3);

  float body = smoothstep(-0.78, 0.72, vNoise);
  vec3 color = mix(uInner, uMid, body);
  color = mix(color, uEdge, pow(fresnel, 1.15) * 0.82);

  float shimmer = pow(max(0.0, vNoise), 2.1);
  color += uEdge * shimmer * 0.13 * uIntensity;

  vec3 halfDir = normalize(viewDir + vec3(0.35, 0.45, 0.8));
  float specular = pow(max(0.0, dot(normal, halfDir)), 28.0);
  color += uEdge * specular * 0.24;

  float innerVeil = smoothstep(0.1, 0.95, body) * (0.06 + uAudio * 0.1 + uMic * 0.08);
  color += uMid * innerVeil;
  color += uEdge * max(0.0, vPulse) * 0.09;

  float alpha = clamp(
    uOpacity + fresnel * 0.38 + shimmer * 0.045 + uAudio * 0.025,
    0.0,
    0.94
  );

  color = (color - 0.015) * uContrast + 0.015;
  gl_FragColor = vec4(color, alpha);
}
`

export const auraVertexShader = /* glsl */ `
varying vec3 vNormalW;
varying vec3 vWorld;

void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`

export const auraFragmentShader = /* glsl */ `
uniform vec3 uColor;
uniform float uStrength;
uniform float uTime;

varying vec3 vNormalW;
varying vec3 vWorld;

void main() {
  vec3 normal = normalize(vNormalW);
  vec3 viewDir = normalize(cameraPosition - vWorld);
  float rim = pow(1.0 - abs(dot(normal, viewDir)), 2.8);
  float breathe = 0.9 + 0.1 * sin(uTime * 0.21);
  float alpha = rim * uStrength * breathe;
  gl_FragColor = vec4(uColor, clamp(alpha, 0.0, 0.5));
}
`

export const particleVertexShader = /* glsl */ `
uniform float uTime;
uniform float uPixelRatio;
uniform float uAudio;
uniform float uMic;
uniform float uDrift;

attribute float aSize;
attribute float aPhase;
attribute float aSeed;

varying float vAlpha;
varying float vTint;

void main() {
  vec3 pos = position;
  float drift = uDrift * (0.35 + aSeed * 0.85);
  pos.x += sin(uTime * 0.042 + aPhase) * drift;
  pos.y += cos(uTime * 0.033 + aPhase * 1.7) * drift * 0.74;
  pos.z += sin(uTime * 0.027 + aPhase * 0.7) * drift * 0.58;
  pos.y += uAudio * sin(uTime * 0.2 + aSeed * 6.283) * 0.055;
  pos.x += uMic * sin(uTime * 1.25 + aPhase * 7.0) * 0.15;
  pos.z += uMic * cos(uTime * 0.9 + aPhase * 3.0) * 0.08;

  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;

  float distanceFade = mix(0.16, 1.0, smoothstep(42.0, 5.0, -mv.z));
  gl_PointSize = aSize * uPixelRatio * (240.0 / max(1.0, -mv.z));
  vAlpha = distanceFade * (0.32 + 0.68 * aSeed);
  vTint = aSeed;
}
`

export const particleFragmentShader = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;

varying float vAlpha;
varying float vTint;

void main() {
  vec2 point = gl_PointCoord - 0.5;
  float distanceToCenter = length(point);
  if (distanceToCenter > 0.5) discard;
  float glow = smoothstep(0.5, 0.02, distanceToCenter);
  glow = pow(glow, 2.1);
  float core = smoothstep(0.18, 0.0, distanceToCenter);
  vec3 color = uColor * (0.6 + core * 1.25);
  gl_FragColor = vec4(color, glow * uOpacity * vAlpha * (0.55 + vTint * 0.45));
}
`

export const waveVertexShader = /* glsl */ `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

export const waveFragmentShader = /* glsl */ `
uniform vec3 uColor;
uniform float uProgress;
uniform float uOpacity;
uniform float uSeed;

varying vec2 vUv;

void main() {
  vec2 point = vUv * 2.0 - 1.0;
  float radius = length(point);
  if (radius > 1.0) discard;

  float normalizedProgress = clamp(uProgress, 0.0, 1.0);
  float eased = 1.0 - pow(1.0 - normalizedProgress, 3.0);
  float ringRadius = mix(0.1, 0.94, eased);
  float distanceToRing = abs(radius - ringRadius);
  float lineWidth = mix(0.012, 0.003, normalizedProgress);
  float line = smoothstep(lineWidth, 0.0, distanceToRing);
  float halo = exp(-distanceToRing * 24.0) * 0.15;

  float angle = atan(point.y, point.x);
  float ragged = 0.68 + 0.32 * sin(angle * 7.0 + uSeed * 12.0 + radius * 22.0);
  float edgeFade = smoothstep(1.0, 0.42, radius);
  float fade = (1.0 - smoothstep(0.62, 1.0, normalizedProgress));
  float alpha = (line * ragged + halo) * edgeFade * fade * uOpacity;

  if (alpha < 0.002) discard;
  gl_FragColor = vec4(uColor, alpha);
}
`

export const gradeShader = {
  uniforms: {
    tDiffuse: { value: null as null },
    uContrast: { value: 1.02 },
    uVignette: { value: 0.26 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uContrast;
    uniform float uVignette;
    varying vec2 vUv;

    void main() {
      vec4 texel = texture2D(tDiffuse, vUv);
      vec3 color = (texel.rgb - 0.18) * uContrast + 0.18;
      float distanceToCenter = distance(vUv, vec2(0.5));
      color *= 1.0 - smoothstep(0.34, 0.88, distanceToCenter) * uVignette;
      gl_FragColor = vec4(max(color, 0.0), texel.a);
    }
  `,
}
