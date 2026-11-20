
import * as THREE from 'three';
import { loadModel, registerRotation } from './modelLoader.js';
import records from './data/exhibits.json';

const BASE = import.meta.env.BASE_URL;
const textureLoader = new THREE.TextureLoader();

// Create a pedestal and register its collision area.
function pedestal(scene, item, addObstacle) {
  const [x, , z] = item.position;
  const width = item.pedestalWidth ?? 2.1;
  const depth = item.pedestalDepth ?? 1.8;
  const height = item.pedestalHeight ?? 0.85;

  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    new THREE.MeshStandardMaterial({
      color: 0xb8a88f,
      roughness: 0.8
    })
  );

  mesh.position.set(x, height / 2, z);
  scene.add(mesh);

  addObstacle(x, z, width, depth);

  return height;
}

// Display a PNG on the wall
function displayPNG(scene, item) {
  const [x, y, z] = item.position;

  const maxWidth = item.width ?? 4.0;
  const maxHeight = item.height ?? 2.7;
  const facing = item.rotationY ?? 0;

  textureLoader.load(
    BASE + item.image.replace(/^\/+/, ''),
    texture => {
      texture.colorSpace = THREE.SRGBColorSpace;

      const aspect =
        texture.image.width / texture.image.height;

      const width = Math.min(
        maxWidth,
        maxHeight * aspect
      );
      const height = width / aspect;

      const group = new THREE.Group();

      // Solid frame backing.
      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(
          width + 0.18,
          height + 0.18,
          0.08
        ),
        new THREE.MeshStandardMaterial({
          color: 0x584d3c,
          roughness: 0.75
        })
      );
      group.add(frame);

      // Thin white mat around the artwork.
      const mat = new THREE.Mesh(
        new THREE.PlaneGeometry(
          width + 0.06,
          height + 0.06
        ),
        new THREE.MeshBasicMaterial({
          color: 0xf8f5ed
        })
      );
      mat.position.z = 0.044;
      group.add(mat);

      // The PNG
      const artwork = new THREE.Mesh(
        new THREE.PlaneGeometry(width, height),
        new THREE.MeshBasicMaterial({
          map: texture,
          side: THREE.FrontSide
        })
      );
      artwork.position.z = 0.048;
      group.add(artwork);

      group.position.set(x, y, z);
      group.rotation.y = facing;

      scene.add(group);
    },
    undefined,
    error => console.error(
      `Could not load ${item.image}`,
      error
    )
  );
}

// Display one or more GLBs on a shared pedestal
function displayModels(scene, item, topY) {
  const paths = item.models ??
    (item.model ? [item.model] : []);

  const [x, , z] = item.position;

  const spacing = paths.length > 1 ? 1.0 : 0;

  paths.forEach((path, index) => {
    const offsetX =
      (index - (paths.length - 1) / 2) *
      spacing * 2;

    loadModel(
      scene,
      path,
      [x + offsetX, topY, z],
      item.targetSize ?? 1.9,
      item.rotationY ?? 0,
      item.spinSpeed ?? 0.28
    ).catch(error => {
      console.error(
        `Could not load ${path}`,
        error
      );
    });
  });
}

export function loadExhibits(scene, addObstacle) {
  if (!Array.isArray(records)) {
    throw new Error(
      'src/data/exhibits.json must be an array'
    );
  }

  for (const item of records) {
    if (
      !Array.isArray(item.position) ||
      item.position.length !== 3
    ) {
      console.warn(
        'Skipping exhibit with invalid position',
        item
      );
      continue;
    }

    if (item.type === 'image') {
    // Wall-mounted artwork: no pedestal.
    displayPNG(scene, item);

    } else if (item.type === 'model') {
      // 3D models retain their pedestals.
      const top = pedestal(scene, item, addObstacle);
      displayModels(scene, item, top);
    }
  }

  return records.filter(
    item =>
      Array.isArray(item.position) &&
      item.position.length === 3
  );
}
