/* UTM capture for cedarview.house — sessionStorage only, no cookies.
   On load, any utm_* query parameters are stored for the session and
   exposed as data-utm on the tel: and mailto: links in the Visit section and the sticky showing bar;
   js/track.js reads the same value to label click events, and email links get the source in the subject. */
(function () {
  'use strict';
  var KEY = 'cedarview-utm';
  var params = new URLSearchParams(location.search);
  var found = {};
  params.forEach(function (v, k) { if (k.indexOf('utm_') === 0) found[k] = v; });
  var stored = null;
  try {
    if (Object.keys(found).length) sessionStorage.setItem(KEY, JSON.stringify(found));
    stored = JSON.parse(sessionStorage.getItem(KEY) || 'null');
  } catch (e) { stored = Object.keys(found).length ? found : null; }
  if (!stored) return;
  var summary = Object.keys(stored).map(function (k) { return k.replace('utm_', '') + '=' + stored[k]; }).join(';');
  var links = document.querySelectorAll('#visit a[data-utm], #cta-bar a[data-utm]');
  for (var i = 0; i < links.length; i++) links[i].setAttribute('data-utm', summary);

  /* An email to the agent carries the source in its subject line, so the inquiry log can record
     where the person came from without asking. Only when the visit arrived on a tagged link. */
  var via = stored.utm_source ? stored.utm_source + (stored.utm_medium ? ', ' + stored.utm_medium : '') : '';
  if (!via) return;
  var mails = document.querySelectorAll('a[href^="mailto:"]');
  for (var j = 0; j < mails.length; j++) {
    var href = mails[j].getAttribute('href');
    if (href.indexOf('?') !== -1) continue;
    mails[j].setAttribute('href', href + '?subject=' + encodeURIComponent('Cedarview House inquiry (via ' + via + ')'));
  }
})();
