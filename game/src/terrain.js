// The island world of Gullwing Courier: heightfield terrain, the lake, the two
// runways, trees, clouds and sky. heightAt(x, z) is the one ground truth every
// other module uses for collisions, landings and ring placement.
import * as THREE from 'three';
import { fbm, mulberry32 } from './noise.js';

export const WORLD_HALF = 1200; // terrain spans -1200..1200 m on x and z
export const SEA_LEVEL = 4; // lake surface height

const SEED = 20261126;

// Runway definitions: centre, heading (deg, 0 = north / -z), length, width, elevation.
export const RUNWAYS = [
  { name: 'HOME', centre: { x: -260, z: 420 }, heading: 90, length: 340, width: 26, elev: 14, id: 'A' },
  { name: 'NORTH', centre: { x: 560, z: -620 }, heading: 20, length: 300, width: 24, elev: 26, id: 'B' },
];

function flattenNearRunways(x, z, h) {
  for (const r of RUNWAYS) {
    const dx = x - r.centre.x;
    const dz = z - r.centre.z;
    const d = Math.hypot(dx, dz);
    const flatR = r.length * 0.8; // a flat apron around each strip
    if (d < flatR) {
      const t = d / flatR;
      const w = t * t * (3 - 2 * t); // smoothstep 0 at centre -> 1 at edge
      h = r.elev + (h - r.elev) * w;
    }
  }
  return h;
}

// Raw island shape: mountains rising to the north-east, a valley running
// south-west, and a lake basin in the south-west corner.
export function heightAt(x, z) {
  const cx = Math.max(-1, Math.min(1, x / WORLD_HALF));
  const cz = Math.max(-1, Math.min(1, z / WORLD_HALF));
  const edge = Math.max(Math.abs(cx), Math.abs(cz));
  let h = 34 + fbm(x + 900, z - 400, SEED) * 52;
  h += Math.max(0, (z * -0.045 - 10)) * 1.6; // higher ground to the north
  h += Math.max(0, (x * 0.05 - 20)) * 1.2; // and to the east
  h -= Math.max(0, 260 - Math.hypot(x + 700, z - 700)) * 0.16; // lake basin SW
  h = Math.max(2, h);
  h = h * (1 - Math.max(0, edge - 0.82) * 4); // fall away at the map edge
  return flattenNearRunways(x, z, h);
}

function colourForHeight(h) {
  const c = new THREE.Color();
  if (h < 6) c.setHex(0xc9b078); // sand at the waterline
  else if (h < 26) c.setHex(0x5d8a4a); // low grass
  else if (h < 60) c.setHex(0x4a7a3e); // deep grass
  else if (h < 110) c.setHex(0x6b7a52); // scrub
  else if (h < 150) c.setHex(0x7a7568); // rock
  else c.setHex(0xe8e8e8); // snow caps
  return c;
}

export function buildTerrain(scene) {
  const group = new THREE.Group();
  group.name = 'terrain';

  const SEG = 150;
  const size = WORLD_HALF * 2;
  const geo = new THREE.PlaneGeometry(size, size, SEG, SEG);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colours = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = heightAt(x, z);
    pos.setY(i, h);
    const c = colourForHeight(h);
    // Slight per-vertex jitter so the slopes read as fields, not plastic.
    const j = 0.94 + ((i * 37) % 13) / 100;
    colours[i * 3] = c.r * j;
    colours[i * 3 + 1] = c.g * j;
    colours[i * 3 + 2] = c.b * j;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  geo.computeVertexNormals();
  const ground = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 }),
  );
  ground.receiveShadow = true;
  group.add(ground);

  // The lake: a flat blue sheet sunk into the south-west basin.
  const lake = new THREE.Mesh(
    new THREE.CircleGeometry(300, 48),
    new THREE.MeshStandardMaterial({ color: 0x2e7fa8, roughness: 0.15, metalness: 0.35, transparent: true, opacity: 0.92 }),
  );
  lake.rotation.x = -Math.PI / 2;
  lake.position.set(-700, SEA_LEVEL, 700);
  group.add(lake);

  buildRunway(group, RUNWAYS[0]);
  buildRunway(group, RUNWAYS[1]);
  buildTrees(group);
  buildClouds(group);
  buildSky(scene);
  scene.add(group);
  return group;
}

function buildRunway(group, r) {
  const rad = (r.heading * Math.PI) / 180;
  const dirX = Math.sin(rad);
  const dirZ = -Math.cos(rad);
  const perpX = Math.cos(rad);
  const perpZ = Math.sin(rad);
  const y = r.elev + 0.35;

  const strip = new THREE.Mesh(
    new THREE.PlaneGeometry(r.width, r.length),
    new THREE.MeshStandardMaterial({ color: 0x33363b, roughness: 0.9 }),
  );
  strip.rotation.x = -Math.PI / 2;
  strip.rotation.z = -rad;
  strip.position.set(r.centre.x, y, r.centre.z);
  strip.receiveShadow = true;
  group.add(strip);

  // Centreline dashes.
  const dashGeo = new THREE.PlaneGeometry(1.6, 14);
  const dashMat = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.7 });
  for (let d = -r.length / 2 + 22; d < r.length / 2 - 18; d += 32) {
    const dash = new THREE.Mesh(dashGeo, dashMat);
    dash.rotation.x = -Math.PI / 2;
    dash.rotation.z = -rad;
    dash.position.set(r.centre.x + dirX * d, y + 0.05, r.centre.z + dirZ * d);
    group.add(dash);
  }

  // Threshold bars at both ends.
  const barGeo = new THREE.PlaneGeometry(r.width * 0.8, 3);
  for (const end of [-1, 1]) {
    const bar = new THREE.Mesh(barGeo, dashMat);
    bar.rotation.x = -Math.PI / 2;
    bar.rotation.z = -rad;
    bar.position.set(
      r.centre.x + dirX * end * (r.length / 2 - 8),
      y + 0.05,
      r.centre.z + dirZ * end * (r.length / 2 - 8),
    );
    group.add(bar);
  }

  // Edge lights: small amber lamps down both sides.
  const lightGeo = new THREE.SphereGeometry(0.9, 8, 8);
  const lightMat = new THREE.MeshStandardMaterial({ color: 0xffb020, emissive: 0xff9a00, emissiveIntensity: 1.6 });
  for (let d = -r.length / 2 + 10; d <= r.length / 2 - 10; d += 30) {
    for (const side of [-1, 1]) {
      const lamp = new THREE.Mesh(lightGeo, lightMat);
      lamp.position.set(
        r.centre.x + dirX * d + perpX * side * (r.width / 2 + 3),
        y + 0.8,
        r.centre.z + dirZ * d + perpZ * side * (r.width / 2 + 3),
      );
      group.add(lamp);
    }
  }

  // Windsock beside the runway, and a hangar at the home strip.
  const sockPole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.25, 12, 8),
    new THREE.MeshStandardMaterial({ color: 0xd8d8d8, roughness: 0.6 }),
  );
  sockPole.position.set(r.centre.x + perpX * (r.width / 2 + 14), y + 6, r.centre.z + perpZ * (r.width / 2 + 14));
  group.add(sockPole);
  const sock = new THREE.Mesh(
    new THREE.ConeGeometry(1.6, 7, 10),
    new THREE.MeshStandardMaterial({ color: 0xff7a1a, roughness: 0.7 }),
  );
  sock.rotation.z = Math.PI / 2;
  sock.position.set(r.centre.x + perpX * (r.width / 2 + 14) + 3.5, y + 11, r.centre.z + perpZ * (r.width / 2 + 14));
  group.add(sock);

  if (r.id === 'A') {
    const hangar = new THREE.Group();
    const walls = new THREE.Mesh(
      new THREE.BoxGeometry(26, 10, 18),
      new THREE.MeshStandardMaterial({ color: 0xb8452e, roughness: 0.8 }),
    );
    walls.position.y = 5;
    hangar.add(walls);
    const roof = new THREE.Mesh(
      new THREE.CylinderGeometry(9, 9, 26, 12, 1, false, 0, Math.PI),
      new THREE.MeshStandardMaterial({ color: 0x8a8f96, roughness: 0.6 }),
    );
    roof.rotation.z = Math.PI / 2;
    roof.rotation.y = Math.PI / 2;
    roof.position.y = 10;
    hangar.add(roof);
    const door = new THREE.Mesh(
      new THREE.PlaneGeometry(18, 8),
      new THREE.MeshStandardMaterial({ color: 0x2c2f33, roughness: 0.9 }),
    );
    door.position.set(0, 4, 9.1);
    hangar.add(door);
    hangar.position.set(r.centre.x + perpX * 34, y, r.centre.z + perpZ * 34);
    hangar.rotation.y = rad;
    group.add(hangar);
  }
}

function buildTrees(group) {
  const rng = mulberry32(777);
  const trunkGeo = new THREE.CylinderGeometry(0.5, 0.8, 4, 6);
  const crownGeo = new THREE.ConeGeometry(3.2, 11, 8);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2a, roughness: 1 });
  const crownMat = new THREE.MeshStandardMaterial({ color: 0x2f5d2a, roughness: 1 });
  const COUNT = 170;
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, COUNT);
  const crowns = new THREE.InstancedMesh(crownGeo, crownMat, COUNT);
  const m = new THREE.Matrix4();
  let placed = 0;
  let guard = 0;
  while (placed < COUNT && guard < 4000) {
    guard++;
    const x = (rng() * 2 - 1) * (WORLD_HALF - 60);
    const z = (rng() * 2 - 1) * (WORLD_HALF - 60);
    const h = heightAt(x, z);
    if (h < 7 || h > 90) continue; // no trees in the lake or on the peaks
    let nearRunway = false;
    for (const r of RUNWAYS) {
      if (Math.hypot(x - r.centre.x, z - r.centre.z) < r.length * 0.7) nearRunway = true;
    }
    if (nearRunway) continue;
    const s = 0.8 + rng() * 0.9;
    m.makeScale(s, s, s);
    m.setPosition(x, h + 2 * s, z);
    trunks.setMatrixAt(placed, m);
    m.makeScale(s, s, s);
    m.setPosition(x, h + (4 + 5) * s, z);
    crowns.setMatrixAt(placed, m);
    placed++;
  }
  trunks.count = placed;
  crowns.count = placed;
  trunks.castShadow = true;
  crowns.castShadow = true;
  group.add(trunks);
  group.add(crowns);
}

function buildClouds(group) {
  const rng = mulberry32(4242);
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, transparent: true, opacity: 0.92 });
  const puffGeo = new THREE.SphereGeometry(1, 10, 8);
  for (let i = 0; i < 16; i++) {
    const cloud = new THREE.Group();
    const puffs = 3 + Math.floor(rng() * 3);
    for (let p = 0; p < puffs; p++) {
      const puff = new THREE.Mesh(puffGeo, mat);
      const s = 14 + rng() * 22;
      puff.scale.set(s, s * 0.45, s * 0.8);
      puff.position.set((rng() - 0.5) * 60, (rng() - 0.5) * 8, (rng() - 0.5) * 30);
      cloud.add(puff);
    }
    cloud.position.set(
      (rng() * 2 - 1) * 1000,
      230 + rng() * 120,
      (rng() * 2 - 1) * 1000,
    );
    cloud.name = 'cloud';
    group.add(cloud);
  }
}

function buildSky(scene) {
  scene.background = new THREE.Color(0x8ec3e8);
  scene.fog = new THREE.Fog(0xa8c8e0, 700, 2600);
  const sun = new THREE.DirectionalLight(0xfff2d8, 2.4);
  sun.position.set(500, 800, 300);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -500;
  sun.shadow.camera.right = 500;
  sun.shadow.camera.top = 500;
  sun.shadow.camera.bottom = -500;
  sun.shadow.camera.far = 2600;
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xbcd8ff, 0x5d7a4a, 0.9));
}
