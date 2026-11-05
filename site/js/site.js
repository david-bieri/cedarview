/* Page behaviour for cedarview.house beyond the gallery — plain JS, no dependencies.
   1. Section menu: on phones the <details> in the top bar is collapsed into a "Sections"
      button and closes after a choice; on wide screens it is always open (no JS needed).
   2. Sticky showing bar: shown once the hero has scrolled out of view, hidden again while
      the Visit section (which carries the same contact details) is on screen.
   3. Album: season tabs filter the strip; pressing a clip card swaps its poster for the video.
   4. 3D tour: the Matterport iframe is created only when "Start the 3D tour" is pressed.
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

  // ----- sticky showing bar, and the pinned section bar on phones -----
  var bar = document.getElementById('cta-bar');
  var hero = document.querySelector('.hero');
  var topnav = document.querySelector('.topnav');
  var visit = document.getElementById('visit');
  if (bar && hero && 'IntersectionObserver' in window) {
    var heroGone = false, visitShown = false;
    var update = function () {
      bar.hidden = !(heroGone && !visitShown);
      if (topnav) {
        topnav.classList.toggle('pinned', heroGone);
        if (!heroGone && menu && !wide.matches) menu.open = false; // back at the hero: fold the menu away
      }
    };
    new IntersectionObserver(function (entries) {
      heroGone = !entries[0].isIntersecting; update();
    }, { rootMargin: '-25% 0px 0px 0px' }).observe(hero);
    if (visit) {
      new IntersectionObserver(function (entries) {
        visitShown = entries[0].isIntersecting; update();
      }, { threshold: 0.15 }).observe(visit);
    }
  }

  // ----- the sticky bar steps aside while any clip is playing, so it never covers the controls -----
  var playing = 0;
  document.addEventListener('play', function (e) { if (e.target.tagName === 'VIDEO') { playing++; document.body.classList.add('video-playing'); } }, true);
  var stopped = function (e) { if (e.target.tagName === 'VIDEO' && playing > 0 && --playing === 0) document.body.classList.remove('video-playing'); };
  document.addEventListener('pause', stopped, true);
  document.addEventListener('ended', stopped, true);

  // ----- the album: season tabs filter the strip; a clip card plays in place -----
  var strip = document.getElementById('album-strip');
  if (strip) {
    var tabs = document.querySelectorAll('.album-tabs button[data-season]');
    for (var t = 0; t < tabs.length; t++) {
      tabs[t].addEventListener('click', function () {
        var season = this.getAttribute('data-season');
        for (var i = 0; i < tabs.length; i++) tabs[i].setAttribute('aria-pressed', String(tabs[i] === this));
        var tiles = strip.querySelectorAll('.album-tile');
        for (var j = 0; j < tiles.length; j++) tiles[j].hidden = Boolean(season) && tiles[j].getAttribute('data-group') !== season;
        strip.scrollTo({ left: 0, behavior: 'smooth' });
      });
    }
    strip.addEventListener('click', function (e) {
      var btn = e.target.closest && e.target.closest('.clip-play');
      if (!btn) return;
      var fig = btn.closest('.album-clip');
      var src = fig && fig.getAttribute('data-clip');
      if (!src) return;
      var v = document.createElement('video');
      v.controls = true; v.playsInline = true; v.preload = 'auto';
      v.setAttribute('playsinline', '');
      v.setAttribute('aria-label', btn.getAttribute('aria-label') || '');
      var img = btn.querySelector('img');
      if (img && img.currentSrc) v.poster = img.currentSrc;
      var source = document.createElement('source');
      source.src = src; source.type = 'video/mp4';
      v.appendChild(source);
      btn.replaceWith(v);
      v.play().catch(function () {});
    });
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
        iframe.setAttribute('allow', 'fullscreen; accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; magnetometer; xr-spatial-tracking');
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
