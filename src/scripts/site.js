/* site.js - BUZZY "DREAM INVENTORY" behaviour (FOUNDATION): 21+ gate, header state, dropdown panels (hover intent with
   a gap bridge and a close delay, click, keyboard, Escape), drawer below 1024px, reveals (+ wipe, 2.5 s fail-safe),
   depth parallax, float, tilt, cursor light, marquee, rotator (real prev, next and dot buttons), tabs, chip filters,
   video toggle + start after load + pause off screen, demo forms, footer light (runs only on screen), back to top.
   No dependencies, defer-safe. Contract D6: no quoted string literal here starts with a slash; URLs come from HTML
   attributes. Every motion hook is off under prefers-reduced-motion. */
(function () {
  'use strict';
  var doc = document;
  var root = doc.documentElement;
  var mq = function (q) { return window.matchMedia ? window.matchMedia(q) : { matches: false }; };
  var reduce = mq('(prefers-reduced-motion: reduce)').matches;
  var finePointer = mq('(hover: hover) and (pointer: fine)').matches;
  var coarse = mq('(hover: none), (pointer: coarse)').matches;
  var desktopMq = mq('(min-width: 1024px)');
  var $$ = function (sel, el) { return Array.prototype.slice.call((el || doc).querySelectorAll(sel)); };
  var $ = function (sel, el) { return (el || doc).querySelector(sel); };
  var hasIO = 'IntersectionObserver' in window;
  var onMq = function (m, fn) { if (m.addEventListener) m.addEventListener('change', fn); else if (m.addListener) m.addListener(fn); };
  var vh = function () { return window.innerHeight || root.clientHeight; };
  var onScreen = function (els, fn, opts) {
    if (!hasIO) { els.forEach(function (el) { fn(el, true); }); return; }
    var io = new IntersectionObserver(function (en) { en.forEach(function (x) { fn(x.target, x.isIntersecting); }); }, opts || {});
    els.forEach(function (el) { io.observe(el); });
  };
  root.classList.add('js');

  var focusables = function (el) {
    return $$('a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])', el).filter(function (x) {
      return !x.hidden && x.offsetParent !== null;
    });
  };
  var loop = function (box, e) {
    var f = focusables(box);
    if (!f.length) return;
    var a = f[0], z = f[f.length - 1];
    if (e.shiftKey && (doc.activeElement === a || !box.contains(doc.activeElement))) { e.preventDefault(); z.focus(); }
    else if (!e.shiftKey && (doc.activeElement === z || !box.contains(doc.activeElement))) { e.preventDefault(); a.focus(); }
  };
  // after the 21+ gate closes or Back to top: move focus to <main> (no visible element; tabindex removed on blur)
  var focusMain = function () {
    var m = doc.getElementById('main');
    if (!m) return;
    m.setAttribute('tabindex', '-1');
    m.focus({ preventScroll: true });
    m.addEventListener('blur', function () { m.removeAttribute('tabindex'); }, { once: true });
  };

  /* ---------------- 21+ gate (D7): localStorage buzzy-age-ok = 1; hidden in the HTML, so it never blocks without JS */
  var gate = $('[data-age-gate]');
  if (gate) {
    var KEY = gate.getAttribute('data-age-key') || 'buzzy-age-ok';
    var ok = false;
    try { ok = window.localStorage.getItem(KEY) === '1'; } catch (err) { ok = false; }
    if (!ok) {
      var site = $('.site');
      var yes = $('[data-age-yes]', gate);
      var no = $('[data-age-no]', gate);
      var refusal = $('[data-age-refusal]', gate);
      gate.hidden = false;
      root.classList.add('gate-open');
      if (site && 'inert' in site) site.inert = true;
      setTimeout(function () { if (yes) yes.focus(); }, 40);
      if (yes) yes.addEventListener('click', function () {
        try { window.localStorage.setItem(KEY, '1'); } catch (err) { /* private mode: the gate just closes */ }
        gate.hidden = true;
        root.classList.remove('gate-open');
        if (site && 'inert' in site) site.inert = false;
        focusMain();
      });
      if (no) no.addEventListener('click', function () { if (refusal) refusal.hidden = false; });
      gate.addEventListener('keydown', function (e) { if (e.key === 'Tab') loop(gate, e); });
      doc.addEventListener('focusin', function (e) { if (!gate.hidden && !gate.contains(e.target) && yes) yes.focus(); });
    }
  }

  /* ---------------- header: scrolled state + back to top ---------------- */
  var header = $('[data-header]');
  var tick = false;
  function onScroll() {
    tick = false;
    var y = window.scrollY || window.pageYOffset || 0;
    if (header) header.classList.toggle('is-scrolled', y > 8);
  }
  onScroll();
  window.addEventListener('scroll', function () { if (!tick) { tick = true; window.requestAnimationFrame(onScroll); } }, { passive: true });
  $$('[data-to-top]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
      focusMain();
    });
  });

  /* ---------------- dropdown panels ([data-dropdown]): hover intent, click, keyboard, Escape ---------------- */
  var items = $$('[data-dropdown]');
  var openItem = null;
  var openTimer = 0;
  var closeTimer = 0;
  function trig(item) { return $('[data-dropdown-trigger]', item); }
  function setOpen(item, open) {
    var btn = trig(item);
    item.classList.toggle('is-open', open);
    if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) {
      if (openItem && openItem !== item) setOpen(openItem, false);
      openItem = item;
    } else if (openItem === item) {
      openItem = null;
    }
    if (header) header.classList.toggle('has-open-panel', !!openItem && desktopMq.matches);
  }
  function closeAll() { items.forEach(function (m) { if (m.classList.contains('is-open')) setOpen(m, false); }); }
  items.forEach(function (item) {
    var btn = trig(item);
    if (!btn) return;
    btn.addEventListener('click', function () {
      clearTimeout(openTimer); clearTimeout(closeTimer);
      setOpen(item, !item.classList.contains('is-open'));
    });
    btn.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowDown') return;
      e.preventDefault();
      setOpen(item, true);
      var panel = $('[data-dropdown-panel]', item);
      var f = panel ? focusables(panel) : [];
      if (f.length) f[0].focus();
    });
    item.addEventListener('pointerenter', function (e) {
      if (e.pointerType !== 'mouse' || !desktopMq.matches) return;
      clearTimeout(closeTimer); clearTimeout(openTimer);
      /* intent: a short delay on the first open, none when moving between open panels */
      openTimer = setTimeout(function () { setOpen(item, true); }, openItem ? 0 : 120);
    });
    item.addEventListener('pointerleave', function (e) {
      if (e.pointerType !== 'mouse' || !desktopMq.matches) return;
      clearTimeout(openTimer);
      closeTimer = setTimeout(function () { if (openItem === item) setOpen(item, false); }, 300);
    });
    item.addEventListener('focusout', function (e) {
      if (!desktopMq.matches) return;
      if (e.relatedTarget && item.contains(e.relatedTarget)) return;
      setTimeout(function () { if (!item.contains(doc.activeElement) && item.classList.contains('is-open')) setOpen(item, false); }, 0);
    });
  });
  doc.addEventListener('click', function (e) {
    if (!openItem || openItem.contains(e.target)) return;
    if (desktopMq.matches) closeAll();
  });

  /* ---------------- drawer (below 1024px), with a focus loop while open ---------------- */
  var nav = $('[data-nav]');
  var toggle = $('[data-nav-toggle]');
  var scrim = $('[data-nav-scrim]');
  var closeBtn = $('[data-nav-close]');
  function setDrawer(open, returnFocus) {
    if (!nav || !toggle) return;
    root.classList.toggle('nav-open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (scrim) scrim.hidden = !open;
    if (open) {
      setTimeout(function () { var f = closeBtn || focusables(nav)[0]; if (f) f.focus(); }, 60);
    } else {
      closeAll();
      if (returnFocus) toggle.focus();
    }
  }
  if (toggle) toggle.addEventListener('click', function () { setDrawer(!root.classList.contains('nav-open')); });
  if (closeBtn) closeBtn.addEventListener('click', function () { setDrawer(false, true); });
  if (scrim) scrim.addEventListener('click', function () { setDrawer(false, true); });
  if (nav) {
    nav.addEventListener('keydown', function (e) { if (e.key === 'Tab' && root.classList.contains('nav-open')) loop(nav, e); });
    nav.addEventListener('click', function (e) {
      var a = e.target.closest ? e.target.closest('a[href]') : null;
      if (a && root.classList.contains('nav-open')) setDrawer(false);
    });
  }
  onMq(desktopMq, function () {
    var active = doc.activeElement;
    setDrawer(false);
    closeAll();
    if (active && active !== doc.body && active.offsetParent === null) {
      var t = desktopMq.matches ? $('.mainbar .logo') : toggle;
      if (t) t.focus();
    }
  });

  /* Escape: close the open panel (focus back on its trigger) or the drawer */
  doc.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape' && e.key !== 'Esc') return;
    if (gate && !gate.hidden) return;
    if (openItem) {
      var btn = trig(openItem);
      setOpen(openItem, false);
      if (btn && btn.offsetParent !== null) btn.focus();
      return;
    }
    if (root.classList.contains('nav-open')) setDrawer(false, true);
  });

  /* ---------------- reveals ([data-reveal], [data-reveal="wipe"]) + fail-safe at 2.5 s ---------------- */
  var reveals = $$('[data-reveal]');
  var ioAlive = false;
  if (reduce || !hasIO) {
    reveals.forEach(function (el) { el.classList.add('is-in'); });
    root.classList.add('reveal-all');
  } else if (reveals.length) {
    var ioReveal = new IntersectionObserver(function (entries) {
      ioAlive = true;
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('is-in'); ioReveal.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.08 });
    reveals.forEach(function (el) { ioReveal.observe(el); });
    var mark = function (el) { el.classList.add('is-in'); ioReveal.unobserve(el); };
    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () {
        reveals.forEach(function (el) { var r = el.getBoundingClientRect(); if ((r.width || r.height) && r.bottom > 0 && r.top < vh()) mark(el); });
      });
    });
    setTimeout(function () {
      root.classList.add('reveal-all');
      reveals.forEach(function (el) { var r = el.getBoundingClientRect(); if (!ioAlive || r.top < vh()) mark(el); });
    }, 2500);
  }

  /* ---------------- parallax ([data-depth="0.15"]: rAF, the translate property only, while on screen) ---------------- */
  var depthEls = (reduce || coarse) ? [] : $$('[data-depth]');
  if (depthEls.length) {
    var ticking = false;
    var vis = [];
    var update = function () {
      ticking = false;
      var h = vh();
      vis.forEach(function (el) {
        var d = parseFloat(el.getAttribute('data-depth')) || 0;
        var r = el.getBoundingClientRect();
        var y = Math.max(-120, Math.min(120, -(r.top + r.height / 2 - h / 2) * d));
        el.style.setProperty('--py', y.toFixed(1) + 'px');
      });
    };
    var queue = function () { if (!ticking) { ticking = true; window.requestAnimationFrame(update); } };
    if (hasIO) {
      var ioDepth = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          var i = vis.indexOf(en.target);
          if (en.isIntersecting && i < 0) { vis.push(en.target); en.target.classList.add('is-moving'); }
          if (!en.isIntersecting && i >= 0) { vis.splice(i, 1); en.target.classList.remove('is-moving'); }
        });
        queue();
      }, { rootMargin: '20% 0px 20% 0px' });
      depthEls.forEach(function (el) { ioDepth.observe(el); });
    } else { vis = depthEls.slice(); }
    window.addEventListener('scroll', queue, { passive: true });
    window.addEventListener('resize', queue, { passive: true });
    queue();
  }

  /* ---------------- [data-float]: the levitation only runs while on screen ---------------- */
  if (!reduce) onScreen($$('[data-float]'), function (el, on) { el.classList.toggle('is-still', !on); }, { rootMargin: '10% 0px 10% 0px' });

  /* ---------------- [data-tilt="6"]: pointer tilt on fine pointers (--rx / --ry) ---------------- */
  if (!reduce && finePointer) {
    $$('[data-tilt]').forEach(function (el) {
      var max = parseFloat(el.getAttribute('data-tilt')) || 6;
      var raf = 0, px = 0, py = 0;
      var paint = function () {
        raf = 0;
        el.style.setProperty('--ry', (px * max * 2).toFixed(2) + 'deg');
        el.style.setProperty('--rx', (-py * max * 2).toFixed(2) + 'deg');
      };
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        if (!r.width || !r.height) return;
        px = (e.clientX - r.left) / r.width - 0.5;
        py = (e.clientY - r.top) / r.height - 0.5;
        el.classList.add('is-tilting');
        if (!raf) raf = window.requestAnimationFrame(paint);
      });
      el.addEventListener('pointerleave', function () {
        el.classList.remove('is-tilting');
        el.style.setProperty('--rx', '0deg');
        el.style.setProperty('--ry', '0deg');
      });
    });
  }

  /* ---------------- [data-spot]: a soft light follows the cursor (an injected .spot layer, --sx / --sy in %) ---------------- */
  if (!reduce && finePointer) {
    $$('[data-spot]').forEach(function (el) {
      var layer = doc.createElement('span');
      layer.className = 'spot';
      layer.setAttribute('aria-hidden', 'true');
      if (window.getComputedStyle(el).position === 'static') el.style.position = 'relative';
      el.insertBefore(layer, el.firstChild);
      var raf = 0, sx = 0, sy = 0;
      var paint = function () { raf = 0; layer.style.setProperty('--sx', sx.toFixed(1) + '%'); layer.style.setProperty('--sy', sy.toFixed(1) + '%'); };
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        if (!r.width || !r.height) return;
        sx = Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100));
        sy = Math.max(0, Math.min(100, ((e.clientY - r.top) / r.height) * 100));
        el.classList.add('is-spotting');
        if (!raf) raf = window.requestAnimationFrame(paint);
      });
      el.addEventListener('pointerleave', function () { el.classList.remove('is-spotting'); });
    });
  }

  /* ---------------- [data-marquee]: two copies in a track; pause on hover, focus, off screen ---------------- */
  $$('[data-marquee]').forEach(function (m) {
    if (m.classList.contains('is-marquee') || reduce) return;
    m.classList.add('marquee');
    var track = $('.marquee__track', m);
    if (!track) {
      track = doc.createElement('div');
      track.className = 'marquee__track';
      while (m.firstChild) track.appendChild(m.firstChild);
      m.appendChild(track);
    }
    var group = doc.createElement('div');
    group.className = 'marquee__group';
    while (track.firstChild) group.appendChild(track.firstChild);
    track.appendChild(group);
    /* repeat short content so one group is at least the box wide (a seamless -50% loop) */
    var guard = 0;
    while (group.scrollWidth && group.scrollWidth < m.clientWidth && guard++ < 6) {
      Array.prototype.slice.call(group.children).forEach(function (c) { var k = c.cloneNode(true); k.setAttribute('aria-hidden', 'true'); group.appendChild(k); });
    }
    var copy = group.cloneNode(true);
    copy.setAttribute('aria-hidden', 'true');
    $$('a, button, input, select, textarea, [tabindex]', copy).forEach(function (x) { x.setAttribute('tabindex', '-1'); });
    $$('[id]', copy).forEach(function (x) { x.removeAttribute('id'); });
    track.appendChild(copy);
    m.classList.add('is-marquee');
    if (hasIO) new IntersectionObserver(function (en) { en.forEach(function (x) { m.classList.toggle('is-paused', !x.isIntersecting); }); }).observe(m);
  });

  /* ---------------- footer wordmark light: runs only while on screen ---------------- */
  $$('[data-footer-light]').forEach(function (fm) {
    if (!hasIO) return;
    fm.classList.add('is-paused');
    new IntersectionObserver(function (en) { en.forEach(function (x) { fm.classList.toggle('is-paused', !x.isIntersecting); }); }).observe(fm);
  });

  /* ---------------- [data-rotator="5000"]: [data-slide] children rotate; prev, next and dots are real buttons
     ([data-rotator-prev] [data-rotator-next] [data-rotator-dots] inside the rotator, created when absent) ---------- */
  var mkIcon = function () { return '<svg class="icon" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg>'; };
  $$('[data-rotator]').forEach(function (rot, rIndex) {
    var slides = $$('[data-slide]', rot);
    if (slides.length < 2) return;
    var stage = slides[0].parentNode;
    stage.classList.add('rotator__stage');
    var label = rot.getAttribute('data-rotator-label') || rot.getAttribute('aria-label') || 'slide';
    var delay = parseInt(rot.getAttribute('data-rotator'), 10) || 5000;
    var prev = $('[data-rotator-prev]', rot);
    var next = $('[data-rotator-next]', rot);
    var dotsBox = $('[data-rotator-dots]', rot);
    if (!prev || !next || !dotsBox) {
      var bar = doc.createElement('div');
      bar.className = 'rotator__controls';
      if (!prev) { prev = doc.createElement('button'); prev.className = 'rotator__btn rotator__btn--prev'; prev.innerHTML = mkIcon() + '<span class="sr-only">Previous</span>'; bar.appendChild(prev); }
      if (!dotsBox) { dotsBox = doc.createElement('div'); bar.appendChild(dotsBox); }
      if (!next) { next = doc.createElement('button'); next.className = 'rotator__btn rotator__btn--next'; next.innerHTML = mkIcon() + '<span class="sr-only">Next</span>'; bar.appendChild(next); }
      rot.appendChild(bar);
    }
    [prev, next].forEach(function (b) { if (b.tagName === 'BUTTON' && !b.getAttribute('type')) b.setAttribute('type', 'button'); });
    dotsBox.classList.add('rotator__dots');
    var cur = 0, timer = 0, paused = false, offscreen = false, dots = [];
    slides.forEach(function (s, i) { if (!s.id) s.id = 'rot' + rIndex + '-s' + i; });
    slides.forEach(function (s, i) {
      var b = doc.createElement('button');
      b.type = 'button';
      b.className = 'rotator__dot';
      b.setAttribute('aria-controls', s.id);
      b.setAttribute('aria-label', 'Show ' + label + ' ' + (i + 1) + ' of ' + slides.length);
      b.addEventListener('click', function () { show(i); restart(); });
      dotsBox.appendChild(b);
      dots.push(b);
    });
    function show(i) {
      var n = slides.length;
      cur = ((i % n) + n) % n;
      slides.forEach(function (s, k) {
        var on = k === cur;
        s.classList.toggle('is-active', on);
        s.setAttribute('aria-hidden', on ? 'false' : 'true');
        if ('inert' in s) s.inert = !on;
      });
      dots.forEach(function (d, k) { d.setAttribute('aria-current', k === cur ? 'true' : 'false'); });
    }
    function restart() {
      clearInterval(timer);
      if (reduce || paused || offscreen) return;
      timer = setInterval(function () { if (!doc.hidden) show(cur + 1); }, delay);
    }
    prev.addEventListener('click', function () { show(cur - 1); restart(); });
    next.addEventListener('click', function () { show(cur + 1); restart(); });
    rot.addEventListener('pointerenter', function () { paused = true; clearInterval(timer); });
    rot.addEventListener('pointerleave', function () { if (!rot.contains(doc.activeElement)) { paused = false; restart(); } });
    rot.addEventListener('focusin', function () { paused = true; clearInterval(timer); });
    rot.addEventListener('focusout', function (e) { if (!e.relatedTarget || !rot.contains(e.relatedTarget)) { paused = false; restart(); } });
    if (hasIO) new IntersectionObserver(function (en) { en.forEach(function (x) { offscreen = !x.isIntersecting; if (offscreen) clearInterval(timer); else restart(); }); }).observe(rot);
    rot.classList.add('is-rotator');
    show(0);
    restart();
  });

  /* ---------------- [data-tabs]: [role=tab] buttons (aria-controls) + [role=tabpanel]; arrows, Home, End ---------------- */
  $$('[data-tabs]').forEach(function (box) {
    var tabs = $$('[role="tab"]', box);
    if (!tabs.length) return;
    var panelOf = function (t) { var id = t.getAttribute('aria-controls'); return id ? doc.getElementById(id) : null; };
    function select(t, focus) {
      tabs.forEach(function (x) {
        var on = x === t;
        x.setAttribute('aria-selected', on ? 'true' : 'false');
        x.setAttribute('tabindex', on ? '0' : '-1');
        var p = panelOf(x);
        if (p) p.hidden = !on;
      });
      if (focus) t.focus();
    }
    tabs.forEach(function (t, i) {
      if (t.tagName === 'BUTTON' && !t.getAttribute('type')) t.setAttribute('type', 'button');
      t.addEventListener('click', function () { select(t, false); });
      t.addEventListener('keydown', function (e) {
        var k = e.key, n = tabs.length, j = -1;
        if (k === 'ArrowRight' || k === 'ArrowDown') j = (i + 1) % n;
        else if (k === 'ArrowLeft' || k === 'ArrowUp') j = (i - 1 + n) % n;
        else if (k === 'Home') j = 0;
        else if (k === 'End') j = n - 1;
        if (j < 0) return;
        e.preventDefault();
        select(tabs[j], true);
      });
    });
    select(tabs.filter(function (t) { return t.getAttribute('aria-selected') === 'true'; })[0] || tabs[0], false);
  });

  /* ---------------- [data-filter-group]: chip filters over [data-filter-item][data-tags] ----------------
     Scope = the closest [data-filter-scope] (else the document). Chips are buttons with data-filter="<tag>" (or "all");
     multi-select within a group (OR), groups combine with AND. [data-filter-count] shows the number of matches,
     [data-filter-empty] shows when none match, [data-more] reveals the next data-limit items. */
  var scopes = [];
  $$('[data-filter-group], [data-more]').forEach(function (g) {
    var scope = (g.closest && g.closest('[data-filter-scope]')) || doc.body;
    if (scopes.indexOf(scope) < 0) scopes.push(scope);
  });
  scopes.forEach(function (scope) {
    var groups = $$('[data-filter-group]', scope);
    var itemsF = $$('[data-filter-item]', scope);
    var more = $('[data-more]', scope);
    var countEl = $$('[data-filter-count]', scope);
    var empty = $('[data-filter-empty]', scope);
    var limit = parseInt(scope.getAttribute('data-limit') || (more && more.getAttribute('data-limit')) || '0', 10) || 0;
    var shown = limit;
    var sel = groups.map(function () { return []; });
    var tagsOf = function (el) { return (el.getAttribute('data-tags') || '').toLowerCase().split(/[\s,]+/).filter(Boolean); };
    function apply() {
      var match = itemsF.filter(function (el) {
        var tg = tagsOf(el);
        return sel.every(function (s) { return !s.length || s.some(function (v) { return tg.indexOf(v) >= 0; }); });
      });
      itemsF.forEach(function (el) { el.classList.toggle('is-filtered-out', match.indexOf(el) < 0); el.classList.remove('is-over'); });
      if (limit) match.forEach(function (el, i) { if (i >= shown) el.classList.add('is-over'); });
      countEl.forEach(function (c) {
        var n = match.length;
        c.textContent = n + ' ' + (n === 1 ? (c.getAttribute('data-one') || 'item') : (c.getAttribute('data-many') || 'items'));
      });
      if (empty) empty.hidden = match.length > 0;
      if (more) more.hidden = !limit || match.length <= shown;
    }
    groups.forEach(function (g, gi) {
      var chips = $$('[data-filter]', g);
      chips.forEach(function (c) {
        if (c.tagName === 'BUTTON' && !c.getAttribute('type')) c.setAttribute('type', 'button');
        if (!c.hasAttribute('aria-pressed')) c.setAttribute('aria-pressed', c.getAttribute('data-filter') === 'all' ? 'true' : 'false');
        c.addEventListener('click', function () {
          var v = (c.getAttribute('data-filter') || '').toLowerCase();
          if (v === 'all' || !v) sel[gi] = [];
          else { var i = sel[gi].indexOf(v); if (i >= 0) sel[gi].splice(i, 1); else sel[gi].push(v); }
          chips.forEach(function (x) {
            var xv = (x.getAttribute('data-filter') || '').toLowerCase();
            x.setAttribute('aria-pressed', (xv === 'all' ? !sel[gi].length : sel[gi].indexOf(xv) >= 0) ? 'true' : 'false');
          });
          shown = limit;
          apply();
        });
      });
    });
    if (more) more.addEventListener('click', function () { shown += limit || itemsF.length; apply(); });
    apply();
  });

  /* ---------------- videos: autoplay loops play only while on screen and never under reduced motion; a video marked
     data-after-load starts (and so downloads) only after window load; [data-video-toggle] pauses or plays the video named
     by aria-controls, else every video in its host (closest [data-video-host], .band or section). A host with a looping
     video and no toggle gets one (WCAG 2.2.2). */
  var allVids = $$('video[data-inview-play], video[autoplay], video[data-after-load]');
  var playV = function (v) { if (v.hasAttribute('data-user-paused')) return; var p = v.play && v.play(); if (p && p.catch) p.catch(function () {}); };
  if (reduce) {
    allVids.forEach(function (v) { v.removeAttribute('autoplay'); if (v.pause) v.pause(); });
  } else {
    var ioVid = hasIO ? new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) playV(en.target); else en.target.pause(); });
    }, { threshold: 0.15 }) : null;
    var startV = function (v) {
      /* a deferred source (data-src on the video or its <source>) is attached only now */
      $$('source[data-src]', v).forEach(function (s) { s.setAttribute('src', s.getAttribute('data-src')); s.removeAttribute('data-src'); });
      if (v.hasAttribute('data-src')) { v.setAttribute('src', v.getAttribute('data-src')); v.removeAttribute('data-src'); }
      if (v.load && v.hasAttribute('data-after-load')) v.load();
      v.muted = true;
      v.addEventListener('playing', function () { v.classList.add('is-playing'); });
      if (ioVid) ioVid.observe(v); else playV(v);
    };
    allVids.forEach(function (v) {
      v.muted = true;
      if (v.hasAttribute('data-after-load') && doc.readyState !== 'complete') window.addEventListener('load', function () { startV(v); });
      else startV(v);
    });
  }
  function hostOf(el) { return el.closest ? el.closest('[data-video-host], .band, section') : null; }
  function bindToggle(b, vids) {
    var label = $('.video-toggle__label', b);
    var tPause = b.getAttribute('data-label-pause') || 'Pause motion';
    var tPlay = b.getAttribute('data-label-play') || 'Play motion';
    if (b.tagName === 'BUTTON' && !b.getAttribute('type')) b.setAttribute('type', 'button');
    var set = function (paused) {
      b.setAttribute('aria-pressed', paused ? 'true' : 'false');
      if (label) label.textContent = paused ? tPlay : tPause;
      else b.setAttribute('aria-label', paused ? tPlay : tPause);
    };
    b.addEventListener('click', function () {
      var pausedNow = b.getAttribute('aria-pressed') !== 'true';
      vids.forEach(function (v) {
        if (pausedNow) { v.setAttribute('data-user-paused', ''); v.pause(); }
        else { v.removeAttribute('data-user-paused'); playV(v); }
      });
      set(pausedNow);
    });
    set(false);
  }
  $$('[data-video-toggle]').forEach(function (b) {
    var id = b.getAttribute('aria-controls');
    var v = id ? doc.getElementById(id) : null;
    var host = hostOf(b);
    var vids = v ? [v] : (host ? $$('video', host) : []);
    if (vids.length) bindToggle(b, vids);
    if (reduce) b.hidden = true;
  });
  if (!reduce) {
    var seen = [];
    $$('video[autoplay][loop], video[data-inview-play][loop], video[data-after-load][loop]').forEach(function (v) {
      var host = hostOf(v);
      if (!host || seen.indexOf(host) >= 0 || v.hasAttribute('data-no-toggle') || $('[data-video-toggle]', host)) return;
      seen.push(host);
      var b = doc.createElement('button');
      b.type = 'button';
      b.className = 'video-toggle';
      b.setAttribute('data-video-toggle', '');
      b.innerHTML = '<span class="video-toggle__ico" aria-hidden="true"></span><span class="video-toggle__label">Pause motion</span>';
      if (window.getComputedStyle(host).position === 'static') host.style.position = 'relative';
      host.appendChild(b);
      bindToggle(b, $$('video', host));
    });
  }

  /* ---------------- demo forms (D9): never post; show the form's one honest line ---------------- */
  $$('[data-demo-form]').forEach(function (f) {
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var note = $('[data-demo-note]', f);
      if (note) note.hidden = false;
    });
  });
})();
