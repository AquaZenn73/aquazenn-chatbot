// ============================================
// AQUAZENN CHATBOT API - Railway
// ============================================

const express = require('express');
const cors = require('cors');

const app = express();

// ✅ CORS pour aquazenn.fr (et www si besoin)
const corsOptions = {
  origin: ['https://aquazenn.fr', 'https://www.aquazenn.fr'],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false
};

// Applique CORS à toutes les routes
app.use(cors(corsOptions));

// ✅ Gère explicitement le preflight OPTIONS
app.options('*', cors(corsOptions));

// Middleware JSON
app.use(express.json());

// ============================================
// TON API CHATBOT (garde ta logique existante)
// ============================================

app.post('/api/chat', async (req, res) => {
  const { message } = req.body;
  
  // ← Ta logique chatbot ici (OpenAI, etc.)
  // Exemple :
  const reply = `Réponse à : ${message}`;
  
  res.json({ reply });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// ============================================
// LANCEMENT SERVEUR
// ============================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`✅ Serveur Aquazenn lancé sur port ${PORT}`);
});
