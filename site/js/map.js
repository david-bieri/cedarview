/* The map in "Life in Blacksburg": Leaflet, pins coloured by theme, a theme filter, and the walking area.
   Every fact (pins, colours, times, links) comes from the #map-data JSON that build-page.mjs embeds. */
(function () {
  'use strict';
  var el = document.getElementById('map');
  var dataEl = document.getElementById('map-data');
  if (!el || !dataEl || typeof L === 'undefined') return;
  var D;
  try { D = JSON.parse(dataEl.textContent); } catch (e) { return; }

  // The build-time fallback stays in the DOM, hidden by CSS while the live map runs and shown again for print.
  el.classList.add('map-live');

  var map = L.map(el, { scrollWheelZoom: false, zoomControl: true, attributionControl: false })
    .setView([D.house.lat, D.house.lng], D.zoom);
  L.tileLayer(D.tiles.url, { subdomains: D.tiles.subdomains || 'abc', maxZoom: D.tiles.maxZoom || 19, attribution: D.tiles.attribution }).addTo(map);
  L.control.attribution({ prefix: false }).addTo(map);

  // Walking area: a soft wash, drawn first so the pins sit on top.
  if (D.walkArea && D.walkArea.polygon) {
    L.polygon(D.walkArea.polygon, { color: D.accent, weight: 1, opacity: .6, fillColor: D.accent, fillOpacity: .12, interactive: false }).addTo(map);
  }

  // The house: a larger cream-ringed marker.
  L.marker([D.house.lat, D.house.lng], {
    icon: L.divIcon({ className: 'pin pin-house', html: '<span></span>', iconSize: [22, 22], iconAnchor: [11, 11], popupAnchor: [0, -12] }),
    zIndexOffset: 1000,
  }).addTo(map).bindPopup('<strong>' + esc(D.house.label) + '</strong>');

  var layers = {};
  var all = [];
  D.groups.forEach(function (g) {
    var layer = L.layerGroup();
    g.places.forEach(function (p) {
      var m = L.marker([p.lat, p.lng], {
        icon: L.divIcon({ className: 'pin', html: '<span style="background:' + g.color + '"></span>', iconSize: [16, 16], iconAnchor: [8, 8], popupAnchor: [0, -8] }),
        title: p.name,
      });
      m.bindPopup('<strong>' + esc(p.name) + '</strong><br>' + esc(p.blurb)
        + (p.times.length ? '<br><span class="pop-times">' + esc(p.times.join(' · ')) + '</span>' : '')
        + '<br><a href="' + esc(p.directions) + '" target="_blank" rel="noopener">' + esc(p.directionsLabel) + ' ↗</a>');
      layer.addLayer(m);
      if (p.fit) all.push([p.lat, p.lng]);
    });
    layers[g.heading] = layer;
    layer.addTo(map);
  });
  all.push([D.house.lat, D.house.lng]);
  map.fitBounds(all, { padding: [28, 28], maxZoom: 15 });

  var chips = document.getElementById('map-chips');
  if (chips) {
    chips.hidden = false;
    chips.addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-theme]');
      if (!btn) return;
      var theme = btn.getAttribute('data-theme');
      chips.querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-pressed', String(b === btn)); });
      var pts = [[D.house.lat, D.house.lng]];
      Object.keys(layers).forEach(function (k) {
        if (!theme || k === theme) { layers[k].addTo(map); layers[k].eachLayer(function (m) { pts.push(m.getLatLng()); }); }
        else map.removeLayer(layers[k]);
      });
      map.fitBounds(pts, { padding: [28, 28], maxZoom: theme ? 16 : 15 });
    });
  }

  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
})();
