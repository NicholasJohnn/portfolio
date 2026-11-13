/* Beat-by-beat tabs (Route / Intensity / ... ). Each project's case study has its own tab row and chart
   panel; the tabs switch which chart and caption show. A separate plain script so it works even if the
   3D scripts fail to load. */
document.querySelectorAll('.case-tabs').forEach(function (list) {
  var tabs = Array.prototype.slice.call(list.querySelectorAll('[role="tab"]'));
  var strip = tabs.length && document.getElementById(tabs[0].getAttribute('aria-controls'));
  if (!strip) return;

  function select(tab, focus) {
    tabs.forEach(function (t) {
      var on = t === tab;
      t.setAttribute('aria-selected', on);
      t.tabIndex = on ? 0 : -1;
    });
    strip.dataset.view = tab.dataset.view;
    strip.querySelectorAll('img[class^="cs-"]').forEach(function (img) {   // only the visible chart is read out
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
});

/* Featured tabs: switch the Featured section between CoreUndead and Cursebreaker, and the beat-by-beat
   below with it (feat-coreundead goes with case-coreundead, feat-cursebreaker with case-cursebreaker). */
(function () {
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.feature-tabs [role="tab"]'));
  if (!tabs.length) return;
  function select(tab, focus) {
    tabs.forEach(function (t) {
      var on = t === tab;
      t.setAttribute('aria-selected', on);
      t.tabIndex = on ? 0 : -1;
      var id = t.getAttribute('aria-controls');
      var panel = document.getElementById(id);
      if (panel) panel.hidden = !on;
      var study = document.getElementById(id.replace('feat-', 'case-'));
      if (study) study.hidden = !on;
    });
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
  // links that point at one featured project (e.g. the CoreUndead tile at the top) open its tab
  document.querySelectorAll("[data-feature]").forEach(function (a) {
    a.addEventListener("click", function () { var t = document.getElementById(a.dataset.feature); if (t) select(t, false); });
  });
})();
