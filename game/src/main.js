// Gullwing Courier — entry point. Boots the renderer, the world and the
// flight loop, runs the menu / flying / crashed / complete states, and stages
// the four screenshot poses when ?shot= is on the URL.
import * as THREE from 'three';
import { buildTerrain, heightAt, RUNWAYS } from './terrain.js';
import { buildAircraft } from './aircraft.js';
import { createFlight, resetFlight, stepFlight, poseAircraft, runwayUnder } from './flight.js';
import { createControls, attachControls, readControls, wasPressed } from './controls.js';
import { createAudio, startAudio, updateAudio, playRingChime, playLandThud, playCrash, playFanfare, setMuted } from './audio.js';
import { createHud, updateHud, showMessage, setObjective } from './hud.js';
import { createMissions, resetMissions, stepMissions, dropCrate, objectiveTarget, objectiveDistance, MISSIONS } from './missions.js';

const params = new URLSearchParams(location.search);
const SHOT = params.get('shot'); // cover | rings | cockpit | landing | null

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.5, 5000);

buildTerrain(scene);
const aircraft = buildAircraft();
scene.add(aircraft.group);
const missions = createMissions(scene);
const flight = createFlight();
const controls = attachControls(createControls(), canvas);
const audio = createAudio();
const hud = createHud();

let state = 'menu'; // menu | flying | paused | crashed | complete
let cameraMode = 'chase'; // chase | cockpit
let holdShot = false; // ?shot= poses freeze the sim so the frame is stable
let score = 0;
let elapsed = 0;
let clock = new THREE.Clock();
let frames = 0;
let readySent = false;

const menuEl = document.getElementById('menu');
const endEl = document.getElementById('end-screen');
const endTitle = document.getElementById('end-title');
const endText = document.getElementById('end-text');

function startSortie() {
  resetFlight(flight, RUNWAYS[0], RUNWAYS[0].heading);
  resetMissions(missions);
  score = 0;
  elapsed = 0;
  state = 'flying';
  menuEl.style.display = 'none';
  endEl.style.display = 'none';
  setObjective(hud, MISSIONS[0].name, MISSIONS[0].goal);
  showMessage(hud, 'Full throttle — pull up gently at 60 knots', 4);
  startAudio(audio);
}

function crash(reason) {
  state = 'crashed';
  playCrash(audio);
  flight.damage = 100;
  endTitle.textContent = 'CRASHED';
  endTitle.style.color = '#ff5040';
  endText.textContent = `${reason} — the Gullwing is a write-off, but the courier walks away. Score ${score}. Press R to fly again.`;
  endEl.style.display = 'flex';
}

function completeSortie() {
  state = 'complete';
  const mins = Math.floor(elapsed / 60);
  const secs = Math.floor(elapsed % 60);
  const timeBonus = Math.max(0, 600 - Math.floor(elapsed)) * 1;
  score += timeBonus;
  playFanfare(audio);
  endTitle.textContent = 'SORTIE COMPLETE';
  endTitle.style.color = '#37d67a';
  endText.textContent = `All three sorties flown in ${mins}:${String(secs).padStart(2, '0')} — time bonus +${timeBonus}. Final score ${score}. Press R to fly again.`;
  endEl.style.display = 'flex';
}

function onMissionEvent(ev) {
  if (ev === 'ring') {
    playRingChime(audio);
    score = missions.score;
    showMessage(hud, `Ring ${missions.ringsCleared} of 8 — +100`, 2);
  } else if (ev === 'rings-done') {
    playRingChime(audio);
    score = missions.score;
    setObjective(hud, MISSIONS[1].name, MISSIONS[1].goal);
    showMessage(hud, 'Ring run complete! Now land on Runway B, the North Field', 4);
  } else if (ev === 'landed-b') {
    playLandThud(audio);
    score = missions.score;
    flight.fuel = 100;
    setObjective(hud, MISSIONS[2].name, MISSIONS[2].goal);
    showMessage(hud, 'Touchdown on Runway B — +500. Fuel topped up. Take off for the drop run.', 4);
  } else if (ev === 'drop') {
    score = missions.score;
    completeSortie();
  } else if (ev === 'drop-miss') {
    showMessage(hud, 'Crate missed the field — circle round and try again (press Space over the red ring)', 4);
    missions.crateDropped = false;
  }
}

function updateCamera(dt) {
  const f = flight;
  if (cameraMode === 'cockpit') {
    // Pilot's seat: ahead of the cabin glass and above the nose, looking
    // over the propeller at the runway and the rings.
    const forward = new THREE.Vector3(Math.sin(f.heading), 0, -Math.cos(f.heading));
    const up = new THREE.Vector3(0, 1, 0);
    const pos = f.pos.clone().addScaledVector(forward, 1.8).add(new THREE.Vector3(0, 1.55, 0));
    if (holdShot) camera.position.copy(pos);
    else camera.position.lerp(pos, Math.min(1, dt * 14));
    const look = f.pos.clone().addScaledVector(forward, 80);
    look.y = f.pos.y + Math.sin(f.pitch) * 80 + 1;
    camera.lookAt(look);
    camera.up.copy(up);
    return;
  }
  // Chase camera: behind and above, eased so it never fights the pilot.
  const back = new THREE.Vector3(-Math.sin(f.heading), 0, Math.cos(f.heading));
  const target = f.pos.clone().addScaledVector(back, 15).add(new THREE.Vector3(0, 5.5, 0));
  if (holdShot) camera.position.copy(target);
  else camera.position.lerp(target, Math.min(1, dt * 3.2));
  const look = f.pos.clone();
  look.y += 1.2;
  camera.lookAt(look);
  camera.up.set(0, 1, 0);
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const simDt = holdShot ? 0 : dt; // staged screenshots hold the pose
  frames++;

  if (state === 'flying') {
    elapsed += simDt;
    readControls(controls);
    if (wasPressed(controls, 'KeyP')) {
      state = 'paused';
      showMessage(hud, 'Paused — press P to keep flying', 60);
    }
    if (wasPressed(controls, 'KeyC')) {
      cameraMode = cameraMode === 'chase' ? 'cockpit' : 'chase';
      showMessage(hud, cameraMode === 'cockpit' ? 'Cockpit view' : 'Chase view', 1.5);
    }
    if (wasPressed(controls, 'KeyM')) {
      setMuted(audio, !audio.muted);
      showMessage(hud, audio.muted ? 'Sound off' : 'Sound on', 1.5);
    }
    if (wasPressed(controls, 'Space') && missions.index === 2) {
      if (dropCrate(missions, flight)) showMessage(hud, 'Crate away!', 1.5);
    }
    if (wasPressed(controls, 'KeyR')) startSortie();

    const ev = stepFlight(flight, controls, simDt);
    if (ev === 'takeoff') {
      playLandThud(audio);
      showMessage(hud, 'Airborne!', 2);
    } else if (ev === 'landed') {
      const r = runwayUnder(flight.pos.x, flight.pos.z);
      if (r && missions.index === 1) {
        // handled by the mission step below
      } else if (r) {
        playLandThud(audio);
        flight.fuel = 100;
        showMessage(hud, `Landed on Runway ${r.id} — fuel topped up`, 2.5);
      } else {
        showMessage(hud, 'Down in a field — throttle up and take off again', 2.5);
      }
    } else if (ev === 'crash') {
      crash('The Gullwing hit the ground too hard');
    } else if (ev === 'rough') {
      playLandThud(audio);
      showMessage(hud, 'Rough landing — the airframe took a knock', 2.5);
    }
    if (state === 'flying') {
      const mev = stepMissions(missions, flight, simDt);
      if (mev) onMissionEvent(mev);
      score = missions.score;
      const t = objectiveTarget(missions, flight);
      const d = Math.round(objectiveDistance(missions, flight));
      setObjective(hud, MISSIONS[missions.index].name, `${MISSIONS[missions.index].goal} — ${t.label} ${d}m`);
    }
    updateAudio(audio, flight.throttle, flight.speed, flight.onGround);
    updateHud(hud, flight, score, elapsed, dt);
  } else if (state === 'menu') {
    // Idle orbit around the home strip while the menu shows.
    const t = performance.now() / 1000;
    const cx = RUNWAYS[0].centre.x + Math.sin(t * 0.08) * 260;
    const cz = RUNWAYS[0].centre.z + Math.cos(t * 0.08) * 260;
    camera.position.set(cx, 150, cz);
    camera.lookAt(RUNWAYS[0].centre.x, 20, RUNWAYS[0].centre.z);
    if (wasPressed(controls, 'KeyR')) startSortie();
  } else if (state === 'paused') {
    if (wasPressed(controls, 'KeyP')) {
      state = 'flying';
      showMessage(hud, '', 0.1);
    }
  } else if (state === 'crashed' || state === 'complete') {
    if (wasPressed(controls, 'KeyR')) startSortie();
  }

  // Aircraft pose, propeller spin, nav-light blink, cloud drift, camera.
  poseAircraft(aircraft.group, flight);
  if (state !== 'menu') updateCamera(dt);
  aircraft.prop.rotation.z += (2 + flight.throttle * 55) * dt;
  const blink = Math.floor(performance.now() / 700) % 2 === 0;
  aircraft.navLights.tail.material.emissiveIntensity = blink ? 3 : 0.4;
  const lowFinal = flight.pos.y < heightAt(flight.pos.x, flight.pos.z) + 60 && flight.speed > 30;
  aircraft.landingLight.intensity = lowFinal ? 60 : 0;
  scene.traverse((o) => {
    if (o.name === 'cloud') o.position.x += dt * 1.2;
  });

  renderer.render(scene, camera);

  // Screenshot staging: after a few settled frames, tell the shooter.
  // The staged pose is snapped, so a handful of frames is enough.
  if (SHOT && !readySent && frames > 6) {
    readySent = true;
    window.__ready = true;
  }
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

menuEl.addEventListener('click', () => {
  if (state === 'menu') startSortie();
});
window.addEventListener('keydown', (e) => {
  if (state === 'menu' && (e.code === 'Enter' || e.code === 'Space')) startSortie();
});

// Stage a fixed pose for each screenshot, then fly it live (no menu).
function stageShot() {
  startSortie();
  const f = flight;
  if (SHOT === 'cover') {
    // Chase view, south of runway A heading north: the strip lies ahead,
    // ring 1 beyond it, valley and mountains all around.
    f.pos.set(-260, heightAt(-260, 680) + 55, 680);
    f.heading = (0 * Math.PI) / 180;
    f.pitch = 0.02;
    f.roll = -0.08;
    f.speed = 62;
    f.throttle = 0.72;
    f.onGround = false;
    f.landed = false;
    cameraMode = 'chase';
  } else if (SHOT === 'rings') {
    // Banking through ring 3, mountains behind.
    f.pos.set(60, heightAt(60, 90) + 75, 90);
    f.heading = (52 * Math.PI) / 180;
    f.pitch = 0.05;
    f.roll = 0.5;
    f.speed = 68;
    f.throttle = 0.8;
    f.onGround = false;
    f.landed = false;
    cameraMode = 'chase';
  } else if (SHOT === 'cockpit') {
    // Cockpit view on final for runway A, instruments lit.
    f.pos.set(-420, heightAt(-420, 420) + 42, 420);
    f.heading = (90 * Math.PI) / 180;
    f.pitch = -0.04;
    f.roll = 0;
    f.speed = 48;
    f.throttle = 0.42;
    f.onGround = false;
    f.landed = false;
    cameraMode = 'cockpit';
  } else if (SHOT === 'landing') {
    // Base leg for runway B: high abeam the strip from the south-west, so
    // the runway, its lights and the hangar show over the ridge.
    f.pos.set(350, heightAt(350, -450) + 130, -450);
    f.heading = (51 * Math.PI) / 180;
    f.pitch = -0.02;
    f.roll = 0.1;
    f.speed = 46;
    f.throttle = 0.38;
    f.onGround = false;
    f.landed = false;
    cameraMode = 'chase';
  }
  // Freeze the pose: hold position by pausing physics after the first frame.
  state = 'flying';
  holdShot = true;
  // Keep the start message out of the screenshots.
  showMessage(hud, '', 0.1);
}

if (SHOT) {
  stageShot();
}

animate();
