/* Project pages: GIF clips start as a still frame and only download when someone presses play.
   Pressing again pauses (back to the still frame), so moving content can always be stopped. */
document.querySelectorAll('.pp-gif[data-gif]').forEach(function (btn) {
  var img = btn.querySelector('img');
  var still = img.getAttribute('src');
  var label = btn.dataset.label || 'Clip';
  var badge = btn.querySelector('.pp-play');
  btn.setAttribute('aria-pressed', 'false');
  btn.addEventListener('click', function () {
    var playing = !btn.classList.contains('playing');
    img.src = playing ? btn.dataset.gif : still;
    btn.classList.toggle('playing', playing);
    btn.setAttribute('aria-pressed', String(playing));
    btn.setAttribute('aria-label', (playing ? 'Pause ' : 'Play ') + label);
    if (badge) badge.innerHTML = playing
      ? '<span class="ico ico-pause"></span> Pause'
      : '<span class="ico ico-right"></span> Play clip';
  });
});

/* Click any image to see it full size: Blueprints, maps and charts need the pixels.
   Opens fitted to the screen with its caption; press the image again for actual size (scrolls on small screens). */
(function () {
  var imgs = document.querySelectorAll('.pp-fig > img, .pp-hero > img');
  if (!imgs.length || typeof HTMLDialogElement !== 'function') return;

  var touch = window.matchMedia('(pointer: coarse)').matches;
  var dlg = document.createElement('dialog');
  dlg.className = 'pp-lightbox';
  dlg.setAttribute('aria-label', 'Image viewer');
  dlg.innerHTML =
    '<button class="pp-lb-close" type="button" aria-label="Close image"><span class="ico ico-close" aria-hidden="true"></span></button>' +
    '<div class="pp-lb-stage"><button class="pp-lb-zoom" type="button" aria-pressed="false" aria-label="Show at actual size"><img alt=""></button></div>' +
    '<p class="pp-lb-caption"></p>' +
    '<p class="pp-lb-hint">' + (touch ? 'Tap the image for actual size' : 'Press the image for actual size · Esc to close') + '</p>';
  document.body.appendChild(dlg);
  var big = dlg.querySelector('img');
  var stage = dlg.querySelector('.pp-lb-stage');
  var cap = dlg.querySelector('.pp-lb-caption');
  var opener = null;

  /* the scroll lock is released however the viewer closes (button, Esc, backdrop), not only on the close event */
  function unlock() { document.documentElement.classList.remove('pp-lb-open'); }
  function close() { unlock(); if (dlg.open) dlg.close(); if (opener) opener.focus(); }
  dlg.addEventListener('cancel', function (e) { e.preventDefault(); close(); });
  dlg.addEventListener('close', unlock);
  dlg.querySelector('.pp-lb-close').addEventListener('click', close);
  dlg.addEventListener('click', function (e) { if (e.target === dlg || e.target === stage) close(); });
  var zoom = dlg.querySelector('.pp-lb-zoom');
  zoom.addEventListener('click', function () {
    var actual = dlg.classList.toggle('actual');
    zoom.setAttribute('aria-pressed', String(actual));
    zoom.setAttribute('aria-label', actual ? 'Fit to screen' : 'Show at actual size');
  });

  imgs.forEach(function (img) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pp-zoom';
    btn.setAttribute('aria-label', 'Enlarge image: ' + (img.alt || 'screenshot'));
    img.parentNode.insertBefore(btn, img);
    btn.appendChild(img);
    btn.addEventListener('click', function () {
      opener = btn;
      big.src = img.currentSrc || img.src;
      big.alt = img.alt;
      var fc = btn.parentNode.querySelector('figcaption');
      cap.textContent = fc ? fc.textContent : '';
      cap.hidden = !fc;
      dlg.classList.remove('actual');
      zoom.setAttribute('aria-pressed', 'false');
      zoom.setAttribute('aria-label', 'Show at actual size');
      document.documentElement.classList.add('pp-lb-open');
      dlg.showModal();
    });
  });
})();

/* Breakdowns: the section bar sticks under the nav and marks the section you're reading.
   Jumping to a section also moves keyboard focus there. */
(function () {
  var links = [].slice.call(document.querySelectorAll('.pp-toc a[href^="#"]'));
  if (!links.length) return;
  var targets = links.map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); });

  links.forEach(function (a, i) {
    a.addEventListener('click', function () {
      var h = targets[i];
      if (!h) return;
      h.setAttribute('tabindex', '-1');
      setTimeout(function () { h.focus({ preventScroll: true }); mark(); }, 0);
    });
  });

  var current = -1;
  function mark() {
    var line = 140, idx = -1;   // just under the nav and the bar
    for (var i = 0; i < targets.length; i++) {
      if (targets[i] && targets[i].getBoundingClientRect().top <= line) idx = i;
    }
    if (idx === current) return;
    current = idx;
    links.forEach(function (a, i) {
      if (i === idx) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
    });
    if (idx >= 0 && links[idx].scrollIntoView && window.matchMedia('(max-width: 640px)').matches) {
      var bar = links[idx].closest('ul');   // keep the active link visible in the phone's scrolling row
      var calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (bar) bar.scrollTo({ left: links[idx].offsetLeft - 16, behavior: calm ? 'auto' : 'smooth' });
    }
  }
  var ticking = false;
  window.addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () { ticking = false; mark(); });
  }, { passive: true });
  mark();
})();
