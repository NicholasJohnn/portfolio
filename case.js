/* CoreUndead case study tabs: Route / Intensity / Combat pacing over the same filmstrip.
   A separate plain script so it works even if the 3D scripts fail to load. */
(function () {
  var strip = document.getElementById('cs-panel');
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.case-tabs [role="tab"]'));
  if (!strip || !tabs.length) return;

  function select(tab, focus) {
    tabs.forEach(function (t) {
      var on = t === tab;
      t.setAttribute('aria-selected', on);
      t.tabIndex = on ? 0 : -1;
    });
    strip.dataset.view = tab.dataset.view;
    strip.querySelectorAll('.case-frames img').forEach(function (img) {   // only the visible chart is read out
      img.setAttribute('aria-hidden', !img.classList.contains('cs-' + tab.dataset.view));
    });
    strip.setAttribute('aria-labelledby', tab.id);
    if (focus) tab.focus();
  }

  tabs.forEach(function (tab, i) {
    tab.addEventListener('click', function () { select(tab, false); });
    tab.addEventListener('keydown', function (e) {           // arrow keys move between tabs
      var next = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1
        : e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : null;
      if (next === null) return;
      e.preventDefault();
      select(tabs[(next + tabs.length) % tabs.length], true);
    });
  });
})();
