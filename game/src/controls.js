// Keyboard and mouse input for Gullwing Courier. The game reads a plain
// object each frame; nothing here touches the game state directly.
export function createControls() {
  return {
    keys: new Set(),
    pitchTarget: 0,
    rollTarget: 0,
    rudder: 0,
    throttleDelta: 0,
    brake: false,
    mouseSteer: false,
    mouseX: 0,
    mouseY: 0,
    pressed: new Set(), // keys pressed since last read, for one-shot actions
  };
}

const KEYMAP = {
  ArrowUp: 'pitchUp',
  KeyW: 'throttleUp',
  ArrowDown: 'pitchDown',
  KeyS: 'throttleDown',
  ArrowLeft: 'rollLeft',
  ArrowRight: 'rollRight',
  KeyQ: 'rudderLeft',
  KeyE: 'rudderRight',
  Space: 'brake',
  KeyC: 'camera',
  KeyP: 'pause',
  KeyR: 'restart',
  KeyM: 'mute',
};

export function attachControls(controls, canvas) {
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
    if (!e.repeat) controls.pressed.add(e.code);
    controls.keys.add(e.code);
  });
  window.addEventListener('keyup', (e) => {
    controls.keys.delete(e.code);
  });
  window.addEventListener('blur', () => controls.keys.clear());
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
      controls.mouseSteer = true;
      controls.mouseX = e.clientX;
      controls.mouseY = e.clientY;
    }
  });
  window.addEventListener('mouseup', () => {
    controls.mouseSteer = false;
  });
  window.addEventListener('mousemove', (e) => {
    controls.mouseX = e.clientX;
    controls.mouseY = e.clientY;
  });
  return controls;
}

// Fold the raw keys into per-frame targets. Mouse steering (hold left button
// and move) blends in beside the keys.
export function readControls(c) {
  const k = c.keys;
  let pitch = 0;
  let roll = 0;
  if (k.has('ArrowUp')) pitch += 1;
  if (k.has('ArrowDown')) pitch -= 1;
  if (k.has('ArrowLeft')) roll -= 1;
  if (k.has('ArrowRight')) roll += 1;
  if (c.mouseSteer) {
    const nx = (c.mouseX / window.innerWidth - 0.5) * 2;
    const ny = (c.mouseY / window.innerHeight - 0.5) * 2;
    roll += nx * 0.9;
    pitch -= ny * 0.7;
  }
  c.pitchTarget = Math.max(-1, Math.min(1, pitch));
  c.rollTarget = Math.max(-1, Math.min(1, roll));
  c.rudder = (k.has('KeyQ') ? -1 : 0) + (k.has('KeyE') ? 1 : 0);
  c.throttleDelta = (k.has('KeyW') ? 0.55 : 0) + (k.has('KeyS') ? -0.7 : 0);
  c.brake = k.has('Space');
}

// One-shot key presses: returns true once per physical press.
export function wasPressed(c, code) {
  if (c.pressed.has(code)) {
    c.pressed.delete(code);
    return true;
  }
  return false;
}

export function consumePresses(c) {
  c.pressed.clear();
}
