/* Project pages: GIF clips start as a still frame and only download when someone presses play. */
document.querySelectorAll('.pp-gif[data-gif]').forEach(function (btn) {
  btn.addEventListener('click', function () {
    if (btn.classList.contains('playing')) return;
    var img = btn.querySelector('img');
    img.src = btn.dataset.gif;
    btn.classList.add('playing');
    btn.setAttribute('aria-label', (btn.dataset.label || 'Clip') + ' (playing)');
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
    '<div class="pp-lb-stage"><img alt=""></div>' +
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
  big.addEventListener('click', function () { dlg.classList.toggle('actual'); });

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
      if (bar) bar.scrollTo({ left: links[idx].offsetLeft - 16, behavior: 'smooth' });
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
