/* Bridge — interactions du site (sans dépendance).
   Principes : tout est lisible sans JavaScript ; les animations ne se jouent
   qu'en mode « motion » (pas de prefers-reduced-motion) et une seule fois. */
(function () {
  'use strict';
  var d = document, html = d.documentElement;
  var motion = html.classList.contains('motion');
  var hoverable = window.matchMedia('(hover: hover)').matches;
  html.classList.add('ready');

  function $(s, c) { return (c || d).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || d).querySelectorAll(s)); }
  function clamp(v, a, b) { return Math.min(b === undefined ? 1 : b, Math.max(a === undefined ? 0 : a, v)); }
  function seq() { var ts = []; return { at: function (f, ms) { ts.push(setTimeout(f, ms)); }, stop: function () { ts.forEach(clearTimeout); ts = []; } }; }
  function restart(el, cls) { if (!el || !motion) return; el.classList.remove(cls); void el.getBoundingClientRect(); el.classList.add(cls); }
  function onVisible(el, fn, threshold) {
    if (!el) return;
    if (!('IntersectionObserver' in window)) { fn(); return; }
    var io = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { io.disconnect(); fn(); } }, { threshold: threshold || 0.3 });
    io.observe(el);
  }
  function svgEl(tag, attrs) { var e = d.createElementNS('http://www.w3.org/2000/svg', tag); for (var k in attrs) e.setAttribute(k, attrs[k]); return e; }
  var SLOW = 1.6; /* simulations ralenties : toutes les durées sont multipliées par ce facteur */
  var DATA = {};
  try { DATA = JSON.parse(($('#bridge-data') || {}).textContent || '{}'); } catch (e) { DATA = {}; }

  var y = $('#year'); if (y) y.textContent = new Date().getFullYear();

  /* ------------------------------------------------------------ Navigation */
  var nav = $('.nav'), ind = $('.nav-ind'), links = $$('.nav-links a[data-sec]');
  function moveInd(a) {
    if (!ind) return;
    if (!a) { ind.style.opacity = '0'; return; }
    ind.style.opacity = '1'; ind.style.width = (a.offsetWidth - 28) + 'px';
    ind.style.transform = 'translateX(' + (a.offsetLeft + 14) + 'px)';
  }
  if ('IntersectionObserver' in window && links.length) {
    var current = null;
    var secIO = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        var a = links.filter(function (l) { return l.dataset.sec === e.target.id; })[0];
        if (e.isIntersecting) current = a; else if (current === a) current = null;
      });
      links.forEach(function (l) { if (l === current) l.setAttribute('aria-current', 'true'); else l.removeAttribute('aria-current'); });
      moveInd(current);
    }, { rootMargin: '-45% 0px -50% 0px' });
    links.forEach(function (a) { var s = d.getElementById(a.dataset.sec); if (s) secIO.observe(s); });
    window.addEventListener('resize', function () { moveInd(current); });
  }
  var burger = $('#burger'), mnav = $('#mnav');
  function setMenu(open) {
    if (!burger || !mnav) return;
    mnav.hidden = !open; mnav.classList.toggle('open', open);
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    burger.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
    if (open) { var f = $('a', mnav); if (f) f.focus(); }
  }
  if (burger && mnav) {
    burger.addEventListener('click', function () { setMenu(mnav.hidden); });
    mnav.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
    d.addEventListener('keydown', function (e) {
      if (mnav.hidden) return;
      if (e.key === 'Escape') { setMenu(false); burger.focus(); }
      if (e.key === 'Tab') {
        var f = [burger].concat($$('a', mnav)), i = f.indexOf(d.activeElement);
        if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
      }
    });
    window.addEventListener('resize', function () { if (window.innerWidth > 900) setMenu(false); });
  }

  /* ------------------------------------------------------------ Apparitions */
  if (motion && 'IntersectionObserver' in window) {
    var rIO = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); rIO.unobserve(e.target); } }); }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    $$('.reveal').forEach(function (el) { rIO.observe(el); });
  } else $$('.reveal').forEach(function (el) { el.classList.add('in'); });

  /* ------------------------------------------------------------ Milo : regard, clin d'œil */
  $$('.milo-big').forEach(function (m) {
    m.addEventListener('animationend', function () { m.classList.remove('hop'); });
    $$('rect', m).forEach(function (r) { r.addEventListener('animationend', function () { m.classList.remove('blink'); }); });
  });
  function look(svg, tx, ty, max) {
    var g = svg && $('.eyes', svg); if (!g) return;
    var r = svg.getBoundingClientRect(), dx = tx - (r.left + r.width / 2), dy = ty - (r.top + r.height / 2);
    var dist = Math.sqrt(dx * dx + dy * dy) || 1, k = Math.min(dist / 260, 1) * (max || 6);
    g.style.transform = 'translate(' + (dx / dist * k).toFixed(2) + 'px,' + (dy / dist * k * 0.75).toFixed(2) + 'px)';
  }
  var dashMilo = null, dashBusy = false;
  if (motion && hoverable) {
    var px = 0, py = 0, tick = false;
    window.addEventListener('pointermove', function (e) {
      px = e.clientX; py = e.clientY; if (tick) return; tick = true;
      requestAnimationFrame(function () {
        tick = false;
        $$('[data-look] .milo-big, .t-core .milo-big, .milo-launch svg').forEach(function (svg) {
          if (svg === dashMilo && dashBusy) return;
          var r = svg.getBoundingClientRect(); if (r.bottom < 0 || r.top > window.innerHeight) return;
          look(svg, px, py, 6);
        });
      });
    }, { passive: true });
  }


  /* ------------------------------------------------------------ Bandeaux défilants : pause hors écran */
  $$('[data-marquee]').forEach(function (m) {
    if (!('IntersectionObserver' in window)) return;
    new IntersectionObserver(function (es) { m.classList.toggle('paused', !es[0].isIntersecting); }).observe(m);
  });


  /* ------------------------------------------------------------ Compteurs */
  $$('[data-count]').forEach(function (el) {
    var target = +el.dataset.count; if (!motion || !target) return;
    el.textContent = '0';
    onVisible(el, function () { var t0 = 0; requestAnimationFrame(function f(ts) { if (!t0) t0 = ts; var u = clamp((ts - t0) / 1100), e = 1 - Math.pow(1 - u, 3); el.textContent = Math.round(target * e); if (u < 1) requestAnimationFrame(f); }); }, 0.6);
  });

  /* ------------------------------------------------------------ Formulaire de contact */
  // Envoi par /api/contact. Si le service n'est pas configuré ou ne répond pas,
  // le message s'ouvre dans la messagerie du visiteur, comme avant : aucune demande n'est perdue.
  (function contact() {
    var f = $('#ct-form'); if (!f) return;
    var st = $('#ct-status'), F = { name: $('#ct-name'), mail: $('#ct-mail'), need: $('#ct-need'), msg: $('#ct-msg'), hp: $('#ct-site') };
    function err(el, msg) { var e = d.getElementById(el.id + '-e'); el.setAttribute('aria-invalid', msg ? 'true' : 'false'); if (msg) el.setAttribute('aria-describedby', el.id + '-e'); else el.removeAttribute('aria-describedby'); if (e) e.textContent = msg || ''; return !msg; }
    function check() {
      var ok = true, first = null;
      [[F.name, F.name.value.trim() ? '' : 'Indiquez votre prénom.'],
       [F.mail, /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(F.mail.value.trim()) ? '' : 'Indiquez une adresse e-mail valide.'],
       [F.need, F.need.value ? '' : 'Choisissez le besoin qui vous correspond le mieux.']].forEach(function (p) { if (!err(p[0], p[1])) { ok = false; first = first || p[0]; } });
      return { ok: ok, first: first };
    }
    [F.name, F.mail, F.need].forEach(function (el) { el.addEventListener('blur', function () { if (el.getAttribute('aria-invalid') === 'true') check(); }); });
    function say(text, ok) { st.classList.toggle('ok', !!ok); st.textContent = text; }
    function byMail(data) {
      var body = 'Prénom : ' + data.name + '\nEmail : ' + data.email + '\nBesoin : ' + data.need + '\n\n' + data.message;
      var url = 'mailto:contact@bridge-agency.eu?subject=' + encodeURIComponent('Demande depuis le site : ' + data.need) + '&body=' + encodeURIComponent(body);
      f.dataset.mailto = url;
      say('Votre messagerie s’ouvre avec le message prêt à envoyer. Si rien ne s’ouvre, écrivez-nous à contact@bridge-agency.eu.', true);
      window.location.href = url;
    }
    f.addEventListener('submit', function (e) {
      e.preventDefault(); var c = check();
      if (!c.ok) { c.first.focus(); say('Merci de compléter les champs indiqués.'); return; }
      if (f.classList.contains('busy')) return;
      var data = { name: F.name.value.trim(), email: F.mail.value.trim(), need: F.need.value, message: F.msg.value.trim(), website: F.hp ? F.hp.value : '' };
      if (!window.fetch) { byMail(data); return; }
      f.classList.add('busy'); say('Envoi en cours…');
      var ctrl = window.AbortController ? new AbortController() : null, t = setTimeout(function () { if (ctrl) ctrl.abort(); }, 9000);
      fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data), signal: ctrl ? ctrl.signal : undefined })
        .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
        .then(function (j) {
          if (!j || !j.ok) return Promise.reject(0);
          f.reset(); f.dataset.sent = '1';
          say('Message envoyé. Merci ' + data.name + ', nous vous répondons personnellement.', true);
        })
        .catch(function () { byMail(data); })
        .then(function () { clearTimeout(t); f.classList.remove('busy'); });
    });
  })();

  /* ------------------------------------------------------------ FAQ : afficher tout, ouverture fluide */
  (function faq() {
    var list = $('.faq-list'); if (!list) return;
    var all = $('#faq-all');
    if (all) all.addEventListener('click', function () {
      var open = all.getAttribute('aria-expanded') !== 'true';
      $$('details.more', list).forEach(function (it) { it.hidden = !open; if (!open) it.open = false; });
      all.setAttribute('aria-expanded', open ? 'true' : 'false');
      all.textContent = open ? 'Afficher moins de questions' : 'Afficher toutes les questions (' + $$('details', list).length + ')';
      if (open) { var f = $('details.more summary', list); if (f) f.focus(); }
    });
    $$('details', list).forEach(function (it) {
      var sum = $('summary', it), ans = $('.faq-a', it);
      sum.addEventListener('click', function (e) {
        if (!motion || !ans.animate) return;
        e.preventDefault(); if (it.dataset.busy) return; it.dataset.busy = '1';
        var opening = !it.open; if (opening) it.open = true;
        var h = ans.scrollHeight;
        var a = ans.animate(opening ? [{ height: '0px', opacity: 0 }, { height: h + 'px', opacity: 1 }] : [{ height: h + 'px', opacity: 1 }, { height: '0px', opacity: 0 }], { duration: 360, easing: 'cubic-bezier(.16,1,.3,1)' });
        a.onfinish = function () { if (!opening) it.open = false; delete it.dataset.busy; };
      });
    });
  })();


  /* ------------------------------------------------------------ Calculateur de ROI (version simple : trois curseurs, deux résultats) */
  (function roi() {
    var R = window.BridgeROI, box = $('.roi'); if (!R || !box) return;
    // seuls ces trois champs sont réglables ; la part automatisable reste à sa valeur par défaut (50 %)
    var F = ['people', 'hours', 'rate'], nums = {}, ranges = {};
    F.forEach(function (k) { nums[k] = $('#n-' + k); ranges[k] = $('#r-' + k); });
    var nf = function (n, dec) { return Number(n).toLocaleString('fr-FR', { maximumFractionDigits: dec || 0, minimumFractionDigits: dec || 0 }); };
    var eur = function (n) { return nf(Math.round(n)) + ' €'; };
    var q = R.fromQuery(location.search);
    var state = R.normalize({ people: q ? q.people : undefined, hours: q ? q.hours : undefined, rate: q ? q.rate : undefined });
    var disp = null, anim = 0;
    function paintInputs() {
      F.forEach(function (k) {
        var f = R.FIELDS[k], v = state[k];
        if (d.activeElement !== nums[k]) nums[k].value = v;
        ranges[k].value = v; ranges[k].style.setProperty('--p', ((v - f.min) / (f.max - f.min) * 100) + '%');
      });
    }
    function paint(v) { $('#k-h').textContent = nf(v.h) + ' h'; $('#k-v').textContent = eur(v.v); }
    function update() {
      paintInputs();
      var r = R.compute(state);
      $('#k-h2').textContent = 'soit environ ' + nf(r.days) + ' journées de 7 h';
      $('#k-v2').textContent = 'soit environ ' + eur(r.value / 12) + ' par mois';
      var target = { h: r.hours, v: r.value };
      cancelAnimationFrame(anim);
      if (!motion || !disp) { disp = target; paint(target); return; }
      var from = disp, t0 = 0;
      anim = requestAnimationFrame(function f(ts) {
        if (!t0) t0 = ts; var u = clamp((ts - t0) / 380), e = 1 - Math.pow(1 - u, 3);
        disp = { h: from.h + (target.h - from.h) * e, v: from.v + (target.v - from.v) * e };
        paint(disp); if (u < 1) anim = requestAnimationFrame(f);
      });
    }
    function setField(k, v) { state[k] = R.clampField(k, v); update(); }
    F.forEach(function (k) {
      ranges[k].addEventListener('input', function () { setField(k, ranges[k].value); });
      nums[k].addEventListener('input', function () {
        var raw = nums[k].value; if (raw === '' || !isFinite(Number(raw))) return;
        var f = R.FIELDS[k], v = Number(raw); if (v < f.min || v > f.max) return;
        setField(k, v);
      });
      nums[k].addEventListener('change', function () { setField(k, nums[k].value === '' ? R.FIELDS[k].def : nums[k].value); nums[k].value = state[k]; });
    });
    var ask = $('#roi-ask');
    if (ask) ask.addEventListener('click', function () {
      var p = state.people, h = state.hours;
      askMilo('Nous sommes ' + p + (p > 1 ? ' personnes' : ' personne') + ' et chacun passe environ ' + h + ' h par semaine sur des tâches répétitives. Par quoi commencer pour automatiser ?');
    });
    update();
  })();

  /* ------------------------------------------------------------ Barre de navigation au défilement */
  function onScroll() { if (nav) nav.classList.toggle('is-scrolled', window.scrollY > 8); }
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll();

  /* ------------------------------------------------------------ Milo : ouvrir et demander */
  function openMilo() { if (window.Milo) window.Milo.open(); }
  function askMilo(text) { if (window.Milo) window.Milo.ask(text); }
  $$('[data-open-milo]').forEach(function (b) { b.addEventListener('click', openMilo); });
  $$('[data-ask]').forEach(function (b) { b.addEventListener('click', function () { askMilo(b.dataset.ask); }); });

  /* ------------------------------------------------------------ Appel final */
  var ctaMilo = $('.cta-av .milo-big');
  onVisible($('.cta'), function () { restart(ctaMilo, 'hop'); setTimeout(function () { restart(ctaMilo, 'blink'); }, 700); }, 0.4);
  $$('[data-hop]').forEach(function (b) { b.addEventListener('mouseenter', function () { restart(ctaMilo, 'hop'); }); b.addEventListener('focus', function () { restart(ctaMilo, 'hop'); }); });

  /* ------------------------------------------------------------ Pas à pas des démonstrations */
  // Chaque élément [data-s="n"] apparaît à l'étape n ; [data-h="m"] disparaît à l'étape m.
  // Balayage au doigt : appelle fn(+1) vers la gauche (suivant), fn(-1) vers la droite (précédent).
  // Le défilement vertical reste libre (touch-action: pan-y côté CSS).
  function onSwipe(el, fn) {
    if (!el || !window.PointerEvent) return;
    var x0 = null, y0 = 0, t0 = 0;
    el.addEventListener('pointerdown', function (e) { if (e.pointerType === 'mouse') return; x0 = e.clientX; y0 = e.clientY; t0 = Date.now(); }, { passive: true });
    el.addEventListener('pointerup', function (e) {
      if (x0 === null) return;
      var dx = e.clientX - x0, dy = e.clientY - y0; x0 = null;
      if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.4 && Date.now() - t0 < 900) fn(dx < 0 ? 1 : -1);
    }, { passive: true });
    el.addEventListener('pointercancel', function () { x0 = null; });
  }
  // [data-on="k"] reçoit la classe on à partir de l'étape k ; onStep(n) est appelé après chaque étape.
  function stepper(root, onStep) {
    var els = $$('[data-s]', root), ons = $$('[data-on]', root), max = 0;
    els.forEach(function (e) { max = Math.max(max, +e.dataset.s); });
    root.classList.add('steps-on');
    var q = seq();
    function set(n) {
      els.forEach(function (e) { var s = +e.dataset.s, h = +(e.dataset.h || 0); e.classList.toggle('sh', n >= s && !(h && n >= h)); });
      ons.forEach(function (e) { e.classList.toggle('on', n >= +e.dataset.on); });
      if (onStep) onStep(n);
    }
    if (!motion) set(99);
    return {
      max: max, set: set,
      play: function (times, done) {
        q.stop();
        if (!motion) { set(99); if (done) done(); return; }
        set(0); times.forEach(function (t, i) { q.at(function () { set(i + 1); }, t * SLOW); });
        if (done) q.at(done, times[times.length - 1] * SLOW + 10);
      },
      stop: function () { q.stop(); }
    };
  }
  function playOnce(el, times, threshold) {
    if (!el) return;
    var st = stepper(el); if (motion) st.set(0); else st.set(99);
    onVisible(el, function () { st.play(times); }, threshold || 0.35);
  }

  /* ------------------------------------------------------------ Questions posées depuis les démonstrations */
  $$('[data-ask-form]').forEach(function (f) {
    var field = $('input, textarea', f);
    f.addEventListener('submit', function (e) {
      e.preventDefault(); var t = field.value.trim(); if (!t) { field.focus(); return; }
      field.value = ''; askMilo(t);
    });
    if (field.tagName === 'TEXTAREA') field.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); f.requestSubmit ? f.requestSubmit() : f.dispatchEvent(new Event('submit')); } });
  });

  /* ------------------------------------------------------------ Services : chaque carte s'anime quand elle apparaît */
  $$('.svc').forEach(function (c) {
    if (!motion) { c.classList.add('on'); return; }
    onVisible(c, function () { c.classList.add('on'); }, 0.3);
  });

  /* ------------------------------------------------------------ Actions : accordéon à défilement automatique */
  (function actions() {
    var box = $('#actions .acc'); if (!box) return;
    var items = $$('.acc-i', box), panes = $$('#actions .pane'), auto = motion, cur = 0, timer = null, inView = false;
    var T = { gmail: [300, 750, 1200, 1650, 2300], hubspot: [300, 650, 1000, 1350, 2200], sheets: [300, 600, 900, 1200, 1500, 2100, 2700, 3400], notion: [300, 900, 1500, 2100, 2800], whatsapp: [200, 700, 1700, 2600, 3500] };
    var st = {}; panes.forEach(function (p) { st[p.dataset.k] = stepper(p); });
    var DUR = 6500 * SLOW;
    function open(i, user) {
      cur = i;
      items.forEach(function (it, j) {
        var on = j === i, b = $('.acc-b', it), p = $('.acc-p', it), bar = $('.acc-bar i', it);
        it.classList.toggle('open', on); b.setAttribute('aria-expanded', on ? 'true' : 'false'); p.hidden = !on;
        bar.style.transition = 'none'; bar.style.transform = 'scaleX(0)';
      });
      var k = items[i].dataset.k;
      panes.forEach(function (p) { p.hidden = p.dataset.k !== k; });
      st[k].play(T[k]);
      clearTimeout(timer);
      if (user) { auto = false; box.classList.add('manual'); }
      if (auto && inView) {
        var bar = $('.acc-bar i', items[i]); void bar.offsetWidth;
        bar.style.transition = 'transform ' + DUR + 'ms linear'; bar.style.transform = 'scaleX(1)';
        timer = setTimeout(function () { open((cur + 1) % items.length); }, DUR);
      }
    }
    items.forEach(function (it, j) { $('.acc-b', it).addEventListener('click', function () { open(j, true); }); });
    if (!motion) box.classList.add('manual');
    onSwipe($('#actions .acc-win'), function (k) { open((cur + k + items.length) % items.length, true); });
    // à l'apparition, on rejoue l'outil courant : un clic fait avant n'est jamais annulé
    onVisible($('#actions .acc-g'), function () { inView = true; open(cur); }, 0.3);
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) {
      var v = es[0].isIntersecting; if (v === inView) return; inView = v;
      if (!v) { clearTimeout(timer); var b = $('.acc-bar i', items[cur]); b.style.transition = 'none'; b.style.transform = 'scaleX(0)'; } else if (auto) open(cur);
    }, { threshold: 0.2 }).observe($('#actions .acc-g'));
    st[items[0].dataset.k].set(motion ? 0 : 99);
  })();

  /* ------------------------------------------------------------ Conversations simulées (secteurs et scénarios) */
  // instants en data-t ; la fenêtre suit le dernier message tant que le visiteur ne fait pas défiler lui-même
  function chatPlayer(root) {
    var chat = $('.sd-chat', root), times = JSON.parse(root.dataset.t || '[]'), stick = true, playing = false;
    var st = stepper(root, function (n) {
      if (!playing) return;
      if (stick) requestAnimationFrame(function () { chat.scrollTo({ top: chat.scrollHeight, behavior: 'smooth' }); });
      if (n >= st.max) playing = false;
    });
    ['wheel', 'touchstart', 'keydown'].forEach(function (ev) { chat.addEventListener(ev, function () { if (playing) stick = false; }, { passive: true }); });
    function play() { stick = true; playing = motion; chat.scrollTop = 0; st.play(times); }
    var re = $('.sd-re', root); if (re) re.addEventListener('click', play);
    return { st: st, play: play, stop: function () { playing = false; st.stop(); } };
  }

  /* ------------------------------------------------------------ Secteurs : onglets et conversation complète */
  (function sectors() {
    var tabs = $$('.pts .pt'); if (!tabs.length) return;
    var panels = tabs.map(function (t) { return d.getElementById(t.getAttribute('aria-controls')); });
    var seen = false;
    var convs = panels.map(function (p) { return chatPlayer($('[data-demo]', p)); });
    function sel(i, focus) {
      tabs.forEach(function (t, j) { var on = j === i; t.setAttribute('aria-selected', on ? 'true' : 'false'); t.tabIndex = on ? 0 : -1; panels[j].hidden = !on; if (!on) convs[j].stop(); });
      if (focus) tabs[i].focus();
      if (seen) convs[i].play(); else convs[i].st.set(motion ? 0 : 99);
    }
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { sel(i); });
      t.addEventListener('keydown', function (e) {
        var k = { ArrowRight: 1, ArrowLeft: -1, Home: -99, End: 99 }[e.key]; if (!k) return; e.preventDefault();
        var n = k === -99 ? 0 : k === 99 ? tabs.length - 1 : (i + k + tabs.length) % tabs.length; sel(n, true);
      });
    });
    convs[0].st.set(motion ? 0 : 99);
    onSwipe($('#secteurs .sps'), function (k) { var i = tabs.findIndex(function (t) { return t.getAttribute('aria-selected') === 'true'; }); sel((i + k + tabs.length) % tabs.length); });
    onVisible($('#secteurs .sps'), function () { seen = true; var i = tabs.findIndex(function (t) { return t.getAttribute('aria-selected') === 'true'; }); convs[i].play(); }, 0.3);
    // un seul cas d'usage ouvert à la fois
    panels.forEach(function (p) {
      var ds = $$('details', p);
      ds.forEach(function (dd) { dd.addEventListener('toggle', function () { if (dd.open) ds.forEach(function (o) { if (o !== dd) o.open = false; }); }); });
    });
  })();



  /* ------------------------------------------------------------ Agent commercial : quatre missions, démonstration pas à pas */
  // Les panneaux sont superposés (même hauteur) : changer de mission ne déplace pas la page.
  // Avance seule tant que la section est visible, jusqu'au premier clic.
  (function agent() {
    var box = $('[data-agent]'); if (!box) return;
    var tabs = $$('.agt-tab', box), pans = tabs.map(function (t) { return d.getElementById(t.getAttribute('aria-controls')); });
    var cmd = $('[data-agt-cmd]', box), re = $('.sd-re', box);
    var num = $('[data-agt-n]', box), cur = 0;
    var caps = pans.map(function (p) { try { return JSON.parse(p.dataset.caps || '[]'); } catch (e) { return []; } });
    // chaque étape est commentée : « 2/6 · Met le compte rendu à votre en-tête »
    function say(i, n) {
      if (i !== cur || !cmd) return;
      var c = caps[i], live = n > 0 && n <= c.length, text = live ? c[n - 1] : (pans[i].dataset.cmd || '');
      if (num) num.textContent = live ? n + '/' + c.length : '';
      box.classList.toggle('live', live && n < c.length);
      if (cmd.textContent === text) return;
      cmd.textContent = text; cmd.classList.remove('tick'); void cmd.offsetWidth; cmd.classList.add('tick');
    }
    var sts = pans.map(function (p, i) { return stepper(p, function (n) { say(i, n); }); }), times = pans.map(function (p) { return JSON.parse(p.dataset.t || '[]'); });
    var auto = motion, inView = false, timer = null, HOLD = 5000;
    function bar(i, ms) {
      tabs.forEach(function (t, j) {
        var b = $('.agt-bar i', t); b.style.transition = 'none'; b.style.transform = 'scaleX(0)';
        if (j === i && ms) { void b.offsetWidth; b.style.transition = 'transform ' + ms + 'ms linear'; b.style.transform = 'scaleX(1)'; }
      });
    }
    function sel(i, user, focus) {
      cur = i; clearTimeout(timer);
      tabs.forEach(function (t, j) {
        var on = j === i; t.setAttribute('aria-selected', on ? 'true' : 'false'); t.tabIndex = on ? 0 : -1;
        pans[j].classList.toggle('is-off', !on); if (!on) sts[j].stop();
      });
      say(i, 0);
      if (focus) tabs[i].focus();
      if (user) { auto = false; box.classList.add('manual'); }
      if (motion && !inView) { sts[i].set(0); bar(-1); return; }
      sts[i].play(times[i]);
      if (auto) {
        var ms = times[i][times[i].length - 1] * SLOW + HOLD; bar(i, ms);
        timer = setTimeout(function () { sel((cur + 1) % tabs.length); }, ms);
      } else bar(-1);
    }
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { sel(i, true); });
      t.addEventListener('keydown', function (e) {
        var k = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1, Home: -99, End: 99 }[e.key]; if (!k) return; e.preventDefault();
        sel(k === -99 ? 0 : k === 99 ? tabs.length - 1 : (i + k + tabs.length) % tabs.length, true, true);
      });
    });
    if (re) re.addEventListener('click', function () { sel(cur, true); });
    if (!motion) box.classList.add('manual');
    onSwipe($('.agt-stage', box), function (k) { sel((cur + k + tabs.length) % tabs.length, true); });
    sts[0].set(motion ? 0 : 99);
    if (!('IntersectionObserver' in window)) { inView = true; sel(0); return; }
    new IntersectionObserver(function (es) {
      var v = es[0].isIntersecting; if (v === inView) return; inView = v;
      if (v) sel(cur); else { clearTimeout(timer); bar(-1); }
    }, { threshold: 0.25 }).observe($('.agt-stage', box));
  })();

  /* ------------------------------------------------------------ Accueil : le parcours ne s'anime que lorsqu'il est visible */
  (function flow() {
    var f = $('[data-flow]'); if (!f || !motion) return;
    if (!('IntersectionObserver' in window)) { f.classList.add('run'); return; }
    new IntersectionObserver(function (es) { f.classList.toggle('run', es[0].isIntersecting); }).observe(f);
  })();

  /* ------------------------------------------------------------ Accueil : la console traite trois demandes, en boucle tant qu'elle est visible */
  (function consoleDemo() {
    var st = $('[data-cons]'); if (!st) return;
    var ins = $$('.cons-in li', st), outs = $$('.cons-out li', st), steps = $$('.cons-steps li', st);
    var txt = steps.map(function (li) { return $('span', li); }), data = [], q = seq();
    try { data = JSON.parse(st.dataset.steps || '[]'); } catch (e) { data = []; }
    if (!motion || data.length < 3) { st.classList.add('static'); return; }
    function show(r, n) {
      ins.forEach(function (e, i) { e.classList.toggle('on', i === r); });
      steps.forEach(function (e, i) {
        if (txt[i].textContent !== data[r][i]) { txt[i].textContent = data[r][i]; restart(txt[i], 'tick'); }
        e.classList.toggle('ok', i < n); e.classList.toggle('now', i === n);
      });
    }
    var count = $('[data-cons-n]', st);
    function done(k) { outs.forEach(function (e, i) { e.classList.toggle('on', i < k); }); if (count && count.textContent !== String(k)) { count.textContent = k; restart(count, 'tick'); } }
    function play() {
      q.stop(); done(0); var t = 300, k = 750 * SLOW;
      [0, 1, 2].forEach(function (r) {
        q.at(function () { show(r, 0); }, t); q.at(function () { show(r, 1); }, t + k); q.at(function () { show(r, 2); }, t + 2 * k);
        q.at(function () { show(r, 3); done(r + 1); }, t + 3 * k); t += 3100 * SLOW;
      });
      q.at(play, t + 4000);
    }
    if (!('IntersectionObserver' in window)) { play(); return; }
    new IntersectionObserver(function (es) { if (es[0].isIntersecting) { st.classList.add('run'); play(); } else { st.classList.remove('run'); q.stop(); } }, { threshold: 0 }).observe(st);
  })();

  /* ------------------------------------------------------------ Accueil : le mot-clé s'écrit, s'efface et change */
  (function typewriter() {
    var el = $('.tw[data-words]'); if (!el || !motion) return;
    var words = []; try { words = JSON.parse(el.dataset.words); } catch (e) { return; }
    var w = 0, n = words[0].length, del = true, live = true;
    el.classList.add('typing');
    function tick() {
      if (!live) return setTimeout(tick, 400);
      var word = words[w];
      if (del) { n--; el.textContent = word.slice(0, Math.max(n, 0)); if (n <= 0) { del = false; w = (w + 1) % words.length; return setTimeout(tick, 300); } return setTimeout(tick, 50); }
      word = words[w]; n++; el.textContent = word.slice(0, n);
      if (n >= word.length) { del = true; return setTimeout(tick, 1500); }
      setTimeout(tick, 75);
    }
    document.addEventListener('visibilitychange', function () { live = !document.hidden; });
    setTimeout(tick, 1500);
  })();

  /* ------------------------------------------------------------ Cartes empilées : la carte recouverte recule doucement */
  (function stack() {
    var cards = $$('.pc'); if (!cards.length || !motion) return;
    var ticking = false;
    function draw() {
      ticking = false;
      cards.forEach(function (c, i) {
        var next = cards[i + 1], inner = c.firstElementChild;
        if (!next) { inner.style.transform = ''; inner.style.opacity = ''; return; }
        var top = c.getBoundingClientRect().top, nTop = next.getBoundingClientRect().top, h = c.offsetHeight;
        var u = clamp(1 - (nTop - top) / h);
        inner.style.transform = 'scale(' + (1 - u * 0.06).toFixed(4) + ')';
        inner.style.opacity = (1 - u * 0.45).toFixed(3);
      });
    }
    window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(draw); } }, { passive: true });
    window.addEventListener('resize', draw); draw();
  })();

  /* ------------------------------------------------------------ Progression de lecture : un filet en haut de page */
  (function progress() {
    var bar = d.createElement('div'); bar.className = 'prog'; bar.setAttribute('aria-hidden', 'true'); d.body.appendChild(bar);
    var tick = false;
    function draw() {
      tick = false; var max = d.documentElement.scrollHeight - window.innerHeight;
      bar.style.transform = 'scaleX(' + (max > 0 ? Math.min(1, window.scrollY / max) : 0) + ')';
    }
    window.addEventListener('scroll', function () { if (!tick) { tick = true; requestAnimationFrame(draw); } }, { passive: true });
    window.addEventListener('resize', draw); draw();
  })();

  /* ------------------------------------------------------------ Méthode : une seule animation, les 5 étapes s'allument l'une après l'autre */
  (function timeline() {
    var tl = $('[data-tl]'); if (!tl) return;
    var st = $$('.tml-s', tl), re = $('.tml-re', tl), q = seq(), last = st.length - 1;
    function set(n) { st.forEach(function (s, j) { s.classList.toggle('on', j <= n); s.classList.toggle('is-now', j === n && n < last + 1); s.classList.toggle('lk', j < n); }); }
    if (!motion) { set(last); st[last].classList.remove('is-now'); return; }
    function play() {
      q.stop(); set(-1);
      st.forEach(function (s, j) { q.at(function () { set(j); }, 350 + j * 1500); });
      q.at(function () { st[last].classList.remove('is-now'); }, 350 + st.length * 1500);
    }
    set(-1);
    onVisible(tl, play, 0.35);
    if (re) re.addEventListener('click', play);
  })();

  /* ------------------------------------------------------------ Carrousels au doigt (agents, offres) sur tablette et smartphone */
  $$('[data-swipe]').forEach(function (box) {
    var slides = $$(':scope > *', box), ctl = box.nextElementSibling;
    if (!ctl || !ctl.classList.contains('sw-ctl') || slides.length < 2) return;
    var dots = $('.sw-dots', ctl), prev = $('.sw-prev', ctl), next = $('.sw-next', ctl), cur = -1, tick = false;
    slides.forEach(function (s, i) { var b = d.createElement('button'); b.type = 'button'; b.tabIndex = -1; b.className = 'sw-dot'; b.addEventListener('click', function () { go(i); }); dots.appendChild(b); });
    var ds = $$('.sw-dot', dots);
    function step() { return slides[1].offsetLeft - slides[0].offsetLeft; }
    function upd() {
      tick = false;
      var i = Math.max(0, Math.min(slides.length - 1, Math.round(box.scrollLeft / Math.max(step(), 1))));
      if (box.scrollLeft + box.clientWidth >= box.scrollWidth - 4) i = slides.length - 1;
      if (i === cur) return; cur = i;
      ds.forEach(function (b, j) { b.classList.toggle('on', j === i); });
      slides.forEach(function (s, j) { s.classList.toggle('is-cur', j === i); });
      prev.disabled = i === 0; next.disabled = i === slides.length - 1;
    }
    function go(i) { box.scrollTo({ left: Math.max(0, i) * step(), behavior: motion ? 'smooth' : 'auto' }); }
    prev.addEventListener('click', function () { go(cur - 1); });
    next.addEventListener('click', function () { go(cur + 1); });
    box.addEventListener('scroll', function () { if (!tick) { tick = true; requestAnimationFrame(upd); } }, { passive: true });
    box.addEventListener('keydown', function (e) { if (e.target !== box) return; if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); go(cur + (e.key === 'ArrowRight' ? 1 : -1)); } });
    window.addEventListener('resize', function () { cur = -1; upd(); });
    upd();
  });

  /* ------------------------------------------------------------ Reflet qui suit la souris sur les cartes */
  $$('.svc, .off, .agg-g li, .agt-tab, .cta-box').forEach(function (c) {
    c.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse') return;
      var r = c.getBoundingClientRect();
      c.style.setProperty('--mx', (e.clientX - r.left).toFixed(0) + 'px'); c.style.setProperty('--my', (e.clientY - r.top).toFixed(0) + 'px');
    }, { passive: true });
  });


  /* ============================================================ Version 8.5 : gestes repris de la référence, adaptés à Bridge */

  /* Boutons « liquides » : la pastille de la flèche se détache au survol (filtre goo) */
  $$('.btn-primary').forEach(function (b) {
    if (b.querySelector('.liq-g')) return;
    var t = d.createElement('span'); t.className = 'bt';
    while (b.firstChild) t.appendChild(b.firstChild);
    var g = d.createElement('span'); g.className = 'liq-g'; g.setAttribute('aria-hidden', 'true');
    g.innerHTML = '<span class="liq-p"></span><span class="liq-b"><svg class="ic"><use href="#l-arrow"/></svg></span>';
    b.appendChild(g); b.appendChild(t); b.classList.add('liq');
  });
  /* Boutons secondaires : un disque sombre remplit le bouton au survol */
  $$('.btn-ghost').forEach(function (b) {
    if (b.querySelector('.bt')) return;
    var t = d.createElement('span'); t.className = 'bt';
    while (b.firstChild) t.appendChild(b.firstChild);
    b.appendChild(t); b.classList.add('flu');
  });

  /* Navigation : se cache en descendant, revient en remontant, passe en clair sur les sections sombres */
  (function navMode() {
    var nav = $('.nav'); if (!nav) return;
    var darks = $$('[data-dark]'), lastY = window.scrollY, ticking = false;
    function draw() {
      ticking = false;
      var yy = window.scrollY, h = nav.offsetHeight;
      var open = d.body.classList.contains('menu-open') || (($('#mnav') || {}).hidden === false);
      nav.classList.toggle('nav-hide', !open && yy > 240 && yy > lastY + 2);
      if (yy < lastY - 2 || yy < 240) nav.classList.remove('nav-hide');
      lastY = yy;
      var mid = h / 2, on = false;
      for (var i = 0; i < darks.length; i++) { var r = darks[i].getBoundingClientRect(); if (r.top <= mid && r.bottom >= mid) { on = true; break; } }
      nav.classList.toggle('on-dark', on);
    }
    window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(draw); } }, { passive: true });
    draw();
  })();

  /* Héros : bulles floues qui dérivent lentement et rebondissent sur les bords */
  (function blobs() {
    var box = $('.blobs'); if (box) return; /* v8.22 : dérive gérée en CSS */
    if (!box || !motion || window.innerWidth < 768) return;
    var items = $$('[data-blob]', box), live = true;
    var st = items.map(function (el) {
      var mx = Math.max(0, box.offsetWidth - el.offsetWidth), my = Math.max(0, box.offsetHeight - el.offsetHeight);
      return { el: el, x: Math.random() * mx, y: Math.random() * my, vx: (Math.random() - 0.5) * 5, vy: (Math.random() - 0.5) * 1.5, mx: mx, my: my };
    });
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { live = es[0].isIntersecting; }).observe(box);
    window.addEventListener('resize', function () { st.forEach(function (o) { o.mx = Math.max(0, box.offsetWidth - o.el.offsetWidth); o.my = Math.max(0, box.offsetHeight - o.el.offsetHeight); }); });
    (function f() {
      if (live && !d.hidden) st.forEach(function (o) {
        o.x += o.vx; o.y += o.vy;
        if (o.x <= 0 || o.x >= o.mx) { o.vx = -o.vx; o.x = clamp(o.x, 0, o.mx); }
        if (o.y <= 0 || o.y >= o.my) { o.vy = -o.vy; o.y = clamp(o.y, 0, o.my); }
        o.el.style.transform = 'translate(' + o.x.toFixed(1) + 'px,' + o.y.toFixed(1) + 'px)';
      });
      requestAnimationFrame(f);
    })();
    box.classList.add('live');
  })();

  /* Services : halo qui s'allume et pastille qui suit le curseur */
  $$('.svc').forEach(function (c) {
    if (!hoverable) return;
    var p = d.createElement('span'); p.className = 'svc-ptr'; p.setAttribute('aria-hidden', 'true');
    p.innerHTML = '<i><svg class="ic"><use href="#l-arrow"/></svg></i>'; c.appendChild(p);
    c.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse') return;
      var r = c.getBoundingClientRect();
      p.style.transform = 'translate(' + (e.clientX - r.left).toFixed(0) + 'px,' + (e.clientY - r.top).toFixed(0) + 'px)';
    }, { passive: true });
  });

  /* « Ce que ça change » : arrivée du texte, de la photo et des bulles, puis léger parallaxe */
  (function arrival() {
    var cards = $$('.pc'); if (!cards.length) return;
    var wide = window.matchMedia('(min-width: 861px)');
    cards.forEach(function (c) {
      if (!motion) { c.classList.add('in'); return; }
      c.classList.add('arr');
      onVisible(c, function () { c.classList.add('in'); }, 0.15);
    });
    if (!motion) return;
    var ticking = false;
    function draw() {
      ticking = false; if (!wide.matches) return;
      var vh = window.innerHeight;
      cards.forEach(function (c) {
        var r = c.getBoundingClientRect(); if (r.bottom < 0 || r.top > vh) return;
        var u = clamp((vh - r.top) / (vh + r.height));
        c.style.setProperty('--p', u.toFixed(3));
      });
    }
    window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(draw); } }, { passive: true });
    draw();
  })();

  /* Mur d'outils : il pivote et s'incline doucement pendant le défilement */
  (function wall() {
    var g = $('[data-wall]'); if (!g || !motion) return;
    var sec = g.closest('.wall'), cur = 0, goal = 0, run = false;
    function measure() { var r = sec.getBoundingClientRect(), vh = window.innerHeight; goal = clamp((vh - r.top) / (vh + r.height) - 0.1, 0, 1); if (!run) { run = true; requestAnimationFrame(f); } }
    function f() {
      cur += (goal - cur) * 0.12;
      g.style.transform = 'rotate(' + (-6 * cur).toFixed(2) + 'deg) skewX(' + (8 * cur).toFixed(2) + 'deg)';
      if (Math.abs(goal - cur) > 0.001) requestAnimationFrame(f); else run = false;
    }
    window.addEventListener('scroll', measure, { passive: true }); measure();
  })();

  /* Cartes à gratter */
  (function scratch() {
    var cards = $$('.scr-c'); if (!cards.length) return;
    var all = $('.scr-all');
    function reveal(c) { c.classList.add('done'); }
    cards.forEach(function (c) {
      var cv = $('canvas', c), ctx = cv.getContext && cv.getContext('2d'); if (!ctx) { reveal(c); return; }
      var w = 0, h = 0, dpr = Math.min(2, window.devicePixelRatio || 1), last = null, n = 0, checks = 0;
      function paint() {
        w = c.offsetWidth; h = c.offsetHeight; cv.width = w * dpr; cv.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        var gr = ctx.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#04CBFC'); gr.addColorStop(1, '#86FBA6');
        ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = gr; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = 'rgba(255,255,255,.18)';
        for (var i = 0; i < 260; i++) ctx.fillRect(Math.random() * w, Math.random() * h, 1.4, 1.4);
        ctx.fillStyle = '#04141A'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = '600 22px Poppins, sans-serif'; ctx.fillText('Grattez ici', w / 2, h / 2 - 8);
        ctx.font = '400 13px Poppins, sans-serif'; ctx.fillText('pour découvrir', w / 2, h / 2 + 20);
      }
      paint();
      function pos(e) { var r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
      function draw(e) {
        if (c.classList.contains('done')) return;
        var p = pos(e);
        ctx.globalCompositeOperation = 'destination-out'; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = 46;
        ctx.beginPath(); if (last) ctx.moveTo(last.x, last.y); else ctx.moveTo(p.x - 0.1, p.y); ctx.lineTo(p.x, p.y); ctx.stroke();
        last = p;
        if (++n % 12 === 0) measure();
      }
      function measure() {
        var data = ctx.getImageData(0, 0, cv.width, cv.height).data, clear = 0, tot = 0;
        for (var i = 3; i < data.length; i += 64) { tot++; if (data[i] < 20) clear++; }
        if (clear / tot > 0.45) reveal(c);
      }
      cv.addEventListener('pointerenter', function () { last = null; });
      cv.addEventListener('pointerleave', function () { last = null; });
      cv.addEventListener('pointermove', function (e) { if (e.pointerType === 'mouse' || e.buttons || e.pressure) draw(e); });
      cv.addEventListener('pointerdown', function (e) { last = null; draw(e); try { cv.setPointerCapture(e.pointerId); } catch (x) {} });
      window.addEventListener('resize', function () { if (!c.classList.contains('done') && c.offsetWidth !== w) paint(); });
    });
    if (all) all.addEventListener('click', function () { cards.forEach(reveal); all.disabled = true; });
  })();


  /* ============================================================ Version 8.6 */

  /* Méthode : onglets en contrôle segmenté, fondu de 100 ms comme la référence */
  (function methodTabs() {
    var box = $('[data-mt]'); if (!box) return;
    var tabs = $$('[role="tab"]', box), pans = $$('[role="tabpanel"]', box), cur = 0;
    function show(i, focus) {
      if (i === cur && !pans[i].hidden) return;
      var old = pans[cur];
      tabs.forEach(function (t, j) { t.setAttribute('aria-selected', j === i ? 'true' : 'false'); t.tabIndex = j === i ? 0 : -1; });
      function swap() { pans.forEach(function (p, j) { p.hidden = j !== i; p.classList.remove('out'); }); if (motion) restart(pans[i], 'fade'); }
      if (motion && old && old !== pans[i]) { old.classList.add('out'); setTimeout(swap, 100); } else swap();
      cur = i; if (focus) tabs[i].focus();
    }
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { show(i); });
      t.addEventListener('keydown', function (e) {
        var k = e.key, n = tabs.length;
        if (k === 'ArrowRight' || k === 'ArrowLeft' || k === 'Home' || k === 'End') {
          e.preventDefault();
          show(k === 'Home' ? 0 : k === 'End' ? n - 1 : (cur + (k === 'ArrowRight' ? 1 : -1) + n) % n, true);
        }
      });
    });
  })();

  /* Menu « Services » : cartes qui arrivent en cascade (0,3 s, 0,1 s d'écart), départ éclair */
  (function dropdown() {
    var dd = $('[data-dd]'), li = $('.has-dd'); if (!dd || !li) return;
    var a = $('a', li), items = $$('[data-dd-item]', dd), t = null;
    items.forEach(function (it) { it.tabIndex = -1; });
    function open() {
      clearTimeout(t); if (dd.classList.contains('open')) return;
      var r = a.getBoundingClientRect(), nr = dd.parentElement.getBoundingClientRect();
      dd.style.setProperty('--x', Math.max(16, Math.min(r.left - nr.left - 24, nr.width - dd.offsetWidth - 16)) + 'px');
      dd.classList.add('open'); a.setAttribute('aria-expanded', 'true');
      items.forEach(function (it) { it.tabIndex = 0; });
    }
    function close(now) {
      clearTimeout(t);
      t = setTimeout(function () { dd.classList.remove('open'); a.setAttribute('aria-expanded', 'false'); items.forEach(function (it) { it.tabIndex = -1; }); }, now ? 0 : 120);
    }
    if (hoverable) {
      [li, dd].forEach(function (el) { el.addEventListener('mouseenter', open); el.addEventListener('mouseleave', function () { close(); }); });
    }
    a.addEventListener('keydown', function (e) { if (e.key === 'ArrowDown') { e.preventDefault(); open(); items[0].focus(); } });
    dd.addEventListener('keydown', function (e) { if (e.key === 'Escape') { close(true); a.focus(); } });
    dd.addEventListener('focusout', function (e) { if (!dd.contains(e.relatedTarget)) close(true); });
    items.forEach(function (it) { it.addEventListener('click', function () { close(true); }); });
    window.addEventListener('scroll', function () { if (dd.classList.contains('open') && window.scrollY > 40 && !dd.matches(':hover')) close(true); }, { passive: true });
  })();


  /* Version 8.21 : pile de cartes qui tourne toute seule sous le héros (ressorts doux) */
  (function previewWall() {
    var box = $('[data-pw]'); if (!box) return;
    var cards = $$('.pw-card', box), order = cards.map(function (c, i) { return i; }), live = true, hold = false;
    function draw() {
      order.forEach(function (ci, i) {
        var c = cards[ci];
        c.style.setProperty('--i', i);
        c.style.zIndex = cards.length - i;
        c.setAttribute('aria-hidden', i === 0 ? 'false' : 'true');
      });
    }
    draw(); box.classList.add('ready');
    if (!motion) return;
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { live = es[0].isIntersecting; }).observe(box);
    box.addEventListener('mouseenter', function () { hold = true; });
    box.addEventListener('mouseleave', function () { hold = false; });
    setInterval(function () {
      if (!live || hold || d.hidden) return;
      order.unshift(order.pop()); draw();
    }, 3000 * SLOW);
  })();


  /* Version 8.24 : onglets segmentés (secteurs, méthode) : un indicateur unique glisse vers l'onglet choisi.
     Emil Kowalski / taste : transform seulement, la taille est prise tout de suite et l'échelle se pose
     depuis celle de l'ancien onglet, 280 ms ease-out ; sans animation si le mouvement est réduit. */
  (function segTabs() {
    $$('.pts[role="tablist"], .mt-menu[role="tablist"]').forEach(function (list) {
      var ind = d.createElement('span'), prev = null;
      ind.className = 'seg-ind'; ind.setAttribute('aria-hidden', 'true');
      list.classList.add('seg'); list.insertBefore(ind, list.firstChild);
      function box() {
        var t = $('[role="tab"][aria-selected="true"]', list); if (!t) return null;
        return { x: t.offsetLeft, y: t.offsetTop, w: t.offsetWidth, h: t.offsetHeight };
      }
      function place(animate) {
        var b = box(); if (!b || !b.w) return;
        ind.style.width = b.w + 'px'; ind.style.height = b.h + 'px';
        if (animate && prev && motion) {
          ind.style.transition = 'none';
          ind.style.transform = 'translate(' + prev.x + 'px,' + prev.y + 'px) scale(' + (prev.w / b.w) + ',' + (prev.h / b.h) + ')';
          void ind.offsetWidth;
          ind.style.transition = 'transform 280ms cubic-bezier(.23, 1, .32, 1), opacity .7s cubic-bezier(.23, 1, .32, 1) .2s';
        } else ind.style.transition = 'opacity .7s cubic-bezier(.23, 1, .32, 1) .2s';
        ind.style.transform = 'translate(' + b.x + 'px,' + b.y + 'px)';
        prev = b; list.classList.add('has-ind');
      }
      place(false);
      new MutationObserver(function () { place(true); }).observe(list, { subtree: true, attributes: true, attributeFilter: ['aria-selected'] });
      var rt = 0;
      window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { prev = null; place(false); }, 80); });
      if (d.fonts && d.fonts.ready) d.fonts.ready.then(function () { prev = null; place(false); });
    });
  })();


  /* Version 8.25 : la fenêtre de l'agent dans le héros traite les demandes une à une, puis recommence.
     Une demande arrive (en cours), passe à « fait » 1,4 s plus tard, la suivante arrive ; pause de 3 s
     sur l'écran terminé, puis tout repart. Mouvement réduit : l'écran terminé, sans boucle. */
  (function heroAgent() {
    var box = $('[data-hx]'); if (!box) return;
    var rows = $$('.hx-list li', box), step = 0, timer = null, live = true;
    function set(li, st) { li.classList.remove('is-wait', 'is-run', 'is-done', 'is-in'); li.classList.add(st); }
    function done() { rows.forEach(function (li) { set(li, 'is-done'); }); }
    if (!motion) { done(); return; }
    function reset() { rows.forEach(function (li) { set(li, 'is-wait'); }); step = 0; }
    function tick() {
      if (!live || d.hidden) { timer = setTimeout(tick, 600); return; }
      var i = Math.floor(step / 2), phase = step % 2;
      if (i >= rows.length) { timer = setTimeout(function () { reset(); tick(); }, 3000); return; }
      if (phase === 0) { set(rows[i], 'is-run'); rows[i].classList.add('is-in'); }
      else set(rows[i], 'is-done');
      step++;
      timer = setTimeout(tick, phase === 0 ? 1400 : 500);
    }
    reset(); set(rows[0], 'is-done'); set(rows[1], 'is-done'); step = 4;
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { live = es[0].isIntersecting; }).observe(box);
    timer = setTimeout(tick, 1600);
  })();


  /* Version 8.28 : lumière qui suit le curseur sur les cartes (un seul écouteur, une écriture par image),
     et profondeur du héros : trois couches qui suivent la souris à des vitesses différentes, lissées.
     Souris fine seulement ; rien sur écran tactile ni en mouvement réduit. */
  (function spotlight() {
    if (!motion || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    var sel = '.svc, .off, .why-g li, .founder, .ct-form, .roi-out, .mt-v, .agt-tab, .sp-list, .hx-win, .acc-win, .cons-w';
    $$(sel).forEach(function (el) {
      if (el.querySelector(':scope > .spot')) return;
      el.setAttribute('data-spot', '');
      if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
      var s = d.createElement('span'); s.className = 'spot'; s.setAttribute('aria-hidden', 'true'); el.appendChild(s);
    });
    var cur = null, px = 0, py = 0, raf = 0;
    function paint() { raf = 0; if (!cur) return; var r = cur.getBoundingClientRect(); cur.style.setProperty('--mx', (px - r.left) + 'px'); cur.style.setProperty('--my', (py - r.top) + 'px'); }
    d.addEventListener('pointermove', function (e) {
      var el = e.target.closest && e.target.closest('[data-spot]');
      if (el !== cur) { if (cur) cur.classList.remove('is-lit'); cur = el; if (cur) cur.classList.add('is-lit'); }
      px = e.clientX; py = e.clientY; if (cur && !raf) raf = requestAnimationFrame(paint);
    }, { passive: true });
    d.addEventListener('pointerleave', function () { if (cur) cur.classList.remove('is-lit'); cur = null; });
  })();

  (function heroDepth() {
    var hx = $('[data-hx]'); if (!hx || !motion || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    var hero = hx.closest('.hero') || hx, layers = [[$('.hx-photo', hx), -10, -8], [$('.hx-win', hx), 14, 10], [$('.hx-note', hx), 24, 18]];
    var tx = 0, ty = 0, x = 0, y = 0, raf = 0;
    function frame() {
      x += (tx - x) * 0.08; y += (ty - y) * 0.08;
      layers.forEach(function (l) { if (l[0]) l[0].style.translate = (x * l[1]).toFixed(2) + 'px ' + (y * l[2]).toFixed(2) + 'px'; });
      raf = (Math.abs(tx - x) > 0.001 || Math.abs(ty - y) > 0.001) ? requestAnimationFrame(frame) : 0;
    }
    hero.addEventListener('pointermove', function (e) {
      var r = hx.getBoundingClientRect();
      tx = clamp(((e.clientX - (r.left + r.width / 2)) / r.width) * 2, -1, 1);
      ty = clamp(((e.clientY - (r.top + r.height / 2)) / r.height) * 2, -1, 1);
      if (!raf) raf = requestAnimationFrame(frame);
    }, { passive: true });
    hero.addEventListener('pointerleave', function () { tx = 0; ty = 0; if (!raf) raf = requestAnimationFrame(frame); });
  })();

})();
