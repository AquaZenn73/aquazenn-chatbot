// ============================================
// AQUAZENN CHATBOT API - Railway
// ============================================

const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 7860;
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

// ============================================
// CORS - TRÈS IMPORTANT, MET ÇA EN PREMIER !
// ============================================

const allowedOrigins = [
    'https://aquazenn.fr',
    'https://www.aquazenn.fr',
    'https://aquazenn.myshopify.com',
    'http://localhost:3000',
    'http://localhost:5000'
];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            console.log('CORS bloqué pour:', origin);
            callback(null, false);
        }
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    optionsSuccessStatus: 204
}));

// Gestion spéciale pour les requêtes OPTIONS (preflight)
app.options('*', cors());

// ============================================
// BODY PARSER (APRÈS CORS !)
// ============================================

app.use(express.json({ limit: '10mb' }));

// ============================================
// ROUTE TEST - pour vérifier que CORS marche
// ============================================

app.get('/test-cors', (req, res) => {
    res.json({
        ok: true,
        message: 'CORS fonctionne !',
        votreOrigin: req.headers.origin || 'aucune'
    });
});

// ============================================
// ROUTE ACCUEIL
// ============================================

app.get('/', (req, res) => {
    res.json({
        status: 'AquaZenn API en ligne',
        endpoints: ['/api/chat', '/test-cors'],
        timestamp: new Date().toISOString()
    });
});

// ============================================
// ROUTE API CHAT
// ============================================

app.post('/api/chat', async (req, res) => {
    console.log('-> Requête de:', req.headers.origin);
    console.log('-> Body:', req.body);

    try {
        const { message } = req.body;

        if (!message || typeof message !== 'string') {
            return res.status(400).json({
                error: 'Champ "message" requis (string)'
            });
        }

        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) {
            throw new Error('Clé API Groq manquante');
        }

        const groqResponse = await fetch(GROQ_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: DEFAULT_MODEL,
                messages: [
                    {
                        role: 'system',
                        content: 'Tu es AquaZenn, assistant IA spécialisé en traitement de l\'eau, adoucisseurs, piscines et bien-être. Réponds en français de façon concise et professionnelle. Limite tes réponses à 3 phrases maximum.'
                    },
                    { role: 'user', content: message }
                ],
                temperature: 0.7,
                max_tokens: 1024
            })
        });

        if (!groqResponse.ok) {
            const errorText = await groqResponse.text();
            throw new Error(`Groq API ${groqResponse.status}: ${errorText}`);
        }

        const groqData = await groqResponse.json();
        const reply = groqData.choices?.[0]?.message?.content || 'Désolé, pas de réponse.';

        console.log('-> Réponse envoyée');

        res.json({
            reply: reply,
            source: 'groq',
            timestamp: new Date().toISOString()
        });

    } catch (err) {
        console.error('Erreur:', err.message);

        res.status(200).json({
            reply: 'Désolé, je rencontre un problème technique. Contactez contact@aquazenn.fr',
            error: err.message,
            fallback: true
        });
    }
});

// ============================================
// GESTION ERREUR 404
// ============================================

app.use((req, res) => {
    res.status(404).json({
        error: 'Route non trouvée',
        path: req.path
    });
});

// ============================================
// LANCEMENT
// ============================================

app.listen(PORT, () => {
    console.log('Serveur AquaZenn lancé sur port ' + PORT);
    console.log('Origines autorisées:', allowedOrigins);
});
