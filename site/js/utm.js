/* UTM capture for cedarview.house — sessionStorage only, no cookies.
   On load, any utm_* query parameters are stored for the session and
   exposed as data-utm on the tel: and mailto: links in the Visit section. */
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
  var links = document.querySelectorAll('#visit a[data-utm]');
  for (var i = 0; i < links.length; i++) links[i].setAttribute('data-utm', summary);
})();
