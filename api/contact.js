// Formulaire de contact de Bridge — fonction serverless Vercel (Node.js 18+)
// Emplacement : api/contact.js. Reçoit le formulaire du site et le transmet à l'agence (n8n), à HubSpot et/ou par e-mail.
// Tant qu'aucun service n'est configuré, la fonction répond 501 et le site ouvre la messagerie du visiteur.
//
// Variables d'environnement (Vercel → Settings → Environment Variables) :
//   HUBSPOT_PORTAL_ID   identifiant du compte HubSpot (Hub ID)
//   HUBSPOT_FORM_ID     identifiant (GUID) d'un formulaire HubSpot avec les champs email, firstname et message
//   HUBSPOT_REGION      facultatif — « eu1 » par défaut (compte hébergé en Europe), « na1 » sinon
//   RESEND_API_KEY      facultatif — envoi d'un e-mail par Resend (resend.com)
//   CONTACT_TO          adresse qui reçoit les demandes (avec Resend)
//   CONTACT_FROM        expéditeur vérifié chez Resend, par exemple « Bridge <site@bridge-agency.eu> »
//   LEAD_WEBHOOK_URL    facultatif — webhook « HubSpot - Lead capture » de l'agence, par exemple https://n8n.bridge-agency.eu/webhook/leads
//   LEAD_WEBHOOK_TOKEN  jeton de ce webhook (identique à la credential n8n « Lead webhook token »)
//   LEAD_WEBHOOK_HEADER facultatif — nom de l'en-tête du jeton, « X-Lead-Token » par défaut
//   ALLOWED_ORIGINS     facultatif — origines autorisées, séparées par des virgules
//
// Contrat : POST { name, email, need, message?, website? } → 200 { ok: true } | 4xx/5xx { error: code }

'use strict';

const DEFAULT_ORIGINS = ['https://bridge-agency.eu', 'https://www.bridge-agency.eu'];
const MAX_BODY_BYTES = 8000;
const PER_HOUR = 6; // par visiteur
const TIMEOUT_MS = 8000;
const EMAIL_RE = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]{2,}$/;

function send(res, status, payload, extraHeaders) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (extraHeaders) Object.keys(extraHeaders).forEach((k) => res.setHeader(k, extraHeaders[k]));
  return res.status(status).json(payload);
}

function logEvent(evt, data) {
  // Aucun contenu du formulaire n'est journalisé : uniquement des codes techniques.
  console.warn(JSON.stringify(Object.assign({ evt }, data || {})));
}

function cleanText(value) {
  return String(value == null ? '' : value)
    .normalize('NFC')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/[​-‏‪-‮⁦-⁩﻿]/g, '')
    .replace(/\r\n?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const oneLine = (value) => cleanText(value).replace(/\s+/g, ' ');

function originAllowed(req) {
  const origin = req.headers.origin;
  if (!origin) return false;
  const list = (process.env.ALLOWED_ORIGINS || DEFAULT_ORIGINS.join(',')).split(',').map((s) => s.trim()).filter(Boolean);
  if (list.includes(origin)) return true;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  try { return Boolean(host) && new URL(origin).host === host; } catch (e) { return false; }
}

function clientIp(req) {
  const fwd = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return fwd || String(req.headers['x-real-ip'] || '') || (req.socket && req.socket.remoteAddress) || 'unknown';
}

// Limitation en mémoire : au mieux, chaque instance serverless a son propre compteur.
const memory = new Map();
function tooMany(key) {
  const now = Date.now();
  let entry = memory.get(key);
  if (!entry || entry.reset <= now) { entry = { count: 0, reset: now + 3600 * 1000 }; memory.set(key, entry); }
  entry.count += 1;
  if (memory.size > 2000) for (const [k, v] of memory) if (v.reset <= now) memory.delete(k);
  return entry.count > PER_HOUR;
}

function validate(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'invalid_request' };
  const name = oneLine(body.name), email = oneLine(body.email), need = oneLine(body.need), message = cleanText(body.message);
  if (!name || name.length > 60) return { error: 'invalid_name' };
  if (!EMAIL_RE.test(email) || email.length > 120) return { error: 'invalid_email' };
  if (!need || need.length > 120) return { error: 'invalid_need' };
  if (message.length > 1500) return { error: 'message_too_long' };
  return { data: { name, email, need, message }, trap: Boolean(cleanText(body.website)) };
}

async function post(url, headers, payload) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, headers), body: JSON.stringify(payload), signal: ctrl.signal });
    return r.ok;
  } catch (e) {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

function hubspotRequest(d, env) {
  const host = (env.HUBSPOT_REGION || 'eu1') === 'na1' ? 'api.hsforms.com' : 'api-' + (env.HUBSPOT_REGION || 'eu1') + '.hsforms.com';
  return {
    url: 'https://' + host + '/submissions/v3/integration/submit/' + encodeURIComponent(env.HUBSPOT_PORTAL_ID) + '/' + encodeURIComponent(env.HUBSPOT_FORM_ID),
    headers: {},
    payload: {
      fields: [
        { objectTypeId: '0-1', name: 'email', value: d.email },
        { objectTypeId: '0-1', name: 'firstname', value: d.name },
        { objectTypeId: '0-1', name: 'message', value: 'Besoin : ' + d.need + (d.message ? '\n\n' + d.message : '') },
      ],
      context: { pageUri: 'https://bridge-agency.eu/#contact', pageName: 'Bridge · formulaire de contact' },
    },
  };
}

function resendRequest(d, env) {
  return {
    url: 'https://api.resend.com/emails',
    headers: { Authorization: 'Bearer ' + env.RESEND_API_KEY },
    payload: {
      from: env.CONTACT_FROM,
      to: [env.CONTACT_TO],
      reply_to: d.email,
      subject: 'Demande depuis le site : ' + d.need,
      text: 'Prénom : ' + d.name + '\nEmail : ' + d.email + '\nBesoin : ' + d.need + '\n\n' + (d.message || '(pas de message)'),
    },
  };
}

// Texte affiché sous le formulaire au moment de l'envoi : il sert de preuve de ce qui a été accepté.
const FORM_NOTICE = 'Vos coordonnées ne servent qu’à vous répondre.';

function agencyRequest(d, env) {
  return {
    url: env.LEAD_WEBHOOK_URL,
    headers: { [env.LEAD_WEBHOOK_HEADER || 'X-Lead-Token']: env.LEAD_WEBHOOK_TOKEN },
    payload: {
      source: 'website_form', email: d.email, first_name: d.name,
      message: 'Besoin : ' + d.need + (d.message ? '\n\n' + d.message : ''),
      consent: true, page_url: 'https://bridge-agency.eu/#contact', form_id: 'contact', consent_text_version: FORM_NOTICE,
    },
  };
}

function channels(env) {
  const list = [];
  if (env.LEAD_WEBHOOK_URL && env.LEAD_WEBHOOK_TOKEN && /^https:\/\//.test(env.LEAD_WEBHOOK_URL)) list.push(['agency', agencyRequest]);
  if (env.HUBSPOT_PORTAL_ID && env.HUBSPOT_FORM_ID) list.push(['hubspot', hubspotRequest]);
  if (env.RESEND_API_KEY && env.CONTACT_TO && env.CONTACT_FROM) list.push(['resend', resendRequest]);
  return list;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'method_not_allowed' }, { Allow: 'POST' });
  if (!originAllowed(req) || String(req.headers['sec-fetch-site'] || '') === 'cross-site') return send(res, 403, { error: 'forbidden' });
  if (!/application\/json/i.test(String(req.headers['content-type'] || ''))) return send(res, 415, { error: 'invalid_request' });
  if (Number(req.headers['content-length'] || 0) > MAX_BODY_BYTES) return send(res, 413, { error: 'message_too_long' });

  let body = req.body;
  if (typeof body === 'string') {
    if (Buffer.byteLength(body) > MAX_BODY_BYTES) return send(res, 413, { error: 'message_too_long' });
    try { body = JSON.parse(body); } catch (e) { body = null; }
  } else if (body && Buffer.byteLength(JSON.stringify(body)) > MAX_BODY_BYTES) {
    return send(res, 413, { error: 'message_too_long' });
  }

  const checked = validate(body);
  if (checked.error) return send(res, 400, { error: checked.error });
  // Champ piège rempli : un robot. On répond comme si tout allait bien, sans rien transmettre.
  if (checked.trap) return send(res, 200, { ok: true });

  const todo = channels(process.env);
  if (!todo.length) return send(res, 501, { error: 'not_configured' });
  if (tooMany(clientIp(req))) return send(res, 429, { error: 'rate_limited' }, { 'Retry-After': '3600' });

  const results = await Promise.all(todo.map(([name, build]) => {
    const r = build(checked.data, process.env);
    return post(r.url, r.headers, r.payload).then((ok) => { if (!ok) logEvent('contact_delivery_error', { channel: name }); return ok; });
  }));
  // Une seule livraison réussie suffit : la demande est arrivée quelque part.
  if (!results.some(Boolean)) return send(res, 502, { error: 'unavailable' });
  return send(res, 200, { ok: true });
};

// Exposé uniquement pour les tests automatisés (tests/contact.test.mjs).
module.exports._internals = { validate, channels, agencyRequest, hubspotRequest, resendRequest, originAllowed };
