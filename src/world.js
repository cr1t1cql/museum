import * as THREE from 'three';

// coords in meters, +Y upwards
export const SPAWN_POINTS = {
  waiting: new THREE.Vector3(-20, 1.65, 26.5),
  foyer: new THREE.Vector3(8, 1.65, 0),
};

const WALL_T = 0.2;
const WALL_COLOR = 0xf5f1e8;    // Warm ivory
const FLOOR_COLOR = 0xd8c7ae;   // Natural sand
const CEILING_COLOR = 0xfffcf5; // Soft white
const FOYER_FLOOR = 0xd6dfd1;  // Pale sage
const SIGN_COLOR = 0x718e76;   // Better green
const SIGN_TEXT = '#fff9eb';   // Cream

const ROOMS = [
  {
    id: 'foyer', x: 0, z: 0, w: 20, d: 20, h: 4.2,
    openings: {
      north: [{ at: 0, width: 8 }],
      south: [{ at: 0, width: 8 }],
      east:  [{ at: 0, width: 8 }],
      west:  [{ at: 0, width: 8 }],
    },
  },
  { id: 'north', x: 0, z: -19, w: 10, d: 18, h: 4.2, skip: ['south'] },
  { id: 'south', x: 0, z: 19, w: 10, d: 18, h: 4.2, skip: ['north'] },
  { id: 'east', x: 19, z: 0, w: 18, d: 10, h: 4.2, skip: ['west'] },
  { id: 'west', x: -19, z: 0, w: 18, d: 10, h: 4.2, skip: ['east'] },
];

const CORRIDORS = [
//  { x: -15, z: 7.5, w: 10, d: 3 },       
//  { x: -20.75, z: 8.25, w: 1.5, d: 1.5 }, 
//  { x: -20, z: 12, w: 3, d: 6 },       multiline comment FTW
];

export function buildWorld(scene) {
  const wallRects = [];
  const obstacles = [];
  const footprints = [...ROOMS, ...CORRIDORS];

  scene.background = new THREE.Color(0xf5f1e8);
  function box(w, h, d, color, x, y, z, isWall = false) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      color === CEILING_COLOR
      ? new THREE.MeshBasicMaterial({ color: 0xeae7df })
      : new THREE.MeshStandardMaterial({ color, roughness: 0.9 }),
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
        room.id === 'foyer' ? FOYER_FLOOR : FLOOR_COLOR,
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

  // look around
  const compass = new THREE.Mesh(
    new THREE.RingGeometry(1.9, 2.05, 64),
    new THREE.MeshBasicMaterial({ color: 0x537b69, side: THREE.DoubleSide }),
  );
  compass.rotation.x = -Math.PI / 2;
  compass.position.y = 0.012;
  scene.add(compass);

  function sign(title, subtitle, x, y, z, width, height, facingY = 0) {
    // match texture resolution to sign aspect ratio
    const pixelsPerMeter = 512;

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * pixelsPerMeter);
    canvas.height = Math.round(height * pixelsPerMeter);

    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = '#718e76';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = SIGN_TEXT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const lines = title.split('\n');

    if (subtitle) {
      lines.push(subtitle);
    }

    const lineHeight = canvas.height / (lines.length + 0.5);

    lines.forEach((line, index) => {
      const isSubtitle = subtitle && index === lines.length - 1;

      let fontSize = lineHeight * (isSubtitle ? 0.45 : 0.7);

      ctx.font = `${isSubtitle ? 'normal' : 'bold'} ${fontSize}px Arial`;

      // shrink text to fit
      const measuredWidth = ctx.measureText(line).width;

      if (measuredWidth > canvas.width * 0.88) {
        fontSize *= (canvas.width * 0.88) / measuredWidth;
      }

      ctx.font = `${isSubtitle ? 'normal' : 'bold'} ${fontSize}px Arial`;

      const textY =
        canvas.height / 2 +
        (index - (lines.length - 1) / 2) * lineHeight;

      ctx.fillText(line, canvas.width / 2, textY);
    });

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;

    // filtering magic
    texture.anisotropy = 8;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;

    // opaque backing to prevent mirrored text on signs
    const backing = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, 0.06),
      new THREE.MeshBasicMaterial({ color: SIGN_COLOR })
    );

    const front = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      new THREE.MeshBasicMaterial({
        map: texture,
        side: THREE.FrontSide
      })
    );

    front.position.z = 0.04;

    const group = new THREE.Group();
    group.add(backing, front);

    group.position.set(x, y, z);
    group.rotation.y = facingY;

    scene.add(group);
  }

  // NORTH — Innovation & Technology
  sign(
    'INNOVATION & TECHNOLOGY', '',
    0, 3.7, -10,
    8.0, 1.0,
    0
  );

  // SOUTH — Art & Culture
  sign(
    'ART & CULTURE', '',
    0, 3.7, 10,
    8.0, 1.0,
    Math.PI
  );

  // EAST — Policy & Infrastructure
  sign(
    'POLICY & INFRASTRUCTURE', '',
    10, 3.7, 0,
    8.0, 1.0,
    -Math.PI / 2
  );

  // WEST — Collective Action & Activism
  sign(
    'COLLECTIVE ACTION & ACTIVISM', '',
    -10, 3.7, 0,
    8.0, 1.0,
    Math.PI / 2
  );

  function wallText(
    title, subtitle,
    x, y, z,
    width, height,
    facingY = 0
  ) {
    const pixelsPerMeter = 512;

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * pixelsPerMeter);
    canvas.height = Math.round(height * pixelsPerMeter);

    const ctx = canvas.getContext('2d');

    const W = canvas.width;
    const H = canvas.height;

    // Transparent background
    ctx.clearRect(0, 0, W, H);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    function drawText(text, y, size, weight, color) {
      ctx.font = `${weight} ${size}px Arial`;

      const measuredWidth = ctx.measureText(text).width;

      if (measuredWidth > W * 0.9) {
        size *= W * 0.9 / measuredWidth;
      }

      ctx.font = `${weight} ${size}px Arial`;
      ctx.fillStyle = color;
      ctx.fillText(text, W / 2, y);
    }

    // Main heading
    const titleLines = title.split('\n');

    titleLines.forEach((line, i) => {
      drawText(
        line,
        H * 0.30 +
          (i - (titleLines.length - 1) / 2) * H * 0.17,
        H * 0.16,
        'bold',
        '#426354'
      );
    });

    // Decorative horizontal divider
    ctx.strokeStyle = '#718e76';
    ctx.lineWidth = 3;

    ctx.beginPath();
    ctx.moveTo(W * 0.25, H * 0.53);
    ctx.lineTo(W * 0.75, H * 0.53);
    ctx.stroke();

    // Smaller supporting text
    const subtitleLines = subtitle.split('\n');

    const startY = H * 0.63;
    const lineSpacing = Math.min(
      H * 0.10,
      H * 0.30 / Math.max(1, subtitleLines.length - 1)
    );

    subtitleLines.forEach((line, i) => {
      drawText(
        line,
        startY + i * lineSpacing,
        Math.min(H * 0.085, lineSpacing * 0.85),
        'normal',
        '#52675b'
      );
    });

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;

    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
        side: THREE.FrontSide
      })
    );

    mesh.position.set(x, y, z);
    mesh.rotation.y = facingY;

    scene.add(mesh);

    return mesh;
  }
  // NORTH WALL

  wallText(
    'IMAGINATION\nINTO ACTION',
    'Today’s ideas become\ntomorrow’s solutions.',
    -7, 2.4, -9.88,
    5.0, 2.8,
    0
  );

  wallText(
    'A BETTER WORLD\nBY DESIGN',
    'Innovation in service\nof our planet.',
    7, 2.4, -9.88,
    5.0, 2.8,
    0
  );

  // EAST WALL

  wallText(
    'CHANGE IS\nCOLLECTIVE',
    'The decisions we make\nshape generations.',
    9.88, 2.4, -7,
    5.0, 2.8,
    -Math.PI / 2
  );

  wallText(
    'HOPE IS\nSOMETHING WE BUILD',
    'Progress begins\nwith a choice.',
    9.88, 2.4, 7,
    5.0, 2.8,
    -Math.PI / 2
  );

  // SOUTH WALL

  wallText(
    'WHAT WILL WE\nLEAVE BEHIND?',
    'The objects of today.\nThe history of tomorrow.',
    7, 2.4, 9.88,
    5.0, 2.8,
    Math.PI
  );

  wallText(
    'THE POWER\nOF PERSPECTIVE',
    'Art helps us imagine\nwhat does not yet exist.',
    -7, 2.4, 9.88,
    5.0, 2.8,
    Math.PI
  );
  
  // WEST WALL — Museum introduction
  wallText(
    'MUSEUM OF\nTHE FUTURE',
    'Artifacts from a\nfuture worth building.',
    -9.88, 2.4, 7,
    5.0, 2.8,
    Math.PI / 2
  );

  wallText(
    'DRIVING QUESTION',
    'How can a “museum of the future,”\n' +
    'featuring hypothetical artifacts\n' +
    'and innovations that helped humanity\n' +
    'address the climate crisis,\n' +
    'inspire hope today?',
    -9.88, 2.2, -7,
    5.0, 3.2,
    Math.PI / 2
  );

  // add static obstacles with collision
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

export function createGlobe(scene) {
  const geometry = new THREE.SphereGeometry(
    1.5, // Radius
    48,   // Longitude segments
    32    // Latitude segments
  );

  const material = new THREE.MeshBasicMaterial({
    color: 0xa4bcc9,
    wireframe: true,
    transparent: false,
    opacity: 0.65
  });

  const globe = new THREE.Mesh(geometry, material);

  globe.position.set(0, 2.4, 0);
  globe.rotation.z = THREE.MathUtils.degToRad(23.5);

  scene.add(globe);

  return globe;
}