import * as THREE from './vendor/three.module.min.js';

/*
  Curved 3D gallery: every project and breakdown as a card on a ring around the viewer,
  with a reflective floor. Rendered into its own scene; main.js handles the transition into it.
*/
export function createGallery(renderer, items, { onRequestClose } = {}) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x07050d);
  const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 100);

  const N = items.length;
  const R = 7.2;                  // ring radius (viewer sits at the centre)
  let STEP = 0.4;                 // angle between cards
  let W = 2.9, H = 1.86;          // card size
  const floorY = () => -H / 2 - 0.14;

  /* ---------- cards ---------- */
  function bentPlane(w, h) {
    const g = new THREE.PlaneGeometry(w, h, 40, 1);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const a = p.getX(i) / R;
      p.setXYZ(i, R * Math.sin(a), p.getY(i), R * (1 - Math.cos(a)));
    }
    g.computeVertexNormals();
    return g;
  }

  const cardVert = `
    varying vec2 vUv; varying float vDepth;
    void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vDepth = -mv.z; gl_Position = projectionMatrix * mv; }`;
  const cardFrag = `
    uniform sampler2D map; uniform float imgAspect, cardAspect, focus, hover, isReflection, ready;
    varying vec2 vUv; varying float vDepth;
    float sdRound(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
    void main(){
      vec2 s = vec2(1.0);
      if (imgAspect > cardAspect) s.x = cardAspect / imgAspect; else s.y = imgAspect / cardAspect;
      vec2 tuv = (vUv - 0.5) * s * (1.0 - 0.05 * focus) + 0.5;
      vec3 col = mix(vec3(0.05, 0.03, 0.09), texture2D(map, tuv).rgb, ready);
      vec2 p = (vUv - 0.5) * vec2(cardAspect, 1.0);
      float d = sdRound(p, vec2(cardAspect * 0.5, 0.5), 0.055);
      float alpha = 1.0 - smoothstep(-0.004, 0.002, d);
      float border = 1.0 - smoothstep(0.0, 0.014, abs(d + 0.007));
      vec3 edge = vec3(0.92, 0.90, 0.95);          // neutral frame: the purple glow belongs to the Core only
      float lum = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(vec3(lum), col, mix(0.45, 1.0, focus));          // side cards slightly desaturated
      col *= mix(0.16, 1.0, focus) * (1.0 + 0.6 * hover * (1.0 - focus));
      col += edge * border * (0.08 + 0.34 * focus);
      float fade = 1.0 - smoothstep(8.5, 15.0, vDepth);
      if (isReflection > 0.5) { alpha *= smoothstep(0.25, 1.0, vUv.y) * 0.5; }
      gl_FragColor = vec4(col * mix(0.15, 1.0, fade), alpha * mix(0.25, 1.0, fade));
      #include <colorspace_fragment>
    }`;

  const loader = new THREE.TextureLoader();
  const cards = [], reflections = [];
  const textureJobs = [];
  let texturesRequested = false;
  let geo = bentPlane(W, H);
  items.forEach((it, i) => {
    const uniforms = {
      map: { value: null }, imgAspect: { value: 16 / 9 }, cardAspect: { value: W / H },
      focus: { value: 0 }, hover: { value: 0 }, isReflection: { value: 0 }, ready: { value: 0 },
    };
    // Textures download only when the gallery is about to open (see preload), not with the page
    textureJobs.push(() => {
      uniforms.map.value = loader.load(it.img, t => {
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = renderer.capabilities.getMaxAnisotropy();
        t.needsUpdate = true;
        uniforms.imgAspect.value = t.image.width / t.image.height;
        uniforms.ready.value = 1;
      });
    });
    const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: cardVert, fragmentShader: cardFrag, transparent: true, side: THREE.DoubleSide });
    const card = new THREE.Mesh(geo, mat);
    card.userData.index = i;
    card.renderOrder = 2;
    const rMat = mat.clone();
    rMat.uniforms = { ...THREE.UniformsUtils.clone(uniforms), map: uniforms.map, imgAspect: uniforms.imgAspect, ready: uniforms.ready };
    rMat.uniforms.isReflection.value = 1;
    rMat.depthWrite = false;
    const refl = new THREE.Mesh(geo, rMat);
    refl.renderOrder = 0;
    scene.add(card, refl);
    cards.push(card); reflections.push(refl);
  });

  /* ---------- floor: dark, glossy, with a faint grid ---------- */
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 60),
    new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `varying vec3 vW;
        void main(){
          float r = length(vW.xz);
          vec3 col = vec3(0.012, 0.008, 0.026);
          col += vec3(0.16, 0.14, 0.20) * 0.09 * exp(-pow(max(r - 5.5, 0.0), 1.2) * 0.35) * smoothstep(9.0, 6.0, r);
          vec2 g = abs(fract(vW.xz * 0.9) - 0.5) / fwidth(vW.xz * 0.9);
          float line = 1.0 - min(min(g.x, g.y), 1.0);
          col += vec3(0.36, 0.34, 0.42) * line * 0.10 * exp(-r * 0.16);
          gl_FragColor = vec4(col, 0.62 * smoothstep(26.0, 12.0, r));
          #include <colorspace_fragment>
        }`,
    })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.renderOrder = 1;
  scene.add(floor);

  /* ---------- ceiling light strips ---------- */
  const strips = new THREE.Group();
  const stripMat = new THREE.MeshBasicMaterial({ color: 0x4a4552, transparent: true, opacity: 0.35 });
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.02, 2.2), stripMat);
    s.position.set(Math.sin(a) * (R + 1.5), 3.1, -Math.cos(a) * (R + 1.5));
    s.rotation.y = -a;
    strips.add(s);
  }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(R + 0.6, 0.012, 6, 160),
    new THREE.MeshBasicMaterial({ color: 0x6e6878, transparent: true, opacity: 0.35 }));
  ring.rotation.x = Math.PI / 2; ring.position.y = 2.7;
  strips.add(ring);
  scene.add(strips);

  /* ---------- drifting dust ---------- */
  const DUST = 260, dp = new Float32Array(DUST * 3);
  for (let i = 0; i < DUST; i++) {
    const a = Math.random() * Math.PI * 2, d = 3 + Math.random() * 9;
    dp[i * 3] = Math.sin(a) * d; dp[i * 3 + 1] = -1.4 + Math.random() * 4.5; dp[i * 3 + 2] = -Math.cos(a) * d;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dp, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0xb9b2c4, size: 0.03, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(dust);

  /* ---------- UI ---------- */
  const ui = document.createElement('div');
  ui.className = 'g-ui';
  ui.hidden = true;
  ui.setAttribute('role', 'dialog');
  ui.setAttribute('aria-modal', 'true');
  ui.setAttribute('aria-label', 'All work gallery');
  ui.innerHTML = `
    <button class="g-back" type="button"><span class="ico ico-left" aria-hidden="true"></span> Exit gallery</button>
    <div class="g-count" aria-hidden="true"><b>01</b> / ${String(N).padStart(2, '0')}</div>
    <p class="sr-only g-status" aria-live="polite"></p>
    <div class="g-bottom">
      <div class="g-info">
        <h2 class="g-title"></h2>
        <p class="g-role"></p>
      </div>
      <div class="g-controls">
        <button class="g-arrow g-prev" type="button" aria-label="Previous piece"><span class="ico ico-left" aria-hidden="true"></span></button>
        <a class="btn primary g-openbtn"><span class="g-openlabel">View project</span> <span class="ico ico-out g-openico" aria-hidden="true"></span></a>
        <button class="g-arrow g-next" type="button" aria-label="Next piece"><span class="ico ico-right" aria-hidden="true"></span></button>
      </div>
      <div class="g-ticks">${items.map((it, i) => `<button type="button" aria-label="Show ${it.title}" data-i="${i}"></button>`).join('')}</div>
      <p class="g-hint">Drag, scroll or use the arrow keys · Esc to exit</p>
    </div>`;
  document.body.appendChild(ui);
  const $ = s => ui.querySelector(s);
  const ticks = [...ui.querySelectorAll('.g-ticks button')];

  /* ---------- state + input ---------- */
  let offset = 0, target = 0, open = false, current = -1;
  let snapTimer = 0;
  const clampT = v => Math.max(0, Math.min(N - 1, v));
  const go = i => { target = clampT(Math.round(i)); };
  const scheduleSnap = () => { clearTimeout(snapTimer); snapTimer = setTimeout(() => go(target), 140); };

  function updateInfo(i) {
    if (i === current) return;
    current = i;
    const it = items[i];
    const info = $('.g-info');
    info.classList.remove('in'); void info.offsetWidth; info.classList.add('in');
    $('.g-title').textContent = it.title;
    $('.g-role').textContent = `${it.kind} · ${it.role}`;   // kind folded into the role line (no label above the title)
    $('.g-openbtn').href = it.url;
    const ext = /^https?:/.test(it.url);   // ArtStation links open a new tab; pages on this site open in place
    $('.g-openbtn').target = ext ? '_blank' : '';
    $('.g-openbtn').rel = ext ? 'noopener' : '';
    $('.g-openico').className = 'ico g-openico ' + (ext ? 'ico-out' : 'ico-right');
    $('.g-openlabel').textContent = it.kind === 'Breakdown' ? 'Read breakdown' : 'View project';
    $('.g-count b').textContent = String(i + 1).padStart(2, '0');
    $('.g-status').textContent = `${it.title}, ${i + 1} of ${N}`;   // what screen readers hear on each move
    ticks.forEach((t, k) => t.classList.toggle('on', k === i));
  }

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  function pick(x, y) {
    ndc.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObjects(cards, false)[0];
    return hit ? hit.object.userData.index : -1;
  }

  const drag = { on: false, x: 0, start: 0, moved: 0 };
  let hoverIndex = -1;
  const mouse = { x: 0, y: 0, sx: 0, sy: 0 };
  const canvas = renderer.domElement;

  function onDown(e) {
    if (!open || e.target.closest?.('.g-ui button, .g-ui a')) return;
    drag.on = true; drag.x = e.clientX; drag.start = target; drag.moved = 0;
  }
  function onMove(e) {
    if (!open) return;
    mouse.x = (e.clientX / innerWidth) * 2 - 1; mouse.y = (e.clientY / innerHeight) * 2 - 1;
    if (drag.on) {
      const dx = e.clientX - drag.x;
      drag.moved = Math.max(drag.moved, Math.abs(dx));
      target = clampT(drag.start - dx * (innerWidth < 700 ? 0.012 : 0.006));
    } else if (!e.target.closest?.('.g-ui button, .g-ui a')) {
      hoverIndex = pick(e.clientX, e.clientY);
      document.body.classList.toggle('g-hovering', hoverIndex >= 0);
    }
  }
  function onUp(e) {
    if (!open || !drag.on) return;
    drag.on = false;
    if (drag.moved < 6) {
      const i = pick(e.clientX, e.clientY);
      if (i >= 0) {
        if (i === Math.round(offset)) (/^https?:/.test(items[i].url) ? window.open(items[i].url, '_blank', 'noopener') : (location.href = items[i].url));
        else go(i);
        return;
      }
    }
    go(target);
  }
  function onWheel(e) {
    if (!open) return;
    e.preventDefault();
    const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    target = clampT(target + d * 0.0022);
    scheduleSnap();
  }
  function onKey(e) {
    if (!open) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { go(target + 1); e.preventDefault(); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { go(target - 1); e.preventDefault(); }
    else if (e.key === 'Home') go(0);
    else if (e.key === 'End') go(N - 1);
    else if (e.key === 'Escape') onRequestClose?.();
  }
  addEventListener('pointerdown', onDown);
  addEventListener('pointermove', onMove);
  addEventListener('pointerup', onUp);
  addEventListener('pointercancel', () => { drag.on = false; go(target); });
  addEventListener('wheel', onWheel, { passive: false });
  addEventListener('keydown', onKey);
  $('.g-prev').addEventListener('click', () => go(target - 1));
  $('.g-next').addEventListener('click', () => go(target + 1));
  $('.g-back').addEventListener('click', () => onRequestClose?.());
  ticks.forEach(t => t.addEventListener('click', () => go(+t.dataset.i)));

  /* ---------- layout ---------- */
  function layout() {
    const aspect = innerWidth / innerHeight;
    camera.aspect = aspect;
    const portrait = aspect < 0.9;
    camera.fov = portrait ? 64 : 48;
    const nW = portrait ? 2.6 : 2.9, nH = portrait ? 1.68 : 1.86;
    STEP = portrait ? 0.42 : 0.4;
    if (nW !== W) {
      W = nW; H = nH;
      geo.dispose(); geo = bentPlane(W, H);
      cards.forEach((c, i) => { c.geometry = geo; reflections[i].geometry = geo; c.material.uniforms.cardAspect.value = W / H; reflections[i].material.uniforms.cardAspect.value = W / H; });
    }
    floor.position.y = floorY();
    camera.updateProjectionMatrix();
  }
  layout();

  /* ---------- per-frame ---------- */
  function update(dt, t) {
    offset += (target - offset) * (1 - Math.pow(0.0006, dt));
    mouse.sx += (mouse.x - mouse.sx) * 0.05; mouse.sy += (mouse.y - mouse.sy) * 0.05;
    camera.position.set(mouse.sx * 0.25, 0.3 - mouse.sy * 0.12, 0);
    camera.rotation.set(-0.04 + mouse.sy * 0.02, -mouse.sx * 0.06, 0, 'YXZ');

    const fy = floorY();
    for (let i = 0; i < N; i++) {
      const rel = i - offset;
      const a = rel * STEP;
      const focus = 1 - Math.min(1, Math.abs(rel));
      const lift = focus * 0.06;
      const c = cards[i], r = reflections[i];
      c.visible = r.visible = Math.abs(a) < 1.9;
      c.position.set(R * Math.sin(a), lift, -R * Math.cos(a));
      c.rotation.y = -a;
      c.scale.setScalar(1 + focus * 0.05);
      r.position.set(c.position.x, 2 * fy - lift, c.position.z);
      r.rotation.y = -a;
      r.scale.set(c.scale.x, -c.scale.y, c.scale.z);
      const u = c.material.uniforms;
      u.focus.value = focus;
      u.hover.value += ((i === hoverIndex ? 1 : 0) - u.hover.value) * 0.15;
      r.material.uniforms.focus.value = focus;
    }
    strips.rotation.y = -offset * STEP * 0.35;
    dust.rotation.y = t * 0.01 - offset * STEP * 0.2;
    updateInfo(Math.round(clampT(offset)));
  }

  return {
    scene, camera, update, layout,
    get isOpen() { return open; },
    preload() {
      if (texturesRequested) return;
      texturesRequested = true;
      textureJobs.forEach(job => job());
    },
    show(startIndex = 0) {
      this.preload();
      open = true; target = offset = clampT(startIndex); current = -1;
      updateInfo(Math.round(offset));
      ui.hidden = false;
      requestAnimationFrame(() => ui.classList.add('on'));
    },
    showUI() { ui.classList.add('ready'); $('.g-next').focus({ preventScroll: true }); },
    hide() {
      open = false; drag.on = false; hoverIndex = -1;
      document.body.classList.remove('g-hovering');
      ui.classList.remove('on', 'ready');
      setTimeout(() => { if (!open) ui.hidden = true; }, 400);
    },
  };
}
