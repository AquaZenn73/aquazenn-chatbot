require('dotenv').config();

const express = require('express');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 7860;
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

app.use(express.json({ limit: '1mb' }));
app.use(express.static('public'));

app.post('/api/chat', async (req, res) => {
  const { messages, model } = req.body || {};

  if (!process.env.GROQ_API_KEY) {
    return res.status(500).json({ error: 'GROQ_API_KEY is not configured on the server.' });
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages must be a non-empty array.' });
  }

  const safeMessages = messages
    .filter((message) => message && ['system', 'user', 'assistant'].includes(message.role))
    .map((message) => ({
      role: message.role,
      content: String(message.content || '').slice(0, 12000)
    }))
    .filter((message) => message.content.trim());

  if (!safeMessages.length) {
    return res.status(400).json({ error: 'No valid messages were provided.' });
  }

  try {
    const groqResponse = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: model || DEFAULT_MODEL,
        messages: safeMessages,
        temperature: 0.7,
        max_tokens: 1024
      })
    });

    const data = await groqResponse.json();
    if (!groqResponse.ok) {
      const detail = data && data.error && data.error.message ? data.error.message : 'Groq API request failed.';
      return res.status(groqResponse.status).json({ error: detail });
    }

    const reply = data.choices && data.choices[0] && data.choices[0].message;
    if (!reply || !reply.content) {
      return res.status(502).json({ error: 'Groq returned an empty response.' });
    }

    return res.json({
      message: { role: 'assistant', content: reply.content },
      model: data.model || model || DEFAULT_MODEL,
      usage: data.usage || null
    });
  } catch (error) {
    console.error('Chat request failed:', error.message);
    return res.status(500).json({ error: 'Unable to reach Groq right now. Please try again.' });
  }
});

app.get('*', (req, res) => {
  res.sendFile('index.html', { root: 'public' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`AquaZenn is listening on port ${PORT}`);
});
