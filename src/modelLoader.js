import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const gltfLoader = new GLTFLoader();

const rotatingModels = [];

export function updateModels(dt) {
  for (const { holder, speed } of rotatingModels) {
    holder.rotation.y += speed * dt;
  }
}

/** Load one model and fit its longest axis to targetSize meters.
 *  position = [x, bottomY, z], where bottomY is the pedestal's top.
 *  Keep assetPath relative to public/ (e.g. 'models/drone.glb').
 */
export async function loadModel(scene, assetPath, position, targetSize = 2, rotationY = 0, spinSpeed = 0) {
  const url = import.meta.env.BASE_URL + assetPath;
  const gltf = await gltfLoader.loadAsync(url);
  const model = gltf.scene;
  model.rotation.y = rotationY;
  model.updateMatrixWorld(true);

  const bounds = new THREE.Box3().setFromObject(model);
  const dimensions = bounds.getSize(new THREE.Vector3());
  const longest = Math.max(dimensions.x, dimensions.y, dimensions.z);
  if (!Number.isFinite(longest) || longest <= 0) {
    throw new Error(`Model has empty or invalid dimensions: ${assetPath}`);
  }

  model.scale.multiplyScalar(targetSize / longest);
  model.updateMatrixWorld(true);
  const fitted = new THREE.Box3().setFromObject(model);
  const center = fitted.getCenter(new THREE.Vector3());
  model.position.x -= center.x;
  model.position.y -= fitted.min.y;
  model.position.z -= center.z;

  const holder = new THREE.Group();
  holder.position.set(...position);
  holder.add(model);
  scene.add(holder);
  if (spinSpeed !== 0) {
    rotatingModels.push({ holder, speed: spinSpeed });
  }
  return holder;
}
