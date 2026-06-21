# 🚀 Deploying PDF Chatbot

This app can deploy **two ways**, and the code auto-detects which one:

| Host | Backend used | Best for | Cold start |
| --- | --- | --- | --- |
| **Vercel** (serverless) | **Upstash Vector** (set its env vars) | fast, always-warm, no model download | ~1 s |
| **Render / Railway** (persistent server) | in-memory + local model | zero external services | ~30–50 s (free tier sleeps) |

The switch is automatic: **if `UPSTASH_VECTOR_REST_URL` + `UPSTASH_VECTOR_REST_TOKEN`
are present, it uses Upstash; otherwise it uses the in-memory store + local model.**
New to serverless? Read **[SERVERLESS.md](./SERVERLESS.md)** first.

---

## Option A — Vercel + Upstash (recommended: fast, no cold-start lag)

Vercel is serverless, so the app needs an external store that survives between
function calls. **Upstash Vector** (free) provides both the storage *and* the
embeddings, so nothing heavy runs in the Vercel function.

### Step 1 — Create a free Upstash Vector index
1. Go to **<https://console.upstash.com>** → sign up (free, GitHub login works).
2. **Vector** → **Create Index**.
3. Give it a name. For **Embedding Model**, pick one (e.g. **`BAAI/bge-small-en-v1.5`**).
   *(Choosing a model lets the app upsert raw text and have Upstash embed it.)*
4. Region: pick one near you. Plan: **Free**.
5. Open the index → **Details/REST** and copy:
   - **`UPSTASH_VECTOR_REST_URL`**
   - **`UPSTASH_VECTOR_REST_TOKEN`**

### Step 2 — Deploy on Vercel
1. Go to **<https://vercel.com/new>** → **Import** your GitHub repo
   `malharjadhav8999/pdf-chatbot`.
2. Framework preset auto-detects **Next.js**. Leave build settings as-is.
3. Under **Environment Variables**, add **three**:
   | Name | Value |
   | --- | --- |
   | `GROQ_API_KEY` | your `gsk_...` key |
   | `UPSTASH_VECTOR_REST_URL` | from Step 1 |
   | `UPSTASH_VECTOR_REST_TOKEN` | from Step 1 |
4. Click **Deploy**. After ~1–2 min you get a URL like
   `https://pdf-chatbot-xxxx.vercel.app`.

That URL is fast on every visit — no sleeping, no model download.

> If you deploy **without** the Upstash vars, the build still succeeds but the app
> will fail at chat time ("No PDF found"), because the in-memory store can't be
> shared across Vercel's separate functions. The Upstash vars are what make Vercel work.

---

## Option B — Render (persistent server, uses the included `render.yaml`)

1. Push your code to GitHub (already done: `github.com/malharjadhav8999/pdf-chatbot`).
2. Go to **<https://dashboard.render.com>** → **New +** → **Blueprint**.
3. Connect your GitHub and select the **`pdf-chatbot`** repo. Render detects
   `render.yaml` automatically.
4. When prompted, set the environment variable:
   - **`GROQ_API_KEY`** = your free key from <https://console.groq.com/keys>
5. Click **Apply** / **Create**. Render runs `npm install && npm run build`, then
   `npm run start`. First deploy takes a few minutes.
6. Open the URL Render gives you (e.g. `https://pdf-chatbot-xxxx.onrender.com`).

**Free-tier notes**
- The instance **sleeps after ~15 min idle**; the next visit has a ~50s cold start.
- ~512 MB RAM — fine for normal PDFs. Very large PDFs may need a paid instance.
- Disk is ephemeral: the embedding model re-downloads (~25 MB) after a restart, on
  the first request. That's why the first question after a cold start is slower.

---

## Option C — Railway

1. Go to **<https://railway.app>** → **New Project** → **Deploy from GitHub repo**.
2. Select the `pdf-chatbot` repo. Railway auto-detects Next.js (Nixpacks):
   - Build: `npm install && npm run build`  (the `.npmrc` handles peer deps)
   - Start: `npm run start`
3. In **Variables**, add **`GROQ_API_KEY`** = your Groq key.
4. Deploy. Open the generated domain (enable a public domain under **Settings →
   Networking** if needed).

---

## Option D — Any Node host / VM / Docker

The app is a standard Next.js server:

```bash
npm install            # .npmrc applies legacy-peer-deps
npm run build
GROQ_API_KEY=gsk_xxx npm run start   # listens on $PORT (default 3000)
```

Put it behind a reverse proxy (nginx/Caddy) for HTTPS if self-hosting.

---

## Environment variables (set on the host, never commit them)

| Variable | Required | Default |
| --- | --- | --- |
| `GROQ_API_KEY` | ✅ Always | — |
| `UPSTASH_VECTOR_REST_URL` | ✅ On Vercel/serverless | — (unset → in-memory backend) |
| `UPSTASH_VECTOR_REST_TOKEN` | ✅ On Vercel/serverless | — |
| `GROQ_MODEL` | No | `llama-3.3-70b-versatile` |
| `EMBEDDING_MODEL` | No (in-memory backend only) | `Xenova/all-MiniLM-L6-v2` |

---

## Post-deploy checklist

- [ ] `GROQ_API_KEY` is set in the host's env (not in the repo).
- [ ] Open the site, upload a PDF, confirm "N chunks indexed".
- [ ] Ask a question and confirm a streamed answer (first one after cold start is slow — that's the model loading).
