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
  elevationScale: 0.15,
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
  cityMarkers: false
};

let currentResolution = params.baseResolution;

const vertexShader = `
uniform float uTime;
uniform float uElevationScale;
uniform float uNoiseFreq;
uniform float uSeed;
uniform float uLacunarity;
uniform float uGain;
uniform float uNoiseOctaves;
varying vec3 vPos;
varying float vElevation;

float noise3(vec3 p){
  p += uSeed;
  return sin(p.x) * sin(p.y) * sin(p.z);
}

float fbm(vec3 p){
  float value = 0.0;
  float amp = 0.5;
  for(int i = 0; i < 5; i++){
  for(int i = 0; i < 8; i++){
    if(float(i) >= uNoiseOctaves) break;
    value += amp * noise3(p);
    p *= 2.0;
    amp *= 0.5;
    p *= uLacunarity;
    amp *= uGain;
  }
  return value;
}
  return value;
}


void main(){
  vec3 nPos = normalize(position);
  float elevation = fbm(nPos * uNoiseFreq + uTime * 0.1);
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
  float temp = clamp((vPos.y + 1.0) / 2.0 + sin(vPos.x * 2.0 + uTime * 0.1) * 0.1, 0.0, 1.0);
  float moist = clamp(0.5 + sin(vPos.z * 2.0 + uTime * 0.1) * 0.25, 0.0, 1.0);
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
      uSeed: { value: params.seed },
      uLacunarity: { value: params.lacunarity },
      uGain: { value: params.gain },
      uNoiseOctaves: { value: params.noiseOctaves },
      uOceanLevel: { value: params.oceanLevel },
      uOceanColor: { value: new THREE.Color(params.oceanColor) },
      uLandColorLow: { value: new THREE.Color(params.landColorLow) },
      uLandColorHigh: { value: new THREE.Color(params.landColorHigh) },
      uSnowHeight: { value: params.snowHeight }
    }
  });

  const planet = new THREE.Mesh(geometry, material);
  //planet = new THREE.Mesh(geometry, material);
  scene.add(planet);

  gui = new GUI();
  gui.add(params, 'seed', 1, 999, 1).onChange(v => material.uniforms.uSeed.value = v);
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