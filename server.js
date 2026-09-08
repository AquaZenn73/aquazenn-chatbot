// ========== /api/chat ==========
app.post('/api/chat', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  try {
    const { message } = req.body;
    console.log('→ Message reçu:', message);

    // VÉRIFICATION clé
    if (!GROQ_KEY || !GROQ_KEY.startsWith('gsk_')) {
      console.error('CLÉ MANQUANTE OU INVALIDE');
      return res.json({
        reply: '🔧 Configuration API en cours...',
        source: 'config-error'
      });
    }

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',  // ou 'mixtral-8x7b-32768'
        messages: [
          {
            role: 'system',
            content: 'Tu es un expert aquarium. Réponds en français, concis, utile.'
          },
          {
            role: 'user',
            content: message  // ← le message de l'utilisateur
          }
        ],
        max_tokens: 500,
        temperature: 0.7
      })
    });

    console.log('← Groq status:', response.status);
    const responseText = await response.text();
    console.log('← Groq raw:', responseText.substring(0, 200));

    if (response.status === 400) {
      console.error('PAYLOAD INVALIDE:', responseText);
      return res.json({
        reply: '❌ Erreur de requête. Contactez le support.',
        source: 'groq-400',
        detail: responseText
      });
    }

    if (!response.ok) {
      throw new Error(`Groq ${response.status}: ${responseText.substring(0, 200)}`);
    }

    const data = JSON.parse(responseText);
    const reply = data.choices?.[0]?.message?.content || 'Réponse vide';

    res.json({ reply, source: 'AquaZenn AI' });

  } catch (err) {
    console.error('💥 Erreur:', err.message);
    // IMPORTANT: toujours renvoyer du JSON valide
    res.json({
      reply: '⚠️ Service temporairement indisponible.',
      source: 'error',
      detail: err.message
    });
  }
});
