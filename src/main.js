
import * as THREE from 'three';
import './style.css';
import { PointerLockControls }
    from 'three/addons/controls/PointerLockControls.js';


// ================================
// 1. SCENE
// ================================

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xe8ebe5);

// ================================
// 2. CAMERA
// ================================

const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    100
);

camera.position.set(0, 1.65, 4);

// ================================
// 3. RENDERER
// ================================

const renderer = new THREE.WebGLRenderer({
    antialias: true
});

renderer.setSize(
    window.innerWidth,
    window.innerHeight
);

renderer.setPixelRatio(
    Math.min(window.devicePixelRatio, 2)
);

document
    .getElementById('scene-container')
    .appendChild(renderer.domElement);

// ================================
// 4. LIGHTING
// ================================

const ambientLight = new THREE.HemisphereLight(
    0xffffff,
    0x888888,
    2
);

scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(
    0xffffff,
    1.5
);

directionalLight.position.set(3, 8, 5);
scene.add(directionalLight);


// ================================
// 5. MUSEUM GEOMETRY
// ================================

function createBox(width, height, depth, color, x, y, z) {

    const geometry = new THREE.BoxGeometry(
        width,
        height,
        depth
    );

    const material = new THREE.MeshStandardMaterial({
        color: color,
        roughness: 0.9
    });

    const mesh = new THREE.Mesh(geometry, material);

    mesh.position.set(x, y, z);

    scene.add(mesh);

    return mesh;
}


const ROOM_SIZE = 12;
const WALL_HEIGHT = 3.5;
const WALL_THICKNESS = 0.2;

const halfRoom = ROOM_SIZE / 2;

const wallColor = 0xf0efe8;
const floorColor = 0xb6beb4;

// Floor
createBox(
    ROOM_SIZE, 0.2, ROOM_SIZE,
    floorColor,
    0, -0.1, 0
);

// North wall
createBox(
    ROOM_SIZE, WALL_HEIGHT, WALL_THICKNESS,
    wallColor,
    0, WALL_HEIGHT / 2, -halfRoom
);

// South wall
createBox(
    ROOM_SIZE, WALL_HEIGHT, WALL_THICKNESS,
    wallColor,
    0, WALL_HEIGHT / 2, halfRoom
);

// West wall
createBox(
    WALL_THICKNESS, WALL_HEIGHT, ROOM_SIZE,
    wallColor,
    -halfRoom, WALL_HEIGHT / 2, 0
);

// East wall
createBox(
    WALL_THICKNESS, WALL_HEIGHT, ROOM_SIZE,
    wallColor,
    halfRoom, WALL_HEIGHT / 2, 0
);

// Ceiling
createBox(
    ROOM_SIZE, 0.2, ROOM_SIZE,
    0xe8e8e3,
    0, WALL_HEIGHT + 0.1, 0
);

createBox(2, 1, 3, 0xffffff, 5, 0.5, 0);

// ================================
// 6. PLAYER CONTROLS
// ================================

const controls = new PointerLockControls(
    camera,
    document.body
);

const menu = document.getElementById('menu');
const hud = document.getElementById('hud');

const enterButton =
    document.getElementById('enter-button');

const exhibitPanel =
    document.getElementById('exhibit-panel');

let readingExhibit = false;

enterButton.addEventListener('click', () => {
    controls.lock();
});

controls.addEventListener('lock', () => {

    menu.hidden = true;
    hud.hidden = false;

});

controls.addEventListener('unlock', () => {

    hud.hidden = true;

    if (!readingExhibit) {
        menu.hidden = false;
        enterButton.textContent = 'Resume Exploring';
    }

});


// ================================
// 7. KEYBOARD INPUT
// ================================

const keys = {};

window.addEventListener('keydown', (event) => {
    keys[event.code] = true;
});

window.addEventListener('keyup', (event) => {
    keys[event.code] = false;
});

function clearKeys() {
    for (const key in keys) {
        keys[key] = false;
    }
}

window.addEventListener('blur', clearKeys);
controls.addEventListener('unlock', clearKeys);


// ================================
// 8. MOVEMENT AND COLLISION
// ================================

const PLAYER_SPEED = 2.5;
const SPRINT_SPEED = 5.0;
const PLAYER_HEIGHT = 1.65;
const PLAYER_RADIUS = 0.3;

const GRAVITY = 9.81;
const JUMP_SPEED = 4.0;

let verticalVelocity = 0;
let isGrounded = true;

function updateMovement(dt) {

    if (!controls.isLocked || readingExhibit) {
        return;
    }

    let forward = 0;
    let sideways = 0;

    if (keys['KeyW']) forward += 1;
    if (keys['KeyS']) forward -= 1;

    if (keys['KeyD']) sideways += 1;
    if (keys['KeyA']) sideways -= 1;

    // Normalize diagonal movement
    const magnitude = Math.hypot(
        forward,
        sideways
    );

  if (magnitude > 0) {

      forward /= magnitude;
      sideways /= magnitude;

      // Determine whether the player is sprinting
      const isSprinting =
          keys['ShiftLeft'] || keys['ShiftRight'];

      const speed = isSprinting
          ? SPRINT_SPEED
          : PLAYER_SPEED;

      controls.moveForward(
          forward * speed * dt
      );

      controls.moveRight(
          sideways * speed * dt
      );
  }

    // Keep player inside the room
    const boundary =
        halfRoom - WALL_THICKNESS / 2 - PLAYER_RADIUS;

    camera.position.x = THREE.MathUtils.clamp(
        camera.position.x,
        -boundary,
        boundary
    );

    camera.position.z = THREE.MathUtils.clamp(
        camera.position.z,
        -boundary,
        boundary
    );

  window.addEventListener('keydown', (event) => {
      if (
          event.code === 'Space' &&
          !event.repeat &&
          controls.isLocked &&
          !readingExhibit &&
          isGrounded
      ) {
          verticalVelocity = JUMP_SPEED;
          isGrounded = false;
      }
  });

  // Apply gravity
  verticalVelocity -= GRAVITY * dt;

  // Update vertical position
  camera.position.y += verticalVelocity * dt;

  // Floor collision
  if (camera.position.y <= PLAYER_HEIGHT) {
      camera.position.y = PLAYER_HEIGHT;
      verticalVelocity = 0;
      isGrounded = true;
  }
}

// ================================
// 10. RENDER LOOP
// ================================
let previousTime = performance.now();

renderer.setAnimationLoop(() => {

    const currentTime = performance.now();

    const dt = Math.min(
        (currentTime - previousTime) / 1000,
        0.05
    );

    previousTime = currentTime;

    updateMovement(dt);
    updateInteraction();

    renderer.render(scene, camera);

});

// ================================
// 11. EXHIBIT DATA
// ================================

const exhibit = {

    id: 'exhibit-01',

    title: 'hexapjack',

    year: '2021',

    origin: 'the jack',

    image: import.meta.env.BASE_URL
        + 'images/artifact.jpg',

    width: 2.4,
    height: 1.6,

    position: new THREE.Vector3(
        0,
        1.8,
        -5.75
    ),

    interactionDistance: 2.5,

    description:
        'This exhibit represents a possible future '
        + 'in which technological innovation and '
        + 'collective action have enabled environmental '
        + 'restoration on a global scale.'

};

// ================================
// 11. CREATE PICTURE EXHIBIT
// ================================

function createPictureExhibit(data) {

    // Wooden frame backing
    createBox(
        data.width + 0.12,
        data.height + 0.12,
        0.08,
        0x594b39,
        data.position.x,
        data.position.y,
        data.position.z
    );

    // White border / mat
    createBox(
        data.width + 0.04,
        data.height + 0.04,
        0.02,
        0xffffff,
        data.position.x,
        data.position.y,
        data.position.z + 0.045
    );

    const textureLoader = new THREE.TextureLoader();

    textureLoader.load(data.image, (texture) => {

        texture.colorSpace = THREE.SRGBColorSpace;

        const geometry = new THREE.PlaneGeometry(
            data.width,
            data.height
        );

        const material = new THREE.MeshBasicMaterial({
            map: texture
        });

        const picture = new THREE.Mesh(
            geometry,
            material
        );

        picture.position.copy(data.position);
        picture.position.z += 0.06;

        scene.add(picture);

    }, undefined, (error) => {

        console.error(
            'Failed to load exhibit image:',
            error
        );

    });
}

createPictureExhibit(exhibit);


// ================================
// 12. EXHIBIT PROXIMITY
// ================================

const interactionPrompt =
    document.getElementById('interaction-prompt');

let activeExhibit = null;

function updateInteraction() {

    activeExhibit = null;
    interactionPrompt.hidden = true;

    if (!controls.isLocked || readingExhibit) {
        return;
    }

    const distance = Math.hypot(
        camera.position.x - exhibit.position.x,
        camera.position.z - exhibit.position.z
    );

    if (distance <= exhibit.interactionDistance) {

        activeExhibit = exhibit;

        interactionPrompt.textContent =
            exhibit.title + '\n[ E ] Read exhibit';

        interactionPrompt.hidden = false;

    }
}


// ================================
// 13. EXHIBIT INFORMATION PANEL
// ================================

function openExhibit(data) {

    readingExhibit = true;

    clearKeys();

    document.getElementById('exhibit-title')
        .textContent = data.title;

    document.getElementById('exhibit-meta')
        .textContent = data.year + ' | ' + data.origin;

    document.getElementById('exhibit-description')
        .textContent = data.description;

    document.getElementById('exhibit-image')
        .src = data.image;

    document.getElementById('exhibit-image')
        .alt = data.title;

    // Release the mouse and pause movement
    controls.unlock();

    menu.hidden = true;
    hud.hidden = true;
    exhibitPanel.hidden = false;
}

window.addEventListener('keydown', (event) => {

    if (
        event.code === 'KeyE'
        && !event.repeat
        && activeExhibit
        && controls.isLocked
        && !readingExhibit
    ) {
        openExhibit(activeExhibit);
    }

});


const closeExhibitButton =
    document.getElementById('close-exhibit');

closeExhibitButton.addEventListener('click', () => {

    readingExhibit = false;

    exhibitPanel.hidden = true;

    clearKeys();

    // Show a fallback menu if mouse capture fails
    menu.hidden = false;
    enterButton.textContent = 'Resume Exploring';

    controls.lock();

});

// ================================
// 9. RESIZE HANDLING
// ================================

window.addEventListener('resize', () => {
    camera.aspect =
        window.innerWidth / window.innerHeight;

    camera.updateProjectionMatrix();

    renderer.setSize(
        window.innerWidth,
        window.innerHeight
    );
});
