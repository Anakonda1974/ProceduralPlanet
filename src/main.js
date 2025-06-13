import * as THREE from 'https://unpkg.com/three@0.158.0/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.158.0/examples/jsm/controls/OrbitControls.js';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 0, 3);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const geometry = new THREE.SphereGeometry(1, 256, 256);

const vertexShader = `
uniform float uTime;
uniform float uElevationScale;
varying vec3 vPos;
varying float vElevation;

float noise3(vec3 p){
  return sin(p.x) * sin(p.y) * sin(p.z);
}

float fbm(vec3 p){
  float value = 0.0;
  float amp = 0.5;
  for(int i = 0; i < 5; i++){
    value += amp * noise3(p);
    p *= 2.0;
    amp *= 0.5;
  }
  return value;
}

void main(){
  vec3 nPos = normalize(position);
  float elevation = fbm(nPos * 5.0 + uTime * 0.1);
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

void main(){
  float temp = clamp((vPos.y + 1.0) / 2.0 + sin(vPos.x * 2.0 + uTime * 0.1) * 0.1, 0.0, 1.0);
  float moist = clamp(0.5 + sin(vPos.z * 2.0 + uTime * 0.1) * 0.25, 0.0, 1.0);
  vec3 color = getBiomeColor(temp, moist);
  if(vElevation < -0.05) color = vec3(0.0, 0.3, 0.8);
  gl_FragColor = vec4(color, 1.0);
}
`;

const material = new THREE.ShaderMaterial({
  vertexShader,
  fragmentShader,
  uniforms: {
    uTime: { value: 0 },
    uElevationScale: { value: 0.15 }
  }
});

const planet = new THREE.Mesh(geometry, material);
scene.add(planet);

const controls = new OrbitControls(camera, renderer.domElement);

function resize(){
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', resize);

function animate(time){
  material.uniforms.uTime.value = time * 0.001;
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

animate(0);
