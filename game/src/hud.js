// The cockpit instruments for Gullwing Courier: altitude, speed, heading,
// throttle, fuel, score, the mission objective, and an artificial horizon
// drawn on a small canvas. All DOM — the 3D scene never draws text.
export function createHud() {
  return {
    alt: document.getElementById('hud-alt'),
    spd: document.getElementById('hud-spd'),
    hdg: document.getElementById('hud-hdg'),
    thr: document.getElementById('hud-thr'),
    fuel: document.getElementById('hud-fuel'),
    score: document.getElementById('hud-score'),
    time: document.getElementById('hud-time'),
    objective: document.getElementById('hud-objective'),
    message: document.getElementById('hud-message'),
    warning: document.getElementById('hud-warning'),
    compass: document.getElementById('hud-compass'),
    attitude: document.getElementById('hud-attitude'),
    mission: document.getElementById('hud-mission'),
    msgTimer: 0,
  };
}

const M_PER_FT = 3.28084;
const MS_PER_KT = 1.94384;

function compassLabel(deg) {
  const names = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return names[Math.round(deg / 22.5) % 16];
}

export function drawCompass(hud, headingDeg) {
  const ctx = hud.compass.getContext('2d');
  const w = hud.compass.width;
  const h = hud.compass.height;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(8, 20, 28, 0.72)';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#7fd4ff';
  ctx.fillStyle = '#cfeeff';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const degPerPx = 0.9;
  const span = (w / 2) * degPerPx;
  // Walk whole degrees so the 45° labels and 15° ticks always land exactly.
  for (let deg = Math.ceil(headingDeg - span); deg <= Math.floor(headingDeg + span); deg++) {
    if (deg % 5 !== 0) continue;
    const label = ((deg % 360) + 360) % 360;
    const x = w / 2 + (deg - headingDeg) / degPerPx;
    if (label % 45 === 0) {
      ctx.fillText(compassLabel(label), x, 12);
      ctx.beginPath();
      ctx.moveTo(x, 22);
      ctx.lineTo(x, 30);
      ctx.stroke();
    } else if (label % 15 === 0) {
      ctx.beginPath();
      ctx.moveTo(x, 24);
      ctx.lineTo(x, 30);
      ctx.stroke();
    }
  }
  // Centre caret: the heading right now.
  ctx.fillStyle = '#ffb020';
  ctx.beginPath();
  ctx.moveTo(w / 2 - 7, h - 2);
  ctx.lineTo(w / 2 + 7, h - 2);
  ctx.lineTo(w / 2, h - 10);
  ctx.closePath();
  ctx.fill();
}

export function drawAttitude(hud, pitch, roll) {
  const ctx = hud.attitude.getContext('2d');
  const w = hud.attitude.width;
  const h = hud.attitude.height;
  const cx = w / 2;
  const cy = h / 2;
  const r = w / 2 - 4;
  ctx.clearRect(0, 0, w, h);
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(cx, cy);
  ctx.rotate(-roll);
  const horizon = pitch * 110;
  ctx.fillStyle = '#2f6fb4';
  ctx.fillRect(-r - 10, -r - 10 - horizon, (r + 10) * 2, r + 10 + horizon);
  ctx.fillStyle = '#8a6a3b';
  ctx.fillRect(-r - 10, -horizon, (r + 10) * 2, r + 10 + horizon);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-r - 10, -horizon);
  ctx.lineTo(r + 10, -horizon);
  ctx.stroke();
  ctx.restore();
  // Fixed wings marker and rim.
  ctx.strokeStyle = '#ffb020';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - 26, cy);
  ctx.lineTo(cx - 8, cy);
  ctx.moveTo(cx + 8, cy);
  ctx.lineTo(cx + 26, cy);
  ctx.stroke();
  ctx.strokeStyle = '#7fd4ff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
}

export function showMessage(hud, text, seconds) {
  hud.message.textContent = text;
  hud.message.style.opacity = '1';
  hud.msgTimer = seconds || 3;
}

export function updateHud(hud, f, score, elapsed, dt) {
  const headingDeg = ((f.heading * 180) / Math.PI % 360 + 360) % 360;
  hud.alt.textContent = `${Math.round(f.pos.y * M_PER_FT)} FT`;
  hud.spd.textContent = `${Math.round(f.speed * MS_PER_KT)} KT`;
  hud.hdg.textContent = `${String(Math.round(headingDeg)).padStart(3, '0')}° ${compassLabel(headingDeg)}`;
  hud.thr.style.width = `${Math.round(f.throttle * 100)}%`;
  hud.fuel.style.width = `${Math.round(f.fuel)}%`;
  hud.fuel.style.background = f.fuel < 25 ? '#ff5040' : '#37d67a';
  hud.score.textContent = `SCORE ${score}`;
  const mins = Math.floor(elapsed / 60);
  const secs = Math.floor(elapsed % 60);
  hud.time.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  drawCompass(hud, headingDeg);
  drawAttitude(hud, f.pitch, f.roll);

  let warning = '';
  if (f.speed < 26 && !f.onGround) warning = 'STALL — NOSE DOWN, FULL THROTTLE';
  else if (f.fuel < 15 && f.fuel > 0) warning = 'LOW FUEL — LAND AND REFUEL';
  else if (f.fuel <= 0) warning = 'FUEL EMPTY — GLIDING';
  else if (f.damage >= 40) warning = 'AIRFRAME DAMAGED';
  hud.warning.textContent = warning;
  hud.warning.style.opacity = warning ? '1' : '0';

  if (hud.msgTimer > 0) {
    hud.msgTimer -= dt;
    if (hud.msgTimer <= 0) hud.message.style.opacity = '0';
  }
}

export function setObjective(hud, missionName, text) {
  hud.mission.textContent = missionName;
  hud.objective.textContent = text;
}
