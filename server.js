// ============================================
// AQUAZENN CHATBOT API - V2 GROQ + FAQ
// ============================================

const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 7860;

// ============================================
// FAQ LOCALE (gratuit, pas d'appel API)
// ============================================

const FAQ = {
    'media filtrant|sable|verre filtrant|zéolite|zeolite': {
        reponse: '**Média filtrant :**\n🟤 Sable : 3-5 ans\n🔵 Verre : 8-10 ans\n⚪ Zéolite : 5-7 ans\n\nRemplacez quand : pression ↑, rétrolavages fréquents, eau trouble persistante.',
        categorie: 'filtration'
    },
    'ph|acidité|basique|ph\\+|ph-': {
        reponse: '**pH idéal : 7.2 - 7.4**\n\n🔴 Trop bas (< 7.0) : yeux irrités, corrosion\n🔵 Trop haut (> 7.6) : chlore inactif, dépôts\n\n🛠️ Ajustement :\n• pH+ : carbonate de sodium\n• pH- : acide sulfurique dilué',
        categorie: 'chimie'
    },
    'chlore|desinfecter|desinfection|brome|oxygène actif': {
        reponse: '**Désinfection :**\n🟡 Chlore (piscine extérieur) : 1-3 mg/L\n🔵 Brome (spa/couvert) : 2-4 mg/L, moins d\'odeurs\n🟢 Oxygène actif : sans chlore, biodégradable\n\nTestez 2x/semaine minimum !',
        categorie: 'chimie'
    },
    'eau verte|algue|algues|eau turquoise': {
        reponse: '**Eau verte = algues !** 🦠\n\n1️⃣ Choc de chlore (10x dose normale)\n2️⃣ Brosser parois + fond\n3️⃣ Filtrer minimum 24h\n4️⃣ Vérifier pH (7.0-7.4)\n5️⃣ Algicide si persistance\n\n⚠️ Cause : filtration insuffisante ou chlore trop bas',
        categorie: 'probleme'
    },
    'eau trouble|trouble|laiteuse|opalescente': {
        reponse: '**Eau trouble — Diagnostic :**\n1. pH correct ? (7.2-7.4)\n2. Chlore suffisant ? (> 1 mg/L)\n3. Filtration assez longue ? (6-8h/j)\n4. Média filtrant propre ?\n\n💡 Floculant si particules en suspension\n🔄 Rétrolavage si pression pompe élevée',
        categorie: 'probleme'
    },
    'pompe|pompe à eau|débit|vitesse|inverter|filtration': {
        reponse: '**Choisir une pompe :**\n\n📐 Débit minimum = volume piscine ÷ 4 (en 4h)\nExemple : 40m³ → 10m³/h minimum\n\n⚡ Inverter = vitesse variable, -60% énergie\n💰 Investissement amorti en 2-3 ans\n\n🔗 Vérifier compatibilité filtre (débit max)',
        categorie: 'materiel'
    },
    'hiverner|hivernage|hiver|protection': {
        reponse: '**Hivernage piscine :**\n🧪 Chlore choc + pH 7.2 avant fermeture\n🫧 Baisse niveau eau (skimmers)\n🛡️ Bâche d\'hiver opaque + fixes\n🌡️ Vider tout équipement (casse gel)\n\n❄️ Actif si température < 10°C constamment',
        categorie: 'saison'
    },
    'réchauffer|chauffer|température|chaleur|pac|solaire': {
        reponse: '**Chauffer sa piscine :**\n🌞 Solaire : gratuit aprés investissement, +2-4°C\n⚡ PAC (pompe à chaleur) : efficace 15-28°C ext\n🔥 Échangeur gaz : rapide, coûteux\n🛁 Enrouleur + bâche à bulles : économise 30% pertes',
        categorie: 'materiel'
    },
    'coût|économie|énergie|électrique|facture': {
        reponse: '**Réduire sa facture piscine :**\n1. Pompe inverter (vitesse variable)\n2. Bâche à bulles + enrouleur\n3. LED (vs halogène)\n4. Filtration nuit (heures creuses)\n5. Nettoyage robot vs aspiration manuelle\n\n💰 Économie : 40-60% sur la saison',
        categorie: 'materiel'
    }
};

function trouverFAQ(question) {
    const q = question.toLowerCase().replace(/[àáâãäå]/g, 'a').replace(/[èéêë]/g, 'e').replace(/[ìíîï]/g, 'i').replace(/[òóôõö]/g, 'o').replace(/[ùúûü]/g, 'u').replace(/ç/g, 'c');
    
    for (const [pattern, data] of Object.entries(FAQ)) {
        const regex = new RegExp(pattern, 'i');
        if (regex.test(q)) {
            return { ...data, source: 'faq' };
        }
    }
    return null;
}

// ============================================
// MIDDLEWARE
// ============================================

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type']
}));

app.use(express.json({ limit: '10kb' }));

// Anti-spam simple
const requêtes = new Map();
function rateLimit(ip) {
    const now = Date.now();
    const windowMs = 10000; // 10 secondes
    const maxReq = 5;
    
    if (!requêtes.has(ip)) {
        requêtes.set(ip, []);
    }
    
    const userReqs = requêtes.get(ip).filter(t => now - t < windowMs);
    requêtes.set(ip, userReqs);
    
    if (userReqs.length >= maxReq) {
        return false;
    }
    userReqs.push(now);
    return true;
}

// Nettoyage périodique
setInterval(() => {
    const now = Date.now();
    for (const [ip, times] of requêtes) {
        if (now - times[times.length - 1] > 60000) requêtes.delete(ip);
    }
}, 60000);

// ============================================
// ROUTES
// ============================================

app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        groq: process.env.GROQ_API_KEY ? 'configuré' : 'non configuré',
        time: new Date().toISOString()
    });
});

app.post('/api/chat', async (req, res) => {
    const clientIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    
    // Rate limit check
    if (!rateLimit(clientIP)) {
        return res.status(429).json({
            reply: '⏳ Trop de messages. Attends 10 secondes.',
            source: 'ratelimit'
        });
    }

    const { message, history = [] } = req.body;
    
    if (!message || typeof message !== 'string') {
        return res.json({
            reply: '❓ Pose-moi une question sur ta piscine !',
            source: 'validation'
        });
    }

    const question = message.trim();
    if (question.length > 500) {
        return res.json({
            reply: '📝 Question trop longue (max 500 caractères).',
            source: 'validation'
        });
    }

    console.log(`[${new Date().toLocaleTimeString()}] ${clientIP}: "${question.slice(0, 80)}"`);

    // 1. VÉRIFICATION FAQ (instantanée)
    const faq = trouverFAQ(question);
    if (faq) {
        console.log('  → FAQ match:', faq.categorie);
        return res.json({
            reply: faq.reponse,
            source: 'faq',
            categorie: faq.categorie
        });
    }

    // 2. SANS CLÉ GROQ → réponse template
    if (!process.env.GROQ_API_KEY) {
        console.log('  → pas de clé Groq');
        return res.json({
            reply: '🔧 **besoin d\'un conseil personnalisé ?**\n\nNos experts répondent rapidement :\n📧 contact@aquazenn.fr\n⏰ Lun-Ven : 8h-19h\n\nJe peux aussi t\'aider sur : pH, chlore, filtration, hivernage...',
            source: 'no-api-key',
            categories: ['chimie', 'filtration', 'probleme', 'materiel', 'saison']
        });
    }

    // 3. APPEL GROQ (avec timeout 15s + retry)
    const systemPrompt = `Tu es AquaZenn, expert piscine et spa depuis 15 ans. 
Règles :
- Réponses courtes (3-6 lignes), précises, actionnables
- Un emoji par ligne si pertinent
- Si tu ne sais pas, suggère contact@aquazenn.fr
- Ton : professionnel mais accessible, jamais robotique
- Contexte : piscines résidentielles en France`;

    const messages = [
        { role: 'system', content: systemPrompt },
        ...history.slice(-3), // max 3 messages d'historique
        { role: 'user', content: question }
    ];

    let lastError = null;
    
    // 1 tentative + 1 retry
    for (let attempt = 1; attempt <= 2; attempt++) {
        try {
            console.log(`  → Groq tentative ${attempt}...`);
            
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout

            const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'llama3-70b-8192',
                    messages: messages,
                    temperature: 0.6,
                    max_tokens: 500,
                    timeout_ms: 12000
                }),
                signal: controller.signal
            });

            clearTimeout(timeout);

            if (!response.ok) {
                const errorBody = await response.json().catch(() => ({}));
                throw new Error(`Groq HTTP ${response.status}: ${errorBody.error?.message || response.statusText}`);
            }

            const data = await response.json();
            const reply = data.choices?.[0]?.message?.content?.trim();

            if (!reply) {
                throw new Error('Réponse vide de Groq');
            }

            console.log('  → Groq OK');
            return res.json({
                reply: reply,
                source: 'groq',
                model: 'llama3-70b'
            });

        } catch (err) {
            lastError = err;
            console.log(`  → Échec tenta[...]mateur')
    });

    console.log(`🚀 Serveur AquaZenn prêt sur port ${PORT}`);
});
