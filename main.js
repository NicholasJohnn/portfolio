import * as THREE from './vendor/three.module.min.js';
import { createGallery } from './gallery.js?v=18';
import { createUndead } from './undead.js?v=18';

/* ============================================================
   Projects and breakdowns live in index.html (so they show even if this
   script fails to load). Their data is read back here for the 3D gallery.
   ============================================================ */
// Breakdown rows show the 640px copy in img/sm/; the gallery uses the full image in img/
const full = src => src.replace('img/sm/', 'img/');
const text = (el, sel) => el.querySelector(sel)?.firstChild?.textContent.trim() ?? '';

const PROJECTS = [...document.querySelectorAll('#grid .proj')].map(a => ({
  title: text(a, 'h3'),
  role: text(a, '.proj-role'),
  img: a.querySelector('img').getAttribute('src'),
  url: a.href,
}));
const BREAKDOWNS = [...document.querySelectorAll('#bdList .bd-link')].map(a => ({
  title: text(a, '.bd-title'),
  sub: text(a, '.bd-sub'),
  img: full(a.dataset.img),
  url: a.href,
}));


/* ============================================================
   Contact email: change the two parts here to use a different address.
   It's assembled at runtime so it never appears as plain text in the HTML.
   ============================================================ */
const CONTACT_EMAIL = ['johnicholas192', 'gmail.com'];
(() => {
  const addr = CONTACT_EMAIL.join('@');
  const subject = encodeURIComponent('Hello from your portfolio');
  document.querySelectorAll('.js-email').forEach(a => {
    a.href = `mailto:${addr}?subject=${subject}`;
    a.removeAttribute('target');
    a.removeAttribute('rel');
    a.textContent = 'Email me';
  });
  const line = document.getElementById('emailLine');
  document.getElementById('emailText').textContent = addr;
  line.hidden = false;
  line.addEventListener('click', async () => {
    const label = document.getElementById('emailCopy');
    try {
      await navigator.clipboard.writeText(addr);
      line.classList.add('copied');
      label.textContent = 'Copied';
    } catch {
      location.href = `mailto:${addr}`;   // clipboard blocked: open the mail app instead
      return;
    }
    setTimeout(() => { line.classList.remove('copied'); label.textContent = 'Copy'; }, 1800);
  });
})();

// Respects the visitor's "reduce motion" setting. Add ?motion=full to the address to preview the full-motion version anyway.
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
  && new URLSearchParams(location.search).get('motion') !== 'full';
const loaderFill = document.getElementById('loaderFill');
loaderFill.style.width = '35%';

/* ============================================================
   Helpers
   ============================================================ */
let seed = 11;
const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const rr = (a, b) => a + rand() * (b - a);
const hash3 = (x, y, z) => {
  const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
  return s - Math.floor(s);
};
// Moves vertices by an amount based on their position, so shared seams stay welded.
function jitter(geo, amt, yScale = 1) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const kx = Math.round(x * 100), ky = Math.round(y * 100), kz = Math.round(z * 100);
    p.setXYZ(i,
      x + (hash3(kx, ky, kz) - 0.5) * amt,
      y + (hash3(ky, kz, kx) - 0.5) * amt * yScale,
      z + (hash3(kz, kx, ky) - 0.5) * amt);
  }
  geo.computeVertexNormals();
  return geo;
}
const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.9, metalness: 0, ...extra });
const shadow = o => { o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); return o; };

/* ============================================================
   Renderer, scene, camera
   ============================================================ */
const canvas = document.getElementById('world');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
} catch (e) {
  canvas.style.display = 'none';
  document.body.style.background = 'radial-gradient(120% 80% at 50% 0%, #2a1446 0%, #0b0912 70%)';
  document.getElementById('loader').classList.add('done');
  throw e;
}
// Phones and tablets get a lower render resolution and a smaller shadow map: the scene is soft and fogged,
// so the difference is hard to see, but it roughly halves the GPU work on high-density screens.
const lowPower = matchMedia('(pointer: coarse)').matches || innerWidth < 900;
renderer.setPixelRatio(Math.min(devicePixelRatio, lowPower ? 1.25 : 1.5));
renderer.setSize(innerWidth, innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x1d1233, 0.017);

const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 900);

// Gradient sky dome
const sky = new THREE.Mesh(
  new THREE.SphereGeometry(450, 32, 16),
  new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      top: { value: new THREE.Color(0x07060f) },
      mid: { value: new THREE.Color(0x2b1650) },
      low: { value: new THREE.Color(0x5a2242) },
    },
    vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 top, mid, low; varying vec3 vP;
      void main(){ float h = vP.y;
        vec3 c = h > 0.0 ? mix(mid, top, smoothstep(0.0, 0.55, h)) : mix(mid, low, smoothstep(0.0, -0.35, h));
        gl_FragColor = vec4(c, 0.0); }`,   // alpha 0 marks "sky" for the transition compositor (the page canvas ignores alpha)
  })
);
scene.add(sky);

// Lights
scene.add(new THREE.HemisphereLight(0x8f80ff, 0x2a160c, 0.9));
const moon = new THREE.DirectionalLight(0xa9b8ff, 1.6);
moon.position.set(-35, 60, 10);
moon.target.position.set(0, 6, -38);
moon.castShadow = true;
moon.shadow.mapSize.setScalar(lowPower ? 1024 : 2048);
Object.assign(moon.shadow.camera, { left: -45, right: 45, top: 60, bottom: -60, near: 1, far: 160 });
moon.shadow.bias = -0.0015;
scene.add(moon, moon.target);

/* ============================================================
   World pieces
   ============================================================ */
const M = {
  grass: mat(0x4e7f45), grass2: mat(0x3e6d43),
  soil: mat(0x6a4a37), rock: mat(0x5c4a44), rockDark: mat(0x3d3036),
  stone: mat(0x7d7590), trunk: mat(0x5a3b28),
  leaves: [mat(0x3f7a3a), mat(0x5b8f3c), mat(0x2f6b4a)],
  special: mat(0xb14dff, { emissive: 0x6d1fb3, emissiveIntensity: 0.25 }),   // purple leaves, but only the Core glows
  flame: new THREE.MeshBasicMaterial({ color: 0xffb066 }),
  cloud: mat(0x2a1a44, { roughness: 1, transparent: true, opacity: 0.55 }),
};

function tree(h, special = false) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(jitter(new THREE.CylinderGeometry(0.12, 0.2, h * 0.45, 5), 0.06), M.trunk);
  trunk.position.y = h * 0.22;
  g.add(trunk);
  const leafMat = special ? M.special : M.leaves[Math.floor(rand() * M.leaves.length)];
  if (!special && rand() < 0.5) {
    for (let i = 0; i < 3; i++) {                       // pine
      const c = new THREE.Mesh(jitter(new THREE.ConeGeometry(h * (0.42 - i * 0.1), h * 0.45, 6), 0.12), leafMat);
      c.position.y = h * (0.45 + i * 0.22);
      g.add(c);
    }
  } else {                                              // round canopy
    const n = special ? 3 : 2;
    for (let i = 0; i < n; i++) {
      const s = h * rr(0.28, 0.38);
      const c = new THREE.Mesh(jitter(new THREE.IcosahedronGeometry(s, 0), s * 0.3), leafMat);
      c.position.set(rr(-0.25, 0.25) * h, h * (0.6 + i * 0.18), rr(-0.25, 0.25) * h);
      g.add(c);
    }
  }
  g.rotation.y = rr(0, Math.PI * 2);
  return shadow(g);
}

function rock(s) {
  const r = new THREE.Mesh(jitter(new THREE.DodecahedronGeometry(s, 0), s * 0.5), rand() < 0.5 ? M.rock : M.rockDark);
  r.scale.y = rr(0.55, 0.9);
  r.rotation.set(rr(0, 3), rr(0, 3), rr(0, 3));
  return shadow(r);
}

const torches = [];
function torch() {
  const g = new THREE.Group();
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 1.6, 5), M.trunk);
  post.position.y = 0.8;
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.12, 0.2, 6), M.rockDark);
  bowl.position.y = 1.65;
  const flame = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 0), M.flame);
  flame.position.y = 1.9;
  const light = new THREE.PointLight(0xff7a2f, 22, 14, 2);
  light.position.y = 2.1;
  g.add(post, bowl, flame, light);
  torches.push({ light, flame, base: 22, phase: rr(0, 10) });
  return shadow(g);
}

function ruin(h) {
  const g = new THREE.Group();
  const col = new THREE.Mesh(jitter(new THREE.CylinderGeometry(0.35, 0.42, h, 6, 2), 0.08), M.stone);
  col.position.y = h / 2;
  const cap = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.25, 1.05), M.stone);
  cap.position.y = h + 0.1;
  cap.rotation.y = rr(-0.3, 0.3);
  g.add(col);
  if (rand() < 0.6) g.add(cap);
  g.rotation.z = rr(-0.08, 0.08);
  return shadow(g);
}

// Places things on an island's flat top
function scatter(island, r, make, count, minR = 0, maxR = 0.78) {
  for (let i = 0; i < count; i++) {
    const a = rr(0, Math.PI * 2), d = Math.sqrt(rr(minR, 1)) * r * maxR;
    const o = make();
    o.position.set(Math.cos(a) * d, 0.42, Math.sin(a) * d);
    island.add(o);
  }
}

function island(r, deco = {}) {
  const g = new THREE.Group();
  const top = new THREE.Mesh(jitter(new THREE.CylinderGeometry(r, r * 0.94, 0.85, 10, 1), 0.25, 0.4), M.grass);
  const lip = new THREE.Mesh(jitter(new THREE.CylinderGeometry(r * 0.97, r * 0.88, 0.7, 10, 1), 0.3), M.soil);
  lip.position.y = -0.7;
  const body = new THREE.Mesh(jitter(new THREE.ConeGeometry(r * 0.9, r * 1.8, 10, 4), r * 0.18), M.rock);
  body.rotation.x = Math.PI;
  body.position.y = -1.05 - r * 0.9;
  g.add(top, lip, body);
  for (let i = 0; i < 3; i++) {                          // hanging chunks
    const c = rock(r * rr(0.14, 0.24));
    const a = rr(0, Math.PI * 2);
    c.position.set(Math.cos(a) * r * 0.55, -r * rr(0.6, 1.3), Math.sin(a) * r * 0.55);
    g.add(c);
  }
  shadow(g);
  if (deco.trees) scatter(g, r, () => tree(rr(1.6, 3.0)), deco.trees, 0.15);
  if (deco.special) scatter(g, r, () => tree(rr(2.6, 3.4), true), deco.special, 0.1, 0.5);
  if (deco.rocks) scatter(g, r, () => { const k = rock(rr(0.25, 0.6)); k.position.y = 0.5; return k; }, deco.rocks);
  if (deco.ruins) scatter(g, r, () => ruin(rr(1.2, 3.4)), deco.ruins, 0.05, 0.7);
  if (deco.torches) scatter(g, r, torch, deco.torches, 0.3, 0.7);
  return g;
}

/* ---------- layout: a rising chain of islands leading to the Core ---------- */
const ISLANDS = [
  { p: [0, 0, 0],      r: 6.2, deco: { trees: 7, rocks: 5, torches: 2 } },
  { p: [13, 4, -20],   r: 4.2, deco: { trees: 4, special: 1, rocks: 3 } },
  { p: [-10, 8, -38],  r: 5.2, deco: { ruins: 6, rocks: 4, torches: 1, trees: 1 } },
  { p: [8, 12, -56],   r: 4.4, deco: { trees: 5, special: 1, rocks: 2 } },
  { p: [-1, 16, -76],  r: 6.6, deco: { ruins: 4, torches: 3, rocks: 3 } },
];
const islandMeshes = ISLANDS.map((d, i) => {
  const g = island(d.r, d.deco);
  g.position.set(...d.p);
  g.userData = { baseY: d.p[1], phase: i * 1.3 };
  scene.add(g);
  return g;
});

// Stepping stones between islands
for (let i = 0; i < ISLANDS.length - 1; i++) {
  const a = new THREE.Vector3(...ISLANDS[i].p), b = new THREE.Vector3(...ISLANDS[i + 1].p);
  for (let k = 1; k <= 3; k++) {
    const t = k / 4;
    const s = new THREE.Group();
    const slab = new THREE.Mesh(jitter(new THREE.CylinderGeometry(0.9, 0.5, 0.6, 7), 0.25), M.grass2);
    const under = rock(0.6); under.position.y = -0.55;
    s.add(slab, under);
    s.position.lerpVectors(a, b, t);
    s.position.x += rr(-2, 2);
    s.userData = { baseY: s.position.y, phase: rr(0, 6) };
    scene.add(shadow(s));
    islandMeshes.push(s);
  }
}

/* ---------- the Core: a glowing cube visible from everywhere ---------- */
const core = new THREE.Group();
const coreMat = new THREE.MeshStandardMaterial({ color: 0x1e0830, emissive: 0xb14dff, emissiveIntensity: 2.4, flatShading: true });
const coreBox = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.8, 1.8), coreMat);
const coreEdges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(2.6, 2.6, 2.6)),
  new THREE.LineBasicMaterial({ color: 0xe3c4ff, transparent: true, opacity: 0.55 }));
const coreLight = new THREE.PointLight(0xb14dff, 90, 60, 1.6);
const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.9, 120, 12, 1, true),
  new THREE.MeshBasicMaterial({ color: 0xb14dff, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
beam.position.y = 60;
core.add(coreBox, coreEdges, coreLight, beam);
const shards = [];
for (let i = 0; i < 7; i++) {
  const s = new THREE.Mesh(new THREE.OctahedronGeometry(rr(0.18, 0.32), 0), coreMat);
  s.userData = { r: rr(2.4, 3.6), sp: rr(0.4, 0.9), off: rr(0, 6.28), y: rr(-1, 1) };
  core.add(s);
  shards.push(s);
}
core.position.set(-1, 23, -76);
scene.add(core);

/* ---------- clouds below, debris around ---------- */
for (let i = 0; i < 34; i++) {
  const s = rr(3, 8);
  const c = new THREE.Mesh(jitter(new THREE.IcosahedronGeometry(s, 0), s * 0.4), M.cloud);
  c.scale.set(rr(1.2, 2), 0.3, rr(1.2, 2));
  c.position.set(rr(-60, 60), rr(-18, -10) + i * 0.15, rr(25, -110));
  scene.add(c);
}
const debris = [];
for (let i = 0; i < 40; i++) {
  const d = rock(rr(0.2, 0.7));
  d.position.set(rr(-35, 35), rr(-4, 32), rr(15, -95));
  d.userData = { baseY: d.position.y, phase: rr(0, 6), spin: rr(-0.4, 0.4) };
  scene.add(d);
  debris.push(d);
}

/* ---------- embers ---------- */
const EMBERS = 650;
const emberGeo = new THREE.BufferGeometry();
const ep = new Float32Array(EMBERS * 3), es = new Float32Array(EMBERS);
for (let i = 0; i < EMBERS; i++) {
  ep[i * 3] = rr(-35, 35); ep[i * 3 + 1] = rr(-10, 40); ep[i * 3 + 2] = rr(20, -100);
  es[i] = rr(0.3, 1.2);
}
emberGeo.setAttribute('position', new THREE.BufferAttribute(ep, 3));
const embers = new THREE.Points(emberGeo, new THREE.PointsMaterial({
  color: 0xffa060, size: 0.14, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false,
}));
scene.add(embers);

/* ---------- undead on their way to the Core (undead.js) ---------- */
createUndead({
  scene, islands: islandMeshes.slice(0, ISLANDS.length), stones: islandMeshes.slice(ISLANDS.length),
  islandDefs: ISLANDS, core, lowPower, reduceMotion,
});

loaderFill.style.width = '75%';

/* ============================================================
   Camera path, driven by scroll
   ============================================================ */
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const camPath = new THREE.CatmullRomCurve3([
  V(0, 5.5, 18),     // hero
  V(-7, 8, 5),       // about
  V(5, 11, -12),     // experience
  V(-3, 14.5, -30),  // featured
  V(6, 19, -48),     // projects
  V(0, 21, -60),     // contact: close to the Core so it reads as the payoff, above the headline
]);
const lookPath = new THREE.CatmullRomCurve3([
  V(0, 2.5, 0),
  V(9, 5, -18),
  V(-8, 9, -36),
  V(6, 13, -55),
  V(-1, 19, -76),
  V(-1, 18, -76),    // aim below the Core so it sits high on screen, clear of the contact text
]);

let target = 0, prog = 0;
// On wide screens, aim the camera left of the hero island so the island sits to the right of the title.
let heroShift = innerWidth > 900 ? -5 : 0;
const mouse = { x: 0, y: 0, sx: 0, sy: 0 };
addEventListener('pointermove', e => {
  mouse.x = (e.clientX / innerWidth) * 2 - 1;
  mouse.y = (e.clientY / innerHeight) * 2 - 1;
});

const progressFill = document.getElementById('progressFill');
// While Projects and Breakdowns cover the screen, the world only shows through at ~10% opacity,
// so it renders at a quarter of the frame rate there.
const coverFrom = document.querySelector('.projects'), coverTo = document.querySelector('.breakdowns');
let covered = false;
function readScroll() {
  const max = document.documentElement.scrollHeight - innerHeight;
  target = max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0;
  progressFill.style.transform = `scaleX(${target})`;
  const top = coverFrom.getBoundingClientRect().top + coverFrom.offsetHeight * 0.15;   // past its fade-in gradient
  covered = top <= 0 && coverTo.getBoundingClientRect().bottom >= innerHeight;
}
addEventListener('scroll', readScroll, { passive: true });
readScroll();
prog = target;

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight, false);
  heroShift = innerWidth > 900 ? -5 : 0;
  sizeTargets();
  gallery.layout();
  readScroll();
});

/* ============================================================
   Loop
   ============================================================ */
const clock = new THREE.Clock();
const look = new THREE.Vector3();
let skipped = 0;
function frame() {
  if (covered && mix <= 0 && !trans.active && ++skipped % 4) { requestAnimationFrame(frame); return; }
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  stepTransition();
  const showWorld = mix < 1, showGallery = mix > 0;

  if (showWorld) updateWorld(dt, t);
  if (showGallery) gallery.update(dt, t);

  if (mix <= 0) {                       // normal page: world straight to screen
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.setRenderTarget(null);
    renderer.render(scene, camera);
  } else if (mix >= 1) {                // gallery open: gallery straight to screen
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.setRenderTarget(null);
    renderer.render(gallery.scene, gallery.camera);
  } else {                              // transition: render both, then the pixel-grid composite
    renderer.setRenderTarget(rtA); renderer.render(scene, camera);
    renderer.setRenderTarget(rtB); renderer.render(gallery.scene, gallery.camera);
    renderer.setRenderTarget(null);
    renderer.toneMapping = THREE.NoToneMapping;
    comp.uniforms.progress.value = mix;
    comp.uniforms.time.value = t;
    renderer.render(compScene, compCam);
  }
  requestAnimationFrame(frame);
}

function updateWorld(dt, t) {
  prog += (target - prog) * (1 - Math.pow(0.0015, dt));   // camera eases even with reduce-motion (user-driven, smooth)
  mouse.sx += (mouse.x - mouse.sx) * 0.05;
  mouse.sy += (mouse.y - mouse.sy) * 0.05;

  camera.position.copy(camPath.getPointAt(prog));
  camera.position.x += mouse.sx * 0.9;
  camera.position.y -= mouse.sy * 0.5;
  look.copy(lookPath.getPointAt(prog));
  const heroW = Math.max(0, 1 - prog * 6);             // fades out over the first part of the scroll
  camera.position.x += heroShift * heroW;
  look.x += heroShift * heroW;
  camera.lookAt(look);

  if (!reduceMotion) {
    for (const g of islandMeshes) g.position.y = g.userData.baseY + Math.sin(t * 0.6 + g.userData.phase) * 0.25;
    for (const d of debris) { d.position.y = d.userData.baseY + Math.sin(t * 0.5 + d.userData.phase) * 0.6; d.rotation.y += d.userData.spin * dt; }
    coreBox.rotation.set(t * 0.4, t * 0.6, 0);
    coreEdges.rotation.set(-t * 0.25, -t * 0.35, t * 0.1);
    core.position.y = 23 + Math.sin(t * 0.8) * 0.4;
    for (const s of shards) {
      const u = s.userData, a = t * u.sp + u.off;
      s.position.set(Math.cos(a) * u.r, u.y + Math.sin(a * 1.3) * 0.5, Math.sin(a) * u.r);
      s.rotation.x += dt; s.rotation.y += dt * 0.7;
    }
    const pa = emberGeo.attributes.position;
    for (let i = 0; i < EMBERS; i++) {
      let y = pa.getY(i) + es[i] * dt * 1.2;
      if (y > 42) y = -10;
      pa.setY(i, y);
      pa.setX(i, pa.getX(i) + Math.sin(t * 0.7 + i) * dt * 0.15);
    }
    pa.needsUpdate = true;
  }
  coreLight.intensity = 80 + Math.sin(t * 2.2) * 15;
  for (const f of torches) {
    const flick = Math.sin(t * 9 + f.phase) * 0.12 + Math.sin(t * 23 + f.phase) * 0.08;
    f.light.intensity = f.base * (1 + flick);
    f.flame.scale.setScalar(1 + flick * 0.8);
  }
}

/* ============================================================
   3D gallery of all work + pixel-grid transition into it
   ============================================================ */
const GALLERY_ITEMS = [
  { kind: 'Project', title: 'CoreUndead', role: 'Action Adventure / Shooter · Game Design, Level Design · UEFN',
    img: 'img/coreundead.jpg', url: 'https://www.artstation.com/artwork/DLE6En' },
  ...PROJECTS.map(p => ({ kind: 'Project', title: p.title, role: p.role, img: p.img, url: p.url })),
  ...BREAKDOWNS.map(b => ({ kind: 'Breakdown', title: b.title, role: b.sub, img: b.img, url: b.url })),
];
const FIRST_BREAKDOWN = 1 + PROJECTS.length;

const gallery = createGallery(renderer, GALLERY_ITEMS, { onRequestClose: () => closeGallery() });

// Render targets for the transition (multisampled so edges stay smooth)
const rtOpts = { type: THREE.HalfFloatType, samples: 4 };
const rtA = new THREE.WebGLRenderTarget(1, 1, rtOpts);
const rtB = new THREE.WebGLRenderTarget(1, 1, rtOpts);
function sizeTargets() {
  const pr = Math.min(devicePixelRatio, 1.5);
  rtA.setSize(innerWidth * pr, innerHeight * pr);
  rtB.setSize(innerWidth * pr, innerHeight * pr);
  comp.uniforms.grid.value.set(Math.round(18 * innerWidth / innerHeight), 18);
}

const comp = new THREE.ShaderMaterial({
  depthTest: false, depthWrite: false,
  uniforms: {
    tA: { value: rtA.texture }, tB: { value: rtB.texture },
    progress: { value: 0 }, time: { value: 0 }, exposure: { value: renderer.toneMappingExposure },
    grid: { value: new THREE.Vector2(32, 18) },
    simple: { value: reduceMotion ? 1 : 0 },   // reduce-motion: plain crossfade instead of the glitch
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tA, tB; uniform float progress, time, exposure, simple; uniform vec2 grid; varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    vec3 rrt(vec3 v){ vec3 a = v * (v + 0.0245786) - 0.000090537; vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081; return a / b; }
    vec3 aces(vec3 c){
      const mat3 inM = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
      const mat3 outM = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
      c *= exposure / 0.6; c = inM * c; c = rrt(c); c = outM * c; return clamp(c, 0.0, 1.0);
    }
    vec3 srgb(vec3 c){ c = clamp(c, 0.0, 1.0); return mix(1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, c * 12.92, step(c, vec3(0.0031308))); }
    // World target: alpha 0 = sky (already display-ready), alpha 1 = lit scene (needs tone mapping)
    vec3 A(vec2 uv){ vec4 a = texture2D(tA, uv); return mix(a.rgb, srgb(aces(a.rgb)), clamp(a.a, 0.0, 1.0)); }
    vec3 B(vec2 uv){ return srgb(texture2D(tB, uv).rgb); }
    void main(){
      vec2 uv = vUv;
      if (simple > 0.5) { gl_FragColor = vec4(mix(A(uv), B(uv), smoothstep(0.0, 1.0, progress)), 1.0); return; }
      vec2 cell = floor(uv * grid);
      float r = hash(cell);
      float th = 0.08 + 0.84 * (0.65 * r + 0.35 * uv.x);
      float d = progress - th;
      float band = 1.0 - smoothstep(0.0, 0.16, abs(d));
      float showB = step(0.0, d);
      float mid = 1.0 - abs(progress * 2.0 - 1.0);
      vec2 g2 = grid * mix(8.0, 1.0, mid);
      vec2 uq = (floor(uv * g2) + 0.5) / g2;
      vec2 us = mix(uv, uq, max(step(0.02, band), smoothstep(0.35, 0.9, mid)));
      float j = (hash(cell + floor(time * 24.0)) - 0.5) * band;
      vec2 off = vec2(0.014 * j + 0.006 * band, 0.0);
      vec3 a = vec3(A(us + off).r, A(us).g, A(us - off).b);
      vec3 b = vec3(B(us + off).r, B(us).g, B(us - off).b);
      vec3 col = mix(a, b, showB);
      float flick = step(0.55, hash(cell * 1.7 + floor(time * 18.0)));
      vec3 tint = mix(vec3(0.69, 0.30, 1.0), vec3(1.0, 0.48, 0.18), hash(cell + 3.1));
      col = mix(col, tint, band * flick * 0.55);
      gl_FragColor = vec4(col, 1.0);
    }`,
});
const compScene = new THREE.Scene();
const compQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), comp);
compQuad.frustumCulled = false;
compScene.add(compQuad);
const compCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
sizeTargets();

// Warm up the shader variants used during the transition so the first click doesn't stutter
renderer.setRenderTarget(rtA); renderer.render(scene, camera);
renderer.setRenderTarget(rtB); renderer.render(gallery.scene, gallery.camera);
renderer.setRenderTarget(null);

let mix = 0;                               // 0 = world, 1 = gallery
const trans = { active: false, from: 0, to: 0, start: 0, dur: 1.15, done: null };
const ease = x => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
function stepTransition() {
  if (!trans.active) return;
  const k = Math.min(1, (performance.now() - trans.start) / (trans.dur * 1000));
  mix = trans.from + (trans.to - trans.from) * ease(k);
  if (k >= 1) { trans.active = false; mix = trans.to; trans.done?.(); }
}
function runTransition(to, done) {
  Object.assign(trans, { active: true, from: mix, to, start: performance.now(), done });
}

const galleryEnabled = true;            // with reduce-motion on, the transition is a crossfade (see `simple`)
if (reduceMotion) trans.dur = 0.6;
let pushedState = false;
let galleryOpener = null;                  // keyboard focus goes back here when the gallery closes
function openGallery(index = 0) {
  if (gallery.isOpen) return;
  galleryOpener = document.activeElement;
  document.body.classList.add('g-open');
  document.documentElement.classList.add('g-lock');
  gallery.show(index);
  history.pushState({ gallery: true }, '', '#gallery');
  pushedState = true;
  runTransition(1, () => gallery.showUI());
}
function closeGallery() {
  if (!gallery.isOpen) return;
  if (pushedState) { pushedState = false; history.back(); return; }   // popstate finishes the close
  finishClose();
}
function finishClose() {
  gallery.hide();
  runTransition(0, () => {
    document.body.classList.remove('g-open');
    document.documentElement.classList.remove('g-lock');
    if (galleryOpener?.isConnected && galleryOpener !== document.body) galleryOpener.focus({ preventScroll: true });
    galleryOpener = null;
  });
}
addEventListener('popstate', () => { if (gallery.isOpen) { pushedState = false; finishClose(); } });

document.querySelectorAll('.g-only').forEach(el => { el.hidden = !galleryEnabled; });
// Start downloading gallery images as soon as someone points at, touches or tabs to a gallery link
document.querySelectorAll('[data-gallery]').forEach(el => {
  ['pointerenter', 'touchstart', 'focus'].forEach(ev => el.addEventListener(ev, () => gallery.preload(), { once: true, passive: true }));
});
document.querySelectorAll('[data-gallery]').forEach(el => {
  if (!galleryEnabled) return;            // plain anchor links keep working without the gallery
  el.addEventListener('click', e => {
    e.preventDefault();
    openGallery(el.dataset.gallery === 'breakdowns' ? FIRST_BREAKDOWN : 0);
  });
});
if (galleryEnabled && location.hash === '#gallery') history.replaceState(null, '', location.pathname);

requestAnimationFrame(frame);

/* ============================================================
   Checkpoint scrolling for the opening sections.
   Hero → About → Experience → Featured: one scroll gesture glides to the next
   text, centred on screen. Below Featured, scrolling is normal again.
   ============================================================ */
(() => {
  const sections = [
    document.querySelector('.hero'),
    document.querySelector('.about'),
    document.querySelector('.featured'),
  ].filter(Boolean);   // a missing section (e.g. a cached old page) is skipped, not a crash
  const root = document.documentElement;
  const maxY = () => root.scrollHeight - innerHeight;
  // Each stop centres the section's content (its card) in the space under the menu. If the content is taller
  // than that space, the stop puts its top just below the menu, and a second stop shows its bottom, so a
  // swipe never skips part of a card.
  const MENU = 96;
  const clampY = y => Math.max(0, Math.min(maxY(), Math.round(y)));
  const content = s => {
    const c = s.querySelector('.card, .featured-inner') || s;
    return { top: s.offsetTop + (c === s ? 0 : c.offsetTop), h: c.offsetHeight };   // offsets ignore reveal transforms
  };
  const stops = () => sections.map((s, i) => {          // one stop per section (menu links use these)
    if (i === 0) return 0;
    const { top, h } = content(s);
    return clampY(h > innerHeight - MENU - 24 ? top - MENU : top + h / 2 - (innerHeight + MENU) / 2);
  });
  const allStops = () => {                              // plus a "see the rest" stop for tall content
    const base = stops(), out = [];
    sections.forEach((s, i) => {
      out.push(base[i]);
      if (i === 0) return;
      const { top, h } = content(s);
      const tail = clampY(top + h + 24 - innerHeight);
      if (tail > base[i] + 8) out.push(tail);
    });
    return out;
  };
  const lastStop = () => allStops().at(-1);
  const locked = () => root.classList.contains('g-lock');            // gallery open

  let anim = null;
  function glideTo(y) {
    y = Math.max(0, Math.min(maxY(), y));
    if (anim) cancelAnimationFrame(anim.raf);
    const from = scrollY, dist = y - from;
    if (Math.abs(dist) < 2) return;
    // glides even with reduce-motion: a short, user-started scroll reads better than a hard jump
    const dur = Math.min(1100, 650 + Math.abs(dist) * 0.25);
    const t0 = performance.now();
    const easeIO = x => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
    anim = { raf: 0 };
    const step = now => {
      const k = Math.min(1, (now - t0) / dur);
      scrollTo(0, from + dist * easeIO(k));
      if (k < 1) anim.raf = requestAnimationFrame(step); else anim = null;
    };
    anim.raf = requestAnimationFrame(step);
  }
  function go(dir) {                                   // dir: +1 next, -1 previous
    const s = allStops(), y = scrollY;
    if (dir > 0) { const i = s.findIndex(v => v > y + 4); if (i >= 0) glideTo(s[i]); }
    else { let i = -1; s.forEach((v, k) => { if (v < y - 4) i = k; }); glideTo(i >= 0 ? s[i] : 0); }
  }
  // Should this gesture be handled as a checkpoint move (instead of normal scrolling)?
  function inZone(dir) {
    const y = scrollY, last = lastStop();
    if (dir > 0) return y < last - 4;                                    // still before Featured
    return y > 2 && y <= last + innerHeight * 0.6;                       // coming back up into the intro
  }

  // Mouse wheel / trackpad: one gesture = one checkpoint. Trackpad momentum is swallowed.
  let lastWheel = 0, gestureUsed = false;
  addEventListener('wheel', e => {
    if (locked() || e.ctrlKey) return;
    const now = performance.now();
    const newGesture = now - lastWheel > 180;
    lastWheel = now;
    const dir = Math.sign(e.deltaY);
    if (!dir) return;
    if (anim || (!newGesture && gestureUsed)) {        // mid-glide or trailing momentum
      if (anim || inZone(dir)) e.preventDefault();
      return;
    }
    gestureUsed = false;
    if (!inZone(dir)) return;                          // normal scrolling below the intro
    e.preventDefault();
    if (Math.abs(e.deltaY) < 4) return;                // ignore tiny trackpad jitter
    gestureUsed = true;
    go(dir);
  }, { passive: false });

  // Keyboard
  addEventListener('keydown', e => {
    if (locked() || e.defaultPrevented || e.target.closest?.('input, textarea, select, [contenteditable]')) return;
    if (e.key === ' ' && e.target.closest?.('a, button')) return;          // Space presses a focused button, it doesn't scroll
    const down = ['ArrowDown', 'PageDown', ' '].includes(e.key) && !e.shiftKey;
    const up = ['ArrowUp', 'PageUp'].includes(e.key) || (e.key === ' ' && e.shiftKey);
    const dir = down ? 1 : up ? -1 : 0;
    if (!dir || !inZone(dir)) return;
    e.preventDefault();
    go(dir);
  });

  // Touch: a swipe moves one checkpoint
  let touch = null;
  addEventListener('touchstart', e => { if (!locked()) touch = { x: e.touches[0].clientX, y: e.touches[0].clientY, moved: false }; }, { passive: true });
  addEventListener('touchmove', e => {
    if (!touch || locked()) return;
    const dy = touch.y - e.touches[0].clientY;
    const dx = touch.x - e.touches[0].clientX;
    if (!touch.moved && Math.abs(dx) > Math.abs(dy)) { touch = null; return; }   // sideways swipe (e.g. the work row): leave it alone
    const dir = Math.sign(dy);
    if (dir && (anim || inZone(dir))) { e.preventDefault(); touch.moved = true; touch.dir = dir; touch.dy = dy; }
  }, { passive: false });
  addEventListener('touchend', () => {
    if (touch?.moved && Math.abs(touch.dy) > 30 && !anim) go(touch.dir);
    touch = null;
  });

  // No snap-back: if someone drags the scrollbar or lands between checkpoints, the page stays where they put it.

  // In-page links (menu, logo) glide to their section; intro sections land on their checkpoint.
  // Gallery buttons (data-gallery) are handled separately and open the 3D gallery instead.
  const checkpointOf = { '#top': 0, '#about': 1, '#work': 2 };
  document.querySelectorAll('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
    const href = a.getAttribute('href');
    if (a.hasAttribute('data-gallery') || href === '#') return;
    const el = document.querySelector(href);
    if (!el) return;
    e.preventDefault();
    if (locked()) return;
    const isCard = el.classList.contains('proj');            // hero tiles point at project cards
    glideTo(href in checkpointOf ? stops()[checkpointOf[href]]
      : el.getBoundingClientRect().top + scrollY - (isCard ? 110 : 0));   // cards stop clear of the menu
    if (isCard) {                                            // brief highlight so it's clear where you landed
      el.classList.remove('arrived'); void el.offsetWidth; el.classList.add('arrived');
      setTimeout(() => el.classList.remove('arrived'), 1800);
    }
    if (e.detail === 0) {                                    // keyboard activation: move focus too
      if (!isCard) el.setAttribute('tabindex', '-1');
      el.focus({ preventScroll: true });
    }
  }));
})();

/* ============================================================
   Intro and reveals
   ============================================================ */
loaderFill.style.width = '100%';
const gsap = window.gsap;
setTimeout(() => {
  document.getElementById('loader').classList.add('done');
  if (gsap && !reduceMotion) {
    gsap.from('.hero-title .line span', { yPercent: 110, duration: 1.3, ease: 'expo.out', stagger: 0.12, delay: 0.15 });
  }
}, 450);

if (gsap && window.ScrollTrigger && !reduceMotion) {
  gsap.registerPlugin(window.ScrollTrigger);
  // Hero items are on screen from the start, so they fade in on load instead of waiting for a scroll trigger
  gsap.from('.hero .reveal', { y: 30, opacity: 0, duration: 1.1, ease: 'power3.out', stagger: 0.1, delay: 0.5 });
  gsap.utils.toArray('.reveal').filter(el => !el.closest('.hero')).forEach(el => {
    gsap.from(el, {
      y: 46, opacity: 0, duration: 1.1, ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 88%' },
    });
  });
}

