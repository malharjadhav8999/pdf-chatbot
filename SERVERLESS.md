# 🖥️ Serverless vs. Persistent Server — Explained (and how to deploy either way)

You asked two things: **how serverless works**, and **how to deploy without it**.
This doc answers both, in plain language, tied to *this* PDF Chatbot.

---

## 1. The two hosting models, in one analogy

Think of running your app like running a **kitchen that cooks answers**.

- **Persistent server (traditional):** you rent a kitchen 24/7. A cook is always
  there. Ingredients you prepped earlier are still on the counter. Always ready,
  but you pay for the kitchen even when nobody orders, and you only have *one*
  kitchen.

- **Serverless:** there is **no permanent kitchen**. Each time an order arrives, a
  brand-new pop-up kitchen appears in seconds, cooks that one dish, and vanishes.
  You pay only per dish, and 100 orders can spin up 100 kitchens at once. But each
  pop-up starts **empty** — nothing you prepped in a previous one is there.

That single difference — *"is anything kept between requests?"* — is the whole story.

---

## 2. Persistent server (what Render / Railway / a VM give you)

```
            ┌─────────────────────────────────────────┐
   request ─┤  ONE long-running Node process           │
   request ─┤  • stays alive between requests           │
   request ─┤  • has RAM you can reuse (in-memory data)  │
            │  • has a disk you can write to            │
            └─────────────────────────────────────────┘
```

- A single process boots once and **keeps running**.
- It has **memory that persists** across requests (a JS variable set on request #1
  is still there on request #2).
- It has a **writable filesystem**.

**Pros:** simple mental model; you can cache things in memory; long tasks are fine.
**Cons:** it's always on (you pay/idle), and one process = limited scaling; to handle
more load you run more servers and add a load balancer yourself.

---

## 3. Serverless (what Vercel / AWS Lambda give you)

```
   request ─► [ fresh function instance A ]  ⟶ runs, returns, may disappear
   request ─► [ fresh function instance B ]  ⟶ different instance, empty memory
   request ─► [ reused warm instance A ]     ⟶ sometimes reused, not guaranteed
```

Your code is split into small **functions** (here: `/api/ingest` and `/api/chat`).
The platform runs a function **on demand**, then may freeze or destroy it.

Three defining traits:

1. **Stateless** — you must assume **nothing is kept** between calls. Memory from one
   invocation is *not* reliably visible to the next, and **different functions don't
   share memory at all**. Anything that must survive goes to an external store (DB).
2. **Ephemeral / read-only filesystem** — only `/tmp` is writable, and it's wiped
   between invocations. You can't rely on caching a downloaded model on disk.
3. **Cold starts** — if no instance is warm, the platform spins one up first
   (usually ~1 s on Vercel; can be slower if your function is heavy).

**Pros:** scales to zero (free when idle) and to thousands automatically; very fast
cold starts; no servers to manage.
**Cons:** you can't keep state in memory or on disk — you must externalize it.

---

## 4. Side-by-side

| | Persistent server (Render/Railway) | Serverless (Vercel) |
| --- | --- | --- |
| Process lifetime | Always running | Created per request, may vanish |
| Memory between requests | ✅ Kept | ❌ Not reliable; not shared across functions |
| Filesystem | ✅ Writable, persists | ⚠️ Only `/tmp`, wiped each call |
| Scaling | Manual (more servers) | Automatic, to zero and to many |
| Idle cost | Pays/sleeps (free tier sleeps) | Free when idle |
| Cold start (free tier) | ~30–50 s (after idle sleep) | ~1 s |
| Good for | Stateful apps, long jobs, local ML | Stateless APIs, spiky traffic |

---

## 5. Why this matters for *this* app specifically

The PDF Chatbot, in its original form, does **two things serverless forbids**:

1. **It stores the PDF's vectors in memory** (`globalThis` Map in `lib/store.ts`).
   - On a persistent server: upload saves vectors in RAM; the next chat request
     reads the same RAM. ✅
   - On serverless: `/api/ingest` and `/api/chat` are **separate functions with
     separate memory**. The chat function never sees what ingest stored →
     *"No PDF found."* ❌

2. **It runs the embedding model from local disk** (`@huggingface/transformers`).
   - On a persistent server: the ~25 MB model downloads once and is cached on disk. ✅
   - On serverless: read-only filesystem + heavy native binary + per-call cold
     start → the model can't load reliably. ❌

So the app supports **both**, and picks automatically:

```
if (UPSTASH_VECTOR_REST_URL && UPSTASH_VECTOR_REST_TOKEN)  →  Upstash backend  (serverless-safe)
else                                                        →  in-memory + local model (persistent server)
```

- **Upstash Vector** solves *both* serverless problems at once: it's an **external**
  store (survives between function calls and is shared by both functions) **and** it
  does the **embeddings server-side** (no local model needed).
- When those env vars are absent, the code uses the original in-memory + local-model
  path — perfect for a persistent server or local dev.

This logic lives in `lib/store.ts` (see `useUpstash`).

---

## 6. ✅ How to deploy WITHOUT serverless (run the current code as-is)

This is the simplest route: a **persistent server**, **no Upstash**, **no code
changes**. The in-memory store + local model just work.

### Render (free)
1. Push to GitHub (done).
2. **<https://dashboard.render.com>** → **New +** → **Blueprint** → pick the repo.
   Render reads the included `render.yaml`.
3. Set **one** env var: `GROQ_API_KEY` = your `gsk_...` key.
   **Do NOT set the Upstash vars** — leaving them empty keeps the in-memory backend.
4. **Apply** → get `https://<name>.onrender.com`.

> Trade-off: the free instance **sleeps after ~15 min idle**, so the first visit
> after a nap takes ~30–50 s (wake + one-time model download). Fast after that.
> A paid instance (~$7/mo) stays always-on and removes the cold start.

### Railway (free trial credit)
Same idea: New Project → Deploy from GitHub repo → set `GROQ_API_KEY` → deploy.

### Your own VM / container
```bash
npm install            # .npmrc handles peer deps
npm run build
GROQ_API_KEY=gsk_xxx npm run start   # one long-running process on $PORT
```

That's "without serverless" — one always-on process holding everything in memory.

---

## 7. How to deploy WITH serverless (Vercel)

Add the Upstash env vars so the serverless-safe backend activates. Full steps are in
**[DEPLOY.md](./DEPLOY.md) → Option A**. In short:
1. Create a free **Upstash Vector** index with an embedding model → copy its REST URL + token.
2. Import the repo on **vercel.com/new** and set **3** env vars:
   `GROQ_API_KEY`, `UPSTASH_VECTOR_REST_URL`, `UPSTASH_VECTOR_REST_TOKEN`.
3. Deploy → fast URL, no cold-start lag.

---

## 8. Which should you pick?

| Your goal | Pick |
| --- | --- |
| Fastest to load, always warm, willing to make a free Upstash account | **Vercel + Upstash (serverless)** |
| Simplest, zero extra services, OK with a slow first load on free tier | **Render/Railway (persistent)** |
| Full privacy / fully offline (local LLM too) | **Persistent server**, swap Groq → Ollama |
| Lots of concurrent users / spiky traffic | **Serverless** (auto-scales) |

Both run the **exact same code in this repo** — the only difference is whether the
Upstash environment variables are set.

---

### TL;DR
- **Serverless = no memory between requests, no disk.** Great for scaling, bad for
  keeping state — so we moved state to Upstash.
- **Without serverless = one always-on server** that keeps the PDF in memory and the
  model on disk — your current code, deployed on **Render/Railway**, no changes.
