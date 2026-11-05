/* Click events for cedarview.house — which visitors went further than the first screen.
   Sends one named event to GoatCounter for each of the actions the marketing plan measures:
   starting the 3D tour, opening a floor plan, downloading a plan or the spec sheet, and tapping
   Kelly's phone or email. The event title carries the visit's source (from js/utm.js), so the
   dashboard shows e.g. "contact-phone · source=postcard;medium=print". No cookies; does nothing
   unless the GoatCounter script is on the page (site.analytics.events.code in data/site.json). */
(function () {
  'use strict';

  function source() {
    try {
      var s = JSON.parse(sessionStorage.getItem('cedarview-utm') || 'null');
      if (!s) return 'direct';
      return ['utm_source', 'utm_medium', 'utm_campaign']
        .filter(function (k) { return s[k]; })
        .map(function (k) { return k.replace('utm_', '') + '=' + s[k]; })
        .join(';');
    } catch (e) { return 'direct'; }
  }

  function send(name) {
    var gc = window.goatcounter;
    if (!gc || typeof gc.count !== 'function') return;
    gc.count({ path: name, title: name + ' · ' + source(), event: true });
  }

  function nameFor(el) {
    if (el.id === 'tour-start') return 'tour-start';
    if (el.matches('.plans [data-lb]')) return 'plan-view';
    var href = el.getAttribute('href') || '';
    if (/^tel:/i.test(href)) return 'contact-phone';
    if (/^mailto:/i.test(href)) return 'contact-email';
    if (/matterport\.com/i.test(href)) return 'tour-open-matterport';
    if (/cedarview-specs\.pdf$/i.test(href)) return 'spec-sheet-pdf';
    if (/\.pdf$/i.test(href) && /plan/i.test(href)) return 'plan-pdf';
    return null;
  }

  document.addEventListener('click', function (e) {
    var el = e.target.closest && e.target.closest('a, button');
    if (!el) return;
    var name = nameFor(el);
    if (name) send(name);
  }, true);
})();
