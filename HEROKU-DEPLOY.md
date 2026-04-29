# Deploying AE MCP Server to Heroku + connecting Azure AI Foundry

This guide takes you from a local clone to a public Azure-Foundry-controlled
After Effects in 7 steps. Plain English.

---

## What you are deploying

ONE Node process (`mcp-wrapper-http.mjs`) that hosts on a single port:

| Surface | Used by | Endpoints |
|---|---|---|
| Official MCP (Streamable HTTP) | **Azure AI Foundry** | `POST /mcp`, `GET /mcp`, `DELETE /mcp` |
| Simple REST | curl / Postman / Foundry fallback | `GET /tools`, `POST /command`, `GET /health`, `GET /` |
| AE bridge | The CEP panel running inside After Effects | `GET /api/commands/pending`, `POST /api/command/:id/result` |
| Legacy | The old stdio wrapper (`mcp-wrapper.mjs`) | `GET /api/tools`, `POST /api/command` |

After deploy you will have one public URL. Paste it (with `/mcp` on the
end) into Azure AI Foundry as the Remote MCP server endpoint, and point
the AE CEP panel at the same domain. Foundry → Heroku → AE.

---

## Step 1 — Local sanity check (optional but recommended)

```powershell
cd "d:\AE-AI plugin\AE-MCP-Server"
npm install
npm start
```

You should see:

```
==================================================================
  ae-mcp-server v1.0.0  -  HTTP MCP for After Effects
==================================================================
  Listening on              : 0.0.0.0:3000
  Public URL (SERVER_URL)   : http://localhost:3000
  Tools registered          : 102

  >> For Azure AI Foundry, paste this as the Remote MCP endpoint:
        http://localhost:3000/mcp
  ...
```

Quick smoke tests in another terminal:

```powershell
curl http://localhost:3000/health
curl http://localhost:3000/tools
```

`POST /command` will time out unless the AE CEP panel is connected — that
is **expected**. The HTTP layer is healthy if `/health` and `/tools` work.

---

## Step 2 — Install the Heroku CLI

Windows: download the installer at <https://devcenter.heroku.com/articles/heroku-cli>.

Then in PowerShell:

```powershell
heroku --version
heroku login
```

---

## Step 3 — Initialise git (if you haven't already)

Heroku deploys via `git push`. From the project folder:

```powershell
cd "d:\AE-AI plugin\AE-MCP-Server"
git init
git add .
git commit -m "Initial commit: AE MCP HTTP server"
```

The `.gitignore` already excludes `node_modules/` so Heroku will run
`npm install` for you on the build server.

---

## Step 4 — Create the Heroku app

Pick a unique name (or omit it and let Heroku assign one):

```powershell
heroku create ae-mcp-server
```

Heroku adds a remote called `heroku` and prints something like:

```
https://ae-mcp-server-xxxxx.herokuapp.com/  (this is your PUBLIC_URL)
```

**Copy that URL — you'll need it twice (Foundry + AE panel).**

---

## Step 5 — Configure environment variables

```powershell
# Tell the server its own public URL so the startup banner / index page
# show the exact string to paste into Azure Foundry.
heroku config:set SERVER_URL=https://ae-mcp-server-xxxxx.herokuapp.com

# (Optional) bump the AE-response timeout for slow renders
heroku config:set AE_COMMAND_TIMEOUT_MS=120000
```

Heroku injects `PORT` automatically — do **not** set it manually.

---

## Step 6 — Deploy

```powershell
git push heroku master
# or, if your default branch is "main":
git push heroku main
```

Watch the build log. When it finishes:

```powershell
heroku logs --tail
```

You should see the startup banner. Verify from your laptop:

```powershell
curl https://ae-mcp-server-xxxxx.herokuapp.com/health
```

Expected response (abbreviated):

```json
{
  "status": "ok",
  "service": "ae-mcp-server",
  "version": "1.0.0",
  "publicUrl": "https://ae-mcp-server-xxxxx.herokuapp.com",
  "mcpEndpoint": "https://ae-mcp-server-xxxxx.herokuapp.com/mcp",
  "tools": 102,
  ...
}
```

---

## Step 7 — Wire the two clients

### 7a. Azure AI Foundry

In your Foundry agent / chat playground:

1. Add a tool / connector of type **Remote MCP server**.
2. Endpoint:
   ```
   https://ae-mcp-server-xxxxx.herokuapp.com/mcp
   ```
3. Save and reload tools — Foundry should discover all 102 AE tools.

Now type things like:

> "Create a 1920×1080 composition called MainComp, then add a text layer that says 'Hello' and make it bounce."

Foundry will call `create_composition`, `add_layer`, `apply_expression` etc. via `/mcp`. Each call is queued on the server and waits for After Effects to complete it.

### 7b. The After Effects CEP panel

The panel currently hits `localhost:3000`. Two tiny edits in
`CSXS/mcp-panel.js` make it talk to Heroku instead:

1. Around **line 37** change the default URL:
   ```js
   serverUrl = urlInput.value || "ae-mcp-server-xxxxx.herokuapp.com";
   ```
2. Around **lines 40, 68 and 248** change the scheme from `http://` to `https://`:
   ```js
   fetch(`https://${serverUrl}/api/commands/pending`)
   fetch(`https://${serverUrl}/api/command/${cmdId}/result`, ...)
   ```

Optionally update `CSXS/mcp-panel.html` so the **Server URL** input shows
the new default. Then in After Effects:

* **Window → Extensions → AE MCP Bridge**
* The URL field shows your Heroku domain
* Click **Connect**

The panel begins polling Heroku. Anything Foundry asks for now executes
inside *your* After Effects.

---

## Verifying the full loop

In After Effects, with the panel connected, run:

```powershell
curl -X POST https://ae-mcp-server-xxxxx.herokuapp.com/command `
     -H "Content-Type: application/json" `
     -d '{ \"tool\": \"get_active_comp_info\", \"args\": {} }'
```

If the panel is wired correctly you get back the comp's name, dimensions,
duration etc. as JSON. If it times out (HTTP 504) the panel is not
polling — re-check the URL/scheme in step 7b and the panel's logs.

---

## Common issues

| Symptom | Cause / Fix |
|---|---|
| `curl /health` works but `/command` returns HTTP 504 | AE CEP panel is not polling Heroku. Re-check `mcp-panel.js` URL + `https://`. |
| Heroku build fails on `npm install` | Make sure you committed `package.json` and that `engines.node` is `>=18`. |
| Foundry says "no tools" | You pasted the URL without `/mcp` on the end. Endpoint must be `<PUBLIC_URL>/mcp`. |
| Heroku app sleeps and first request is slow | On free dynos, first hit cold-starts in 5-10s. The AE panel's 500 ms poll keeps it warm while connected. Upgrade to Eco/Basic dynos if you want it always-on. |
| `mcp-wrapper.mjs` (stdio) stops working | It now needs `AE_MCP_URL=https://ae-mcp-server-xxxxx.herokuapp.com` in its env, not `localhost:3000`. |

---

## Architecture recap

```
            ┌────────────────────────────┐
            │     Azure AI Foundry       │
            │  (LLM brain, runs in cloud)│
            └──────────────┬─────────────┘
                           │  POST /mcp  (Streamable HTTP, JSON-RPC)
                           ▼
        ┌─────────────────────────────────────┐
        │   Heroku: mcp-wrapper-http.mjs      │
        │   - /mcp           (Foundry)        │
        │   - /tools /command /health         │
        │   - /api/commands/pending  (panel)  │
        │   - /api/command/:id/result         │
        └──────────────┬──────────────────────┘
                       │  GET /api/commands/pending
                       │  POST /api/command/:id/result
                       ▼
       ┌──────────────────────────────────────┐
       │  Your laptop: After Effects + CEP    │
       │  panel (CSXS/mcp-panel.js)           │
       │  → executes ExtendScript locally     │
       └──────────────────────────────────────┘
```

Single process on Heroku, single command queue. That's the whole trick.

---

## Files in this deploy

| File | Purpose |
|---|---|
| `mcp-wrapper-http.mjs` | The whole HTTP server (Foundry + AE bridge in one) |
| `package.json` | Dependencies + `start` script |
| `Procfile` | Heroku entry point: `web: node mcp-wrapper-http.mjs` |
| `.gitignore` | Keep `node_modules` out of the deploy slug |
| `mcp-wrapper.mjs` | (Optional) stdio bridge — keep for local Cursor/Claude usage |
| `CSXS/` | After Effects CEP panel — edit URL + scheme as in step 7b |
| `dist/mcp/server.js` | Old local-only server. Not used on Heroku. |
