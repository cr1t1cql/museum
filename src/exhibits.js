import * as THREE from 'three';
import { loadModel } from './modelLoader.js';
import exhibitRecords from './data/exhibits.json';

const BASE = import.meta.env.BASE_URL;

function createBox(scene, w, h, d, color, x, y, z) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness: 0.8 }),
  );
  mesh.position.set(x, y, z);
  scene.add(mesh);
  return mesh;
}

function createPicture(scene, data) {
  const [x, y, z] = data.position;
  const width = data.width ?? 2.4;
  const height = data.height ?? 1.6;
  createBox(scene, width + 0.16, height + 0.16, 0.08, 0x584d3c, x, y, z - 0.05);
  createBox(scene, width + 0.05, height + 0.05, 0.02, 0xffffff, x, y, z + 0.005);
  new THREE.TextureLoader().load(
    BASE + data.image,
    texture => {
      texture.colorSpace = THREE.SRGBColorSpace;
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(width, height),
        new THREE.MeshBasicMaterial({ map: texture }),
      );
      mesh.position.set(x, y, z + 0.025);
      scene.add(mesh);
    },
    undefined,
    error => console.error(`Failed to load image: ${data.image}`, error),
  );
}

function createModelPedestal(scene, data, addObstacle) {
  const [x, , z] = data.position;
  const width = data.pedestalWidth ?? 2.1;
  const depth = data.pedestalDepth ?? 2.1;
  const height = data.pedestalHeight ?? 0.9;
  createBox(scene, width, height, depth, 0x54645b, x, height / 2, z);
  addObstacle(x, z, width, depth);
  return height;
}

/** Load exhibit metadata once and render each exhibit according to its type. */
export function loadExhibits(scene, addObstacle) {
  // Vite imports and validates the JSON at build time.
  const records = exhibitRecords;
  if (!Array.isArray(records)) throw new Error('src/data/exhibits.json must contain an array');

  for (const item of records) {
    if (!Array.isArray(item.position) || item.position.length !== 3) {
      console.warn('Skipping exhibit with invalid position:', item);
      continue;
    }
    if (item.type === 'image') {
      createPicture(scene, item);
    } else if (item.type === 'model') {
      const pedestalTop = createModelPedestal(scene, item, addObstacle);
      // Begin loading without blocking the exhibit descriptions or the render loop.
      loadModel(scene, item.model,
        [item.position[0], pedestalTop, item.position[2]],
        item.targetSize ?? 1.9,
        item.rotationY ?? 0,
        item.spinSpeed ?? 0)
        .catch(error => {
          console.error(`Failed to load model: ${item.model}`, error);
          // A conspicuous wireframe marks a missing GLB without crashing.
          const [x, , z] = item.position;
          const placeholder = new THREE.Mesh(
            new THREE.BoxGeometry(1.2, 0.8, 1.2),
            new THREE.MeshBasicMaterial({ color: 0xd18b63, wireframe: true }),
          );
          placeholder.position.set(x, pedestalTop + 0.5, z);
          scene.add(placeholder);
        });
    } else {
      console.warn('Unknown exhibit type:', item.type);
    }
  }

  return records.filter(item => Array.isArray(item.position) && item.position.length === 3);
}
