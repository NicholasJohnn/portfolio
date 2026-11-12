/* ============================================================
   Undead on their way to the Core: a still scene of undead
   mid-stride on the smaller islands, all heading for the Core.
   Look taken from CoreUndead: helmeted zombies in dark coats,
   bones in the grass, green soul lanterns.
   ============================================================ */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

// Own seeded random numbers, so adding the undead doesn't move the rest of the world
let seed = 90210;
const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const rr = (a, b) => a + rand() * (b - a);

/* ---------- geometry helpers: several coloured parts merged into one mesh ---------- */
const tmpColor = new THREE.Color();
function part(geo, color, { p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1] } = {}) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  g.applyMatrix4(new THREE.Matrix4().compose(
    new THREE.Vector3(...p),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)),
    new THREE.Vector3(...s)));
  tmpColor.setHex(color).convertSRGBToLinear();
  const n = g.attributes.position.count, c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { c[i * 3] = tmpColor.r; c[i * 3 + 1] = tmpColor.g; c[i * 3 + 2] = tmpColor.b; }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}
function merge(parts) {
  const total = parts.reduce((a, g) => a + g.attributes.position.count, 0);
  const pos = new Float32Array(total * 3), col = new Float32Array(total * 3);
  let o = 0;
  for (const g of parts) {
    pos.set(g.attributes.position.array, o * 3);
    col.set(g.attributes.color.array, o * 3);
    o += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.computeVertexNormals();
  return out;
}

const Box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const C = {
  coat: 0x3a3142, coatHi: 0x4a3f55, shirt: 0x3c5a52, belt: 0x6b2f1f, pants: 0x2c2224, stripe: 0x8a6b5a,
  boot: 0x3a2418, skin: 0x8fa070, skinDark: 0x66744f, helmet: 0xc2ad8a, helmetDark: 0x6e604f, bone: 0xf2ecd6, boneDark: 0xcfc6a8,
};

/* ---------- the undead: body + head in one mesh, arms and legs swing from joints ---------- */
const bodyGeo = merge([
  part(Box(0.46, 0.5, 0.26), C.coat, { p: [0, 0.98, 0] }),                       // coat torso
  part(Box(0.5, 0.2, 0.3), C.coatHi, { p: [0, 1.2, 0] }),                         // shoulders / collar
  part(Box(0.2, 0.36, 0.05), C.shirt, { p: [0, 1.02, 0.13] }),                    // torn shirt
  part(Box(0.48, 0.07, 0.28), C.belt, { p: [0, 0.76, 0] }),                       // belt
  part(Box(0.44, 0.22, 0.26), C.coat, { p: [0, 0.62, -0.01], r: [0.08, 0, 0] }),  // coat tails
  part(Box(0.1, 0.1, 0.1), C.skinDark, { p: [0, 1.33, 0.02] }),                   // neck
  part(new THREE.IcosahedronGeometry(0.15, 0), C.skin, { p: [0, 1.47, 0.03], s: [1, 1.15, 1] }),       // head
  part(Box(0.12, 0.05, 0.08), C.skinDark, { p: [0, 1.36, 0.12], r: [0.25, 0, 0] }),                  // slack jaw
  part(new THREE.SphereGeometry(0.19, 6, 3, 0, Math.PI * 2, 0, Math.PI / 2), C.helmet, { p: [0, 1.52, 0.01], r: [-0.12, 0, 0.1] }), // dented helmet
  part(Box(0.42, 0.03, 0.1), C.helmetDark, { p: [0, 1.53, 0.16], r: [-0.12, 0, 0.1] }),              // helmet brim
  part(new THREE.IcosahedronGeometry(0.045, 0), 0xffb060, { p: [0.06, 1.49, 0.15] }),                  // the one glowing eye
]);
const armGeo = merge([
  part(Box(0.13, 0.3, 0.13), C.coat, { p: [0, -0.15, 0] }),
  part(Box(0.1, 0.3, 0.1), C.skin, { p: [0, -0.43, 0] }),
  part(new THREE.IcosahedronGeometry(0.075, 0), C.skinDark, { p: [0, -0.62, 0.02] }),
]);
const legGeo = merge([
  part(Box(0.16, 0.42, 0.16), C.pants, { p: [0, -0.21, 0] }),
  part(Box(0.05, 0.4, 0.165), C.stripe, { p: [0.06, -0.21, 0] }),
  part(Box(0.17, 0.2, 0.26), C.boot, { p: [0, -0.5, 0.04] }),
]);

/* ---------- bone pile: skull, ribcage and long bones ---------- */
function bonePileGeo() {
  const parts = [part(new THREE.IcosahedronGeometry(0.13, 0), C.bone, { p: [0.38, 0.1, 0.05], s: [1, 0.9, 1.15] })];
  for (let i = 0; i < 5; i++) {                                     // ribs
    parts.push(part(new THREE.TorusGeometry(0.16 - i * 0.012, 0.022, 3, 7, Math.PI), i % 2 ? C.boneDark : C.bone,
      { p: [-0.05 + i * 0.075, 0.03, 0], r: [0, Math.PI / 2, 0], s: [1, 0.7, 1] }));
  }
  parts.push(part(Box(0.42, 0.04, 0.04), C.boneDark, { p: [0.08, 0.03, 0] }));    // spine
  for (const [x, z, a] of [[-0.35, 0.22, 0.4], [-0.3, -0.25, -0.3], [0.05, 0.4, 1.4], [0.6, -0.3, 2.2]]) {
    parts.push(part(new THREE.CylinderGeometry(0.025, 0.025, 0.46, 4), C.bone, { p: [x, 0.03, z], r: [0, a, Math.PI / 2] }));
    parts.push(part(new THREE.IcosahedronGeometry(0.045, 0), C.bone, { p: [x - Math.cos(a) * 0.23, 0.03, z + Math.sin(a) * 0.23] }));
  }
  return merge(parts);
}

/* ---------- a still scene: undead caught mid-stride on the smaller islands, heading for the Core ---------- */
const POSES = [
  { legs: [0.5, -0.45], arms: [-1.35, -1.15], lean: 0.2, sway: 0.06 },    // lurching step, arms reaching
  { legs: [-0.4, 0.35], arms: [-1.2, -1.45], lean: 0.24, sway: -0.07 },   // other foot forward
  { legs: [0.15, -0.1], arms: [-0.3, -1.6], lean: 0.32, sway: 0.1 },      // hunched, one arm dragging
  { legs: [0.35, -0.3], arms: [-1.9, -1.7], lean: 0.12, sway: 0 },        // clawing at the air
];

export function createUndead({ islands, islandDefs, core, lowPower }) {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.8, emissive: 0x15121c });
  const boneGeo = bonePileGeo();
  const TOP = 0.42;
  const ON = [1, 2, 3];                         // the smaller islands between the start and the Core

  /* ---------- bones in the grass ---------- */
  for (const i of [0, ...ON]) {
    for (let k = 0; k < (i === 0 ? 3 : 2); k++) {
      const pile = new THREE.Mesh(boneGeo, mat);
      const a = rr(0, Math.PI * 2), d = islandDefs[i].r * rr(0.25, 0.75);
      pile.position.set(Math.cos(a) * d, 0.45, Math.sin(a) * d);
      pile.rotation.y = rr(0, Math.PI * 2);
      pile.scale.setScalar(rr(1.4, 1.8));
      pile.receiveShadow = true;
      islands[i].add(pile);
    }
  }

  /* ---------- green soul lanterns (two cast real light; lights are the expensive part) ---------- */
  const glowMat = new THREE.MeshBasicMaterial({ color: 0x7dffc0 });
  const haloMat = new THREE.MeshBasicMaterial({ color: 0x24ff94, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false });
  const postMat = new THREE.MeshStandardMaterial({ color: 0x3b2a22, flatShading: true });
  for (const [i, a, lit] of [[0, 2.2, true], [1, 0.4, false], [2, 3.6, true], [3, 1.2, false]]) {
    const g = new THREE.Group();
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 1.5, 5), postMat);
    post.position.y = 0.75;
    const glow = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.26, 2, 6), glowMat);
    glow.position.y = 1.72;
    const halo = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 6), haloMat);
    halo.position.y = 1.72;
    g.add(post, glow, halo);
    if (lit && !lowPower) {
      const light = new THREE.PointLight(0x33ff99, 9, 9, 2);
      light.position.y = 1.8;
      g.add(light);
    }
    const d = islandDefs[i].r * 0.72;
    g.position.set(Math.cos(a) * d, 0.42, Math.sin(a) * d);
    islands[i].add(g);
  }

  /* ---------- the undead: children of their island, so they ride its gentle bob ---------- */
  const perIsland = lowPower ? 3 : 4;
  let n = 0;
  for (const i of ON) {
    const isl = islands[i], r = islandDefs[i].r;
    // face the Core, spread across the island in a loose column
    const toCore = new THREE.Vector3().subVectors(core.position, isl.position).setY(0).normalize();
    const side = new THREE.Vector3(-toCore.z, 0, toCore.x);
    for (let k = 0; k < perIsland; k++, n++) {
      const g = new THREE.Group();
      const rig = new THREE.Group();
      const body = new THREE.Mesh(bodyGeo, mat);
      const mk = (geo, x, y) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, 0); m.castShadow = true; return m; };
      const armL = mk(armGeo, -0.3, 1.24), armR = mk(armGeo, 0.3, 1.24);
      const legL = mk(legGeo, -0.11, 0.6), legR = mk(legGeo, 0.11, 0.6);
      body.castShadow = true;
      rig.add(body, armL, armR, legL, legR);
      g.add(rig);

      const p = POSES[(n + i) % POSES.length];
      legL.rotation.x = p.legs[0]; legR.rotation.x = p.legs[1];
      armL.rotation.x = p.arms[0]; armR.rotation.x = p.arms[1];
      armL.rotation.z = 0.12; armR.rotation.z = -0.12;
      rig.rotation.x = p.lean; rig.rotation.z = p.sway;

      const along = rr(-0.45, 0.45) * r, across = (k / (perIsland - 1) - 0.5) * r * 0.9 + rr(-0.3, 0.3);
      g.position.copy(toCore).multiplyScalar(along).addScaledVector(side, across).setY(TOP);
      g.rotation.y = Math.atan2(toCore.x, toCore.z) + rr(-0.35, 0.35);
      g.scale.setScalar(rr(1.45, 1.7));
      isl.add(g);
    }
  }
}
