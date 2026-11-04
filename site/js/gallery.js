/* Gallery and lightbox for cedarview.house — plain JS, keyboard accessible.
   1. Photo / virtually-staged: a gallery-wide text toggle (data-scope="all") and a one-link
      flip per pair (data-flip); each swaps the <picture> sources, alt and caption word in place.
   2. Lightbox: Esc closes, arrow keys navigate, focus is trapped inside the dialog;
      paired images carry both variants and a toggle of their own. */
(function () {
  'use strict';
  var STAGED = 'staged', PHOTO = 'photo';
  var BLANK = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';

  // ----- variant toggles on tiles -----
  function setPressed(group, variant) {
    var btns = group.querySelectorAll('button[data-variant]');
    for (var i = 0; i < btns.length; i++) btns[i].setAttribute('aria-pressed', String(btns[i].getAttribute('data-variant') === variant));
  }
  function setTile(fig, variant) {
    var d = fig.dataset;
    var source = fig.querySelector('source');
    var img = fig.querySelector('img');
    var word = fig.querySelector('.cap-staged');
    var flip = fig.querySelector('[data-flip]');
    var btn = fig.querySelector('[data-lb]');
    if (!source || !img) return;
    source.srcset = variant === STAGED ? d.stagedWebp : d.photoWebp;
    img.srcset = variant === STAGED ? d.stagedJpg : d.photoJpg;
    img.src = variant === STAGED ? d.stagedSrc : d.photoSrc;
    img.alt = variant === STAGED ? d.stagedAlt : d.photoAlt;
    if (btn) btn.setAttribute('aria-label', 'Enlarge: ' + img.alt);
    if (word) word.hidden = variant !== STAGED;
    if (flip) {
      var other = variant === STAGED ? 'as photographed' : STAGED_WORD;
      flip.textContent = 'Show ' + other;
      flip.setAttribute('aria-label', d.photoAlt + ': show ' + other);
    }
    fig.dataset.variant = variant;
  }
  var STAGED_WORD = (function () {
    var el = document.querySelector('.vtoggle button[data-variant="staged"]');
    return el ? el.textContent.trim().toLowerCase() : 'virtually staged';
  })();
  function syncAllToggle() {
    var pairs = document.querySelectorAll('.tile[data-pair]');
    var all = document.querySelectorAll('.vtoggle button[data-scope="all"]');
    var staged = 0;
    for (var i = 0; i < pairs.length; i++) if (pairs[i].dataset.variant === STAGED) staged++;
    for (var j = 0; j < all.length; j++) {
      var v = all[j].getAttribute('data-variant');
      var pressed = (v === STAGED && staged === pairs.length && pairs.length > 0) || (v === PHOTO && staged === 0);
      all[j].setAttribute('aria-pressed', String(pressed));
    }
  }
  document.addEventListener('click', function (e) {
    var flip = e.target.closest && e.target.closest('[data-flip]');
    if (flip) {
      var f = flip.closest('.tile[data-pair]');
      if (f) setTile(f, f.dataset.variant === STAGED ? PHOTO : STAGED);
      syncAllToggle();
      return;
    }
    var btn = e.target.closest && e.target.closest('.vtoggle button[data-variant]');
    if (!btn || btn.hasAttribute('data-lb-variant')) return;
    var variant = btn.getAttribute('data-variant');
    var pairs = document.querySelectorAll('.tile[data-pair]');
    for (var i = 0; i < pairs.length; i++) setTile(pairs[i], variant);
    syncAllToggle();
  });

  // ----- lightbox -----
  var dataEl = document.getElementById('lightbox-data');
  var box = document.getElementById('lightbox');
  if (!dataEl || !box) return;
  var items;
  try { items = JSON.parse(dataEl.textContent); } catch (e) { return; }
  if (!items.length) return;

  var webp = document.getElementById('lb-webp');
  var img = document.getElementById('lb-img');
  var cap = document.getElementById('lb-cap');
  var badge = document.getElementById('lb-badge');
  var toggle = document.getElementById('lb-toggle');
  var toggleBtns = toggle ? toggle.querySelectorAll('button[data-lb-variant]') : [];
  var closeBtn = box.querySelector('[data-lb-close]');
  var prevBtn = box.querySelector('[data-lb-prev]');
  var nextBtn = box.querySelector('[data-lb-next]');
  var current = 0;
  var variant = PHOTO;
  var opener = null;

  function tileVariantFor(it) {
    if (!it.pair) return PHOTO;
    var fig = document.querySelector('.tile[data-pair="' + it.pair + '"]');
    return fig && fig.dataset.variant === STAGED ? STAGED : PHOTO;
  }

  function render() {
    var it = items[current];
    var useStaged = variant === STAGED && it.stagedVariant;
    var v = useStaged ? it.stagedVariant : it;
    webp.srcset = v.webp;
    img.src = v.jpg;
    img.width = v.w;
    img.height = v.h;
    img.alt = v.alt;
    img.style.backgroundColor = it.color || '';
    cap.textContent = it.caption || it.alt; // the room, not the variant: the word after it says which is showing
    badge.hidden = !(useStaged || it.staged);
    if (toggle) {
      toggle.hidden = !it.stagedVariant;
      for (var i = 0; i < toggleBtns.length; i++) toggleBtns[i].setAttribute('aria-pressed', String(toggleBtns[i].getAttribute('data-lb-variant') === (useStaged ? STAGED : PHOTO)));
    }
    box.setAttribute('aria-label', 'Photo ' + (current + 1) + ' of ' + items.length);
  }

  function show(i) {
    current = (i + items.length) % items.length;
    variant = tileVariantFor(items[current]);
    render();
  }

  function open(i, fromEl) {
    opener = fromEl || document.activeElement;
    show(i);
    box.hidden = false;
    document.body.classList.add('lb-open');
    document.addEventListener('keydown', onKey);
    closeBtn.focus();
  }

  function close() {
    box.hidden = true;
    document.body.classList.remove('lb-open');
    document.removeEventListener('keydown', onKey);
    img.src = BLANK;
    webp.removeAttribute('srcset');
    if (opener && typeof opener.focus === 'function') opener.focus();
  }

  function focusable() {
    var list = [closeBtn, prevBtn, nextBtn];
    if (toggle && !toggle.hidden) for (var i = 0; i < toggleBtns.length; i++) list.push(toggleBtns[i]);
    return list;
  }

  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key === 'ArrowRight') { e.preventDefault(); show(current + 1); return; }
    if (e.key === 'ArrowLeft') { e.preventDefault(); show(current - 1); return; }
    if (e.key === 'Tab') {
      var f = focusable();
      var idx = f.indexOf(document.activeElement);
      if (e.shiftKey && (idx <= 0)) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && idx === f.length - 1) { e.preventDefault(); f[0].focus(); }
    }
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('[data-lb]');
    if (btn) { open(parseInt(btn.getAttribute('data-lb'), 10) || 0, btn); }
  });
  for (var k = 0; k < toggleBtns.length; k++) {
    toggleBtns[k].addEventListener('click', function () { variant = this.getAttribute('data-lb-variant'); render(); });
  }
  closeBtn.addEventListener('click', close);
  prevBtn.addEventListener('click', function () { show(current - 1); });
  nextBtn.addEventListener('click', function () { show(current + 1); });
  box.addEventListener('click', function (e) { if (e.target === box) close(); });
})();
