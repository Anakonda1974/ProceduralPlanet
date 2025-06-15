<template>
  <div ref="container" class="viewer"></div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GUI } from 'dat.gui';

const container = ref(null);

let renderer, scene, camera, controls, material, animationId, gui, planet;
let lastTime = 0;


const params = {
  seed: 1,
  noiseOctaves: 5,
  lacunarity: 2.0,
  gain: 0.5,
  elevationScale: 0.3,
  noiseFreq: 5.0,

  oceanLevel: -0.05,
  oceanColor: '#0044aa',
  landColorLow: '#237d3d',
  landColorHigh: '#cba560',
  snowHeight: 0.7,
  rotationSpeed: 0.2,
  dayCycle: 1.0,
  lodEnabled: false,
  baseResolution: 256,
  atmosphere: false,
  cityMarkers: false,
  wireframe: false
};

let currentResolution = params.baseResolution;

// simple deterministic seed derivation
function mulberry32(a) {
  return function () {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function deriveSeed(base, offset) {
  const rng = mulberry32(base + offset * 0x9e3779b9);
  return Math.floor(rng() * 1e9);
}

let terrainSeed = deriveSeed(params.seed, 1);
let tempSeed = deriveSeed(params.seed, 2);
let moistSeed = deriveSeed(params.seed, 3);

const vertexShader = `
uniform float uTime;
uniform float uElevationScale;
uniform float uNoiseFreq;
uniform float uTerrainSeed;
uniform float uTempSeed;
uniform float uMoistSeed;
uniform float uLacunarity;
uniform float uGain;
uniform float uNoiseOctaves;
varying vec3 vPos;
varying float vElevation;

// Simplex noise implementation adapted from
// https://github.com/ashima/webgl-noise
vec3 mod289(vec3 x){
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}
vec4 mod289(vec4 x){
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}
vec4 permute(vec4 x){
  return mod289(((x * 34.0) + 1.0) * x);
}
vec4 taylorInvSqrt(vec4 r){
  return 1.79284291400159 - 0.85373472095314 * r;
}
float snoise(vec3 v){
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);

  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;

  i = mod289(i);
  vec4 p = permute( permute( permute(
                i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
              + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
              + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

  float n_ = 1.0 / 7.0;
  vec3  ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);

  vec4 x = x_ * ns.x + ns.y;
  vec4 y = y_ * ns.x + ns.y;
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

  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;

  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1),
                                dot(p2,x2), dot(p3,x3) ) );
}

float noise3(vec3 p, float seed){
  return snoise(p + seed);
}

float fbm(vec3 p, float seed){
  float value = 0.0;
  float amp = 1.0;
  for(int i = 0; i < 8; i++){
    if(float(i) >= uNoiseOctaves) break;
    value += amp * noise3(p, seed + float(i));
    p *= uLacunarity;
    amp *= uGain;
  }
  return value;
}

float ffbm(vec3 p, float seed){
  float value = 0.0;
  float amp = 0.5;
  for(int i = 0; i < 8; i++){
    if(float(i) >= uNoiseOctaves) break;
    value += amp * abs(noise3(p, seed + float(i)));
    p *= uLacunarity;
    amp *= uGain;
  }
  return value;
}


void main(){
  vec3 nPos = normalize(position);
  float elevation = ffbm(nPos * uNoiseFreq + uTime * 0.1, uTerrainSeed) * 2.0 - 1.0;
  vPos = nPos;
  vElevation = elevation;
  vec3 displaced = nPos * (1.0 + elevation * uElevationScale);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
}
`;

const fragmentShader = `
varying vec3 vPos;
varying float vElevation;
uniform float uTime;
uniform float uOceanLevel;
uniform float uTempSeed;
uniform float uMoistSeed;
uniform float uLacunarity;
uniform float uGain;
uniform float uNoiseOctaves;

float noise3(vec3 p, float seed){
  return snoise(p + seed);
}

float fbm(vec3 p, float seed){
  float value = 0.0;
  float amp = 1.0;
  for(int i = 0; i < 8; i++){
    if(float(i) >= uNoiseOctaves) break;
    value += amp * noise3(p, seed + float(i));
    p *= uLacunarity;
    amp *= uGain;
  }
  return value;
}

vec3 getBiomeColor(float temp, float moist){
  if(temp < 0.3){
    if(moist < 0.3) return vec3(0.8,0.8,0.9);
    return vec3(0.6,0.7,0.8);
  }
  if(temp < 0.6){
    if(moist < 0.3) return vec3(0.8,0.8,0.5);
    return vec3(0.1,0.6,0.2);
  }
  if(moist < 0.5) return vec3(0.9,0.8,0.4);
  return vec3(0.2,0.7,0.3);
}
uniform vec3 uOceanColor;
uniform vec3 uLandColorLow;
uniform vec3 uLandColorHigh;
uniform float uSnowHeight;

void main(){
  float temp = clamp((vPos.y + 1.0) / 2.0 + fbm(vPos * 2.0 + uTime * 0.1, uTempSeed) * 0.5, 0.0, 1.0);
  float moist = clamp(0.5 + fbm(vPos * 2.0 + uTime * 0.1, uMoistSeed) * 0.5, 0.0, 1.0);
   vec3 color = getBiomeColor(temp, moist);
  if(vElevation < uOceanLevel) color = vec3(0.0, 0.3, 0.8);
   color = mix(uLandColorLow, uLandColorHigh, clamp(vElevation * 0.5 + 0.5, 0.0, 1.0));
  if(vElevation < uOceanLevel) color = uOceanColor;
  if(vElevation > uSnowHeight) color = vec3(1.0);
  gl_FragColor = vec4(color, 1.0);
}
`;

function init() {
  const width = container.value.clientWidth;
  const height = container.value.clientHeight;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 100);
  camera.position.set(0,0,3);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(width, height);
  container.value.appendChild(renderer.domElement);

  
  const geometry = new THREE.SphereGeometry(1, params.baseResolution, params.baseResolution);

  material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uElevationScale: { value: params.elevationScale },
      uNoiseFreq: { value: params.noiseFreq },
      uOceanLevel: { value: params.oceanLevel },
      uTerrainSeed: { value: terrainSeed },
      uTempSeed: { value: tempSeed },
      uMoistSeed: { value: moistSeed },
      uLacunarity: { value: params.lacunarity },
      uGain: { value: params.gain },
      uNoiseOctaves: { value: params.noiseOctaves },
      uOceanColor: { value: new THREE.Color(params.oceanColor) },
      uLandColorLow: { value: new THREE.Color(params.landColorLow) },
      uLandColorHigh: { value: new THREE.Color(params.landColorHigh) },
      uSnowHeight: { value: params.snowHeight }
    }
  });
  material.wireframe = params.wireframe;

  planet = new THREE.Mesh(geometry, material);
  scene.add(planet);
  updateSeeds(params.seed);

  gui = new GUI();
  gui.add(params, 'seed', 1, 999, 1).onChange(v => updateSeeds(v));
  gui.add(params, 'noiseOctaves', 1, 8, 1).onChange(v => material.uniforms.uNoiseOctaves.value = v);
  gui.add(params, 'lacunarity', 1, 4).onChange(v => material.uniforms.uLacunarity.value = v);
  gui.add(params, 'gain', 0.1, 1).onChange(v => material.uniforms.uGain.value = v);
  gui.add(params, 'elevationScale', 0, 0.5).onChange(v => material.uniforms.uElevationScale.value = v);
  gui.add(params, 'noiseFreq', 1, 10).onChange(v => material.uniforms.uNoiseFreq.value = v);
  gui.add(params, 'oceanLevel', -0.2, 0.2).onChange(v => material.uniforms.uOceanLevel.value = v);
  gui.addColor(params, 'oceanColor').onChange(v => material.uniforms.uOceanColor.value.set(v));
  gui.addColor(params, 'landColorLow').onChange(v => material.uniforms.uLandColorLow.value.set(v));
  gui.addColor(params, 'landColorHigh').onChange(v => material.uniforms.uLandColorHigh.value.set(v));
  gui.add(params, 'snowHeight', 0, 1).onChange(v => material.uniforms.uSnowHeight.value = v);
  gui.add(params, 'rotationSpeed', 0, 2);
  gui.add(params, 'dayCycle', 0, 5);
  gui.add(params, 'lodEnabled');
  gui.add(params, 'baseResolution', 16, 512, 1).onChange(updateResolution);
  gui.add(params, 'atmosphere');
  gui.add(params, 'cityMarkers');
  gui.add(params, 'wireframe').onChange(v => material.wireframe = v);

  controls = new OrbitControls(camera, renderer.domElement);
  window.addEventListener('resize', onResize);
  animate(0);
}

function onResize() {
  if(!container.value) return;
  const width = container.value.clientWidth;
  const height = container.value.clientHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}

function updateResolution(v){
  currentResolution = v;
  const newGeo = new THREE.SphereGeometry(1, v, v);
  planet.geometry.dispose();
  planet.geometry = newGeo;
}

function updateSeeds(base){
  terrainSeed = deriveSeed(base, 1);
  tempSeed = deriveSeed(base, 2);
  moistSeed = deriveSeed(base, 3);
  material.uniforms.uTerrainSeed.value = terrainSeed;
  material.uniforms.uTempSeed.value = tempSeed;
  material.uniforms.uMoistSeed.value = moistSeed;
}

function animate(time){
  material.uniforms.uTime.value = time * 0.001;
  const delta = (time - lastTime) * 0.001;
  lastTime = time;
  material.uniforms.uTime.value += delta * params.dayCycle;
  planet.rotation.y += delta * params.rotationSpeed;

  if(params.lodEnabled){
    const dist = camera.position.length();
    let target = params.baseResolution;
    if(dist < 1.5) target = params.baseResolution * 2;
    if(target !== currentResolution){
      updateResolution(target);
    }
  }
  controls.update();
  renderer.render(scene, camera);
  animationId = requestAnimationFrame(animate);
}

onMounted(init);

onBeforeUnmount(() => {
  cancelAnimationFrame(animationId);
  window.removeEventListener('resize', onResize);
  renderer.dispose();
  gui?.destroy();
});
</script>

<style scoped>
.viewer {
  width: 1000px;
  height: 100vh;
  overflow: hidden;
}
canvas { display: block; }
</style>
