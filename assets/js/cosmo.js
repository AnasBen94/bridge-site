/* Bridge, version 10 : interactions du site (sans dépendance).
   Tout reste lisible sans JavaScript ; les animations ne se jouent qu'en mode « motion ». */
(function () {
  'use strict';
  var d = document, html = d.documentElement;
  var motion = html.classList.contains('motion') && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  html.classList.add('ready');

  function $(s, c) { return (c || d).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || d).querySelectorAll(s)); }
  function clamp(v, a, b) { return Math.min(b === undefined ? 1 : b, Math.max(a === undefined ? 0 : a, v)); }
  function onVisible(el, fn, threshold) {
    if (!el) return;
    if (!('IntersectionObserver' in window)) { fn(); return; }
    var io = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { io.disconnect(); fn(); } }, { threshold: threshold || 0.3 });
    io.observe(el);
  }
  function askMilo(text) { if (window.Milo) window.Milo.ask(text); }
  function openMilo() { if (window.Milo) window.Milo.open(); }

  var y = $('#year'); if (y) y.textContent = new Date().getFullYear();

  /* ------------------------------------------------------------ Navigation */
  var nav = $('.nav'), links = $$('.nav-links a');
  (function navMode() {
    if (!nav) return;
    var lastY = window.scrollY, ticking = false;
    function draw() {
      ticking = false;
      var yy = window.scrollY, open = !($('#mnav') || {}).hidden;
      nav.classList.toggle('is-scrolled', yy > 8);
      if (!open && yy > 240 && yy > lastY + 2) nav.classList.add('nav-hide');
      if (yy < lastY - 2 || yy < 240) nav.classList.remove('nav-hide');
      lastY = yy;
    }
    window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(draw); } }, { passive: true });
    draw();
  })();
  if ('IntersectionObserver' in window && links.length) {
    var secIO = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        var a = links.filter(function (l) { return l.getAttribute('href') === '#' + e.target.id; })[0];
        if (!a) return;
        if (e.isIntersecting) { links.forEach(function (l) { l.removeAttribute('aria-current'); }); a.setAttribute('aria-current', 'true'); }
        else if (a.getAttribute('aria-current')) a.removeAttribute('aria-current');
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    links.forEach(function (a) { var s = d.getElementById(a.getAttribute('href').slice(1)); if (s) secIO.observe(s); });
  }

  /* Menu mobile : piège du focus, fermeture avec Échap */
  var burger = $('#burger'), mnav = $('#mnav');
  function setMenu(open) {
    if (!burger || !mnav) return;
    mnav.hidden = !open; mnav.classList.toggle('open', open);
    d.body.classList.toggle('menu-open', open);
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    burger.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
    if (open) { if (nav) nav.classList.remove('nav-hide'); var f = $('a', mnav); if (f) f.focus(); }
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
    window.addEventListener('resize', function () { if (window.innerWidth > 1080) setMenu(false); });
  }

  /* Accueil : l'horizon se cale juste au-dessus de la console, quelle que soit la hauteur du texte */
  (function horizon() {
    var hero = $('.hero'), stage = $('.stage'); if (!hero || !stage) return;
    function place() { hero.style.setProperty('--hz', stage.offsetTop + 'px'); }
    place(); window.addEventListener('resize', place); if (d.fonts && d.fonts.ready) d.fonts.ready.then(place);
  })();

  /* ------------------------------------------------------------ Apparitions au défilement */
  if (motion && 'IntersectionObserver' in window) {
    var rIO = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); rIO.unobserve(e.target); } }); }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    $$('.sh, .st-g, .bx, .svc, .htabs, .tp-g, .step, .cc, .roi, .plan, .who, .faq-g, .cta, .ct-g').forEach(function (el, i) { el.classList.add('rv'); el.style.transitionDelay = (/(bx|step|cc|plan)/.test(el.className) ? (i % 3) * 0.08 : 0) + 's'; rIO.observe(el); });
  }
  setTimeout(function () { window.dispatchEvent(new Event('bridge:intro')); }, motion ? 1600 : 0);

  /* Orbe : le mot change en douceur */
  (function orb() {
    var w = $('[data-orb]'); if (!w || !motion) return;
    var words = ['Relances', 'Devis', 'Réponses', 'Saisie', 'Rapports', 'Factures'], k = 0;
    setInterval(function () {
      if (d.hidden) return;
      w.classList.add('out');
      setTimeout(function () { k = (k + 1) % words.length; w.textContent = words[k]; w.classList.remove('out'); }, 350);
    }, 2600);
  })();

  /* Cadran : l'arc se remplit une fois visible */
  (function dial() {
    var a = $('.dial-arc'); if (!a) return;
    if (!motion) return;
    a.style.strokeDashoffset = '100';
    onVisible(a, function () { requestAnimationFrame(function () { a.style.strokeDashoffset = '32'; }); }, 0.5);
  })();

  /* ------------------------------------------------------------ Onglets (services, métiers) : clic, flèches, Début, Fin */
  $$('[role="tablist"]').forEach(function (list) {
    var tabs = $$('[role="tab"]', list); if (!tabs.length) return;
    function select(tab, focus) {
      tabs.forEach(function (t) {
        var on = t === tab, p = d.getElementById(t.getAttribute('aria-controls'));
        t.setAttribute('aria-selected', on ? 'true' : 'false'); t.tabIndex = on ? 0 : -1;
        if (p) p.hidden = !on;
      });
      if (focus) tab.focus();
      if (tab.scrollIntoView && list.scrollWidth > list.clientWidth) tab.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: motion ? 'smooth' : 'auto' });
      var p = d.getElementById(tab.getAttribute('aria-controls'));
      if (p && motion && p.animate) p.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 380, easing: 'cubic-bezier(.2,.8,.2,1)' });
    }
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { select(t); });
      t.addEventListener('keydown', function (e) {
        var k = e.key, n = null;
        if (k === 'ArrowRight' || k === 'ArrowDown') n = tabs[(i + 1) % tabs.length];
        else if (k === 'ArrowLeft' || k === 'ArrowUp') n = tabs[(i - 1 + tabs.length) % tabs.length];
        else if (k === 'Home') n = tabs[0]; else if (k === 'End') n = tabs[tabs.length - 1];
        if (n) { e.preventDefault(); select(n, true); }
      });
    });
  });

  $$('[data-open-milo]').forEach(function (b) { b.addEventListener('click', openMilo); });
  $$('[data-ask]').forEach(function (b) { b.addEventListener('click', function () { askMilo(b.dataset.ask); }); });

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

})();
