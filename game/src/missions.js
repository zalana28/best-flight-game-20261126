// Gullwing Courier's three sorties: a ring run over the valley, a landing on
// the North Field, and a supply drop over the lake field — then home.
// Rings and markers are three.js meshes; the scoring lives here too.
import * as THREE from 'three';
import { heightAt, RUNWAYS, WORLD_HALF } from './terrain.js';
import { runwayUnder } from './flight.js';

export const MISSIONS = [
  { name: 'SORTIE 1 — RING RUN', goal: 'Fly through all 8 rings over the valley' },
  { name: 'SORTIE 2 — ISLAND HOP', goal: 'Land on Runway B, the North Field' },
  { name: 'SORTIE 3 — SUPPLY DROP', goal: 'Drop the crate on the marked field by the lake' },
];

const RING_COUNT = 8;

export function createMissions(scene) {
  const group = new THREE.Group();
  group.name = 'missions';
  scene.add(group);

  const ringGeo = new THREE.TorusGeometry(16, 1.1, 10, 40);
  const rings = [];
  // A course that snakes down the valley from the home strip to the north.
  const course = [
    [-180, 500, 78], [-60, 260, 96], [90, 60, 112], [210, -140, 128],
    [300, -320, 104], [420, -480, 118], [520, -560, 88], [560, -620, 60],
  ];
  for (let i = 0; i < RING_COUNT; i++) {
    const [x, z, alt] = course[i];
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffb020, emissive: 0xff8c00, emissiveIntensity: 1.4, roughness: 0.4,
    });
    const ring = new THREE.Mesh(ringGeo, mat);
    ring.position.set(x, Math.max(alt, heightAt(x, z) + 34), z);
    // Face the ring along the course direction.
    const next = course[Math.min(i + 1, RING_COUNT - 1)];
    ring.lookAt(next[0], ring.position.y, next[1]);
    ring.userData.index = i;
    group.add(ring);
    rings.push(ring);
  }

  // The drop target: a painted circle on the field by the lake.
  const target = new THREE.Mesh(
    new THREE.RingGeometry(9, 12, 40),
    new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xff5040, emissiveIntensity: 0.9, side: THREE.DoubleSide }),
  );
  target.rotation.x = -Math.PI / 2;
  const tx = -480;
  const tz = 480;
  target.position.set(tx, heightAt(tx, tz) + 0.6, tz);
  target.name = 'drop-target';
  group.add(target);
  const targetPost = new THREE.Mesh(
    new THREE.CylinderGeometry(0.4, 0.4, 26, 8),
    new THREE.MeshStandardMaterial({ color: 0xff5040, emissive: 0xff5040, emissiveIntensity: 1.2 }),
  );
  targetPost.position.set(tx, heightAt(tx, tz) + 13, tz);
  group.add(targetPost);

  // The dropped crate, hidden until the pilot lets it go.
  const crate = new THREE.Mesh(
    new THREE.BoxGeometry(3, 3, 3),
    new THREE.MeshStandardMaterial({ color: 0xb07a2e, roughness: 0.9 }),
  );
  crate.visible = false;
  crate.castShadow = true;
  group.add(crate);

  return {
    group, rings, target, targetPos: { x: tx, z: tz }, crate,
    index: 0, // 0 = rings, 1 = landing, 2 = drop, 3 = done
    ringsCleared: 0,
    crateDropped: false,
    crateFalling: false,
    crateVel: 0,
    score: 0,
    startTime: 0,
  };
}

// Reset the mission chain for a fresh sortie.
export function resetMissions(m) {
  m.index = 0;
  m.ringsCleared = 0;
  m.crateDropped = false;
  m.crateFalling = false;
  m.crate.visible = false;
  m.score = 0;
  m.startTime = performance.now();
  for (const ring of m.rings) {
    ring.visible = true;
    ring.material.emissiveIntensity = 1.4;
  }
  return m;
}

function nextRingTarget(m) {
  return m.rings[m.ringsCleared] || null;
}

// Highlight the next ring and dim the cleared ones.
export function refreshRings(m) {
  for (const ring of m.rings) {
    const cleared = ring.userData.index < m.ringsCleared;
    ring.visible = !cleared;
    if (!cleared) {
      const next = ring.userData.index === m.ringsCleared;
      ring.material.emissiveIntensity = next ? 1.8 : 0.55;
      ring.material.color.setHex(next ? 0xffb020 : 0x8a97a3);
    }
  }
}

// One step of the mission chain. Returns an event string or null:
// 'ring' | 'landed-b' | 'drop' | 'complete'.
export function stepMissions(m, f, dt) {
  if (m.index === 0) {
    const ring = nextRingTarget(m);
    if (!ring) return null;
    const d = f.pos.distanceTo(ring.position);
    if (d < 15) {
      m.ringsCleared++;
      m.score += 100;
      refreshRings(m);
      if (m.ringsCleared >= RING_COUNT) {
        m.index = 1;
        return 'rings-done';
      }
      return 'ring';
    }
    return null;
  }
  if (m.index === 1) {
    if (f.onGround && f.landed) {
      const r = runwayUnder(f.pos.x, f.pos.z);
      if (r && r.id === 'B') {
        m.score += 500;
        m.index = 2;
        return 'landed-b';
      }
    }
    return null;
  }
  if (m.index === 2) {
    if (m.crateFalling) {
      m.crateVel += 22 * dt;
      m.crate.position.y -= m.crateVel * dt;
      m.crate.position.x += (f.vel.x * 0.25) * dt;
      m.crate.position.z += (f.vel.z * 0.25) * dt;
      const ground = heightAt(m.crate.position.x, m.crate.position.z);
      if (m.crate.position.y <= ground + 1.5) {
        m.crate.position.y = ground + 1.5;
        m.crateFalling = false;
        const d = Math.hypot(m.crate.position.x - m.targetPos.x, m.crate.position.z - m.targetPos.z);
        if (d < 26) {
          m.score += 300;
          m.index = 3;
          return 'drop';
        }
        return 'drop-miss';
      }
    }
    return null;
  }
  return null;
}

export function dropCrate(m, f) {
  if (m.index !== 2 || m.crateDropped || f.onGround) return false;
  m.crateDropped = true;
  m.crateFalling = true;
  m.crateVel = 0;
  m.crate.position.copy(f.pos);
  m.crate.position.y -= 2;
  m.crate.visible = true;
  return true;
}

// Distance and bearing to the current objective, for the HUD arrow.
export function objectiveTarget(m, f) {
  if (m.index === 0) {
    const ring = nextRingTarget(m);
    if (ring) return { x: ring.position.x, z: ring.position.z, label: 'RING' };
  }
  if (m.index === 1) {
    return { x: RUNWAYS[1].centre.x, z: RUNWAYS[1].centre.z, label: 'RUNWAY B' };
  }
  if (m.index === 2) {
    return { x: m.targetPos.x, z: m.targetPos.z, label: 'DROP ZONE' };
  }
  return { x: RUNWAYS[0].centre.x, z: RUNWAYS[0].centre.z, label: 'HOME' };
}

export function objectiveDistance(m, f) {
  const t = objectiveTarget(m, f);
  return Math.hypot(t.x - f.pos.x, t.z - f.pos.z);
}

export { WORLD_HALF };
