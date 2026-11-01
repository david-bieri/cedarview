/* Page behaviour for cedarview.house beyond the gallery — plain JS, no dependencies.
   1. Section menu: on phones the <details> in the top bar is collapsed into a "Sections"
      button and closes after a choice; on wide screens it is always open (no JS needed).
   2. Sticky showing bar: shown once the hero has scrolled out of view, hidden again while
      the Visit section (which carries the same contact details) is on screen.
   3. 3D tour: the Matterport iframe is created only when "Start the 3D tour" is pressed.
      Until then the visitor sees a still of the house. A browser without WebGL would only
      get a black canvas, so there the button is replaced by a note and the direct link. */
(function () {
  'use strict';
  var wide = window.matchMedia('(min-width: 48rem)');

  // ----- section menu -----
  var menu = document.getElementById('nav-menu');
  if (menu) {
    var syncMenu = function () { menu.open = wide.matches; };
    syncMenu();
    if (wide.addEventListener) wide.addEventListener('change', syncMenu); else wide.addListener(syncMenu);
    menu.addEventListener('click', function (e) {
      if (!wide.matches && e.target.closest && e.target.closest('a')) menu.open = false;
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !wide.matches && menu.open) { menu.open = false; menu.querySelector('summary').focus(); }
    });
  }

  // ----- sticky showing bar -----
  var bar = document.getElementById('cta-bar');
  var hero = document.querySelector('.hero');
  var visit = document.getElementById('visit');
  if (bar && hero && 'IntersectionObserver' in window) {
    var heroGone = false, visitShown = false;
    var update = function () { bar.hidden = !(heroGone && !visitShown); };
    new IntersectionObserver(function (entries) {
      heroGone = !entries[0].isIntersecting; update();
    }, { rootMargin: '-25% 0px 0px 0px' }).observe(hero);
    if (visit) {
      new IntersectionObserver(function (entries) {
        visitShown = entries[0].isIntersecting; update();
      }, { threshold: 0.15 }).observe(visit);
    }
  }

  // ----- 3D tour -----
  var frame = document.getElementById('tour-frame');
  var start = document.getElementById('tour-start');
  var note = document.getElementById('tour-note');
  if (frame && start) {
    var hasWebgl = false;
    try {
      var c = document.createElement('canvas');
      hasWebgl = Boolean(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')));
    } catch (e) { hasWebgl = false; }
    if (hasWebgl) {
      start.hidden = false;
      start.addEventListener('click', function () {
        var iframe = document.createElement('iframe');
        iframe.src = frame.getAttribute('data-tour-src');
        iframe.title = frame.getAttribute('data-tour-title') || '3D tour';
        iframe.setAttribute('allow', 'xr-spatial-tracking; fullscreen');
        iframe.setAttribute('allowfullscreen', '');
        var poster = frame.querySelector('picture');
        if (poster) poster.replaceWith(iframe); else frame.insertBefore(iframe, frame.firstChild);
        start.remove();
        frame.classList.add('tour-live');
        iframe.focus();
      });
    } else if (note) {
      note.hidden = false;
    }
  }
})();
