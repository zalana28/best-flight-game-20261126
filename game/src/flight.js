// Gullwing Courier's flight model: arcade, but throttle and turn discipline
// matter. Speed, lift and stall come from a simple energy balance; the ground
// is the terrain height, so landings and crashes read as what happened.
import * as THREE from 'three';
import { heightAt, RUNWAYS } from './terrain.js';

export const STALL_SPEED = 26; // m/s — below this the wing stops flying
export const MAX_SPEED = 92; // m/s at full throttle, level flight
export const CRUISE_SPEED = 55;

export function createFlight() {
  return {
    pos: new THREE.Vector3(-260, 60, 560),
    vel: new THREE.Vector3(0, 0, 0),
    heading: Math.PI, // facing north (-z) is heading 0; start facing south
    pitch: 0,
    roll: 0,
    throttle: 0.55,
    speed: 0,
    fuel: 100,
    damage: 0,
    onGround: false,
    landed: false,
    verticalSpeed: 0,
    groundSpeed: 0,
  };
}

export function resetFlight(f, runway, headingDeg) {
  f.pos.set(runway.centre.x, runway.elev + 1.6, runway.centre.z);
  f.vel.set(0, 0, 0);
  f.heading = (headingDeg * Math.PI) / 180; // compass heading: 0 = north (-z)
  f.pitch = 0;
  f.roll = 0;
  f.throttle = 0;
  f.speed = 0;
  f.fuel = 100;
  f.damage = 0;
  f.onGround = true;
  f.landed = true;
  f.verticalSpeed = 0;
  f.groundSpeed = 0;
}

// Which runway, if any, the aircraft sits over (within its strip, low).
export function runwayUnder(x, z) {
  for (const r of RUNWAYS) {
    const rad = (r.heading * Math.PI) / 180;
    const dx = x - r.centre.x;
    const dz = z - r.centre.z;
    const along = dx * Math.sin(rad) + dz * -Math.cos(rad);
    const across = dx * Math.cos(rad) + dz * Math.sin(rad);
    if (Math.abs(along) < r.length / 2 && Math.abs(across) < r.width / 2 + 4) return r;
  }
  return null;
}

const UP = new THREE.Vector3(0, 1, 0);

// One physics step. input: { pitchTarget (-1..1), rollTarget (-1..1),
// rudder (-1..1), throttleDelta, brake }. Returns an event string or null:
// 'takeoff' | 'landed' | 'crash' | 'rough' | 'stall'.
export function stepFlight(f, input, dt) {
  dt = Math.min(dt, 0.05);
  const prevVy = f.vel.y;

  // Throttle: W/S nudge it; empty tanks force idle.
  f.throttle = Math.max(0, Math.min(1, f.throttle + input.throttleDelta * dt));
  if (f.fuel <= 0) f.throttle = 0;
  if (f.throttle > 0.05) f.fuel = Math.max(0, f.fuel - (0.12 + f.throttle * 0.22) * dt);

  // Attitude eases toward the pilot's targets; steeper banks turn harder.
  const pitchRate = 0.9;
  const rollRate = 1.6;
  f.pitch += (input.pitchTarget * 0.42 - f.pitch) * Math.min(1, pitchRate * dt * 3);
  f.roll += (input.rollTarget * 0.85 - f.roll) * Math.min(1, rollRate * dt * 3);
  f.heading += Math.sin(f.roll) * 0.85 * (f.speed / CRUISE_SPEED) * dt;
  f.heading += input.rudder * 0.25 * dt;

  // Forward vector from heading/pitch/roll.
  const cp = Math.cos(f.pitch);
  const forward = new THREE.Vector3(
    Math.sin(f.heading) * cp,
    Math.sin(f.pitch),
    -Math.cos(f.heading) * cp,
  );

  if (f.onGround) {
    // Rolling on the strip: throttle accelerates, brake and grass slow down.
    const runway = runwayUnder(f.pos.x, f.pos.z);
    const drag = runway ? 0.25 : 2.2; // grass grabs the wheels
    const accel = f.throttle * 26 - drag * f.speed - (input.brake ? 22 : 0);
    f.speed = Math.max(0, f.speed + accel * dt);
    f.vel.copy(forward).multiplyScalar(f.speed);
    f.vel.y = 0;
    f.pos.addScaledVector(f.vel, dt);
    f.pos.y = heightAt(f.pos.x, f.pos.z) + 1.6;
    if (f.speed > STALL_SPEED + 6 && f.pitch > 0.06) {
      f.onGround = false;
      f.landed = false;
      return 'takeoff';
    }
    return null;
  }

  // In the air: thrust fights drag, gravity pulls along the pitch.
  const thrust = f.throttle * 30;
  const drag = 0.0038 * f.speed * f.speed + 1.4;
  const accel = thrust - drag - 9.8 * Math.sin(f.pitch);
  f.speed = Math.max(0, f.speed + accel * dt);

  // Lift holds the nose up while the wing is flying; below stall speed the
  // nose drops and the aircraft sinks.
  let liftFactor = Math.min(1, f.speed / (STALL_SPEED + 8));
  if (f.speed < STALL_SPEED) {
    f.pitch -= (STALL_SPEED - f.speed) * 0.012 * dt * 60 * 0.02;
    liftFactor *= 0.55;
  }
  const climb = Math.sin(f.pitch) * f.speed * liftFactor - (1 - liftFactor) * 9;
  f.vel.copy(forward).multiplyScalar(f.speed);
  f.vel.y = climb;
  f.pos.addScaledVector(f.vel, dt);
  f.verticalSpeed = f.vel.y;
  f.groundSpeed = Math.hypot(f.vel.x, f.vel.z);

  // Ground contact.
  const ground = heightAt(f.pos.x, f.pos.z);
  if (f.pos.y <= ground + 1.6) {
    f.pos.y = ground + 1.6;
    const runway = runwayUnder(f.pos.x, f.pos.z);
    const sink = -prevVy;
    const gentle = sink < 3.2 && Math.abs(f.roll) < 0.22 && Math.abs(f.pitch) < 0.16 && f.speed < 58;
    if (runway && gentle) {
      f.onGround = true;
      f.landed = true;
      f.vel.y = 0;
      return 'landed';
    }
    if (sink > 6 || Math.abs(f.roll) > 0.6 || Math.abs(f.pitch) > 0.5) {
      return 'crash';
    }
    f.onGround = true;
    f.landed = false;
    f.damage += 18;
    f.vel.y = 0;
    return 'rough';
  }

  // Water: the lake is a crash, not a landing.
  if (f.pos.y < 5.5 && Math.hypot(f.pos.x + 700, f.pos.z - 700) < 290) {
    return 'crash';
  }
  return f.speed < STALL_SPEED ? 'stall' : null;
}

// Apply the flight state to the aircraft mesh (position + orientation).
// Model nose is -z, starboard wing +x: rotation.y = -heading points the nose
// along the forward vector, rotation.x = pitch lifts the nose, and
// rotation.z = -roll banks the starboard wing down for a positive roll.
export function poseAircraft(group, f) {
  group.position.copy(f.pos);
  group.rotation.order = 'YXZ';
  group.rotation.y = -f.heading;
  group.rotation.x = f.pitch;
  group.rotation.z = -f.roll;
}
