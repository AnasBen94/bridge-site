/* Bridge — moteur du calculateur de ROI (sans dépendance, testable avec node --test).
   Toutes les valeurs sont des hypothèses saisies par le visiteur : c'est une simulation. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BridgeROI = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var WEEKS = 47; // semaines travaillées par an (52 moins 5 semaines de congés)
  var FIELDS = {
    people: { min: 1, max: 50, step: 1, def: 2 },
    hours: { min: 1, max: 25, step: 1, def: 5 },
    rate: { min: 15, max: 150, step: 1, def: 35 },
    share: { min: 10, max: 90, step: 5, def: 50 },
    invest: { min: 0, max: 50000, step: 250, def: 3000 },
    tools: { min: 0, max: 1000, step: 10, def: 50 }
  };

  function clampField(name, value) {
    var f = FIELDS[name];
    var v = Number(String(value).replace(',', '.'));
    if (!isFinite(v)) v = f.def;
    v = Math.min(f.max, Math.max(f.min, v));
    return Math.round(v / f.step) * f.step;
  }

  function normalize(input) {
    var out = {};
    Object.keys(FIELDS).forEach(function (k) { out[k] = clampField(k, input && input[k] != null ? input[k] : FIELDS[k].def); });
    return out;
  }

  function compute(input) {
    var p = normalize(input);
    var hours = p.people * p.hours * WEEKS * (p.share / 100);
    var value = hours * p.rate;
    var toolsYear = p.tools * 12;
    var monthlyNet = (value - toolsYear) / 12;
    var payback = monthlyNet > 0 ? p.invest / monthlyNet : Infinity;
    var base = p.invest + toolsYear;
    var roi12 = base > 0 ? (value - toolsYear - p.invest) / base * 100 : null;
    var net3 = value * 3 - toolsYear * 3 - p.invest;
    var cumulative = [];
    for (var m = 0; m <= 24; m++) cumulative.push(-p.invest + monthlyNet * m);
    return {
      input: p, hours: hours, days: hours / 7, value: value, toolsYear: toolsYear,
      monthlyNet: monthlyNet, payback: payback, roi12: roi12, net3: net3, cumulative: cumulative
    };
  }

  // Comparaison de scénarios : seule la part automatisable varie.
  function scenarios(input) {
    var p = normalize(input);
    var prudent = Math.max(FIELDS.share.min, Math.round(p.share / 2 / 5) * 5);
    var favorable = Math.min(FIELDS.share.max, Math.round(p.share * 1.5 / 5) * 5);
    return [
      { id: 'prudent', label: 'Prudent', share: prudent },
      { id: 'mine', label: 'Votre hypothèse', share: p.share },
      { id: 'favorable', label: 'Favorable', share: favorable }
    ].map(function (s) {
      var r = compute(Object.assign({}, p, { share: s.share }));
      return { id: s.id, label: s.label, share: s.share, yearNet: r.value - r.toolsYear, payback: r.payback };
    });
  }

  var KEYS = { people: 'p', hours: 'h', rate: 'c', share: 's', invest: 'i', tools: 't' };
  function toQuery(input) {
    var p = normalize(input);
    return Object.keys(KEYS).map(function (k) { return KEYS[k] + '=' + p[k]; }).join('&');
  }
  function fromQuery(search) {
    var params = {}, found = false;
    String(search || '').replace(/^\?/, '').split('&').forEach(function (pair) {
      var kv = pair.split('='); if (kv.length !== 2) return;
      Object.keys(KEYS).forEach(function (k) { if (KEYS[k] === kv[0]) { params[k] = decodeURIComponent(kv[1]); found = true; } });
    });
    return found ? normalize(params) : null;
  }

  function toCSV(input) {
    var r = compute(input), p = r.input;
    var rows = [
      ['Hypothèse ou résultat', 'Valeur'],
      ['Personnes concernées', p.people],
      ['Heures répétitives par personne et par semaine', p.hours],
      ['Coût horaire chargé (EUR)', p.rate],
      ['Part automatisable (%)', p.share],
      ['Investissement de départ (EUR)', p.invest],
      ['Abonnements des outils (EUR par mois)', p.tools],
      ['Heures récupérées par an', Math.round(r.hours)],
      ['Valeur de ce temps par an (EUR)', Math.round(r.value)],
      ['Gain net mensuel (EUR)', Math.round(r.monthlyNet)],
      ['Investissement rentabilisé en (mois)', isFinite(r.payback) ? r.payback.toFixed(1) : 'non rentable'],
      ['Retour sur 12 mois (%)', r.roi12 === null ? 'sans objet' : Math.round(r.roi12)],
      ['Gain net sur 3 ans (EUR)', Math.round(r.net3)],
      ['Note', 'Simulation fondée sur vos hypothèses, sans valeur d’engagement. Calcul sur ' + WEEKS + ' semaines travaillées.']
    ];
    return rows.map(function (row) { return row.map(function (c) { var s = String(c); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(';'); }).join('\r\n');
  }

  return { WEEKS: WEEKS, FIELDS: FIELDS, clampField: clampField, normalize: normalize, compute: compute, scenarios: scenarios, toQuery: toQuery, fromQuery: fromQuery, toCSV: toCSV };
});
