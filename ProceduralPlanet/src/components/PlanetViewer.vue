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

float noise3(vec3 p, float seed){
  p += seed;
  return sin(dot(p, vec3(12.9898,78.233,37.719)));
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
  p += seed;
  return sin(dot(p, vec3(12.9898,78.233,37.719)));
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
  //planet.rotation.y += delta * params.rotationSpeed;

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
