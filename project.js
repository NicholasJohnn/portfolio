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
   Opens fitted to the screen; press the image again for actual size (scrolls on small screens). */
(function () {
  var imgs = document.querySelectorAll('.pp-fig > img, .pp-hero > img');
  if (!imgs.length || typeof HTMLDialogElement !== 'function') return;

  var dlg = document.createElement('dialog');
  dlg.className = 'pp-lightbox';
  dlg.setAttribute('aria-label', 'Image viewer');
  dlg.innerHTML =
    '<button class="pp-lb-close" type="button" aria-label="Close image"><span class="ico ico-close" aria-hidden="true"></span></button>' +
    '<div class="pp-lb-stage"><img alt=""></div>' +
    '<p class="pp-lb-hint">Press the image for actual size · Esc to close</p>';
  document.body.appendChild(dlg);
  var big = dlg.querySelector('img');
  var stage = dlg.querySelector('.pp-lb-stage');
  var opener = null;

  function close() { dlg.close(); }
  dlg.addEventListener('close', function () {
    document.documentElement.classList.remove('pp-lb-open');
    if (opener) opener.focus();
  });
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
      dlg.classList.remove('actual');
      document.documentElement.classList.add('pp-lb-open');
      dlg.showModal();
    });
  });
})();
