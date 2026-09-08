const express = require('express');
const cors = require('cors');

const app = express();

// CORS - AUTORISE SEULEMENT TON DOMAINE
const allowedOrigins = [
  'https://aquazenn.fr',
  'https://www.aquazenn.fr',
  'http://localhost:3000'  // pour test local
];

app.use(cors({
  origin: function(origin, callback) {
    // allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      return callback(new Error('CORS policy violation'), false);
    }
    return callback(null, true);
  },
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));

// ============ CONFIG ============
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = 'llama3-8b-8192';
// ============ HEALTH CHECK ============
app.get('/health', (req, res) => {
  res.json({ 
    ok: true, 
    key_present: !!GROQ_API_KEY,
    timestamp: new Date().toISOString()
  });
});

// ============ CHAT API ============
app.post('/api/chat', async (req, res) => {
  console.log('📩 Requête reçue:', new Date().toISOString());
  console.log('Body:', JSON.stringify(req.body).substring(0, 200));

  // Vérification clé API
  if (!GROQ_API_KEY) {
    console.error('❌ CLÉ API MANQUANTE');
    return res.status(500).json({ 
      error: 'Configuration serveur incorrecte',
      details: 'GROQ_API_KEY manquante'
    });
  }

  const { message, history = [] } = req.body;
  
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ 
      error: 'Message requis (string)' 
    });
  }

  try {
    // Appel API Groq
    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          {
            role: 'system',
            content: `Tu es AquaBot, expert en pompes et équipement piscine pour Aquazenn. 
Conseille sur le choix de pompes de filtration, pompes à chaleur, surpresseurs.
Sois concis, professionnel, orienté vente. 
Produits disponibles: pompe Silensor, Aqua Plus, Max Flo, IntelliFlo variable.`
          },
          ...history.slice(-6),  // garde les 6 derniers messages pour contexte
          { role: 'user', content: message }
        ],
        temperature: 0.7,
        max_tokens: 1024
      })
    });

    const data = await groqResponse.json();
    console.log('Groq status:', groqResponse.status);

    if (!groqResponse.ok) {
      console.error('❌ Erreur Groq:', data);
      return res.status(502).json({
        error: 'Erreur API Groq',
        details: data.error?.message || 'Unknown'
      });
    }

    if (!data.choices || !data.choices[0]) {
      return res.status(502).json({
        error: 'Réponse Groq invalide',
        details: data
      });
    }

    const reply = data.choices[0].message.content;
    console.log('✅ Réponse envoyée:', reply.substring(0, 100) + '...');

    res.json({ 
      reply,
      model: GROQ_MODEL,
      usage: data.usage 
    });

  } catch (error) {
    console.error('❌ Catch:', error.message);
    res.status(500).json({
      error: 'Erreur serveur',
      details: error.message
    });
  }
});

// ============ ERREUR CORS ============
app.use((err, req, res, next) => {
  if (err.message === 'CORS policy violation') {
    console.error('CORS bloqué pour:', req.headers.origin);
    return res.status(403).json({ error: 'Origin non autorisée' });
  }
  next(err);
});

// ============ DÉMARRAGE ============
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('🚀 Serveur AquaBot démarré');
  console.log('Port:', PORT);
  console.log('Clé API:', GROQ_API_KEY ? '✅ Présente' : '❌ MANQUANTE');
  console.log('Origines autorisées:', allowedOrigins);
});
