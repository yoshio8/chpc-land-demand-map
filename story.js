// =====================================================================
// Story map engine. You usually only need to edit config.js.
//
// Sections:
//   1. Settings: programs, colors, size groups
//   2. Map setup
//   3. Filters
//   4. Story text, hero and header
//   5. Explorer controls (last chapter)
//   6. Legend
//   7. Small chart (bottom right)
//   8. Larger chart, bottom right (featureChart chapters)
//   9. Map points: one layer per chapter, cross-faded
//  10. Switching chapters
//  11. Popups and click-to-zoom
//  12. Startup: load data, add layers, watch scrolling
// =====================================================================


// ---------------------------------------------------------------------
// 1. Settings: programs, colors, size groups
// ---------------------------------------------------------------------

// Tax incentive groups. Anything not listed is shown as "Other".
var PROGRAMS = ['421a', '485-X', '420c', 'Article XI', 'No Tax Incentive', 'Other'];
var COLORS = {
  '421a': '#f4a261',
  '485-X': '#e76f51',
  '420c': '#08a59d',
  'Article XI': '#7ec270',
  'No Tax Incentive': '#a8b2bd',
  'Other': '#b388eb'
};
var LABELS = { '421a': '421-a', '485-X': '485-x', '420c': '420-c', 'Article XI': 'Article XI', 'No Tax Incentive': 'No tax incentive', 'Other': 'Other programs' };
// Colors drawn inside the map and charts (the page itself is styled in style.css).
var INK = {
  axis: '#9aa3ad',       // chart axis text
  grid: '#2c333b',       // chart grid lines
  text: '#e8eaed',       // value labels on the bars
  neutralBar: '#cfd6dd', // bars when no single program is shown
  mutedBar: '#4a525c',   // the non-highlighted bars (chart.highlight)
  pointStroke: '#111418' // outline around map points
};

// Building size groups (net new units, inclusive), used for the 'size_group'
// chart grouping. Labels must match chart.highlight values in config.js.
var SIZE_GROUPS = [
  { label: '1', min: 1, max: 1 },
  { label: '2', min: 2, max: 2 },
  { label: '3–5', min: 3, max: 5 },
  { label: '6–10', min: 6, max: 10 },
  { label: '11–49', min: 11, max: 49 },
  { label: '50–99', min: 50, max: 99 },
  { label: '100–199', min: 100, max: 199 },
  { label: '200+', min: 200 }
];

// Stops on the explorer's building size slider (net new units). The span
// between the two handles is inclusive; the last stop means "and up".
var SIZE_STOPS = [1, 2, 3, 5, 10, 50, 100, 200];
var YEARS = { min: 0, max: 0 }; // permit year range, filled in from the data

// Current explorer selections.
var exploreState = {
  programs: PROGRAMS.slice(),
  sizeLo: 0, sizeHi: SIZE_STOPS.length - 1, // indexes into SIZE_STOPS
  yearLo: null, yearHi: null,
  groupBy: 'boro_name'
};

var fmt = new Intl.NumberFormat('en-US');
var allFeatures = [];      // every building's properties, once loaded
var current = null;        // the active chapter
var metricOverride = null; // set when the reader clicks Units / Per Building
var skipping = false;      // true while the Skip button scrolls to the explorer
var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function programGroup(p) { return PROGRAMS.indexOf(p) >= 0 ? p : 'Other'; }

// A building's value for a chart grouping, e.g. '2019' rather than '2019.0'.
function groupKey(p, groupBy) {
  return p[groupBy] == null ? 'Unknown' : String(p[groupBy]).replace('.0', '');
}
function median(vals) {
  if (!vals.length) return 0;
  var v = vals.slice().sort(function (a, b) { return a - b; });
  return v[Math.floor((v.length - 1) / 2)];
}
function sum(vals) { return vals.reduce(function (a, v) { return a + v; }, 0); }


// ---------------------------------------------------------------------
// 2. Map setup
// ---------------------------------------------------------------------

mapboxgl.accessToken = config.accessToken;
var first = config.chapters[0].location;
var map = new mapboxgl.Map({
  container: 'map',
  style: config.style,
  center: first.center, zoom: first.zoom, pitch: first.pitch || 0, bearing: first.bearing || 0,
  scrollZoom: false // page scroll drives the story, not map zoom
});

// Zoom buttons. buildLegend() puts them inside the legend box.
var navControl = new mapboxgl.NavigationControl({ showCompass: false });

// Keep the header from covering the top of the map: camera centers are
// measured within the area below it.
function headerHeight() { return window.innerWidth <= 760 ? 60 : 80; }
// Phones: the text sheet covers up to the bottom 45% of the screen (see
// style.css), so the camera centers the map in the open area above it.
function isPhone() { return window.innerWidth <= 760; }
function sheetHeight() { return isPhone() ? Math.round(window.innerHeight * 0.45) : 0; }
map.setPadding({ top: headerHeight(), bottom: sheetHeight(), left: 0, right: 0 });

// Rough outline of NYC. Basemap labels outside it are hidden.
var NYC_OUTLINE = { type: 'Polygon', coordinates: [[
  [-74.26, 40.49], [-74.25, 40.53], [-74.21, 40.56], [-74.20, 40.60], [-74.20, 40.635],
  [-74.18, 40.645], [-74.07, 40.648], [-74.04, 40.69], [-74.025, 40.71], [-74.015, 40.75],
  [-74.00, 40.78], [-73.97, 40.82], [-73.945, 40.86], [-73.925, 40.88], [-73.915, 40.915],
  [-73.85, 40.905], [-73.81, 40.885], [-73.77, 40.875], [-73.755, 40.80], [-73.74, 40.77],
  [-73.70, 40.75], [-73.725, 40.72], [-73.73, 40.66], [-73.745, 40.635], [-73.74, 40.59],
  [-73.74, 40.54], [-74.00, 40.54], [-74.10, 40.51], [-74.26, 40.49]
]] };
map.on('load', function () {
  map.getStyle().layers.forEach(function (l) {
    if (l.type !== 'symbol') return;
    var inside = ['within', NYC_OUTLINE];
    map.setFilter(l.id, l.filter ? ['all', l.filter, inside] : inside);
  });
});


// ---------------------------------------------------------------------
// 3. Filters
// One filter "spec" per chapter becomes both a Mapbox expression (for the
// map) and a JS test (for the charts). Spec keys:
//   programs, minUnits, maxUnits, minYear, maxYear.
// ---------------------------------------------------------------------

function filterSpec(ch) {
  if (!ch.explore) return ch.filter || {};
  // Explorer: build the spec from the controls. Each slider only filters
  // when pulled in from its end, so the full range also keeps buildings
  // with 0 units or no permit year.
  var s = { programs: exploreState.programs };
  if (exploreState.sizeLo > 0) s.minUnits = SIZE_STOPS[exploreState.sizeLo];
  if (exploreState.sizeHi < SIZE_STOPS.length - 1) s.maxUnits = SIZE_STOPS[exploreState.sizeHi];
  if (exploreState.yearLo > YEARS.min) s.minYear = exploreState.yearLo;
  if (exploreState.yearHi < YEARS.max) s.maxYear = exploreState.yearHi;
  return s;
}
function toMapboxFilter(s) {
  var f = ['all'];
  if (s.programs) f.push(['in', ['get', 'prog'], ['literal', s.programs]]);
  if (s.minUnits != null) f.push(['>=', ['get', 'classanet'], s.minUnits]);
  if (s.maxUnits != null) f.push(['<=', ['get', 'classanet'], s.maxUnits]);
  if (s.minYear != null) f.push(['>=', ['get', 'year'], s.minYear]);
  if (s.maxYear != null) f.push(['<=', ['get', 'year'], s.maxYear]);
  return f;
}
function matches(p, s) {
  if (s.programs && s.programs.indexOf(p.prog) < 0) return false;
  if (s.minUnits != null && p.classanet < s.minUnits) return false;
  if (s.maxUnits != null && p.classanet > s.maxUnits) return false;
  if (s.minYear != null && !(p.year >= s.minYear)) return false;
  return !(s.maxYear != null && !(p.year <= s.maxYear));
}


// ---------------------------------------------------------------------
// 4. Story text, hero and header
// ---------------------------------------------------------------------

// A logo image, linked to config.logoLink if set.
function linkedImg(src) {
  var img = '<img src="' + src + '" alt="' + (config.logoAlt || '') + '">';
  return config.logoLink ? '<a href="' + config.logoLink + '" target="_blank" rel="noopener">' + img + '</a>' : img;
}

function buildStory() {
  var story = document.getElementById('story');

  // Hero: big logo over title over subtitle. The logo is actually the fixed
  // header image (see wireHeader); the hero only holds an empty slot for it.
  var exploreCh = config.chapters.find(function (c) { return c.explore; });
  var hero = document.createElement('section');
  hero.id = 'hero';
  hero.innerHTML = (config.headerLogo ? '<div class="hero-logo-slot" aria-hidden="true"></div>' : '') +
    '<div class="hero-text"><h1>' + config.title + '</h1><p class="hero-sub">' + config.subtitle +
    '</p><p class="byline">' + config.byline + '</p></div>' +
    (exploreCh ? '<button type="button" class="skip-btn">Skip to the map explorer</button>' : '') +
    '<div class="hero-cue" aria-hidden="true">Scroll ↓</div>';
  document.body.insertBefore(hero, story);

  // Skip button: slowly scroll down to the explorer so the reader sees the
  // story pass by. Chapters passed on the way are skipped (see activate)
  // so the map doesn't fly to each one.
  var skip = hero.querySelector('.skip-btn');
  if (skip) skip.addEventListener('click', function () {
    var el = document.getElementById(exploreCh.id);
    var r = el.getBoundingClientRect();
    var to = window.scrollY + r.top + r.height / 2 - window.innerHeight / 2; // explorer centered
    skipping = true;
    scrollSlowly(to, reduceMotion ? 0 : SKIP_MS, function () {
      skipping = false;
      // Start whichever chapter ended up mid-screen (the explorer, unless
      // the reader stopped the scroll early).
      var mid = window.innerHeight / 2;
      var hit = config.chapters.find(function (c) {
        var b = document.getElementById(c.id).getBoundingClientRect();
        return b.top <= mid && b.bottom >= mid;
      });
      if (hit) activate(hit);
    });
  });

  if (config.headerLogo) {
    var bar = document.createElement('header');
    bar.id = 'site-header';
    bar.innerHTML = linkedImg(config.headerLogo) +
      '<span class="header-title" aria-hidden="true">' + config.title + '</span>';
    document.body.appendChild(bar);
  }

  // One box per chapter: title (with a color dot), optional photo, text.
  var html = config.chapters.map(function (ch) {
    var progs = (ch.filter && ch.filter.programs) || [];
    var dot = progs.length === 1 ? COLORS[progs[0]] : ch.color;
    var swatch = dot ? '<span class="swatch" style="background:' + dot + '"></span>' : '';
    var caption = ch.imageCaption ? '<figcaption>' + ch.imageCaption + '</figcaption>' : '';
    var img = ch.compareImages ? '<figure class="step-img">' + compareHTML(ch.compareImages) + caption + '</figure>'
      : ch.image ? '<figure class="step-img"><img src="' + ch.image + '" alt="' + (ch.imageAlt || '') + '" loading="lazy">' + caption + '</figure>'
      : '';
    return '<div class="step panel' + (img ? ' has-img' : '') + (ch.wide ? ' wide' : '') + '" id="' + ch.id + '"><h2>' + swatch + ch.title + '</h2>' + img +
      '<p>' + ch.description + '</p>' +
      (ch.more ? '<button type="button" class="more-btn" data-page="' + ch.more.page + '">' + (ch.more.label || 'Read more') + ' →</button>' : '') +
      (ch.explore ? exploreControls() : '') + '</div>';
  }).join('');

  // Footer: logo on white, then sources.
  var brand = config.logo ? '<div class="brand">' + linkedImg(config.logo) + '</div>' : '';
  html += '<div class="footer panel">' + brand + '<div class="footer-body">' + config.footer + '</div></div>';
  story.innerHTML = html;
}

// Scroll the page to y over ms milliseconds, easing in and out. Snapping
// is paused meanwhile (it would fight the animation). Any wheel, touch or
// key from the reader stops it where it is.
var SKIP_MS = 3500;
function scrollSlowly(to, ms, done) {
  var root = document.documentElement, from = window.scrollY, start = performance.now(), stopped = false;
  function stop() { stopped = true; }
  var events = ['wheel', 'touchstart', 'keydown', 'mousedown'];
  events.forEach(function (ev) { window.addEventListener(ev, stop, { passive: true }); });
  root.style.scrollSnapType = 'none';
  (function step(now) {
    var t = ms ? Math.min(1, (now - start) / ms) : 1;
    var e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; // ease in-out
    if (!stopped) window.scrollTo(0, from + (to - from) * e);
    if (t < 1 && !stopped) return requestAnimationFrame(step);
    events.forEach(function (ev) { window.removeEventListener(ev, stop); });
    root.style.scrollSnapType = '';
    done();
  })(start);
}

// "Read more" overlay: a chapter's more.page (an HTML file) shown in a
// scrollable box over the map. Close with ×, Esc, or a click outside.
function wireOverlay() {
  var overlay = document.createElement('div');
  overlay.id = 'overlay';
  overlay.innerHTML = '<div class="overlay-box panel" role="dialog" aria-modal="true">' +
    '<button type="button" class="overlay-close" aria-label="Close">×</button>' +
    '<div class="overlay-body"></div></div>';
  document.body.appendChild(overlay);
  var body = overlay.querySelector('.overlay-body');
  var closeBtn = overlay.querySelector('.overlay-close');
  var opener = null;

  function open(page, btn) {
    opener = btn;
    body.innerHTML = '<p class="overlay-loading">Loading…</p>';
    overlay.classList.add('show');
    document.documentElement.classList.add('overlay-open'); // stops the story scrolling behind
    closeBtn.focus();
    fetch(page).then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.text();
    }).then(function (html) {
      body.innerHTML = html;
      body.scrollTop = 0;
    }).catch(function () {
      body.innerHTML = '<p>Could not load ' + page + '.</p>';
    });
  }
  function close() {
    overlay.classList.remove('show');
    document.documentElement.classList.remove('overlay-open');
    if (opener) opener.focus();
  }
  document.querySelectorAll('.more-btn').forEach(function (b) {
    b.addEventListener('click', function () { open(b.dataset.page, b); });
  });
  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && overlay.classList.contains('show')) close();
  });
}

// Before/after photo slider: the "after" photo sits underneath and the
// "before" photo on top is cut off at the slider (--pos, 0–100%).
function compareHTML(c) {
  return '<div class="compare" style="--pos:50%">' +
    '<img src="' + c.after + '" alt="' + (c.alt || '') + '" loading="lazy">' +
    '<img class="compare-before" src="' + c.before + '" alt="" loading="lazy">' +
    '<span class="compare-label left">Before</span><span class="compare-label right">After</span>' +
    '<div class="compare-handle"></div>' +
    '<input type="range" min="0" max="100" value="50" aria-label="Compare before and after photos">' +
    '</div>';
}
function wireCompare() {
  document.querySelectorAll('.compare').forEach(function (box) {
    var input = box.querySelector('input');
    input.addEventListener('input', function () { box.style.setProperty('--pos', input.value + '%'); });
  });
}

// As you scroll, the big hero logo shrinks and slides up into the header,
// where it sits beside the title.
function wireHeader() {
  var bar = document.getElementById('site-header');
  var hero = document.getElementById('hero');
  if (!bar || !hero) return;
  var slot = hero.querySelector('.hero-logo-slot');
  var text = hero.querySelector('.hero-text');
  var logo = bar.querySelector('img');
  var title = bar.querySelector('.header-title');
  var cue = hero.querySelector('.hero-cue');
  var skipBtn = hero.querySelector('.skip-btn');
  var ASPECT = 2716 / 725, GAP = 16; // logo image width / height; gap before title
  var m = {};

  function measure() {
    var phone = window.innerWidth <= 760;
    m.small = phone ? 34 : 44; // docked logo height
    m.top = phone ? 14 : 20;   // docked distance from top
    m.big = Math.min(120, (Math.min(window.innerWidth, 900) - 48) / ASPECT); // hero logo height
    slot.style.height = m.big + 'px';
    m.slotTop = slot.getBoundingClientRect().top + window.scrollY;
    m.showTitle = !phone;
    title.style.display = m.showTitle ? '' : 'none';
    m.titleW = m.showTitle ? title.offsetWidth : 0;
    update();
  }
  function update() {
    var p = Math.min(1, Math.max(0, window.scrollY / Math.max(1, m.slotTop - m.top))); // 0 = top, 1 = docked
    var e = p * p * (3 - 2 * p); // eased
    var h = m.big + (m.small - m.big) * e;
    var y = p >= 1 ? m.top : m.slotTop - window.scrollY; // follow the slot, then park at the top
    var dx = -(m.showTitle ? (GAP + m.titleW) / 2 : 0) * e; // center logo + title as a pair
    logo.style.height = h + 'px';
    bar.style.transform = 'translate(calc(-50% + ' + dx + 'px), ' + y + 'px)';
    bar.style.width = (h * ASPECT) + 'px';
    title.style.opacity = Math.max(0, (p - 0.8) / 0.2);
    // The "Scroll" cue and the glow behind the hero fade out early.
    var early = Math.max(0, 1 - p / 0.35);
    if (cue) cue.style.opacity = early;
    if (skipBtn) { skipBtn.style.opacity = early; skipBtn.style.pointerEvents = early > 0.1 ? '' : 'none'; }
    hero.style.setProperty('--hero-glow', Math.max(0, 1 - p / 0.7));
    // Hero text fades as it slides under the header.
    var tTop = text.getBoundingClientRect().top;
    text.style.opacity = Math.min(1, Math.max(0, (tTop - (m.top + m.small)) / 120));
  }
  window.addEventListener('scroll', function () { requestAnimationFrame(update); }, { passive: true });
  window.addEventListener('resize', measure);
  if (!logo.complete) logo.addEventListener('load', measure);
  measure();
}


// ---------------------------------------------------------------------
// 5. Explorer controls (last chapter)
// ---------------------------------------------------------------------

function exploreControls() {
  return '<div class="controls">' +
    '<fieldset><legend>Program</legend>' + PROGRAMS.map(function (p) {
      return '<label><input type="checkbox" name="prog" value="' + p + '" checked> ' +
        '<span class="swatch" style="background:' + COLORS[p] + '"></span>' + LABELS[p] + '</label>';
    }).join('') + '</fieldset>' +
    rangeSliderHTML('size-range', 'Building size (units)') +
    rangeSliderHTML('year-range', 'Permit year') +
    '<label>Chart by<select id="groupby">' +
      '<option value="boro_name">Borough</option><option value="zone_group">Zoning district</option>' +
      '<option value="permityear">Permit year</option><option value="ntaname20">Neighborhood (top 12)</option>' +
    '</select></label>' +
    '<button type="button" id="explore-reset" class="reset-btn">Reset</button>' +
    '</div>';
}

// Redraw the explorer. Slider drags wait 120ms so the map isn't
// re-filtered on every pixel of movement.
var exploreTimer = null;
function refreshExplore(delay) {
  clearTimeout(exploreTimer);
  exploreTimer = setTimeout(function () { if (current && current.explore) render(current, false); }, delay || 0);
}
function checkedValues(name) {
  return Array.prototype.filter.call(document.querySelectorAll('input[name="' + name + '"]'), function (x) { return x.checked; })
    .map(function (x) { return x.value; });
}

function wireExplore() {
  // Program checkboxes
  document.querySelectorAll('input[name="prog"]').forEach(function (cb) {
    cb.addEventListener('change', function () {
      exploreState.programs = checkedValues('prog');
      refreshExplore();
    });
  });

  // Building size slider (the permit year slider is wired once data loads)
  wireRange('size-range', {
    min: 0, max: SIZE_STOPS.length - 1, lo: exploreState.sizeLo, hi: exploreState.sizeHi,
    ticks: SIZE_STOPS.map(function (v, i) {
      return { value: i, label: i === SIZE_STOPS.length - 1 ? v + '+' : String(v) };
    }),
    format: function (lo, hi) {
      var last = SIZE_STOPS.length - 1, a = SIZE_STOPS[lo], b = SIZE_STOPS[hi];
      if (lo === 0 && hi === last) return 'All sizes';
      if (hi === last) return a + '+ units';
      return a === b ? a + (a === 1 ? ' unit' : ' units') : a + '–' + b + ' units';
    },
    onChange: function (lo, hi) { exploreState.sizeLo = lo; exploreState.sizeHi = hi; refreshExplore(120); }
  });

  // "Chart by" dropdown
  document.getElementById('groupby').addEventListener('change', function (e) {
    exploreState.groupBy = e.target.value;
    refreshExplore();
  });

  // Reset: everything checked, sliders at full range, chart by borough.
  document.getElementById('explore-reset').addEventListener('click', function () {
    document.querySelectorAll('input[name="prog"]').forEach(function (x) { x.checked = true; });
    exploreState.programs = PROGRAMS.slice();
    exploreState.sizeLo = 0; exploreState.sizeHi = SIZE_STOPS.length - 1;
    ranges['size-range'].set(exploreState.sizeLo, exploreState.sizeHi);
    exploreState.yearLo = YEARS.min; exploreState.yearHi = YEARS.max;
    if (ranges['year-range']) ranges['year-range'].set(YEARS.min, YEARS.max);
    exploreState.groupBy = 'boro_name';
    document.getElementById('groupby').value = 'boro_name';
    metricOverride = null;
    refreshExplore();
  });
}

// Two-handle range slider: two stacked <input type="range"> on one track,
// with a colored fill between the handles.
var ranges = {}; // slider id -> { set(lo, hi) }, used by the reset button
function rangeSliderHTML(id, label) {
  return '<div class="range" id="' + id + '">' +
    '<div class="range-head"><span>' + label + '</span><span class="range-val"></span></div>' +
    '<div class="range-track"><div class="range-fill"></div>' +
    '<input type="range" class="lo" aria-label="' + label + ' from">' +
    '<input type="range" class="hi" aria-label="' + label + ' to"></div>' +
    '<div class="range-ticks"></div></div>';
}
// o = { min, max, lo, hi, ticks: [{ value, label }], format(lo, hi), onChange(lo, hi) }
function wireRange(id, o) {
  var root = document.getElementById(id);
  var lo = root.querySelector('.lo'), hi = root.querySelector('.hi');
  var fill = root.querySelector('.range-fill'), val = root.querySelector('.range-val');
  var span = Math.max(1, o.max - o.min);
  function pos(v) { return (v - o.min) / span; } // 0–1 along the track
  [lo, hi].forEach(function (el) { el.min = o.min; el.max = o.max; el.step = 1; });
  lo.value = o.lo; hi.value = o.hi;
  root.querySelector('.range-ticks').innerHTML = o.ticks.map(function (t) {
    return '<span class="tick" style="--p:' + pos(t.value) + '">' + (t.label || '') + '</span>';
  }).join('');
  function update(fromLo) {
    var a = +lo.value, b = +hi.value;
    if (a > b) { if (fromLo) lo.value = a = b; else hi.value = b = a; } // handles can't cross
    fill.style.setProperty('--a', pos(a));
    fill.style.setProperty('--b', pos(b));
    lo.style.zIndex = a === o.max ? 3 : 2; // keep the low handle grabbable at the far end
    val.textContent = o.format(a, b);
    return [a, b];
  }
  lo.addEventListener('input', function () { var r = update(true); o.onChange(r[0], r[1]); });
  hi.addEventListener('input', function () { var r = update(false); o.onChange(r[0], r[1]); });
  update(true);
  ranges[id] = { set: function (a, b) { lo.value = a; hi.value = b; update(true); } };
}


// ---------------------------------------------------------------------
// 6. Legend (top right, with the zoom buttons)
// ---------------------------------------------------------------------

function buildLegend() {
  var legend = document.getElementById('legend');
  legend.innerHTML = '<div class="legend-body">' + PROGRAMS.map(function (p) {
    return '<div class="row" data-prog="' + p + '"><span class="dot" style="background:' + COLORS[p] + '"></span>' + LABELS[p] + '</div>';
  }).join('') +
    (config.subwayRoutesUrl ? '<div class="row subway"><span class="line"></span>Subway</div>' : '') +
    '<div class="note">Point size = building size</div>' +
    (config.districtsUrl ? districtLegendHTML() : '') +
    (config.zoningUrl ? zoningLegendHTML() : '') + '</div>';
  legend.appendChild(navControl.onAdd(map));
  var box = document.getElementById('districts-on');
  if (box) box.addEventListener('change', function () { setDistricts(box.checked); });
  var zbox = document.getElementById('zoning-on');
  if (zbox) zbox.addEventListener('change', function () { setZoning(zbox.checked); });
}
function zoningLegendHTML() {
  return '<label class="row districts-toggle zoning-toggle"><input type="checkbox" id="zoning-on"> Low-density zoning</label>' +
    '<div class="district-key zoning-key">' + Object.keys(ZONING_COLORS).map(function (z) {
      return '<span><i style="background:' + ZONING_COLORS[z] + '"></i>' + z + '</span>';
    }).join('') + '</div>';
}
// Checkbox plus a color key (shown only while the layer is on).
function districtLegendHTML() {
  var k = function (n) { return n >= 1000 ? n / 1000 + 'k' : String(n); };
  return '<label class="row districts-toggle"><input type="checkbox" id="districts-on"> Units by community district</label>' +
    '<div class="district-key">' + DISTRICT_STEPS.map(function (s, i) {
      var next = DISTRICT_STEPS[i + 1];
      return '<span><i style="background:' + s[1] + '"></i>' + (next ? k(s[0]) + '–' + k(next[0]) : k(s[0]) + '+') + '</span>';
    }).join('') + '</div>';
}
// Dim the programs the current chapter isn't showing.
function updateLegend(s) {
  document.querySelectorAll('#legend .row[data-prog]').forEach(function (r) {
    r.classList.toggle('off', !!s.programs && s.programs.indexOf(r.dataset.prog) < 0);
  });
}


// ---------------------------------------------------------------------
// 7. Small chart (bottom right)
// chapter.chart = { groupBy, metric, title, filter, highlight }
// metric: 'units' (sum), 'perbuilding' (median units per building) or
//         'lotarea' (median lot area, sq ft)
// ---------------------------------------------------------------------

var chart = null;
var chartTip = null; // tooltip text, set on each update
var METRIC_NAMES = { units: 'Units', perbuilding: 'Median Units per Building', lotarea: 'Median Lot Area (sq ft)' };
var GROUP_NAMES = { size_group: 'building size', prog: 'tax incentive', boro_name: 'borough',
  zone_group: 'zoning district', permityear: 'permit year', ntaname20: 'neighborhood', cdtanamesimple: 'neighborhood' };

// Writes each highlighted bar's number at its end (right of a horizontal
// bar, above a vertical one). Set per update as dataset.valueLabels.
var highlightLabel = {
  id: 'highlightLabel',
  afterDatasetsDraw: function (c) {
    var d = c.data.datasets[0], labs = (d && d.valueLabels) || [];
    var ctx = c.ctx, horizontal = c.options.indexAxis === 'y';
    ctx.save();
    ctx.fillStyle = INK.text;
    ctx.font = '600 12px ' + Chart.defaults.font.family;
    ctx.textAlign = horizontal ? 'left' : 'center';
    ctx.textBaseline = horizontal ? 'middle' : 'bottom';
    labs.forEach(function (lab) {
      var bar = c.getDatasetMeta(0).data[lab.index];
      if (bar) ctx.fillText(lab.text, horizontal ? bar.x + 6 : bar.x, horizontal ? bar.y : bar.y - 4);
    });
    ctx.restore();
  }
};

// Long bar labels (e.g. "Long Island City-Sunnyside-Woodside") break into
// lines at hyphens, about 18 characters each, so the bars keep their room.
function wrapLabel(text) {
  if (text.length <= 18) return text;
  var lines = [''];
  text.split(/(?<=-)/).forEach(function (part) {
    var last = lines.length - 1;
    if (lines[last] && (lines[last] + part).length > 18) lines.push(part);
    else lines[last] += part;
  });
  return lines.length > 1 ? lines : text;
}

function lotAreas(rows) {
  return rows.map(function (p) { return +p.lotarea; }).filter(function (v) { return v > 0; });
}

// Bar order: fixed for sizes, years and zoning; otherwise null = by value.
function sortKeys(keys, groupBy) {
  if (groupBy === 'size_group') return SIZE_GROUPS.map(function (g) { return g.label; })
    .filter(function (l) { return keys.indexOf(l) >= 0; });
  if (groupBy === 'permityear') return keys.sort();
  if (groupBy === 'zone_group') return keys.sort(function (a, b) {
    var na = parseInt(a.replace(/\D/g, ''), 10), nb = parseInt(b.replace(/\D/g, ''), 10);
    return (isNaN(na) ? 99 : na) - (isNaN(nb) ? 99 : nb);
  });
  return null;
}

function updateChart(ch, s) {
  var groupBy = ch.explore ? exploreState.groupBy : ch.chart.groupBy;
  var metric = metricOverride || ch.chart.metric;
  // chart.filter lets the chart show different buildings than the map.
  var cs = (!ch.explore && ch.chart.filter) || s;
  var rows = allFeatures.filter(function (p) { return matches(p, cs); });

  // Group the buildings, then compute the metric for each group.
  var groups = {};
  rows.forEach(function (p) {
    if (groupBy === 'size_group' && p.size_group == null) return; // 0-unit buildings
    var k = groupKey(p, groupBy);
    (groups[k] = groups[k] || []).push(p);
  });
  var totals = {}, counts = {};
  Object.keys(groups).forEach(function (k) {
    var g = groups[k], units = g.map(function (p) { return p.classanet; });
    if (metric === 'lotarea') {
      var lots = lotAreas(g);
      if (!lots.length) return; // no lot areas in this group: leave it out
      counts[k] = lots.length; totals[k] = median(lots);
    } else {
      counts[k] = g.length;
      totals[k] = metric === 'units' ? sum(units) : median(units);
    }
  });

  // Order the bars, then keep the top N: chart.top if set, else 12 for
  // explorer neighborhoods. For medians, the N with the most buildings,
  // so tiny groups don't dominate.
  var keys = Object.keys(totals);
  keys = sortKeys(keys, groupBy) || keys.sort(function (a, b) { return totals[b] - totals[a]; });
  var top = (!ch.explore && ch.chart.top) || (groupBy === 'ntaname20' ? 12 : 0);
  if (top) {
    if (metric === 'units') keys = keys.slice(0, top);
    else keys = keys.slice().sort(function (a, b) { return counts[b] - counts[a]; }).slice(0, top)
      .sort(function (a, b) { return totals[b] - totals[a]; });
  }

  // Stats line: matches the metric shown (Units tab = totals,
  // Per Building tab = the median, lot area = the median lot).
  var allUnits = rows.map(function (p) { return p.classanet; });
  document.getElementById('chart-stats').textContent =
    metric === 'perbuilding' ? 'Median ' + fmt.format(median(allUnits)) + ' units per building'
    : metric === 'lotarea' ? 'Median lot ' + fmt.format(median(lotAreas(rows))) + ' sq ft'
    : fmt.format(rows.length) + ' buildings · ' + fmt.format(sum(allUnits)) + ' new units';
  document.getElementById('chart-title').textContent = (ch.explore || metricOverride)
    ? METRIC_NAMES[metric] + ' by ' + (GROUP_NAMES[groupBy] || groupBy)
    : ch.chart.title;
  // Units / Per Building buttons only show on charts that use one of those.
  var toggleable = ch.explore || ch.chart.metric === 'units' || ch.chart.metric === 'perbuilding';
  document.getElementById('metric-toggle').style.display = toggleable ? '' : 'none';
  document.querySelectorAll('#metric-toggle button').forEach(function (b) { b.classList.toggle('on', b.dataset.metric === metric); });

  // Bar colors: the chapter's color, its one program's color, or neutral;
  // per-program colors when charting by program; chart.highlight mutes the rest.
  var progs = cs.programs || [];
  var color = ch.color || (progs.length === 1 ? COLORS[progs[0]] : INK.neutralBar);
  if (groupBy === 'prog') color = keys.map(function (k) { return COLORS[k] || INK.neutralBar; });
  // Neighborhood bars match their district's shade on the map.
  if (groupBy === 'cdtanamesimple') color = keys.map(function (k) { return districtColor(districtUnits[k] || 0); });
  // Zoning bars match the R1–R4 shading when it's on; the rest are muted.
  if (groupBy === 'zone_group' && zoningOn) color = keys.map(function (k) { return ZONING_COLORS[k] || INK.mutedBar; });
  // chart.highlight: one bar name or a list of them.
  var hi = !ch.explore && ch.chart.highlight ? [].concat(ch.chart.highlight) : [];
  if (hi.length) {
    var colorOf = color;
    color = keys.map(function (k, i) {
      if (hi.indexOf(k) < 0) return INK.mutedBar;
      return typeof colorOf === 'string' ? colorOf : colorOf[i];
    });
  }

  // Draw. Years run left to right; everything else is horizontal bars.
  var labels = groupBy === 'prog' ? keys.map(function (k) { return LABELS[k] || k; }) : keys.map(wrapLabel);
  var axis = groupBy === 'permityear' ? 'x' : 'y';
  var data = { labels: labels, datasets: [{ data: keys.map(function (k) { return totals[k]; }), backgroundColor: color, borderRadius: 3 }] };
  chartTip = function (c) {
    var k = keys[c.dataIndex], n = fmt.format(counts[k]) + (counts[k] === 1 ? ' Building' : ' Buildings');
    if (metric === 'units') return fmt.format(c.raw) + ' Units';
    if (metric === 'lotarea') return fmt.format(c.raw) + ' sq ft Median Lot (' + n + ')';
    return fmt.format(c.raw) + ' Units per Building (median of ' + n + ')';
  };
  // Highlighted bars: write each one's number next to it.
  data.datasets[0].valueLabels = keys.map(function (k, i) {
    return hi.indexOf(k) < 0 ? null : { index: i, text: fmt.format(totals[k]) + (metric === 'lotarea' ? ' sq ft' : '') };
  }).filter(Boolean);
  var pad = data.datasets[0].valueLabels.length ? (axis === 'y' ? { right: 60 } : { top: 18 }) : {};
  if (chart && chart.options.indexAxis !== axis) { chart.destroy(); chart = null; }
  if (chart) {
    chart.options.layout.padding = pad;
    chart.data = data; chart.update(); return;
  }
  var valueAxis = { grid: { color: INK.grid }, beginAtZero: true, ticks: { callback: function (v) { return fmt.format(v); } } };
  var catAxis = { grid: { display: false }, ticks: { autoSkip: false, font: { size: 11 } } };
  chart = new Chart(document.getElementById('chart'), {
    type: 'bar', data: data, plugins: [highlightLabel],
    options: {
      indexAxis: axis, maintainAspectRatio: false, animation: { duration: 500 },
      layout: { padding: pad },
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (c) { return chartTip(c); } } } },
      scales: axis === 'y' ? { x: valueAxis, y: catAxis } : { x: catAxis, y: valueAxis }
    }
  });
}


// ---------------------------------------------------------------------
// 8. Larger chart, bottom right (featureChart chapters): one bar per program
// featureChart = { title, note, programs, metric }
// metric: 'units' (sum) or 'average' (mean units per building)
// ---------------------------------------------------------------------

var featureChart = null;

// Writes each bar's value above it.
var barValueLabels = {
  id: 'barValueLabels',
  afterDatasetsDraw: function (ch) {
    var ctx = ch.ctx;
    ctx.save();
    ctx.fillStyle = INK.text;
    ctx.font = '600 13px ' + Chart.defaults.font.family;
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ch.getDatasetMeta(0).data.forEach(function (bar, j) {
      var v = ch.data.datasets[0].data[j];
      if (v != null) ctx.fillText(fmt.format(v), bar.x, bar.y - 4);
    });
    ctx.restore();
  }
};

function updateFeatureChart(fc) {
  var metric = fc.metric || 'units';
  var units = {}; // program -> list of units per building
  fc.programs.forEach(function (p) { units[p] = []; });
  allFeatures.forEach(function (f) { if (units[f.prog]) units[f.prog].push(f.classanet); });
  function value(list) {
    if (!list.length) return null;
    if (metric === 'average') return Math.round(sum(list) / list.length * 10) / 10;
    return sum(list);
  }
  var counts = fc.programs.map(function (p) { return units[p].length; });
  var data = {
    labels: fc.programs.map(function (p) { return LABELS[p]; }),
    datasets: [{
      borderRadius: 4, maxBarThickness: 90,
      backgroundColor: fc.programs.map(function (p) { return COLORS[p]; }),
      data: fc.programs.map(function (p) { return value(units[p]); })
    }]
  };
  document.getElementById('feature-title').textContent = fc.title || '';
  document.getElementById('feature-note').textContent = fc.note || '';
  if (featureChart) { featureChart.data = data; featureChart.update(); return; }
  featureChart = new Chart(document.getElementById('feature-canvas'), {
    type: 'bar', data: data, plugins: [barValueLabels],
    options: {
      maintainAspectRatio: false, animation: { duration: 600 },
      layout: { padding: { top: 22 } }, // room for the value labels
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: function (c) {
          var n = counts[c.dataIndex], bldgs = fmt.format(n) + (n === 1 ? ' Building' : ' Buildings');
          if (metric === 'average') return fmt.format(c.raw) + ' Units per Building (average of ' + bldgs + ')';
          return fmt.format(c.raw) + ' Units';
        } } }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 13 } } },
        y: { grid: { color: INK.grid }, beginAtZero: true, ticks: { callback: function (v) { return fmt.format(v); } } }
      }
    }
  });
}


// ---------------------------------------------------------------------
// 9. Map points: one layer per chapter, cross-faded
// Changing a visible layer's filter makes the points "pop" while Mapbox
// rebuilds them. So each chapter gets its own pre-filtered layer and
// switching chapters just fades opacity. The explorer uses two layers that
// take turns: filter the hidden one, wait for it to rebuild, then fade.
// ---------------------------------------------------------------------

var POINT_OPACITY = 0.75;
var FADE_MS = 700;
var pointLayers = [];   // every point layer id
var activeLayer = null; // the one currently shown
var exploreSlots = ['pts-explore-a', 'pts-explore-b'], exploreSlot = 0, exploreFilterKey = null, exploreToken = 0;

function layerIdFor(ch) { return ch.explore ? exploreSlots[exploreSlot] : 'pts-' + ch.id; }

function addPointLayer(id, filter) {
  var fade = { duration: reduceMotion ? 0 : FADE_MS, delay: 0 };
  var size = ['sqrt', ['max', ['get', 'classanet'], 1]]; // dot size grows with units
  map.addLayer({
    id: id, type: 'circle', source: 'nc', filter: filter,
    paint: {
      'circle-color': ['get', 'color'], // set from COLORS when the data loads
      'circle-radius': ['interpolate', ['linear'], ['zoom'],
        9,  ['interpolate', ['linear'], size, 1, 1.4, 10, 4, 30, 9],
        14, ['interpolate', ['linear'], size, 1, 4, 10, 12, 30, 26]],
      'circle-opacity': 0, 'circle-opacity-transition': fade,
      'circle-stroke-opacity': 0, 'circle-stroke-opacity-transition': fade,
      'circle-stroke-color': INK.pointStroke, 'circle-stroke-width': 0.4
    }
  });
  pointLayers.push(id);
}

// Subway lines and stations, drawn under the building points. Lines use
// the MTA colors (by rt_symbol); stations show from zoom 12, names from 14.
var SUBWAY_COLORS = {
  '1': '#ee352e', '4': '#00933c', '7': '#b933ad', 'A': '#0039a6', 'SI': '#0039a6',
  'B': '#ff6319', 'G': '#6cbe45', 'J': '#996633', 'L': '#a7a9ac', 'N': '#fccc0a'
};
function addSubway() {
  if (!config.subwayRoutesUrl) return;
  map.addSource('subway-routes', { type: 'geojson', data: config.subwayRoutesUrl });
  var color = ['match', ['get', 'rt_symbol']];
  Object.keys(SUBWAY_COLORS).forEach(function (k) { color.push(k, SUBWAY_COLORS[k]); });
  color.push('#808183');
  map.addLayer({
    id: 'subway-lines', type: 'line', source: 'subway-routes',
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: {
      'line-color': color, 'line-opacity': 0.6,
      'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1, 15, 3.5]
    }
  });
  if (!config.subwayStopsUrl) return;
  map.addSource('subway-stops', { type: 'geojson', data: config.subwayStopsUrl });
  map.addLayer({
    id: 'subway-stations', type: 'circle', source: 'subway-stops', minzoom: 12,
    paint: {
      'circle-color': '#ffffff', 'circle-stroke-color': '#111418', 'circle-stroke-width': 1,
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 2, 15, 4],
      'circle-opacity': ['interpolate', ['linear'], ['zoom'], 12, 0, 12.5, 0.9],
      'circle-stroke-opacity': ['interpolate', ['linear'], ['zoom'], 12, 0, 12.5, 0.9]
    }
  });
  map.addLayer({
    id: 'subway-station-labels', type: 'symbol', source: 'subway-stops', minzoom: 14,
    layout: {
      'text-field': ['get', 'name'], 'text-size': 12, 'text-offset': [0, 1.1], 'text-anchor': 'top',
      'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular']
    },
    paint: { 'text-color': '#c9d0d8', 'text-halo-color': '#111418', 'text-halo-width': 1.2 }
  });
}

// Community districts, shaded by total new units (classanet) in each.
// Drawn under the subway and points; off unless a slide has
// districts: true or the reader ticks the box in the legend.
// District files use BoroCD (e.g. 301); the buildings use cdta2020 (BK01).
// Teal-blue ramp built on #036c81: dark for few units, bright for many.
var DISTRICT_STEPS = [            // [from this many units, color]
  [0, '#0d2a33'], [1000, '#0b4a5a'], [2500, '#036c81'], [5000, '#1d9bb0'], [10000, '#5fd3e0']
];
var BORO_CODES = { 1: 'MN', 2: 'BX', 3: 'BK', 4: 'QN', 5: 'SI' };
var districtsOn = false;
var districtUnits = {}; // neighborhood name (cdtanamesimple) -> total units, for bar colors
// The district color for a unit total (same steps as the map).
function districtColor(units) {
  var c = DISTRICT_STEPS[0][1];
  DISTRICT_STEPS.forEach(function (s) { if (units >= s[0]) c = s[1]; });
  return c;
}
function addDistricts(geoD) {
  var totals = {}, names = {};
  allFeatures.forEach(function (p) {
    totals[p.cdta2020] = (totals[p.cdta2020] || 0) + p.classanet;
    names[p.cdta2020] = p.cdtanamesimple;
    districtUnits[p.cdtanamesimple] = (districtUnits[p.cdtanamesimple] || 0) + p.classanet;
  });
  if (!geoD) return;
  geoD.features.forEach(function (f) {
    var c = +f.properties.BoroCD, key = BORO_CODES[Math.floor(c / 100)] + ('0' + c % 100).slice(-2);
    // Parks and airports have no buildings: no units, left unshaded.
    if (totals[key] != null) { f.properties.units = Math.round(totals[key]); f.properties.name = names[key]; }
  });
  var color = ['step', ['get', 'units'], DISTRICT_STEPS[0][1]];
  DISTRICT_STEPS.slice(1).forEach(function (s) { color.push(s[0], s[1]); });
  map.addSource('districts', { type: 'geojson', data: geoD });
  map.addLayer({
    id: 'districts-fill', type: 'fill', source: 'districts', layout: { visibility: 'none' },
    paint: { 'fill-color': ['case', ['has', 'units'], color, 'rgba(0,0,0,0)'], 'fill-opacity': 0.75 }
  });
  map.addLayer({
    id: 'districts-line', type: 'line', source: 'districts', layout: { visibility: 'none' },
    paint: { 'line-color': '#0b0e12', 'line-width': 0.8, 'line-opacity': 0.8 }
  });
}
function setDistricts(on) {
  districtsOn = on;
  var box = document.getElementById('districts-on');
  if (box) box.checked = on;
  document.getElementById('legend').classList.toggle('districts-shown', on);
  if (!map.getLayer('districts-fill')) return;
  ['districts-fill', 'districts-line'].forEach(function (id) {
    map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none');
  });
}

// Low-density zoning districts (R1–R4), from MapPLUTO via
// data/build_low_density_zoning.py. Each feature has z: 'R1'…'R4'.
// Drawn under the subway and points; off unless a slide has zoning: true
// or the reader ticks the box in the legend. Lighter = lower density.
var ZONING_COLORS = { R1: '#e6dcf8', R2: '#c3a8ee', R3: '#9d79d9', R4: '#7650b8' };
var zoningOn = false;
function addZoning() {
  if (!config.zoningUrl) return;
  map.addSource('zoning', { type: 'geojson', data: config.zoningUrl });
  var color = ['match', ['get', 'z']];
  Object.keys(ZONING_COLORS).forEach(function (z) { color.push(z, ZONING_COLORS[z]); });
  color.push('rgba(0,0,0,0)');
  map.addLayer({
    id: 'zoning-fill', type: 'fill', source: 'zoning', layout: { visibility: 'none' },
    paint: { 'fill-color': color, 'fill-opacity': 0.45 }
  });
}
function setZoning(on) {
  zoningOn = on;
  var box = document.getElementById('zoning-on');
  if (box) box.checked = on;
  document.getElementById('legend').classList.toggle('zoning-shown', on);
  if (map.getLayer('zoning-fill')) map.setLayoutProperty('zoning-fill', 'visibility', on ? 'visible' : 'none');
  if (current && current.chart && current.chart.groupBy === 'zone_group') updateChart(current, filterSpec(current));
}

// Ring around a chapter's focus building (chapter.focus = its address).
function addFocusRing() {
  map.addLayer({
    id: 'focus-ring', type: 'circle', source: 'nc', filter: ['==', ['get', 'address'], ''],
    paint: {
      'circle-radius': 22, 'circle-color': 'rgba(0,0,0,0)',
      'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2.5,
      'circle-stroke-opacity': 0,
      'circle-stroke-opacity-transition': { duration: reduceMotion ? 0 : FADE_MS, delay: 0 }
    }
  });
}

function fadeTo(id) {
  if (activeLayer === id) return;
  pointLayers.forEach(function (l) {
    var v = l === id ? POINT_OPACITY : 0;
    map.setPaintProperty(l, 'circle-opacity', v);
    map.setPaintProperty(l, 'circle-stroke-opacity', v);
  });
  activeLayer = id;
}
// Wait until the points have been rebuilt after a filter change (max 600ms).
function whenRebuilt(cb) {
  var start = performance.now(), frames = 0;
  (function check() {
    frames++;
    if ((frames > 2 && map.isSourceLoaded('nc')) || performance.now() - start > 600) return cb();
    requestAnimationFrame(check);
  })();
}
function applyFilter(ch, s) {
  if (ch.dots === false) return fadeTo(null); // slide with no building dots
  if (!ch.explore) return fadeTo(layerIdFor(ch));
  var key = JSON.stringify(toMapboxFilter(s));
  if (key === exploreFilterKey) return fadeTo(exploreSlots[exploreSlot]);
  exploreFilterKey = key;
  exploreSlot = 1 - exploreSlot;
  var id = exploreSlots[exploreSlot], token = ++exploreToken;
  map.setFilter(id, toMapboxFilter(s));
  whenRebuilt(function () { if (token === exploreToken && current === ch) fadeTo(id); });
}


// ---------------------------------------------------------------------
// 10. Switching chapters
// ---------------------------------------------------------------------

// Draw a chapter: points, focus ring, legend, chart; optionally fly there.
function render(ch, moveCamera) {
  var s = filterSpec(ch);
  if (ch.focus) map.setFilter('focus-ring', ['==', ['get', 'address'], ch.focus]);
  map.setPaintProperty('focus-ring', 'circle-stroke-opacity', ch.focus ? 0.9 : 0);
  applyFilter(ch, s);
  updateLegend(s);
  document.body.classList.toggle('feature-on', !!ch.featureChart);
  document.body.classList.toggle('no-chart', !ch.featureChart && !ch.chart && !ch.explore);
  if (ch.featureChart) updateFeatureChart(ch.featureChart);
  else if (ch.chart || ch.explore) updateChart(ch, s);
  if (moveCamera) {
    var loc = Object.assign({}, ch.location);
    // Phones: the open map area is small, so zoom out a little to fit the
    // same view (e.g. the whole city).
    if (isPhone()) loc.zoom = ch.location.zoom - 0.8;
    map.flyTo(Object.assign({ duration: 2200, essential: true }, loc, focusCamera(ch)));
  }
}

// Focus slides: put the building halfway between the right edge of the
// text box and the left edge of the chart panel (whether or not the slide
// shows a chart). Other slides use their config location as is.
// The top padding always keeps the camera clear of the header.
var focusPoints = {}; // address -> [lng, lat], filled when the data loads
function focusCamera(ch) {
  var none = { padding: { top: headerHeight(), bottom: sheetHeight(), left: 0, right: 0 } };
  if (isPhone()) {
    // Phones: center the focus building in the open area above the sheet.
    if (ch.focus && focusPoints[ch.focus]) none.center = focusPoints[ch.focus];
    return none;
  }
  if (!ch.focus) return none;
  var box = document.getElementById(ch.id).getBoundingClientRect();
  var left = Math.max(0, box.right);
  var right = 396; // chart panel: 380px wide + 16px from the screen edge
  if (left + right > window.innerWidth - 200) return none; // too little room left
  var cam = { padding: { top: headerHeight(), bottom: 0, left: left, right: right } };
  if (focusPoints[ch.focus]) cam.center = focusPoints[ch.focus];
  return cam;
}

function activate(ch) {
  if (current === ch) return;
  if (skipping && !ch.explore) return; // passing through on the way down
  skipping = false;
  current = ch;
  metricOverride = null;
  document.querySelectorAll('.step').forEach(function (el) { el.classList.toggle('active', el.id === ch.id); });
  setZoomLock(true);
  setDistricts(!!ch.districts); // each slide starts with its own setting
  zoningOn = !!ch.zoning; // set before render so the chart picks it up
  render(ch, true);
  setZoning(zoningOn);
}


// ---------------------------------------------------------------------
// 11. Popups and click-to-zoom
// ---------------------------------------------------------------------

// Scroll-wheel zoom stays off so reaching the end of the story doesn't
// suddenly start zooming the map. In the explorer a hint asks the reader
// to click the map first; that click turns scroll zoom on.
var zoomHint = document.createElement('div');
zoomHint.id = 'zoom-hint';
zoomHint.textContent = 'Click the map to zoom with scroll';
document.body.appendChild(zoomHint);
function setZoomLock(locked) {
  map.scrollZoom[locked ? 'disable' : 'enable']();
  zoomHint.classList.toggle('show', locked && !!current && !!current.explore);
}

// Click a point: address, tax incentive, units, permit year.
function addPopups() {
  map.on('click', function (e) {
    if (current && current.explore) setZoomLock(false);
    var hit = activeLayer && map.queryRenderedFeatures(e.point, { layers: [activeLayer] })[0];
    if (!hit) return districtPopup(e);
    var p = hit.properties;
    var program = p.prog === 'Other' ? p.afford_program : LABELS[p.prog];
    var html = '<b>' + (p.address || '') + '</b><br>' +
      '<span style="color:' + COLORS[p.prog] + '">●</span> ' + program + '<br>' +
      fmt.format(p.classanet) + (p.classanet === 1 ? ' unit' : ' units') + '<br>' +
      'Permitted in ' + groupKey(p, 'permityear');
    new mapboxgl.Popup({ closeButton: true, maxWidth: '260px' }).setLngLat(hit.geometry.coordinates).setHTML(html).addTo(map);
  });
  map.on('mousemove', function (e) {
    var hit = activeLayer && map.queryRenderedFeatures(e.point, { layers: [activeLayer] }).length;
    map.getCanvas().style.cursor = hit ? 'pointer' : '';
  });
}
// Click a shaded district (not on a point): its name and total new units.
function districtPopup(e) {
  if (zoningOn && !districtsOn) {
    var z = map.queryRenderedFeatures(e.point, { layers: ['zoning-fill'] })[0];
    if (z) new mapboxgl.Popup({ closeButton: true, maxWidth: '260px' }).setLngLat(e.lngLat)
      .setHTML('<b>' + z.properties.z + ' zoning district</b>').addTo(map);
    return;
  }
  if (!districtsOn) return;
  var d = map.queryRenderedFeatures(e.point, { layers: ['districts-fill'] })[0];
  if (!d || d.properties.units == null) return;
  new mapboxgl.Popup({ closeButton: true, maxWidth: '260px' }).setLngLat(e.lngLat)
    .setHTML('<b>' + d.properties.name + '</b><br>' + fmt.format(d.properties.units) + ' new units')
    .addTo(map);
}


// ---------------------------------------------------------------------
// 12. Startup: load data, add layers, watch scrolling
// ---------------------------------------------------------------------

Chart.defaults.color = INK.axis;
Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;

buildStory();
wireHeader();
wireCompare();
wireOverlay();
buildLegend();
wireExplore();

// Phones: a "Chart" button shows or hides the chart (hidden by default so
// it doesn't cover the map). Hidden on desktop by style.css.
var chartBtn = document.createElement('button');
chartBtn.id = 'chart-btn';
chartBtn.type = 'button';
chartBtn.textContent = 'Show chart';
chartBtn.setAttribute('aria-pressed', 'false');
chartBtn.addEventListener('click', function () {
  var open = document.body.classList.toggle('chart-open');
  chartBtn.textContent = open ? 'Hide chart' : 'Show chart';
  chartBtn.setAttribute('aria-pressed', String(open));
});
document.body.appendChild(chartBtn);
// Hide the button while the title screen is showing.
function updateOnHero() {
  var hero = document.getElementById('hero');
  document.body.classList.toggle('on-hero', !!hero && hero.getBoundingClientRect().bottom > window.innerHeight * 0.5);
}
window.addEventListener('scroll', function () { requestAnimationFrame(updateOnHero); }, { passive: true });
updateOnHero();

document.querySelectorAll('#metric-toggle button').forEach(function (b) {
  b.addEventListener('click', function () { metricOverride = b.dataset.metric; if (current) render(current, false); });
});

var dataReady = fetch(config.dataUrl).then(function (r) {
  if (!r.ok) throw new Error('Could not load ' + config.dataUrl + ' (' + r.status + ')');
  return r.json();
});
var mapReady = new Promise(function (res) { map.on('load', res); });
// Community districts are optional: if the file is missing, skip the layer.
var districtsReady = config.districtsUrl ? fetch(config.districtsUrl)
  .then(function (r) { return r.ok ? r.json() : null; })
  .catch(function () { return null; }) : Promise.resolve(null);

Promise.all([dataReady, mapReady, districtsReady]).then(function (out) {
  var geo = out[0];

  // Add helper fields to each building: program group, units as a number,
  // permit year as a number, and size group.
  geo.features.forEach(function (f) {
    var p = f.properties;
    p.prog = programGroup(p.afford_program);
    p.color = COLORS[p.prog]; // dot color, straight from COLORS
    if (f.geometry) focusPoints[p.address] = f.geometry.coordinates; // for focus slides
    p.classanet = +p.classanet || 0;
    p.year = parseInt(p.permityear, 10) || null;
    var sg = SIZE_GROUPS.find(function (g) { return p.classanet >= g.min && (g.max == null || p.classanet <= g.max); });
    p.size_group = sg ? sg.label : null; // null for 0-unit buildings
  });
  allFeatures = geo.features.map(function (f) { return f.properties; });

  // Permit year slider spans the years in the data (every other year labeled).
  var yrs = allFeatures.map(function (p) { return p.year; }).filter(Boolean);
  YEARS.min = Math.min.apply(null, yrs); YEARS.max = Math.max.apply(null, yrs);
  exploreState.yearLo = YEARS.min; exploreState.yearHi = YEARS.max;
  if (document.getElementById('year-range')) {
    var yearTicks = [];
    for (var y = YEARS.min; y <= YEARS.max; y++) {
      yearTicks.push({ value: y, label: (y - YEARS.min) % 2 === 0 || y === YEARS.max ? String(y) : '' });
    }
    wireRange('year-range', {
      min: YEARS.min, max: YEARS.max, lo: YEARS.min, hi: YEARS.max, ticks: yearTicks,
      format: function (lo, hi) { return lo === hi ? String(lo) : lo + '–' + hi; },
      onChange: function (lo, hi) { exploreState.yearLo = lo; exploreState.yearHi = hi; refreshExplore(120); }
    });
  }

  // Map layers, bottom to top: community districts, subway, one point
  // layer per story chapter, two for the explorer, and the focus ring.
  addDistricts(out[2]);
  addZoning();
  addSubway();
  map.addSource('nc', { type: 'geojson', data: geo });
  config.chapters.forEach(function (ch) {
    if (!ch.explore) addPointLayer(layerIdFor(ch), toMapboxFilter(ch.filter || {}));
  });
  var exploreCh = config.chapters.find(function (c) { return c.explore; });
  if (exploreCh) {
    var f0 = toMapboxFilter(filterSpec(exploreCh));
    exploreFilterKey = JSON.stringify(f0);
    exploreSlots.forEach(function (id) { addPointLayer(id, f0); });
  }
  addFocusRing();
  addPopups();

  // A chapter starts when its box crosses the middle of the screen
  // (phones: a line 85% down, since the boxes rest at the bottom).
  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) activate(config.chapters.find(function (c) { return c.id === e.target.id; }));
    });
  }, { rootMargin: isPhone() ? '-85% 0px -15% 0px' : '-50% 0px -50% 0px' });
  document.querySelectorAll('.step').forEach(function (el) { observer.observe(el); });
  activate(config.chapters[0]);
}).catch(function (err) {
  console.error(err);
  document.getElementById('chart-stats').textContent = 'Error: ' + err.message +
    '. If you opened index.html by double-clicking, run a local server instead (see README).';
});
