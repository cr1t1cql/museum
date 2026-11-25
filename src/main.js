import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { buildWorld, SPAWN_POINTS, createGlobe } from './world.js';
import { loadExhibits } from './exhibits.js';
import { updateModels } from './modelLoader.js';
import './style.css';
import { createPerformanceMonitor } from "./performance.js";

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xe8ebe5);
const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 120);
const DEFAULT_SPAWN = 'foyer';
const requestedSpawn = new URLSearchParams(window.location.search).get('spawn');
const spawnName = Object.hasOwn(SPAWN_POINTS, requestedSpawn) ? requestedSpawn : DEFAULT_SPAWN;
camera.position.copy(SPAWN_POINTS[spawnName]);
camera.rotation.y = Math.PI / 2; // look at the fuller exhibits lol
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.getElementById('scene-container').appendChild(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xffffff, 0x888888, 2));
const sun = new THREE.DirectionalLight(0xffffff, 1.5);
sun.position.set(3, 8, 5);
scene.add(sun);
const perfMonitor = createPerformanceMonitor(renderer);
const world = buildWorld(scene);
const globe = createGlobe(scene);

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
const exhibitContent = exhibitPanel.querySelector('.exhibit-content');
const interactionPrompt = document.getElementById('interaction-prompt');
const keys = {};
let readingExhibit = false;
let exploring = false;
let inputMode = 'keyboard';
let activeExhibit = null;
const WALK_SPEED = 2.5;
const RUN_SPEED = 5.0;
const PLAYER_HEIGHT = 1.65; 
const PLAYER_RADIUS = 0.3;
const JUMP_SPEED = 6;     // upwards velocity
const GRAVITY = 15;        // downward acceleration
let verticalVelocity = 0;
let grounded = true;

function clearKeys() {
  for (const key in keys) keys[key] = false;
}

enterButton.addEventListener('click', () => controls.lock());

// Switch back to keyboard/mouse when moving the mouse
document.addEventListener('mousemove', event => {
  if (!exploring || readingExhibit) return;

  if (event.movementX || event.movementY) {
    inputMode = 'keyboard';
  }
});
// Recapture the mouse when clicking the museum
renderer.domElement.addEventListener('click', () => {
  if (!exploring || readingExhibit) return;

  inputMode = 'keyboard';

  if (!controls.isLocked) {
    controls.lock();
  }
});

controls.addEventListener('lock', () => {
  exploring = true;
  inputMode = 'keyboard';

  menu.hidden = true;
  hud.hidden = readingExhibit;
});

controls.addEventListener('unlock', () => {
  clearKeys();

  // lock mouse look when reading artifact
  if (readingExhibit) return;

  // not needed for controller
  if (inputMode === 'gamepad') return;

  // pause menu behavior
  exploring = false;
  hud.hidden = true;
  menu.hidden = false;
  enterButton.textContent = 'Resume Exploring';
});

window.addEventListener('keydown', event => {
  keys[event.code] = true;
  if (event.code === 'Space') {
    event.preventDefault(); // no double jumping
    if (!event.repeat && controls.isLocked && !readingExhibit && grounded) {
      verticalVelocity = JUMP_SPEED;
      grounded = false;
    }
  }
});
window.addEventListener('keyup', event => { keys[event.code] = false; });
window.addEventListener('blur', clearKeys);

// gamepad support n stuff
let gamepad = null;

const STICK_DEADZONE = 0.15;
const LOOK_SPEED = 2.0;

function getGamepad() {
  return Array.from(navigator.getGamepads?.() || [])
    .find(pad => pad && pad.mapping === 'standard') || null;
}

function deadzone(value) {  // the deadzone glitch!!! 
  if (Math.abs(value) < STICK_DEADZONE) return 0;

  return Math.sign(value) *
    (Math.abs(value) - STICK_DEADZONE) / (1 - STICK_DEADZONE);
}

let previousGamepadButtons = [];

function updateGamepad(dt) {
  const pad = getGamepad();
  gamepad = pad;

  if (!pad) {
    previousGamepadButtons = [];
    if (inputMode === 'gamepad' && exploring) {
      exploring = false;
      menu.hidden = readingExhibit;
      hud.hidden = true;
      enterButton.textContent = 'Resume Exploring';
    }
    return;
  }

  const buttons = pad.buttons.map(button => button.pressed);
  const pressed = index => buttons[index] && !previousGamepadButtons[index];

  const jump = pressed(0); // A
  const cancel = pressed(1);  // B
  const confirm = pressed(2); // X
  const start = pressed(9);   // Menu

  if (readingExhibit) {
    // close artifact
    if (confirm || cancel || start) {
      closeExhibit('gamepad');
    } else {
      const leftY = deadzone(pad.axes[1] || 0);
      const rightY = deadzone(pad.axes[3] || 0);

      const scroll = Math.abs(leftY) > Math.abs(rightY) ? leftY : rightY;   // either stick can scroll, pick the biggest input

      exhibitContent.scrollTop += scroll * 600 * dt;
    }

  } else if (!exploring) {
    // clear pause menu
    if (confirm || start) {
      inputMode = 'gamepad';
      exploring = true;

      menu.hidden = true;
      hud.hidden = false;
    }
    
  } else {
    // read artifact
    if (confirm && activeExhibit) {
      inputMode = 'gamepad';
      openExhibit(activeExhibit);
    }
    //jump
    if (jump && grounded) { 
      inputMode = 'gamepad';
      verticalVelocity = JUMP_SPEED;
      grounded = false;
    }
    // pause
    else if (start) {
      inputMode = 'gamepad';
      exploring = false;
      menu.hidden = false;
      hud.hidden = true;
      clearKeys();
      if (controls.isLocked) controls.unlock();
    }
  }
  previousGamepadButtons = buttons;
}

const lookEuler = new THREE.Euler(0, 0, 0, 'YXZ');

function updateGamepadLook(dt) {
  if (!gamepad || !exploring || readingExhibit) return;

  const lookX = deadzone(gamepad.axes[2] || 0);
  const lookY = deadzone(gamepad.axes[3] || 0);

  lookEuler.setFromQuaternion(camera.quaternion);   // lol, quaternions

  lookEuler.y -= lookX * LOOK_SPEED * dt; // theta integration from theta dot lolol 
  lookEuler.x -= lookY * LOOK_SPEED * dt; // phi integration from phi dot lolol 

  lookEuler.x = THREE.MathUtils.clamp(
    lookEuler.x,
    -Math.PI / 2 + 0.05,
    Math.PI / 2 - 0.05
  );

  camera.quaternion.setFromEuler(lookEuler);
}

function updateMovement(dt) {
  if (!exploring || readingExhibit) return; // cant move when reading stuff
  let forward =
    Number(!!keys.KeyW) - Number(!!keys.KeyS);
  let sideways =
    Number(!!keys.KeyD) - Number(!!keys.KeyA);
  if (gamepad) {
    forward -= deadzone(gamepad.axes[1] || 0);
    sideways += deadzone(gamepad.axes[0] || 0);
  }

  const length = Math.hypot(forward, sideways);
  if (length > 0) {
    forward /= Math.max(1, length);
    sideways /= Math.max(1, length);
    const running = keys.ShiftLeft || keys.ShiftRight || (gamepad?.buttons[6]?.value ?? 0) > 0.2;
    const speed = running ? RUN_SPEED : WALK_SPEED;  // run forrest run! 
    const start = camera.position.clone();
    controls.moveForward(forward * speed * dt);
    controls.moveRight(sideways * speed * dt);
    const target = camera.position.clone();

    // resolve X and Z individually for sliding collisions with walls/pedestals.
    camera.position.copy(start);
    if (world.canStand(target.x, start.z, PLAYER_RADIUS)) camera.position.x = target.x;
    if (world.canStand(camera.position.x, target.z, PLAYER_RADIUS)) camera.position.z = target.z;
  }

  if (!grounded) { // lol, state space integration 
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
  globe.rotation.y += 0.15 * dt;
}

function updateInteraction() {
  activeExhibit = null;
  interactionPrompt.hidden = true;
  if (!exploring || readingExhibit) return;
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
    const interactKey = inputMode === 'gamepad' ? 'A' : 'E';

    interactionPrompt.textContent = `${activeExhibit.title}\n[ ${interactKey} ] Read exhibit`;
    interactionPrompt.hidden = false;
  }
}

const WING_NAMES = {
  "innovation": "Innovation & Technology",
  "policy": "Policy & Infrastructure",
  "collective-action": "Collective Action & Activism",
  "art-culture": "Art & Culture"
};

function openExhibit(item) {
  readingExhibit = true;
  clearKeys();
  exhibitContent.scrollTop = 0; 

  document.getElementById('exhibit-wing').textContent = (WING_NAMES[item.wing] || 'Museum Collection').toUpperCase();
  document.getElementById('exhibit-title').textContent = item.title;
  document.getElementById('exhibit-meta').textContent = `${item.year || ''} | ${item.origin || ''}`;
  document.getElementById('exhibit-description').textContent = item.description || '';

  const image = document.getElementById('exhibit-image');

  image.hidden = !item.image;

  if (item.image) {
    image.src = import.meta.env.BASE_URL + item.image;
    image.alt = item.title;
  } else {
    image.removeAttribute('src');
  }

  menu.hidden = true;
  hud.hidden = true;
  exhibitPanel.hidden = false;

  // release mouse for scrolling, highlighting, character parsing, etc etc
  if (controls.isLocked) {
    controls.unlock();
  }
  exhibitPanel.tabIndex = -1;
  exhibitPanel.focus();
}

function closeExhibit(source = 'keyboard') {
  if (!readingExhibit) return;

  readingExhibit = false;
  exhibitPanel.hidden = true;
  clearKeys();

  if (source === 'gamepad') {
    inputMode = 'gamepad';
    exploring = true;

    menu.hidden = true;
    hud.hidden = false;

    return;
  }

  inputMode = 'keyboard';
  exploring = false;

  // resume menu acts as fallback if pointer lock fails
  menu.hidden = false;
  hud.hidden = true;
  enterButton.textContent = 'Resume Exploring';

  // browser also listens for escape
  if (source !== 'escape') {
    controls.lock();
  }
}

window.addEventListener('keydown', event => {
  if (event.repeat) return;

  // open/close artifact
  if (event.code === 'KeyE') {
    event.preventDefault();
    if (readingExhibit) {
      closeExhibit('keyboard');
    } else if (activeExhibit && exploring) {
      openExhibit(activeExhibit);
    }
    return;
  }
});

// close button
document.getElementById('close-exhibit')
  .addEventListener('click', () => {
    closeExhibit('keyboard');
  });

let previousTime = performance.now();
renderer.setAnimationLoop(() => {
  const now = performance.now();
  const dt = Math.min((now - previousTime) / 1000, 0.05);
  previousTime = now;
  updateGamepad(dt);
  updateGamepadLook(dt);
  updateMovement(dt);
  updateInteraction();
  updateModels(dt);
  renderer.render(scene, camera);
  perfMonitor.update();
});
