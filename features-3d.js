// features-3d.js
import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

// Get container
const container = document.getElementById('features-3d-container');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xfafafa);

// Camera
const camera = new THREE.PerspectiveCamera(
  45,
  container.clientWidth / container.clientHeight,
  0.1,
  1000
);
camera.position.z = 8;

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(container.clientWidth, container.clientHeight);
container.appendChild(renderer.domElement);

// Lights
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(5, 5, 5);
scene.add(light);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

// Features data
const features = [
  { title: 'Strong Academic Foundation', color: 0x4caf50 },
  { title: 'Safe & Caring Environment', color: 0x2196f3 },
  { title: 'Dedicated Teaching Staff', color: 0xff9800 },
  { title: 'Strong Moral Values', color: 0x9c27b0 },
  { title: 'Well-Structured Programme', color: 0x00bcd4 },
  { title: 'Positive Community', color: 0xf44336 }
];

// Create cubes
const cubes = [];
const cubeSize = 1.5;
const spacing = 2.0;

features.forEach((feat, i) => {
  const geometry = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize);
  const material = new THREE.MeshStandardMaterial({ color: feat.color });
  const cube = new THREE.Mesh(geometry, material);

  const row = Math.floor(i / 3);
  const col = i % 3;
  cube.position.x = (col - 1) * spacing;
  cube.position.y = -(row - 0.5) * spacing;

  scene.add(cube);
  cubes.push(cube);
});

// Mouse interaction (desktop only)
let mouseX = 0, mouseY = 0;

document.addEventListener('mousemove', e => {
  mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
  mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
});

// Animate
function animate() {
  requestAnimationFrame(animate);

  cubes.forEach((cube, i) => {
    cube.rotation.x += 0.002 + mouseY * 0.005; // slower rotation
    cube.rotation.y += 0.004 + mouseX * 0.005;
  });

  renderer.render(scene, camera);
}

animate();

// Handle resize
window.addEventListener('resize', () => {
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
});