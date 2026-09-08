# AquaZenn Chatbot

AquaZenn is a focused, ocean-inspired chatbot interface backed by the [Groq API](https://console.groq.com/). It is a small Express application that can run locally, on GitHub, or in a Docker-based Hugging Face Space.

## Features

- Responsive single-page chatbot UI in `public/index.html`
- Express static-file server and `POST /api/chat` endpoint
- Groq chat completions using `node-fetch` v2 and CommonJS `require`
- Environment-based API key configuration (the key never reaches the browser)
- Dockerfile configured for Hugging Face Spaces on port `7860`

## Run locally

```bash
npm install
cp .env.example .env
# Add your real GROQ_API_KEY to .env
npm start
```

Open [http://localhost:7860](http://localhost:7860).

## Deploy to GitHub

1. Create a new repository.
2. Upload the contents of this folder (including `public/`).
3. Do **not** commit `.env`; it is ignored by Git.

## Deploy to Hugging Face Spaces

1. Create a new Space and choose **Docker** as the SDK.
2. Upload the project files, including `Dockerfile`.
3. In **Settings → Variables and secrets**, add a secret named `GROQ_API_KEY`.
4. Optionally add `GROQ_MODEL`; otherwise the app uses `llama-3.3-70b-versatile`.
5. The Space will build the image and expose the app on port `7860`.

## API

`POST /api/chat`

```json
{
  "messages": [
    { "role": "user", "content": "What can you help me with?" }
  ]
}
```

The response contains the assistant message in `message.content`.

## License

Add the license that fits your project before publishing.
