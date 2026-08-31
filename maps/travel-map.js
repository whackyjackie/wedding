// "The Journey" — animates the user's finished Figma maps without touching
// a pixel of them: the boat sails their drawn ferry line, the jet and car
// travel their drawn drive line. build_web.py tags the hooks (route dashes,
// guides, anchors, portal bounds) into the web SVGs.
// No dependencies; degrades to the finished static maps.
(function () {
  'use strict';
  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var SVGNS = 'http://www.w3.org/2000/svg';
  var MAPS = {}; // data-map -> lightbox api

  document.querySelectorAll('.mapstory__map').forEach(initMap);

  function initMap(fig) {
    fetch(fig.dataset.src)
      .then(function (r) { return r.text(); })
      .then(function (txt) {
        var kind = fig.dataset.map;
        // namespace defs ids so the two inline maps can't collide
        var ids = [];
        txt.replace(/id="((?:clip|mask|pattern|image|filter)[^"]*)"/g,
          function (m, i) { ids.push(i); return m; });
        ids.forEach(function (i) {
          txt = txt.split('id="' + i + '"').join('id="' + i + '-' + kind + '"');
          txt = txt.split('#' + i).join('#' + i + '-' + kind);
        });
        var doc = new DOMParser().parseFromString(txt, 'image/svg+xml');
        var svg = document.importNode(doc.documentElement, true);
        svg.removeAttribute('width');
        svg.removeAttribute('height');
        fig.insertBefore(svg, fig.firstChild);
        MAPS[kind] = makeExpandable(fig, svg);
        if (kind === 'region') regionStory(fig, svg);
        else islandsStory(fig, svg);
      })
      .catch(function () { /* map image simply stays absent */ });
  }

  // ---------- click-to-expand lightbox ----------

  function makeExpandable(fig, svg) {
    var vb = (svg.getAttribute('viewBox') || '0 0 1 1').split(/\s+/);
    var aspect = (+vb[2]) / (+vb[3]);
    var slot = document.createComment('map-slot');
    var overlay = null;

    function size() {
      var w = Math.min(window.innerWidth * 0.94,
                       (window.innerHeight - 40) * aspect);
      svg.style.width = w + 'px';
    }
    function open() {
      if (overlay) return;
      overlay = document.createElement('div');
      overlay.className = 'mapstory__fs';
      var btn = document.createElement('button');
      btn.className = 'mapstory__fs-close';
      btn.setAttribute('aria-label', 'Close map');
      btn.innerHTML = '×';
      fig.parentNode.insertBefore(slot, fig);
      overlay.appendChild(fig);
      overlay.appendChild(btn);
      document.body.appendChild(overlay);
      document.body.style.overflow = 'hidden';
      size();
      btn.addEventListener('click', function (e) { e.stopPropagation(); close(); });
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) close();
      });
      btn.focus();
    }
    function close() {
      if (!overlay) return;
      svg.style.width = '';
      slot.parentNode.insertBefore(fig, slot);
      slot.parentNode.removeChild(slot);
      overlay.parentNode.removeChild(overlay);
      overlay = null;
      document.body.style.overflow = '';
    }
    fig.addEventListener('click', function () {
      if (overlay) close(); else open();
    });
    window.addEventListener('resize', function () { if (overlay) size(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') close();
    });
    return { open: open, close: close };
  }

  // the scribble circle on the region map opens the islands close-up
  function wirePortal(fig, svg) {
    var bounds = (svg.getAttribute('data-portal') || '').split(',');
    if (bounds.length !== 4) return;
    var hot = document.createElement('div');
    hot.className = 'mapstory__portal';
    hot.style.left = bounds[0] + '%';
    hot.style.top = bounds[1] + '%';
    hot.style.width = bounds[2] + '%';
    hot.style.height = bounds[3] + '%';
    fig.appendChild(hot);
    hot.addEventListener('click', function (e) {
      e.stopPropagation();
      if (MAPS.islands) MAPS.islands.open();
    });
  }

  // ---------- shared helpers ----------

  function makeVehicle(inner, scale) {
    var wrap = document.createElementNS(SVGNS, 'g');
    wrap.appendChild(inner);
    wrap.setAttribute('opacity', '0');
    wrap.setAttribute('pointer-events', 'none');
    wrap._scale = scale;
    return wrap;
  }

  function placeVehicle(veh, x, y, deg) {
    veh.setAttribute('transform', 'translate(' + x + ' ' + y + ') rotate(' +
      deg + ') scale(' + veh._scale + ') translate(-120 -120)');
  }

  function sample(path, len) {
    var L = path.getTotalLength();
    var l = Math.max(0, Math.min(L, len));
    var p = path.getPointAtLength(l);
    var p1 = path.getPointAtLength(Math.max(0, l - 3));
    var p2 = path.getPointAtLength(Math.min(L, l + 3));
    return { x: p.x, y: p.y, ang: Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180 / Math.PI };
  }

  function anchorPoint(svg, id) {
    var el = svg.querySelector('#' + id);
    if (!el) return null;
    var m = /translate\((-?[\d.]+) (-?[\d.]+)\)/.exec(el.getAttribute('transform') || '');
    return m ? { x: +m[1], y: +m[2], el: el } : null;
  }

  function boatImage() {
    var g = document.createElementNS(SVGNS, 'g');
    var img = document.createElementNS(SVGNS, 'image');
    img.setAttribute('href', 'maps/boat.png');
    img.setAttribute('width', '167');
    img.setAttribute('height', '212');
    img.setAttribute('x', String(120 - 83.5));
    img.setAttribute('y', String(120 - 106));
    g.appendChild(img);
    return g;
  }

  function fetchVehicle(url) {
    return fetch(url).then(function (r) { return r.text(); }).then(function (t) {
      var doc = new DOMParser().parseFromString(t, 'image/svg+xml');
      var g = doc.querySelector('g');
      g.removeAttribute('transform'); // strip the baked -32° heading
      return document.importNode(g, true);
    });
  }

  function ease(t) { return 0.5 - 0.5 * Math.cos(Math.PI * Math.max(0, Math.min(1, t))); }

  function onVisible(el, cb) {
    if (!('IntersectionObserver' in window)) { cb(); return; }
    var io = new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) { io.disconnect(); cb(); }
    }, { threshold: 0.35 });
    io.observe(el);
  }

  // ---------- the region map: jet lands, car drives the user's line ----------

  function regionStory(fig, svg) {
    wirePortal(fig, svg);
    var driveGuide = svg.querySelector('#route-drive-guide');
    var seatac = anchorPoint(svg, 'anchor-seatac');
    var ferryG = svg.querySelector('#route-ferry');
    var ferryGuide = ferryG && ferryG.querySelector('.route-guide');
    var ferryDashes = ferryG ? Array.prototype.filter.call(
      ferryG.querySelectorAll('path'),
      function (p) { return !p.classList.contains('route-guide'); }) : [];
    var clipG = svg.querySelector('g[clip-path]') || svg;
    if (!driveGuide || !seatac || REDUCED) return;

    Promise.all([
      fetchVehicle('maps/jet.svg'),
      fetchVehicle('maps/car.svg')
    ]).then(function (gs) {
      var jet = makeVehicle(gs[0], 0.5);
      var car = makeVehicle(gs[1], 0.28);
      var boat = makeVehicle(boatImage(), 0.32);
      clipG.appendChild(jet);
      clipG.appendChild(car);
      clipG.appendChild(boat);

      var LEGS = [2200, 5200, ferryGuide ? 4600 : 0]; // jet, drive, ferry
      var HOLD = 2600; // quiet beat before the loop restarts
      var TOTAL = LEGS[0] + LEGS[1] + LEGS[2] + HOLD;
      var start = null, lastT = 0;

      function frame(ts) {
        if (start === null) start = ts;
        var t = (ts - start) % TOTAL;
        if (t < lastT) { // wrapped: new lap
          ferryDashes.forEach(function (p) { p.setAttribute('opacity', '0'); });
        }
        lastT = t;

        var t1 = ease(t / LEGS[0]);
        var jx = seatac.x + 300 * (1 - t1), jy = seatac.y + 380 * (1 - t1);
        jet._scale = 0.62 - 0.2 * t1;
        placeVehicle(jet, jx, jy, Math.atan2(-380, -300) * 180 / Math.PI + 90);
        jet.setAttribute('opacity', String(Math.min(1, 3 * t1) * (t1 > 0.9 ? (1 - t1) * 10 : 1)));

        var t2 = ease((t - LEGS[0]) / LEGS[1]);
        if (t > LEGS[0]) {
          var dp = sample(driveGuide, driveGuide.getTotalLength() * t2);
          placeVehicle(car, dp.x, dp.y, dp.ang + 90);
          car.setAttribute('opacity', String(t2 >= 1 ? 0 : Math.min(1, 6 * t2)));
        }

        var t3 = ease((t - LEGS[0] - LEGS[1]) / LEGS[2]);
        if (ferryGuide && t > LEGS[0] + LEGS[1]) {
          var p = sample(ferryGuide, ferryGuide.getTotalLength() * t3);
          placeVehicle(boat, p.x, p.y, 0); // pose baked into the art
          boat.setAttribute('opacity', String(t3 >= 1 ? 0 : Math.min(1, 6 * t3)));
          var m = t3 >= 1 ? ferryDashes.length
                          : Math.floor(ferryDashes.length * t3);
          for (var j = 0; j < m; j++) ferryDashes[j].setAttribute('opacity', '1');
        }

        requestAnimationFrame(frame);
      }

      onVisible(fig, function () {
        ferryDashes.forEach(function (p) { p.setAttribute('opacity', '0'); });
        requestAnimationFrame(frame);
      });
    });
  }

  // ---------- the islands map: boat sails the user's line + star cards ----------

  var TIPS = {
    'star-anacortes': {
      title: 'ANACORTES FERRY TERMINAL',
      html: '<p>Sail to Friday Harbor in about 1–2 hours — some sailings ' +
        'pause at Lopez, Shaw, or Orcas on the way.</p>' +
        '<p><strong>Walking on?</strong> No reservation needed.<br>' +
        '<strong>Bringing a car?</strong> <a href="https://secureapps.wsdot.wa.gov/ferries/reservations/vehicle/SailingSchedule.aspx?cookieCheck=true" target="_blank" rel="noopener">Reserve on WSDOT</a> — spots open mid-April 2027 ' +
        '(<a href="ferry-reminder.ics">calendar reminder</a>).</p>'
    },
    'star-friday-harbor': {
      title: 'FRIDAY HARBOR',
      html: '<p>You made it! The ferry lands right downtown — everything ' +
        'is a short walk from the dock.</p>'
    }
  };

  // CMS copy wins when the page provides it (build.js emits #map-tips)
  (function () {
    var el = document.getElementById('map-tips');
    if (!el) return;
    try {
      var cms = JSON.parse(el.textContent);
      Object.keys(cms).forEach(function (k) {
        if (cms[k] && cms[k].title && cms[k].html) TIPS[k] = cms[k];
      });
    } catch (e) { /* fall back to the built-in copy */ }
  })();

  function islandsStory(fig, svg) {
    var guide = svg.querySelector('#route-ferry-guide');
    var clipG = svg.querySelector('g[clip-path]') || svg;
    var parked = svg.querySelector('.parked-boat');
    var dashes = Array.prototype.slice.call(svg.querySelectorAll('.route-dash'))
      .sort(function (a, b) { return +a.dataset.t - +b.dataset.t; });

    Object.keys(TIPS).forEach(function (id) {
      var star = svg.querySelector('#' + id);
      if (!star) return;
      var hit = document.createElementNS(SVGNS, 'circle');
      hit.setAttribute('r', '46');
      hit.setAttribute('fill', 'transparent');
      hit.classList.add('star-hit');
      var pulse = document.createElementNS(SVGNS, 'circle');
      pulse.setAttribute('fill', 'none');
      pulse.setAttribute('stroke', '#FAEEDC');
      pulse.setAttribute('stroke-width', '3');
      pulse.classList.add('star-pulse');
      star.appendChild(pulse);
      star.appendChild(hit);

      var tip = document.createElement('div');
      tip.className = 'mapstory__tip';
      tip.innerHTML = '<h4>' + TIPS[id].title + '</h4>' + TIPS[id].html;
      fig.appendChild(tip);

      function position() {
        var fr = fig.getBoundingClientRect();
        var sr = hit.getBoundingClientRect();
        var cx = sr.left + sr.width / 2 - fr.left;
        var cy = sr.top + sr.height / 2 - fr.top;
        tip.style.left = Math.max(8, Math.min(fr.width - 258, cx + 24)) + 'px';
        tip.style.top = Math.max(8, cy - tip.offsetHeight - 24) + 'px';
      }
      function toggle(open) {
        document.querySelectorAll('.mapstory__tip.is-open').forEach(function (o) {
          if (o !== tip) o.classList.remove('is-open');
        });
        tip.classList.toggle('is-open', open);
        if (open) position();
      }
      hit.addEventListener('click', function (e) {
        e.stopPropagation();
        toggle(!tip.classList.contains('is-open'));
      });
      window.addEventListener('resize', function () {
        if (tip.classList.contains('is-open')) position();
      });
    });
    document.addEventListener('click', function () {
      document.querySelectorAll('.mapstory__tip.is-open').forEach(function (o) {
        o.classList.remove('is-open');
      });
    });

    if (REDUCED || !guide || !dashes.length) return;

    // the sailing loops: the boat departs the dock, inks the user's dashes
    // to Friday Harbor, the finished line holds a beat, then it sails again
    var boat = makeVehicle(boatImage(), 0.46);
    clipG.appendChild(boat);
    onVisible(fig, function () {
      var start = null, lastT = 0;
      var DUR = 8000, HOLD = 2600, TOTAL = DUR + HOLD;
      function frame(ts) {
        if (start === null) start = ts;
        var t = (ts - start) % TOTAL;
        if (t < lastT) { // wrapped: new sailing
          dashes.forEach(function (p) { p.setAttribute('opacity', '0'); });
        }
        lastT = t;
        var tt = ease(t / DUR);
        if (t < DUR) {
          if (parked) parked.setAttribute('opacity', '0'); // it has departed
          var p = sample(guide, guide.getTotalLength() * tt);
          placeVehicle(boat, p.x, p.y, 0); // pose baked into the art
          boat.setAttribute('opacity', String(tt >= 1 ? 0 : Math.min(1, 6 * tt)));
          var m = Math.floor(dashes.length * tt);
          for (var i = 0; i < m; i++) dashes[i].setAttribute('opacity', '1');
        } else { // the hold: line complete, boat back at the dock
          boat.setAttribute('opacity', '0');
          dashes.forEach(function (p) { p.setAttribute('opacity', '1'); });
          if (parked) parked.setAttribute('opacity', '1');
        }
        requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    });
  }
})();
