<template>
  <div ref="container" class="viewer"></div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GUI } from 'dat.gui';
import noise from '../noise.js'; // Assuming you have a noise library for procedural generation

// --- PARAMETERS ---
const container = ref(null);
let renderer, scene, camera, controls, planet, gui, animationId;
let material;
let atmosphereMesh = null;
let cityMarkersGroup = null;
let lastTime = 0;

// Main parameter set
const params = {
  seed: 42,
  noiseOctaves: 5,
  lacunarity: 2.0,
  gain: 0.5,
  elevationScale: 0.3,
  noiseFreq: 5.0,
  oceanLevel: 0.98,        // (Radius, not Y!) Base = 1.0
  oceanColor: '#0044aa',
  landColorLow: '#237d3d',
  landColorHigh: '#cba560',
  snowHeight: 1.18,        // (Radius, not Y!) Base = 1.0
  rotationSpeed: 0.2,
  dayCycle: 1.0,
  lodEnabled: false,
  baseResolution: 128,
  atmosphere: false,
  cityMarkers: false,
  wireframe: false,
};

let currentResolution = params.baseResolution;

// --- DETERMINISTIC SEED UTILS ---
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

function updateSeeds(base){
  terrainSeed = deriveSeed(base, 1);
  tempSeed = deriveSeed(base, 2);
  moistSeed = deriveSeed(base, 3);
  if (material && material.uniforms) {
    material.uniforms.uTerrainSeed.value = terrainSeed;
    material.uniforms.uTempSeed.value = tempSeed;
    material.uniforms.uMoistSeed.value = moistSeed;
  }
}

// --- SHADERS ---
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
  
  vec3 pos = position;
  vec3 normal = normalize(position);
  pos += normal * uTime * 0.01; // Simple wave effect based on time
  
  float noiseValue = fbm(pos * uNoiseFreq, uTerrainSeed);
  float tempValue = ffbm(pos * uNoiseFreq, uTempSeed);
  float moistValue = ffbm(pos * uNoiseFreq, uMoistSeed);

  // Elevation based on noise
  float elevation = 1.0 + noiseValue * uElevationScale;

  // Apply temperature and moisture to modify elevation
  elevation += (tempValue - 0.5) * 0.1; // Adjust temperature influence
  elevation += (moistValue - 0.5) * 0.05; // Adjust moisture influence

  vElevation = elevation;
  vPos = pos * elevation;

  gl_Position = projectionMatrix * modelViewMatrix * vec4(vPos, 1.0);
  gl_PointSize = 1.0;
}
`;

const fragmentShader = `
varying vec3 vPos;
varying float vElevation;
uniform float uOceanLevel;
uniform float uSnowHeight;
uniform vec3 uOceanColor;
uniform vec3 uLandColorLow;
uniform vec3 uLandColorHigh;

float linearstep(float edge0, float edge1, float x) {
  return clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
}

void main(){
  vec3 color;
  if (vElevation < uOceanLevel) {
    color = uOceanColor; // Ocean
  } else if (vElevation > uSnowHeight) {
    color = vec3(1.0);   // Snow
  } else {
    float t = linearstep(uOceanLevel, uSnowHeight, vElevation);
    color = mix(uLandColorLow, uLandColorHigh, t);
  }
  gl_FragColor = vec4(color, 1.0);
}
`;

// --- THREE INIT ---
function init() {
  const width = container.value.clientWidth;
  const height = container.value.clientHeight;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 100);
  camera.position.set(0, 0, 3);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(width, height);
  container.value.appendChild(renderer.domElement);

  createPlanet();

  controls = new OrbitControls(camera, renderer.domElement);

  window.addEventListener('resize', onResize);

  // --- GUI ---
  gui = new GUI();
  gui.add(params, 'seed', 1, 999, 1).onChange(v => {
    updateSeeds(v);
    rerender();
  });
  gui.add(params, 'noiseOctaves', 1, 8, 1).onChange(v => {
    material.uniforms.uNoiseOctaves.value = v;
    rerender();
  });
  gui.add(params, 'lacunarity', 1, 4).onChange(v => {
    material.uniforms.uLacunarity.value = v;
    rerender();
  });
  gui.add(params, 'gain', 0.1, 1.5).onChange(v => {
    material.uniforms.uGain.value = v;
    rerender();
  });
  gui.add(params, 'elevationScale', 0, 1).onChange(v => {
    material.uniforms.uElevationScale.value = v;
    rerender();
  });
  gui.add(params, 'noiseFreq', 1, 10).onChange(v => {
    material.uniforms.uNoiseFreq.value = v;
    rerender();
  });
  gui.add(params, 'oceanLevel', 0.95, 1.05).onChange(v => {
    material.uniforms.uOceanLevel.value = v;
    rerender();
  });
  gui.add(params, 'snowHeight', 1.05, 1.3).onChange(v => {
    material.uniforms.uSnowHeight.value = v;
    rerender();
  });
  gui.addColor(params, 'oceanColor').onChange(v => {
    material.uniforms.uOceanColor.value.set(v);
    rerender();
  });
  gui.addColor(params, 'landColorLow').onChange(v => {
    material.uniforms.uLandColorLow.value.set(v);
    rerender();
  });
  gui.addColor(params, 'landColorHigh').onChange(v => {
    material.uniforms.uLandColorHigh.value.set(v);
    rerender();
  });
  gui.add(params, 'rotationSpeed', 0, 2);
  gui.add(params, 'dayCycle', 0, 5);
  gui.add(params, 'lodEnabled');
  gui.add(params, 'baseResolution', 16, 256, 1).onChange(updateResolution);
  gui.add(params, 'wireframe').onChange(v => {
    material.wireframe = v;
    rerender();
  });
  gui.add(params, 'atmosphere').onChange(updateAtmosphere);
  gui.add(params, 'cityMarkers').onChange(updateCityMarkers);

  animate(0);
}

function createPlanet() {
  if (planet) {
    scene.remove(planet);
    planet.geometry.dispose();
    // Don't dispose material; it's reused for uniforms
    atmosphereMesh = null;
    cityMarkersGroup = null;
  }
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
    },
    wireframe: params.wireframe
  });
  planet = new THREE.Mesh(geometry, material);
  scene.add(planet);
  updateSeeds(params.seed);
  updateAtmosphere(params.atmosphere);
  updateCityMarkers(params.cityMarkers);
}

function updateResolution(v){
  currentResolution = v;
  createPlanet();
}

function updateAtmosphere(v){
  if (!planet) return;
  if(v){
    if(!atmosphereMesh){
      const geo = new THREE.SphereGeometry(1.05, 32, 32);
      const mat = new THREE.MeshBasicMaterial({
        color: 0x99ccff,
        transparent: true,
        opacity: 0.3,
        side: THREE.BackSide
      });
      atmosphereMesh = new THREE.Mesh(geo, mat);
      planet.add(atmosphereMesh);
    }
  } else if(atmosphereMesh){
    planet.remove(atmosphereMesh);
    atmosphereMesh.geometry.dispose();
    atmosphereMesh.material.dispose();
    atmosphereMesh = null;
  }
  rerender();
}

function createCityMarkersGroup(count = 10){
  const group = new THREE.Group();
  for(let i=0;i<count;i++){
    const geo = new THREE.SphereGeometry(0.01, 4, 4);
    const mat = new THREE.MeshBasicMaterial({color: 0xff3333});
    const u = Math.random();
    const vpos = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * vpos - 1);
    const r = 1.01;
    const marker = new THREE.Mesh(geo, mat);
    marker.position.set(
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.cos(phi),
      r * Math.sin(phi) * Math.sin(theta)
    );
    group.add(marker);
  }
  return group;
}

function updateCityMarkers(v){
  if (!planet) return;
  if(v){
    if(!cityMarkersGroup){
      cityMarkersGroup = createCityMarkersGroup();
      planet.add(cityMarkersGroup);
    }
  } else if(cityMarkersGroup){
    planet.remove(cityMarkersGroup);
    cityMarkersGroup.traverse(child => {
      if(child.isMesh){
        child.geometry.dispose();
        child.material.dispose();
      }
    });
    cityMarkersGroup = null;
  }
  rerender();
}

function rerender() {
  // Force rerender after uniforms change
  renderer.render(scene, camera);
}

function onResize() {
  if(!container.value) return;
  const width = container.value.clientWidth;
  const height = container.value.clientHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
  rerender();
}

function animate(time){
  const delta = (time - lastTime) * 0.001;
  lastTime = time;
  material.uniforms.uTime.value += delta * params.dayCycle;
  planet.rotation.y += delta * params.rotationSpeed;

  controls.update();
  renderer.render(scene, camera);
  animationId = requestAnimationFrame(animate);
}

onMounted(init);

onBeforeUnmount(() => {
  cancelAnimationFrame(animationId);
  window.removeEventListener('resize', onResize);
  if (renderer) renderer.dispose();
  gui?.destroy();
  if (planet) {
    planet.geometry.dispose();
    // material.dispose(); // Only if you won't reuse
  }
});
</script>

<style scoped>
.viewer {
  width: 100vw;
  height: 100vh;
  background: #181d2a;
  overflow: hidden;
}
canvas { display: block; }
</style>
