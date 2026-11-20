import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { buildWorld, SPAWN_POINTS } from './world.js';
import { loadExhibits } from './exhibits.js';
import { updateModels } from './modelLoader.js';
import './style.css';

// Scene and renderer stay here; geometry and exhibit assets live in modules.
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xe8ebe5);
const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 120);
// To debug from the foyer, open: ?spawn=foyer
// Or change DEFAULT_SPAWN to 'foyer' to start there every time.
const DEFAULT_SPAWN = 'waiting';
const requestedSpawn = new URLSearchParams(window.location.search).get('spawn');
const spawnName = Object.hasOwn(SPAWN_POINTS, requestedSpawn) ? requestedSpawn : DEFAULT_SPAWN;
camera.position.copy(SPAWN_POINTS[spawnName]);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.getElementById('scene-container').appendChild(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xffffff, 0x888888, 2));
const sun = new THREE.DirectionalLight(0xffffff, 1.5);
sun.position.set(3, 8, 5);
scene.add(sun);

const world = buildWorld(scene);
let exhibits = [];
try {
  // Exhibit metadata is bundled by Vite; no fetch/404/HTML-as-JSON errors.
  exhibits = loadExhibits(scene, world.addObstacle);
} catch (error) {
  console.error('Failed to initialize exhibits:', error);
}

const controls = new PointerLockControls(camera, document.body);
const menu = document.getElementById('menu');
const hud = document.getElementById('hud');
const enterButton = document.getElementById('enter-button');
const exhibitPanel = document.getElementById('exhibit-panel');
const interactionPrompt = document.getElementById('interaction-prompt');
const keys = {};
let readingExhibit = false;
let activeExhibit = null;
const WALK_SPEED = 2.5;
const RUN_SPEED = 5.0;
const PLAYER_HEIGHT = 1.65; // eye height in meters, with feet at Y = 0
const PLAYER_RADIUS = 0.3;
const JUMP_SPEED = 5.5;     // initial upwards velocity, meters/second
const GRAVITY = 14;        // downward acceleration, meters/second squared
let verticalVelocity = 0;
let grounded = true;

function clearKeys() {
  for (const key in keys) keys[key] = false;
}

enterButton.addEventListener('click', () => controls.lock());
controls.addEventListener('lock', () => {
  menu.hidden = true;
  hud.hidden = false;
});
controls.addEventListener('unlock', () => {
  clearKeys();
  hud.hidden = true;
  if (!readingExhibit) {
    menu.hidden = false;
    enterButton.textContent = 'Resume Exploring';
  }
});
window.addEventListener('keydown', event => {
  keys[event.code] = true;
  // Jump only on fresh press, while playing, and only from the ground.
  if (event.code === 'Space') {
    event.preventDefault();
    if (!event.repeat && controls.isLocked && !readingExhibit && grounded) {
      verticalVelocity = JUMP_SPEED;
      grounded = false;
    }
  }
});
window.addEventListener('keyup', event => { keys[event.code] = false; });
window.addEventListener('blur', clearKeys);

function updateMovement(dt) {
  if (!controls.isLocked || readingExhibit) return;

  let forward = Number(!!keys.KeyW) - Number(!!keys.KeyS);
  let sideways = Number(!!keys.KeyD) - Number(!!keys.KeyA);
  const length = Math.hypot(forward, sideways);
  if (length > 0) {
    forward /= length;
    sideways /= length;
    const speed = (keys.ShiftLeft || keys.ShiftRight) ? RUN_SPEED : WALK_SPEED;
    const start = camera.position.clone();
    controls.moveForward(forward * speed * dt);
    controls.moveRight(sideways * speed * dt);
    const target = camera.position.clone();

    // Resolve X and Z individually for sliding collisions with walls/pedestals.
    camera.position.copy(start);
    if (world.canStand(target.x, start.z, PLAYER_RADIUS)) camera.position.x = target.x;
    if (world.canStand(camera.position.x, target.z, PLAYER_RADIUS)) camera.position.z = target.z;
  }

  // Gravity still runs while standing still (the old early-return blocked it).
  if (!grounded) {
    verticalVelocity -= GRAVITY * dt;
    camera.position.y += verticalVelocity * dt;
    if (camera.position.y <= PLAYER_HEIGHT) {
      camera.position.y = PLAYER_HEIGHT;
      verticalVelocity = 0;
      grounded = true;
    }
  } else {
    camera.position.y = PLAYER_HEIGHT;
  }
}

function updateInteraction() {
  activeExhibit = null;
  interactionPrompt.hidden = true;
  if (!controls.isLocked || readingExhibit) return;
  let nearest = Infinity;
  for (const item of exhibits) {
    const [x, , z] = item.position;
    const d = Math.hypot(camera.position.x - x, camera.position.z - z);
    if (d <= (item.interactionDistance ?? 2.7) && d < nearest) {
      nearest = d;
      activeExhibit = item;
    }
  }
  if (activeExhibit) {
    interactionPrompt.textContent = `${activeExhibit.title}\n[ E ] Read exhibit`;
    interactionPrompt.hidden = false;
  }
}

function openExhibit(item) {
  readingExhibit = true;
  clearKeys();
  document.getElementById('exhibit-title').textContent = item.title;
  document.getElementById('exhibit-meta').textContent =
    `${item.year || ''} | ${item.origin || ''}`;
  document.getElementById('exhibit-description').textContent = item.description || '';
  const image = document.getElementById('exhibit-image');
  image.hidden = !item.image;
  if (item.image) {
    image.src = import.meta.env.BASE_URL + item.image;
    image.alt = item.title;
  } else {
    image.removeAttribute('src');
  }
  controls.unlock();
  menu.hidden = true;
  hud.hidden = true;
  exhibitPanel.hidden = false;
}

window.addEventListener('keydown', event => {
  if (event.code === 'KeyE' && !event.repeat && activeExhibit &&
      controls.isLocked && !readingExhibit) openExhibit(activeExhibit);
});
document.getElementById('close-exhibit').addEventListener('click', () => {
  readingExhibit = false;
  exhibitPanel.hidden = true;
  clearKeys();
  controls.lock();
});

window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
let previousTime = performance.now();
renderer.setAnimationLoop(() => {
  const now = performance.now();
  const dt = Math.min((now - previousTime) / 1000, 0.05);
  previousTime = now;
  updateMovement(dt);
  updateInteraction();
  updateModels(dt);
  renderer.render(scene, camera);
});
