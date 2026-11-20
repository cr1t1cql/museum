import * as THREE from 'three';

// All positions are in meters. +Y is up, and the floor surface is Y=0.
export const SPAWN_POINTS = {
  // waiting: new THREE.Vector3(-20, 1.65, 26.5),
  waiting: new THREE.Vector3(0, 1.65, 0),
  foyer: new THREE.Vector3(0, 1.65, 0),
};
const WALL_T = 0.2;
const WALL_COLOR = 0xf0efe8;
const FLOOR_COLOR = 0xbac4b9;
const CEILING_COLOR = 0xe9ece7;

// Local door offsets: for north/south, 'at' is relative X;
// for east/west, 'at' is relative Z.
const ROOMS = [
  {
    id: 'foyer', x: 0, z: 0, w: 20, d: 20, h: 5.2,
    openings: {
      north: [{ at: 0, width: 8 }],
      south: [{ at: 0, width: 8 }],
      east:  [{ at: 0, width: 8 }],
      west:  [{ at: 0, width: 8 }, { at: 7.5, width: 3 }],
    },
  },
  { id: 'north', x: 0, z: -22, w: 10, d: 24, h: 4.2, skip: ['south'] },
  { id: 'south', x: 0, z: 22, w: 10, d: 24, h: 4.2, skip: ['north'] },
  { id: 'east', x: 22, z: 0, w: 24, d: 10, h: 4.2, skip: ['west'] },
  { id: 'west', x: -22, z: 0, w: 24, d: 10, h: 4.2, skip: ['east'] },
  {
    id: 'waiting', x: -20, z: 22, w: 12, d: 14, h: 4.2,
    openings: { north: [{ at: 0, width: 3 }] },
  },
];

// An L-shaped entrance corridor connects the waiting room to the SW
// side of the foyer, leaving all four cardinal exhibit wings unobstructed.
// Three NONOVERLAPPING tiles form the L-shaped floor/ceiling.
// The previous two rectangles overlapped, causing coplanar z-fighting
// (flickering / see-through-looking surfaces at the corridor turn).
const CORRIDORS = [
  { x: -15, z: 7.5, w: 10, d: 3 },       // horizontal: X [-20,-10], Z [6,9]
  { x: -20.75, z: 8.25, w: 1.5, d: 1.5 }, // corner: X [-21.5,-20], Z [7.5,9]
  { x: -20, z: 12, w: 3, d: 6 },        // vertical: X [-21.5,-18.5], Z [9,15]
];

export function buildWorld(scene) {
  const wallRects = [];
  const obstacles = [];
  const footprints = [...ROOMS, ...CORRIDORS];

  function box(w, h, d, color, x, y, z, isWall = false) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ color, roughness: 0.9 }),
    );
    mesh.position.set(x, y, z);
    scene.add(mesh);
    if (isWall) {
      wallRects.push({ minX: x - w / 2, maxX: x + w / 2,
                       minZ: z - d / 2, maxZ: z + d / 2 });
    }
    return mesh;
  }

  function wallSide(room, side) {
    if (room.skip?.includes(side)) return;
    const acrossX = side === 'north' || side === 'south';
    const length = acrossX ? room.w : room.d;
    const openings = [...(room.openings?.[side] || [])]
      .sort((a, b) => a.at - b.at);

    const segments = [];
    let cursor = -length / 2;
    for (const opening of openings) {
      const start = Math.max(-length / 2, opening.at - opening.width / 2);
      const end = Math.min(length / 2, opening.at + opening.width / 2);
      if (start > cursor) segments.push([cursor, start]);
      cursor = Math.max(cursor, end);
    }
    if (cursor < length / 2) segments.push([cursor, length / 2]);

    for (const [start, end] of segments) {
      const middle = (start + end) / 2;
      const span = end - start;
      if (span <= 0.001) continue;
      if (acrossX) {
        const z = room.z + (side === 'north' ? -room.d / 2 : room.d / 2);
        box(span, room.h, WALL_T, WALL_COLOR,
            room.x + middle, room.h / 2, z, true);
      } else {
        const x = room.x + (side === 'west' ? -room.w / 2 : room.w / 2);
        box(WALL_T, room.h, span, WALL_COLOR,
            x, room.h / 2, room.z + middle, true);
      }
    }
  }

  for (const room of ROOMS) {
    box(room.w, 0.2, room.d,
        room.id === 'foyer' ? 0xcbd2ca : FLOOR_COLOR,
        room.x, -0.1, room.z);
    box(room.w, 0.2, room.d, CEILING_COLOR,
        room.x, room.h + 0.1, room.z);
    for (const side of ['north', 'south', 'east', 'west']) wallSide(room, side);
  }

  // Connecting corridor floors and ceilings.
  for (const c of CORRIDORS) {
    box(c.w, 0.2, c.d, FLOOR_COLOR, c.x, -0.1, c.z);
    box(c.w, 0.2, c.d, CEILING_COLOR, c.x, 4.3, c.z);
  }

  // The corridor is an L shape, so its perimeter is defined explicitly.
  // These walls leave a continuous opening around the bend and at both ends.
  box(10, 4.2, WALL_T, WALL_COLOR, -15, 2.1, 6, true);       // top of horizontal leg
  box(8.5, 4.2, WALL_T, WALL_COLOR, -14.25, 2.1, 9, true);    // bottom, right of bend
  box(WALL_T, 4.2, 1.5, WALL_COLOR, -20, 2.1, 6.75, true);   // west of horizontal leg
  box(1.5, 4.2, WALL_T, WALL_COLOR, -20.75, 2.1, 7.5, true); // FIX: missing short wall at L-corner
  box(WALL_T, 4.2, 7.5, WALL_COLOR, -21.5, 2.1, 11.25, true);// west of vertical leg
  box(WALL_T, 4.2, 6, WALL_COLOR, -18.5, 2.1, 12, true);    // east of vertical leg

  // A subtle mark in the foyer makes the four-way junction obvious.
  const compass = new THREE.Mesh(
    new THREE.RingGeometry(1.9, 2.05, 64),
    new THREE.MeshBasicMaterial({ color: 0x537b69, side: THREE.DoubleSide }),
  );
  compass.rotation.x = -Math.PI / 2;
  compass.position.y = 0.012;
  scene.add(compass);

  function sign(title, subtitle, x, y, z, width, height, facingY = 0) {
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#244638';
    ctx.fillRect(0, 0, 2048, 512);
    ctx.fillStyle = '#f4f0e4';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${title.length > 23 ? 102 : 128}px Arial`;
    ctx.fillText(title, 1024, subtitle ? 195 : 255, 1920);
    if (subtitle) {
      ctx.font = '60px Arial';
      ctx.fillText(subtitle, 1024, 350, 1920);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    // A thin solid backing, opaque on both sides
    const backing = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, 0.06),
      new THREE.MeshBasicMaterial({ color: 0x244638 })
    );

    // Text visible only on the front
    const front = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      new THREE.MeshBasicMaterial({
        map: texture,
        side: THREE.FrontSide
      })
    );

    // Place front slightly ahead of backing
    front.position.z = 0.04;

    // Group both together
    const signGroup = new THREE.Group();
    signGroup.add(backing);
    signGroup.add(front);

    signGroup.position.set(x, y, z);
    signGroup.rotation.y = facingY;

    scene.add(signGroup);
  }

  // Waiting-room title and four wing labels; camera default spawn is set in main.js.
  sign('MUSEUM OF TOMORROW', 'A hopeful climate future, told through its artifacts',
       -20, 3.0, 15.3, 8.5, 1.7);
  sign('RESILIENCE', '', 0, 3.45, -11.4, 6.7, 0.8);
  sign('CLEANUP', '', 0, 3.45, 11.4, 6.7, 0.8, Math.PI);
  sign('ENERGY', '', 11.4, 3.45, 0, 6.7, 0.8, -Math.PI / 2);
  sign('MOBILITY', '', -11.4, 3.45, 0, 6.7, 0.8, Math.PI / 2);

  // Add static obstacles (pedestals, later benches, etc.) without rewriting movement.
  function addObstacle(x, z, width, depth) {
    obstacles.push({ minX: x - width / 2, maxX: x + width / 2,
                     minZ: z - depth / 2, maxZ: z + depth / 2 });
  }

  function inFootprint(x, z) {
    return footprints.some(r =>
      Math.abs(x - r.x) <= r.w / 2 + 1e-5 &&
      Math.abs(z - r.z) <= r.d / 2 + 1e-5
    );
  }

  function circleHitsRect(x, z, radius, r) {
    const closestX = THREE.MathUtils.clamp(x, r.minX, r.maxX);
    const closestZ = THREE.MathUtils.clamp(z, r.minZ, r.maxZ);
    return (x - closestX) ** 2 + (z - closestZ) ** 2 < radius ** 2;
  }

  function canStand(x, z, radius = 0.3) {
    // Test the visitor's circular footprint against the UNION of room floors,
    // rather than shrinking each room separately (which would block doors).
    if (!inFootprint(x, z)) return false;
    for (let i = 0; i < 16; i++) {
      const angle = i * Math.PI / 8;
      if (!inFootprint(x + radius * Math.cos(angle),
                       z + radius * Math.sin(angle))) return false;
    }
    return ![...wallRects, ...obstacles].some(
      rect => circleHitsRect(x, z, radius, rect)
    );
  }

  return { canStand, addObstacle };
}
