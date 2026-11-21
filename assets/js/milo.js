/* Milo — assistant IA de Bridge (widget de conversation).
   Contrat serveur inchangé : POST /api/chat { messages: [{ role, content, sig? }], lang }
   → { reply, sig, suggestAudit, suggestions }. Aucune clé n'est présente côté client,
   aucune conversation n'est conservée dans le navigateur. */
(function () {
  'use strict';
  var d = document, html = d.documentElement, motion = html.classList.contains('motion');
  var API = '/api/chat', AUDIT = 'https://meetings-eu1.hubspot.com/anas-ben-abdallah', MAX = 1000, TIMEOUT = 25000;
  try { var cfg = JSON.parse((d.getElementById('bridge-data') || {}).textContent || '{}'); if (cfg.audit) AUDIT = cfg.audit; } catch (e) { /* valeurs par défaut */ }
  var GREETING = 'Bonjour, je suis Milo, l’assistant IA de Bridge. Dites-moi ce qui vous prend du temps chaque semaine : je vous dirai ce qui peut s’automatiser.';
  var SHORTCUTS = ['Que puis-je automatiser ?', 'Comment fonctionne Bridge ?', 'Combien coûte un projet ?'];
  var ERRORS = {
    429: 'Vous avez envoyé beaucoup de messages en peu de temps. Réessayez dans une minute.',
    413: 'Ce message ou cette conversation est trop long. Raccourcissez-le, ou réservez l’audit pour en parler de vive voix.',
    timeout: 'La réponse prend trop de temps. Vérifiez votre connexion puis réessayez.',
    offline: 'Vous semblez hors connexion. Réessayez une fois la connexion rétablie.',
    other: 'Je n’arrive pas à répondre pour le moment. Réessayez dans un instant, ou réservez directement l’audit gratuit.'
  };

  function el(tag, cls, text) { var e = d.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function svgUse(cls, id) { return '<svg class="' + cls + '" aria-hidden="true"><use href="#' + id + '"/></svg>'; }
  var MILO_SVG = '<svg viewBox="0 0 100 100" aria-hidden="true"><use href="#i-milo-body"/><g class="eyes"><rect x="34" y="36" width="13" height="29" rx="6.5" fill="#fff"/><rect x="57" y="36" width="13" height="29" rx="6.5" fill="#fff"/></g></svg>';

  /* ---------- Construction de l'interface ---------- */
  var root = el('div', 'milo'); root.id = 'milo';
  root.innerHTML =
    '<section class="milo-panel" id="milo-panel" role="dialog" aria-modal="false" aria-labelledby="milo-title" hidden>' +
      '<header class="milo-head"><span class="milo-av">' + MILO_SVG + '</span><div><p class="milo-title" id="milo-title">Milo</p><p class="milo-sub"><i></i>Assistant IA de Bridge</p></div>' +
      '<button type="button" class="milo-x" aria-label="Fermer la conversation">' + svgUse('ic', 'l-x') + '</button></header>' +
      '<div class="milo-log" role="log" aria-live="polite" aria-relevant="additions"></div>' +
      '<div class="milo-chips" aria-label="Raccourcis"></div>' +
      '<form class="milo-form" novalidate><label class="sr-only" for="milo-in">Votre message à Milo</label>' +
        '<textarea id="milo-in" rows="1" maxlength="' + MAX + '" placeholder="Posez votre question…" autocomplete="off"></textarea>' +
        '<button type="submit" class="milo-send" aria-label="Envoyer" disabled>' + svgUse('ic', 'l-send') + '</button></form>' +
      '<p class="milo-foot"><span>Milo est une IA et peut se tromper. Ne partagez pas de données sensibles.</span><span class="milo-cnt" aria-live="polite"></span></p>' +
    '</section>' +
    '<button type="button" class="milo-launch" aria-expanded="false" aria-controls="milo-panel" aria-label="Ouvrir la conversation avec Milo">' + MILO_SVG + '<span class="milo-close-ic">' + svgUse('ic', 'l-x') + '</span></button>';
  d.body.appendChild(root);

  var panel = root.querySelector('.milo-panel'), log = root.querySelector('.milo-log'), chips = root.querySelector('.milo-chips');
  var form = root.querySelector('.milo-form'), input = root.querySelector('#milo-in'), sendBtn = root.querySelector('.milo-send');
  var launch = root.querySelector('.milo-launch'), closeBtn = root.querySelector('.milo-x'), cnt = root.querySelector('.milo-cnt');
  var history = [], busy = false, started = false, lastText = '';

  /* ---------- Messages ---------- */
  function fill(node, text) {
    String(text).split(/(https?:\/\/[^\s]+)/g).forEach(function (part, i) {
      if (i % 2) {
        var a = el('a', null, part); a.href = part; a.target = '_blank'; a.rel = 'noopener';
        try { if (new URL(part).protocol !== 'https:') { node.appendChild(d.createTextNode(part)); return; } } catch (e) { node.appendChild(d.createTextNode(part)); return; }
        node.appendChild(a);
      } else if (part) node.appendChild(d.createTextNode(part));
    });
  }
  function scroll() { log.scrollTop = log.scrollHeight; }
  function bubble(role, text, extra) {
    var row = el('div', 'm-row ' + (role === 'user' ? 'm-user' : 'm-bot'));
    if (role !== 'user') { var av = el('span', 'm-av'); av.innerHTML = MILO_SVG; row.appendChild(av); }
    var b = el('div', 'm-b'); fill(b, text); row.appendChild(b);
    if (extra) b.appendChild(extra);
    log.appendChild(row); scroll(); return row;
  }
  function typing(on) {
    var t = log.querySelector('.m-typing');
    if (on && !t) { t = el('div', 'm-row m-bot m-typing'); t.innerHTML = '<span class="m-av">' + MILO_SVG + '</span><div class="m-b" aria-label="Milo écrit"><i></i><i></i><i></i></div>'; log.appendChild(t); scroll(); }
    else if (!on && t) t.remove();
  }
  function setChips(list, withAudit) {
    chips.innerHTML = '';
    (list || []).forEach(function (s) {
      var c = el('button', 'm-chip', s); c.type = 'button';
      c.addEventListener('click', function () { send(s); }); chips.appendChild(c);
    });
    if (withAudit) {
      var a = el('a', 'm-chip m-chip-cta'); a.href = AUDIT; a.target = '_blank'; a.rel = 'noopener';
      a.innerHTML = svgUse('ic', 'l-cal') + '<span>Réserver un audit</span>'; chips.appendChild(a);
    }
    chips.hidden = !chips.children.length;
    scroll();
  }
  function auditButton() {
    var a = el('a', 'm-cta'); a.href = AUDIT; a.target = '_blank'; a.rel = 'noopener';
    a.innerHTML = svgUse('ic', 'l-cal') + '<span>Réserver l’audit gratuit</span>'; return a;
  }
  function errorBubble(kind, text) {
    var box = el('div', 'm-err-act');
    if (kind !== 413) { var r = el('button', 'm-retry', 'Réessayer'); r.type = 'button'; r.addEventListener('click', function () { row.remove(); send(text); }); box.appendChild(r); }
    box.appendChild(auditButton());
    var row = bubble('bot', ERRORS[kind] || ERRORS.other, box); row.classList.add('m-err');
  }

  /* ---------- Envoi ---------- */
  function updateSend() {
    var n = input.value.length;
    sendBtn.disabled = busy || !input.value.trim();
    cnt.textContent = n > MAX - 200 ? n + ' / ' + MAX : '';
  }
  function grow() { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 132) + 'px'; }
  function send(text) {
    text = String(text || '').trim();
    if (busy || !text) return;
    busy = true; lastText = text; setChips([]);
    bubble('user', text); history.push({ role: 'user', content: text });
    input.value = ''; grow(); updateSend(); typing(true);
    var ctrl = 'AbortController' in window ? new AbortController() : null, timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, TIMEOUT);
    fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: history.slice(-11), lang: 'fr' }), signal: ctrl ? ctrl.signal : undefined })
      .then(function (r) { if (!r.ok) { var e = new Error('http'); e.status = r.status; throw e; } return r.json(); })
      .then(function (data) {
        var reply = String((data && (data.reply || data.output || data.text)) || '').trim();
        if (!reply) throw new Error('empty');
        typing(false);
        bubble('bot', reply, data.suggestAudit ? auditButton() : null);
        var entry = { role: 'assistant', content: reply }; if (data.sig) entry.sig = data.sig; history.push(entry);
        setChips(Array.isArray(data.suggestions) ? data.suggestions.slice(0, 3) : [], !data.suggestAudit);
      })
      .catch(function (err) {
        typing(false); history.pop();
        var kind = !navigator.onLine ? 'offline' : err && err.name === 'AbortError' ? 'timeout' : err && (err.status === 429 || err.status === 413) ? err.status : 'other';
        errorBubble(kind, text);
      })
      .then(function () { clearTimeout(timer); busy = false; updateSend(); if (!panel.hidden) input.focus({ preventScroll: true }); });
  }
  form.addEventListener('submit', function (e) { e.preventDefault(); send(input.value); });
  input.addEventListener('input', function () { grow(); updateSend(); });
  input.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(input.value); } });

  /* ---------- Ouverture et fermeture ---------- */
  function start() {
    if (started) return; started = true;
    bubble('bot', GREETING);
    setChips(SHORTCUTS, true);
  }
  function open(focus) {
    start(); hideNudge();
    if (!panel.hidden) { if (focus !== false) input.focus(); return; }
    panel.hidden = false; root.classList.add('is-open');
    launch.setAttribute('aria-expanded', 'true'); launch.setAttribute('aria-label', 'Fermer la conversation avec Milo');
    html.classList.add('milo-open');
    requestAnimationFrame(function () { panel.classList.add('show'); scroll(); });
    if (focus !== false) setTimeout(function () { input.focus({ preventScroll: true }); }, motion ? 220 : 0);
  }
  function close() {
    if (panel.hidden) return;
    panel.classList.remove('show'); root.classList.remove('is-open'); html.classList.remove('milo-open');
    launch.setAttribute('aria-expanded', 'false'); launch.setAttribute('aria-label', 'Ouvrir la conversation avec Milo');
    setTimeout(function () { if (!root.classList.contains('is-open')) panel.hidden = true; }, motion ? 260 : 0);
    launch.focus({ preventScroll: true });
  }
  launch.addEventListener('click', function () { if (panel.hidden || !root.classList.contains('is-open')) open(); else close(); });
  closeBtn.addEventListener('click', close);
  d.addEventListener('keydown', function (e) { if (e.key === 'Escape' && root.classList.contains('is-open')) close(); });

  /* ---------- Arrivée du lanceur, clin d'œil, bulle d'accueil ---------- */
  var nudge = null;
  function hideNudge() { if (nudge) { nudge.classList.remove('show'); try { sessionStorage.setItem('milo-nudge', '1'); } catch (e) { /* stockage indisponible */ } } }
  function ready() {
    if (root.classList.contains('ready')) return; root.classList.add('ready');
    var svg = launch.querySelector('svg');
    var blink = function () { if (!motion) return; svg.classList.remove('blink'); void svg.getBoundingClientRect(); svg.classList.add('blink'); };
    svg.addEventListener('animationend', function () { svg.classList.remove('blink'); });
    launch.addEventListener('mouseenter', blink); setTimeout(blink, 600);
    // Milo vit : il cligne des yeux et regarde autour de lui, sauf quand la souris le guide ou que la conversation est ouverte
    if (motion) (function idle() {
      var eyes = svg.querySelector('.eyes'), lastPointer = 0;
      window.addEventListener('pointermove', function (e) { if (e.pointerType === 'mouse') lastPointer = Date.now(); }, { passive: true });
      var spots = [[-4.5, 0], [4.5, 0], [-3.5, -2.5], [3.5, -2.5], [0, -3], [-4, 2], [4, 2]];
      function move(x, y) { if (eyes) eyes.style.transform = 'translate(' + x + 'px,' + y + 'px)'; }
      function step() {
        var wait = 1400 + Math.random() * 2000;
        var busy = root.classList.contains('is-open') || document.hidden || Date.now() - lastPointer < 2500;
        if (!busy) {
          var r = Math.random();
          if (r < 0.25) { blink(); if (Math.random() < 0.3) setTimeout(blink, 420); }
          else {
            var a = spots[Math.floor(Math.random() * spots.length)]; move(a[0], a[1]);
            if (Math.random() < 0.4) setTimeout(blink, 500);
            setTimeout(function () { if (Date.now() - lastPointer > 2500) move(0, 0); }, 900 + Math.random() * 900);
          }
        }
        setTimeout(step, wait);
      }
      setTimeout(step, 1600);
    })();
    var seen = false; try { seen = sessionStorage.getItem('milo-nudge') === '1'; } catch (e) { seen = false; }
    if (seen || window.innerWidth < 720) return;
    nudge = el('div', 'milo-nudge'); nudge.setAttribute('role', 'status');
    var go = el('button', 'milo-nudge-go'); go.type = 'button'; go.innerHTML = 'Une question&nbsp;? <b>Demandez à Milo.</b>';
    var x = el('button', 'milo-nudge-x'); x.type = 'button'; x.setAttribute('aria-label', 'Masquer'); x.innerHTML = svgUse('ic', 'l-x');
    nudge.appendChild(go); nudge.appendChild(x); root.appendChild(nudge);
    go.addEventListener('click', function () { open(); }); x.addEventListener('click', hideNudge);
    var hero = d.querySelector('.hero'), shown = false;
    var check = function () {
      if (shown || window.scrollY < (hero ? hero.offsetHeight * 0.8 : 700)) return;
      shown = true; window.removeEventListener('scroll', check);
      setTimeout(function () { if (!root.classList.contains('is-open')) { nudge.classList.add('show'); blink(); setTimeout(hideNudge, 8000); } }, 1000);
    };
    window.addEventListener('scroll', check, { passive: true });
  }
  window.addEventListener('bridge:intro', ready);
  setTimeout(ready, motion ? 6500 : 0);

  window.Milo = {
    open: function () { open(); },
    close: close,
    ask: function (text) { open(false); if (busy) return; send(text); }
  };
})();
