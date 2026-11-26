// The Gullwing Courier herself: a little cream-and-teal bush plane built from
// primitives, with a spinning propeller, blinking nav lights and fixed gear.
import * as THREE from 'three';

export function buildAircraft() {
  const plane = new THREE.Group();
  plane.name = 'gullwing-courier';

  const cream = new THREE.MeshStandardMaterial({ color: 0xf2e8d5, roughness: 0.55, metalness: 0.15 });
  const teal = new THREE.MeshStandardMaterial({ color: 0x1f7a6d, roughness: 0.5, metalness: 0.2 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2c3136, roughness: 0.7, metalness: 0.3 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x9fd4e8, roughness: 0.1, metalness: 0.4, transparent: true, opacity: 0.85 });

  // Fuselage: a tapered body, nose forward on -z.
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.55, 5.6, 12), cream);
  body.rotation.x = Math.PI / 2;
  body.castShadow = true;
  plane.add(body);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.85, 1.4, 12), teal);
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -3.4;
  nose.castShadow = true;
  plane.add(nose);
  const tailCone = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.8, 12), cream);
  tailCone.rotation.x = Math.PI / 2;
  tailCone.position.z = 3.6;
  plane.add(tailCone);

  // Cabin glasshouse.
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.85, 1.9), glass);
  cabin.position.set(0, 0.62, -0.5);
  cabin.castShadow = true;
  plane.add(cabin);
  const cabinRoof = new THREE.Mesh(new THREE.BoxGeometry(1.34, 0.14, 1.9), teal);
  cabinRoof.position.set(0, 1.08, -0.5);
  plane.add(cabinRoof);

  // Teal cheatline stripe along the fuselage.
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.28, 4.6), teal);
  stripe.position.set(0, -0.1, 0.1);
  plane.add(stripe);

  // Main wing, high-wing layout, with slight dihedral.
  const wingGeo = new THREE.BoxGeometry(5.4, 0.16, 1.7);
  const wingL = new THREE.Mesh(wingGeo, cream);
  wingL.position.set(-2.7, 0.95, -0.4);
  wingL.rotation.z = 0.06;
  wingL.castShadow = true;
  plane.add(wingL);
  const wingR = new THREE.Mesh(wingGeo, cream);
  wingR.position.set(2.7, 0.95, -0.4);
  wingR.rotation.z = -0.06;
  wingR.castShadow = true;
  plane.add(wingR);
  const wingTipL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.5, 1.6), teal);
  wingTipL.position.set(-5.4, 1.1, -0.4);
  plane.add(wingTipL);
  const wingTipR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.5, 1.6), teal);
  wingTipR.position.set(5.4, 1.1, -0.4);
  plane.add(wingTipR);
  // Wing struts.
  const strutGeo = new THREE.CylinderGeometry(0.06, 0.06, 1.6, 6);
  for (const side of [-1, 1]) {
    const strut = new THREE.Mesh(strutGeo, dark);
    strut.position.set(side * 2.1, 0.3, -0.4);
    strut.rotation.z = side * 0.7;
    plane.add(strut);
  }

  // Tail: horizontal stabiliser and vertical fin.
  const stab = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.12, 0.9), cream);
  stab.position.set(0, 0.35, 4.2);
  stab.castShadow = true;
  plane.add(stab);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.3, 1.1), teal);
  fin.position.set(0, 0.85, 4.2);
  fin.castShadow = true;
  plane.add(fin);

  // Propeller: hub plus two blades, spins with throttle.
  const prop = new THREE.Group();
  prop.position.set(0, 0, -4.15);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.5, 10), dark);
  hub.rotation.x = Math.PI / 2;
  prop.add(hub);
  const bladeGeo = new THREE.BoxGeometry(0.28, 2.4, 0.08);
  for (const a of [0, Math.PI]) {
    const blade = new THREE.Mesh(bladeGeo, dark);
    blade.rotation.z = a;
    blade.position.z = -0.15;
    prop.add(blade);
  }
  plane.add(prop);

  // Fixed landing gear: two mains and a tail wheel.
  const gearGeo = new THREE.CylinderGeometry(0.07, 0.07, 1.1, 6);
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 12);
  wheelGeo.rotateZ(Math.PI / 2);
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(gearGeo, dark);
    leg.position.set(side * 0.9, -1.15, -0.9);
    leg.rotation.z = side * 0.25;
    plane.add(leg);
    const wheel = new THREE.Mesh(wheelGeo, dark);
    wheel.position.set(side * 1.05, -1.65, -0.9);
    wheel.castShadow = true;
    plane.add(wheel);
  }
  const tailWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.16, 10), dark);
  tailWheel.rotation.z = Math.PI / 2;
  tailWheel.position.set(0, -0.9, 4.1);
  plane.add(tailWheel);

  // Navigation lights: red port, green starboard, white tail.
  const navLights = {};
  const lightDefs = [
    ['port', 0xff2a2a, [-5.45, 1.0, -0.4]],
    ['starboard', 0x2aff66, [5.45, 1.0, -0.4]],
    ['tail', 0xffffff, [0, 0.4, 4.6]],
  ];
  for (const [name, colour, p] of lightDefs) {
    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 8, 8),
      new THREE.MeshStandardMaterial({ color: colour, emissive: colour, emissiveIntensity: 2.5 }),
    );
    lamp.position.set(p[0], p[1], p[2]);
    plane.add(lamp);
    navLights[name] = lamp;
  }

  // A warm landing light under the nose, lit on final approach.
  const landingLight = new THREE.PointLight(0xfff6cc, 0, 260, 1.4);
  landingLight.position.set(0, -0.6, -3.8);
  plane.add(landingLight);

  return { group: plane, prop, navLights, landingLight };
}
