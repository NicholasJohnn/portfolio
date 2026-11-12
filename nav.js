/* Marks the menu item for the section in the middle of the screen (aria-current), so visitors can see
   where they are. A plain script, so it works even if the 3D scripts fail to load. */
(function () {
  var links = {};
  document.querySelectorAll('.nav nav a[href^="#"]').forEach(function (a) { links[a.getAttribute('href').slice(1)] = a; });
  // sections that belong to a menu item; the case study is part of "Work"
  // the hero (#top) marks nothing, so jumping back to the top clears the marker
  var owner = { top: null, about: 'about', work: 'work', process: 'work', projects: 'projects', breakdowns: 'breakdowns', contact: 'contact' };
  var current = null;
  function set(id) {
    if (id === current) return;
    if (current && links[current]) links[current].removeAttribute('aria-current');
    current = id;
    if (id && links[id]) links[id].setAttribute('aria-current', 'location');
  }
  if (!('IntersectionObserver' in window)) return;
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { if (e.isIntersecting) set(owner[e.target.id]); });
  }, { rootMargin: '-45% 0px -50% 0px' });   // a thin band across the middle of the screen
  Object.keys(owner).forEach(function (id) { var s = document.getElementById(id); if (s) io.observe(s); });
})();
