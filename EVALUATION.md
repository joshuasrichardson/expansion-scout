# Evaluation — on-device Gemma reasoning

Evidence for rubric §4 (Underlying Model — local execution) and §5 (Evidence &
Evaluation). This documents how we define success, how we measure it repeatably,
what we measured, and the honest limitations we designed around.

Run it yourself:

```bash
ollama serve                       # if not already running
npm run gemma:pull                 # one-time: pull gemma4:e2b-it-qat (~4.3 GB)
npm run gemma:eval                 # exits 0 only if all success criteria pass
```

## Model choice — and why E2B fits the iPhone 17

Gemma 4 ships in five sizes; only **E2B** and **E4B** are edge/phone-optimized.

| Model | RAM needed | Fits iPhone 17 (8 GB) | Fits 17 Pro (12 GB) | Notes |
| --- | --- | --- | --- | --- |
| **E2B (QAT)** ✅ | ~6 GB (4.3 GB weights) | Yes, with headroom | Yes | Our pick — quality-aware quant, near-full quality |
| E4B | ~8 GB | Risky (no OS/app headroom) | Yes | Higher quality; only safe on Pro |
| 12B / 26B / 31B | 16 GB+ | No | No | Not phone models |

We target **`gemma4:e2b-it-qat`**: the best quality that leaves an 8 GB base
iPhone 17 enough headroom for iOS + the app during a live demo. On a 12 GB Pro,
`EXPO_PUBLIC_GEMMA_MODEL=gemma4:e2b-it-qat` can be swapped for E4B for more quality.

## Success criteria

Enforced by `npm run gemma:eval` (exit non-zero on any miss):

| Criterion | Target |
| --- | --- |
| JSON-valid rate | ≥ 80% of raw calls return usable JSON |
| Category-valid rate | ≥ 90% of categories land in our closed set |
| Warm latency (p95) | ≤ 12 s (masked by the analysis animation) |
| Gemma grounds ≥1 opportunity / profile | real reasoning contributes |
| Shipped list ≥3 / profile | complete list after on-device backfill |
| Graceful fallback | an unreachable runtime never throws to the UI |

## Measured results

`gemma4:e2b-it-qat` · Apple M1 Pro (16 GB) · 12 reasoning calls across 3 business
profiles (taco truck, mobile detailer, mobile pet groomer):

| Metric | Result |
| --- | --- |
| JSON-valid rate | **100%** (12/12) at temperature 0.3 |
| Category-valid rate | **100%** (19/19) |
| Latency p50 / p95 | **2.8 s / 8.6 s** (warm) |
| Cold start (first call) | ~14 s — mitigated by `warmUpGemma()` at launch |
| Gemma-grounded opportunities | 1–4 of 4 per profile (varies) |
| Shipped list | **always 4/4** (deterministic backfill) |
| Fallback on unreachable runtime | ✓ |

## How the product verifies its own results (not just claims them)

- **Schema validation.** Every model response is parsed and validated against a
  typed shape in `services/gemma.ts`; malformed/off-contract output is rejected.
- **Grounding guard.** Rankings are matched back to our own candidate ids — the
  model cannot invent a place; unknown ids are dropped.
- **Category coercion.** Free-text category guesses are mapped onto the closed set;
  unmappable values fall back to the candidate's known category.
- **Provenance.** Every result carries `InferenceMeta { source, model, latencyMs,
  validated, note }`, surfaced in-app (see `LocalAiStatus`) so a judge can see
  whether on-device Gemma or the fallback answered, and how fast.

## Honest limitations & edge cases

- **Completeness varies.** E2B frequently ranks only its strongest pick and omits
  weaker candidates, despite being told to emit all N. We treat the model as a
  *re-ranker/justifier* and **backfill** the remainder with a deterministic ranker,
  so the UI is always complete; `meta.note` reports coverage (e.g. "Gemma ranked
  1/6; remainder ordered on-device").
- **Occasional malformed JSON.** At temperature 0.4 we saw ~1-in-8 truncated JSON;
  lowering ranking temperature to 0.3 eliminated it across 12 calls. The app still
  falls back deterministically if it ever recurs.
- **Cold start.** The first inference loads the model (~14 s). We warm up at launch;
  the analysis "thinking" screen also masks first-call latency.
- **Two transports, one interface.** `GemmaTransport` has two real implementations:
  the **embedded llama.rn** runtime (Gemma runs inside the app process on the phone's
  GPU — the true on-device path) and the **Ollama HTTP** runtime (dev/simulator; what
  this eval measures). Selection is automatic. The embedded path is implemented and
  typechecked; because iOS on-device inference can't run in the Simulator or in CI,
  its end-to-end + airplane-mode verification is a hands-on step on a physical iPhone
  with a dev build — see **ON_DEVICE.md**. The numbers above are from the Ollama
  transport against the same model class, prompts, and validation, so they're a
  faithful proxy for the reasoning quality; on-device latency will differ with the
  phone's GPU.
