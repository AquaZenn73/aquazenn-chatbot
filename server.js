// ============================================
// AQUAZENN CHATBOT API - DEBUG MODE
// ============================================

const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 7860;

// DEBUG : log toutes les variables d'environnement (masque la clé API)
console.log('=== DÉMARRAGE DEBUG ===');
console.log('PORT:', PORT);
console.log('GROQ_API_KEY présente:', process.env.GROQ_API_KEY ? 'OUI (' + process.env.GROQ_API_KEY.slice(0, 10) + '...)' : 'NON ❌');
console.log('NODE_ENV:', process.env.NODE_ENV || 'non défini');
console.log('=======================');

// ============================================
// CORS - Autorise tout en debug
// ============================================

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// ============================================
// MIDDLEWARE DEBUG - log chaque requête
// ============================================

app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} | Origin: ${req.headers.origin || 'aucun'}`);
    next();
});

// ============================================
// ROUTE TEST
// ============================================

app.get('/test-cors', (req, res) => {
    res.json({ 
        ok: true, 
        message: 'CORS fonctionne',
        groq_key_present: !!process.env.GROQ_API_KEY
    });
});

// ============================================
// ROUTE CHAT - VERSION DEBUG
// ============================================

app.post('/api/chat', async (req, res) => {
    console.log('--- /api/chat appelé ---');
    console.log('Body reçu:', req.body);
    console.log('User-Agent:', req.headers['user-agent']?.slice(0, 50));

    const { message, email, conversation_id } = req.body;

    if (!message) {
        console.log('❌ Erreur: message manquant');
        return res.status(400).json({ error: 'Message requis' });
    }

    // MODE TEST : si pas de clé Groq, répond sans appel API
    if (!process.env.GROQ_API_KEY) {
        console.log('⚠️ Pas de GROQ_API_KEY - mode test activé');
        return res.json({
            reply: `[MODE TEST] Serveur OK ! Message reçu : "${message}"\n\n⚠️ Ajoute GROQ_API_KEY dans Railway pour activer l'IA.`,
            source: 'debug-test',
            timestamp: new Date().toISOString()
        });
    }

    // MODE GROQ
    try {
        console.log('-> Appel Groq API...');
        
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
                messages: [
                    {
                        role: 'system',
                        content: 'Tu es AquaZenn, expert piscines. Réponds en français, concis, max 3 phrases.'
                    },
                    { role: 'user', content: message }
                ],
                temperature: 0.7,
                max_tokens: 500
            })
        });

        console.log('Status Groq:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.log('❌ Erreur Groq:', errorText);
            throw new Error(`Groq ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        const reply = data.choices?.[0]?.message?.content;
        
        console.log('✅ Réponse Groq:', reply?.slice(0, 100));

        res.json({
            reply: reply || 'Pas de réponse',
            source: 'groq',
            timestamp: new Date().toISOString()
        });

    } catch (err) {
        console.log('❌ Erreur catchée:', err.message);
        
        res.json({
            reply: `Erreur technique: ${err.message}. Réessaie ou contacte contact@aquazenn.fr`,
            error: err.message,
            source: 'error-fallback',
            timestamp: new Date().toISOString()
        });
    }
});

// ============================================
// LANCEMENT
// ============================================

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Serveur lancé sur port ${PORT}`);
});
