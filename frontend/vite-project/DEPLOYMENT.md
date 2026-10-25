# Deployment Instructions

The application uses three independent backend services. Do not point one
service at another service's URL.

| Service | Render start command | Health check |
| --- | --- | --- |
| WebRTC signaling | `npm run start:webrtc` | `/health` |
| Translation / auth / transcripts | `npm run start:translation` | `/health` |
| AI anchoring | `npm run start:anchoring` | `/health` |

All three services read `process.env.PORT` and listen on `0.0.0.0`, which is
required by Render. The same `backend` folder is used for all three Render
services; set the start command per service in the Render dashboard.

## Test deployment URLs

| Service | URL |
| --- | --- |
| Frontend (Vercel) | `https://meet-2-deploying.vercel.app` |
| WebRTC signaling | `https://meet-2-deploying.onrender.com` |
| Translation / auth | `https://meet-2-deploying-1.onrender.com` |
| AI anchoring | `https://meet-2-deploying-2.onrender.com` |

## Frontend on Vercel

1. Import the repository and set **Root Directory** to `frontend/vite-project`.
2. Framework preset: **Vite**.
3. Build command: `npm run build`.
4. Output directory: `dist`.
5. Add these environment variables (Production and Preview):

```text
VITE_WEBRTC_URL=https://meet-2-deploying.onrender.com
VITE_TRANSLATION_URL=https://meet-2-deploying-1.onrender.com
VITE_ANCHORING_URL=https://meet-2-deploying-2.onrender.com
```

Optional TURN relay:

```text
VITE_TURN_URL=
VITE_TURN_USERNAME=
VITE_TURN_CREDENTIAL=
```

Vite embeds `VITE_*` values at build time, so **redeploy the frontend after
changing any of them**. Never put `SARVAM_API_KEY`, `MONGO_URI`, `JWT_SECRET`
or any other secret in a `VITE_*` variable: those values are visible in the
browser bundle.

If a URL is missing, the affected feature shows a configuration error instead
of falling back to the Vercel hostname or a localhost port.

## Render services

Each service can use the `backend` folder as its root directory.

### WebRTC signaling

- Start command: `npm run start:webrtc`
- Environment: `CLIENT_ORIGIN=https://meet-2-deploying.vercel.app` (optional;
  when omitted, any origin is allowed because credentials are disabled).
- Health check path: `/health`

### Translation / auth

- Start command: `npm run start:translation`
- Environment:
  - `SARVAM_API_KEY` (translated speech and primary translation provider;
    captions still work without it)
  - `MONGO_URI`, `MONGO_DB_NAME`, `JWT_SECRET` (auth, transcripts, summaries)
  - `FRONTEND_URL` / `CLIENT_ORIGIN`
- Health check path: `/health`
- MongoDB is optional for live captions and TTS. If it is missing or
  unreachable, those features keep working and auth/transcript endpoints
  return `503`.

### AI anchoring

- Start command: `npm run start:anchoring`
- Environment:
  - `SARVAM_API_KEY` (server-side speech; the browser voice is the fallback)
  - `CLIENT_ORIGIN=https://meet-2-deploying.vercel.app`
- Health check path: `/health`

## Translation providers

Both backend services use `backend/lib/multilingual.js`, which tries the
providers in this order:

1. **Sarvam AI** (`sarvam-translate:v1`, same `SARVAM_API_KEY` as TTS)
2. **MyMemory**
3. **Google Translate**

Sarvam is first because it is reachable from Render and covered by the API key
that already powers TTS. MyMemory and Google remain fallbacks. If every
provider fails, the recipient receives the original text labelled as
untranslated and **no audio**; the service never speaks the original language
as if it were the translation.

Sarvam TTS does not currently expose Assamese (`as`) or Urdu (`ur`) voices on
all accounts. Translation still works for both languages and the browser
speech-synthesis fallback speaks the translated text.

## Verification

After deploying:

```text
https://meet-2-deploying.onrender.com/health
https://meet-2-deploying-1.onrender.com/health
https://meet-2-deploying-2.onrender.com/health
```

Each should return HTTP 200 with a JSON `status: "ok"`.

## Local development

The frontend falls back to these addresses only when running `vite dev`:

```text
http://localhost:3001  WebRTC signaling
http://localhost:5000  translation / auth
http://localhost:3002  AI anchoring
```

Run each backend service in its own terminal from `backend`:

```bash
npm run dev:webrtc
npm run dev:translation
npm run dev:anchoring
```
