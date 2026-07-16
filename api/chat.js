// Chatbot Bridge — fonction serverless Vercel
// Emplacement : api/chat.js (à la racine du projet, à côté de index.html)
// Nécessite la variable d'environnement ANTHROPIC_API_KEY dans Vercel.

const SYSTEM_PROMPT = `Tu es l'assistant du site bridge-agency.eu, le site de Bridge, agence d'automatisation IA basée à Paris.
Bridge aide les TPE, PME et indépendants à automatiser tout ce qui leur fait perdre du temps, en connectant les outils qu'ils utilisent déjà.
Services : automatisation de processus (devis, factures, relances), agents IA et chatbots, intégration CRM, reporting automatisé.
Outils connectés : Make, n8n, Zapier, Anthropic, OpenAI, HubSpot, Notion, Airtable, Gmail, Slack, WhatsApp, Google Sheets, etc.

Règles :
- Réponds toujours en français, ton professionnel et accessible, sans jargon.
- Sois concis : 2 à 3 phrases maximum par réponse.
- Objectif : comprendre le besoin du visiteur, puis proposer l'audit gratuit de 30 minutes (visio ou téléphone, sans engagement) en donnant ce lien : https://meetings-eu1.hubspot.com/anas-ben-abdallah
- Ne donne jamais de prix : chaque projet est chiffré après l'audit gratuit, et le client connaît le montant exact avant de s'engager.
- Autres contacts si on te les demande : contact@bridge-agency.eu ou +33 1 87 66 79 13.
- Si la question est hors sujet, ramène poliment la conversation vers l'automatisation.`;

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  const { messages } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 20) {
    return res.status(400).json({ error: 'Requête invalide' });
  }

  // Nettoyage : rôles valides, contenu texte limité à 2000 caractères
  const clean = messages.map((m) => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: String(m.content || '').slice(0, 2000),
  }));

  // L'API exige que la conversation commence par un message "user"
  while (clean.length && clean[0].role !== 'user') clean.shift();
  if (!clean.length) {
    return res.status(400).json({ error: 'Requête invalide' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001', // ou 'claude-sonnet-4-6' pour des réponses plus élaborées
        max_tokens: 300,
        system: SYSTEM_PROMPT,
        messages: clean,
      }),
    });

    if (!response.ok) {
      const details = await response.text();
      console.error('Erreur API Anthropic :', response.status, details);
      return res.status(502).json({ error: 'Service momentanément indisponible' });
    }

    const data = await response.json();
    const reply =
      (data.content || []).find((b) => b.type === 'text')?.text || '';

    return res.status(200).json({ reply });
  } catch (err) {
    console.error('Erreur serveur :', err);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};
