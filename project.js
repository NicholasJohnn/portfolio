/* Project pages: GIF clips start as a still frame and only download when someone presses play. */
document.querySelectorAll('.pp-gif[data-gif]').forEach(function (btn) {
  btn.addEventListener('click', function () {
    if (btn.classList.contains('playing')) return;
    var img = btn.querySelector('img');
    img.src = btn.dataset.gif;
    btn.classList.add('playing');
    btn.setAttribute('aria-label', 'Metrics gym clip (playing)');
  });
});
