# Running Gemma truly on-device (llama.rn)

Two real on-device transports sit behind the same `GemmaTransport` interface, so
the app code (`analyzeBusiness` / `rankOpportunities` / `generateOutreach`) is
identical whichever runs:

| Transport | Where it runs | Use for |
| --- | --- | --- |
| **`llama.rn` (embedded)** | Gemma runs **inside the app process** on the phone's GPU (Metal). No server, no network. | The real On-Device demo. Survives airplane mode on the phone itself. |
| **Ollama (HTTP)** | Gemma runs on a Mac; the app calls it over localhost/LAN. | Fast dev loop, iOS Simulator, `npm run gemma:eval`. |

Selection is automatic (`EXPO_PUBLIC_GEMMA_TRANSPORT=auto`): on a device it prefers
embedded llama.rn and falls back to Ollama, then to the deterministic engine.

## Why this needs a dev build (not Expo Go)

llama.rn is a native module (llama.cpp). Expo Go can't load it, so you must build a
**custom dev client**. Also note:

- **iOS inference requires a physical Metal device — it does NOT run in the iOS
  Simulator.** Use the Simulator with the Ollama transport; use a real iPhone for
  llama.rn.
- The model (~3.35 GB) is **downloaded on device at runtime**, never bundled (App
  Store rejects multi-GB binaries). The in-app "Download Gemma for on-device" button
  (on the design-system screen) handles this via `modelManager`.
- iOS needs the increased-memory-limit entitlement to hold the model in RAM — enabled
  by the `llama.rn` config plugin (`enableEntitlements: true` in `app.json`).

## One-time setup

```bash
# 1. Install deps (already in package.json): llama.rn + expo-dev-client
npm install

# 2. Generate native projects (CNG — ios/ and android/ are gitignored)
npx expo prebuild --clean

# 3a. iOS — build & run the dev client on a CONNECTED physical iPhone
npx expo run:ios --device --configuration Release

# 3b. Android — arm64 device
npx expo run:android --device
```

> Release configuration is recommended on iOS: Metal offload and mmap are much
> faster than a debug build.

## First launch on device

1. Open the app → design-system screen → **On-device reasoning** card.
2. Tap **Download Gemma for on-device** and wait for the ~3.35 GB download (progress
   shown). It's stored in the app's document directory and reused after that.
3. The status flips to **"Gemma 4 · running on this device"** with endpoint
   `llama.rn (embedded)`.
4. Tap **Run sample reasoning** — the result meta shows `source: gemma`, the latency,
   and `schema-validated`.

## Prove it's local (the §4 checklist judges verify)

- [ ] Endpoint reads **`llama.rn (embedded)`**, not an `http://…` host.
- [ ] Enable **airplane mode on the iPhone**, then run sample reasoning — it still
      produces a fresh, validated result. (The Ollama transport would fail here; only
      truly-embedded inference survives.)
- [ ] Quit Ollama on the Mac entirely — reasoning is unaffected on device.

## Configuration

All optional; see `.env.example`. Key vars:

- `EXPO_PUBLIC_GEMMA_TRANSPORT` — `auto` | `llama` | `ollama`
- `EXPO_PUBLIC_GEMMA_GGUF_URL` / `_FILE` — which GGUF to download
- `EXPO_PUBLIC_GEMMA_N_CTX` / `_N_GPU_LAYERS` — context size / Metal offload

## Status & what's verified where

- **Implemented & typechecked:** transport, model download/management, resolver,
  entitlements, config, in-app download + locality UI.
- **Verified on the host machine:** real Gemma inference, JSON validity, latency, and
  fallback (via `npm run gemma:eval` against Ollama — same prompts/validation).
- **Requires a physical iPhone + dev build to verify:** end-to-end llama.rn inference
  and the airplane-mode proof above. This can't be exercised in the Simulator or in
  this repo's CI — it's the final hands-on step before the demo.
