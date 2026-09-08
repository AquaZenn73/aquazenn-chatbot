// ============================================
// AQUAZENN CHATBOT API — Railway
// ============================================

require('dotenv').config();

const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// ========== CORS — AUTORISE SHOPIFY ==========
const ALLOWED_ORIGINS = [
  'https://aquazenn.fr',
  'https://www.aquazenn.fr',
  'http://localhost:3000',
  'http://localhost:5173'
];

app.use(cors({
  origin: function (origin, callback) {
    // Autorise les requêtes sans origin (Postman, curl)
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) {
      return callback(null, true);
    }
    console.log('❌ CORS bloqué pour:', origin);
    callback(new Error('CORS non autorisé'));
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 200
}));

// Gestion explicite des requêtes OPTIONS (preflight)
app.options('*', cors());

// ========== MIDDLEWARE ==========
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ========== ROUTES ==========

// Health check
app.get('/', (req, res) => {
  res.json({ status: '✅ AquaZenn API en ligne' });
});

// Test CORS
app.get('/test', (req, res) => {
  res.json({ message: 'CORS OK', origin: req.headers.origin || 'no-origin' });
});

// ========== API CHAT ==========
app.post('/api/chat', async (req, res) => {
  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages requis (tableau)' });
    }

    // Appel Groq
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama3-8b-8192',
        messages: [
          {
            role: 'system',
            content: 'Tu es AquaZenn, un expert piscine et spa. Réponds en français, de façon concise et utile. Donne des conseils précis sur le traitement de l\'eau, l\'entretien, et le matériel.'
          },
          ...messages
        ],
        temperature: 0.7,
        max_tokens: 800
      })
    });

    if (!groqRes.ok) {
      throw new Error(`Groq error: ${groqRes.status}`);
    }

    const groqData = await groqRes.json();
    const reply = groqData.choices?.[0]?.message?.content || 'Désolé, pas de réponse.';

    res.json({
      reply: reply,
      source: 'groq'
    });

  } catch (err) {
    console.error('Erreur:', err.message);

    // Réponse de secours
    res.json({
      reply: '⚠️ Service temporairement surchargé. Réessayez dans quelques secondes.',
      source: 'error-fallback'
    });
  }
});

// ========== GESTION ERREURS ==========

// Route 404
app.use((req, res) => {
  res.status(404).json({ error: 'Route non trouvée' });
});

// Erreur globale
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Erreur serveur' });
});

// ========== DÉMARRAGE ==========
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 AquaZenn API sur le port ${PORT}`);
});
