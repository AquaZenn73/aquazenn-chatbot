require('dotenv').config();

const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 7860;
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

// ========== CORS - TON DOMAINE SHOPIFY ==========
const ALLOWED_ORIGINS = [
  'https://aquazenn.fr',
  'https://www.aquazenn.fr'
  // Ajoute ici ton domaine myshopify si tu testes en preview:
  // 'https://ton-shop.myshopify.com'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    const allowed = ALLOWED_ORIGINS.some(o => {
      if (o.includes('*')) {
        const regex = new RegExp('^' + o.replace(/\*/g, '.*') + '$');
        return regex.test(origin);
      }
      return o === origin;
    });
    if (allowed) {
      callback(null, true);
    } else {
      console.warn('CORS bloque:', origin);
      callback(null, false);
    }
  },
  methods: ['POST', 'GET'],
  allowedHeaders: ['Content-Type']
}));

app.use(express.json({ limit: '1mb' }));

// ========== FAQ LOCALE (gratuit, instantané) ==========
const FAQ = {
  'media filtrant': {
    reponse: '**Média filtrant — Durée de vie :**\n🟤 Sable : **3-5 ans**\n🔵 Verre : **8-10 ans**\n⚪ Zéolite : **5-7 ans**\n\nRemplacez quand : pression ↑, rétrolavages fréquents, eau trouble persistante.',
    mots: ['sable', 'verre', 'filtrant', 'filtre', 'zéolite', 'media', 'filtration']
  },
  'ph': {
    reponse: '**pH idéal : 7.2 - 7.4**\n\n🔴 Trop bas (< 7.0) : yeux irrités, corrosion\n🔵 Trop haut (> 7.6) : chlore inactif\n\n🛠️ pH+ : carbonate de sodium | pH- : acide sulfurique dilué',
    mots: ['ph', 'acid', 'basique', 'alcalin']
  },
  'chlore': {
    reponse: '**Désinfection :**\n🟡 Chlore (piscine extérieur) : **1-3 mg/L**\n🔵 Brome (spa, moins d\'odeurs) : **2-4 mg/L**\n🟢 Oxygène actif : sans chlore, biodégradable\n\nTestez 2x/semaine minimum !',
    mots: ['chlore', 'brome', 'desinfect', 'oxydant', 'traitement', 'desinfection']
  },
  'eau verte': {
    reponse: '**Eau verte = algues !** 🦠\n\n1️⃣ Choc chlore (10x la dose normale)\n2️⃣ Brosser parois + fond\n3️⃣ Filtrer minimum 24h\n4️⃣ Vérifier pH (7.0-7.4)\n\n⚠️ Cause : filtration insuffisante ou chlore trop bas',
    mots: ['vert', 'algue', 'algues', 'eau verte']
  },
  'tarif': {
    reponse: '**Devis personnalisé AquaZenn :**\n\n📧 contact@aquazenn.fr\n📞 [ton numéro]\n\nIntervention sur **Chambéry et 30km alentours**',
    mots: ['prix', 'tarif', 'devis', 'combien', 'coute', 'cout'],
    forceContact: true
  }
};

function trouverFAQ(message) {
  const m = message.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  for (const [cle, data] of Object.entries(FAQ)) {
    if (data.mots.some(mot => m.includes(mot))) {
      return data;
    }
  }
  return null;
}

// ========== RATE LIMITER SIMPLE ==========
const requetesParIP = new Map();

function checkRateLimit(ip) {
  const maintenant = Date.now();
  const historique = (requetesParIP.get(ip) || []).filter(t => maintenant - t < 60000);
  if (historique.length >= 15) return false;
  historique.push(maintenant);
  requetesParIP.set(ip, historique);
  return true;
}

setInterval(() => {
  const maintenant = Date.now();
  for (const [ip, temps] of requetesParIP.entries()) {
    if (temps.every(t => maintenant - t > 60000)) {
      requetesParIP.delete(ip);
    }
  }
}, 600000);

// ========== ROUTES ==========

// Health check
app.get('/', (req, res) => {
  res.json({
    status: 'AquaZenn API en ligne',
    version: '2.0',
    timestamp: new Date().toISOString()
  });
});

// Chat API principal
app.post('/api/chat', async (req, res) => {
  const { message, messages, model } = req.body || {};

  // Rate limit
  const clientIP = req.headers['x-forwarded-for']?.split(',')[0] || req.ip;
  if (!checkRateLimit(clientIP)) {
    return res.status(429).json({
      error: 'Trop de requêtes. Patientez une minute.',
      fallback: 'contact@aquazenn.fr'
    });
  }

  // Clé API Groq présente ?
  if (!process.env.GROQ_API_KEY) {
    return res.status(500).json({
      error: 'Clé API manquante',
      fallback: 'Service temporairement indisponible. Email : contact@aquazenn.fr'
    });
  }

  let messagesPourGroq = [];

  // Format 1 : tableau de messages (ton ancien format)
  if (Array.isArray(messages) && messages.length > 0) {
    messagesPourGroq = messages
      .filter(m => m && ['system', 'user', 'assistant'].includes(m.role))
      .map(m => ({
        role: m.role,
        content: String(m.content || '').slice(0, 12000)
      }))
      .filter(m => m.content.trim());

    if (!messagesPourGroq.length) {
      return res.status(400).json({ error: 'Aucun message valide.' });
    }

  // Format 2 : message simple (Shopify) avec FAQ
  } else if (typeof message === 'string' && message.trim()) {
    const faq = trouverFAQ(message);

    if (faq && !faq.forceContact) {
      console.log('✅ FAQ:', message.substring(0, 40));
      return res.json({
        source: 'faq',
        message: { role: 'assistant', content: faq.reponse },
        instant: true
      });
    }

    messagesPourGroq = [
      {
        role: 'system',
        content: 'Tu es AquaZenn, expert piscine et spa à Chambéry depuis 15 ans. Réponses courtes (max 100 mots), ton professionnel mais chaleureux. Hors sujet piscine/spa : redirige poliment vers contact@aquazenn.fr. Jamais de diagnostic définitif sans visite.'
      },
      { role: 'user', content: message.trim().slice(0, 500) }
    ];

  } else {
    return res.status(400).json({ error: 'message ou messages requis.' });
  }

  // Appel Groq
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const groqResponse = await fetch(GROQ_API_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: model || DEFAULT_MODEL,
        messages: messagesPourGroq,
        temperature: 0.7,
        max_tokens: 1024
      })
    });

    clearTimeout(timeout);

    const data = await groqResponse.json();

    if (!groqResponse.ok) {
      const detail = data?.error?.message || 'Erreur Groq';
      console.error('Groq erreur:', detail);

      const lastMsg = message || messages?.[messages.length - 1]?.content || '';
      const faq = trouverFAQ(lastMsg);
      return res.status(200).json({
        source: 'fallback',
        message: {
          role: 'assistant',
          content: faq?.reponse || 'Service momentanément perturbé. Contactez contact@aquazenn.fr — réponse sous 2h.'
        },
        error: detail
      });
    }

    const reply = data.choices?.[0]?.message;
    if (!reply?.content) {
      throw new Error('Réponse vide de Groq');
    }

    return res.json({
      source: 'groq',
      message: { role: 'assistant', content: reply.content },
      model: data.model || model || DEFAULT_MODEL,
      usage: data.usage || null
    });

  } catch (error) {
    console.error('Erreur chat:', error.message);

    const lastMsg = message || messages?.[messages.length - 1]?.content || '';
    const faq = trouverFAQ(lastMsg);
    return res.json({
      source: 'error-fallback',
      message: {
        role: 'assistant',
        content: faq?.reponse || '⚠️ Connexion limitée.\n\nConseils rapides :\n• pH idéal : 7.2-7.4\n• Chlore : 1-3 mg/L\n• Eau verte = choc chlore x10\n• Sable filtrant : 3-5 ans\n\n📧 contact@aquazenn.fr'
      }
    });
  }
});

// Route legacy /chat (redirection)
app.post('/chat', (req, res) => {
  req.url = '/api/chat';
  app._router.handle(req, res);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 AquaZenn API en ligne sur port ${PORT}`);
  console.log(`🔗 CORS autorisés: ${ALLOWED_ORIGINS.join(', ')}`);
});
