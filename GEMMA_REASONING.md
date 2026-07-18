# How Gemma reasons in Expansion Scout

A quick, judge-friendly tour of exactly what the model does, where it runs, and
how its output is kept honest. (Data handling: [DATA_FLOW.md](./DATA_FLOW.md) ·
on-device setup: [ON_DEVICE.md](./ON_DEVICE.md) · metrics:
[EVALUATION.md](./EVALUATION.md).)

The one-line architecture: **Google Places discovers public places. Gemma 4
reasons about them privately, on the device.** The map is a tool; the reasoning
is the product.

## The big picture

```mermaid
flowchart LR
    subgraph device["📱 On the device — never leaves"]
        P[Owner's business profile\n+ interview answers] --> G{{"Gemma 4 (E2B)\nvia llama.rn / Ollama"}}
        G -->|"1 · interviewStep"| Q[Next question or done]
        G -->|"2 · summarizeInterview"| C[Ideal-customer picture]
        G -->|"3 · analyzeBusiness"| A["Today's focus +\ntarget segments (who to look for)"]
        G -->|"4 · rankOpportunities"| R[Scored, reasoned,\nevidence-backed ranking]
        G -->|"5 · generateOutreach"| O[Editable draft\nnever auto-sent]
    end
    subgraph network["🌐 Network (optional)"]
        PL[Google Places\nText Search]
    end
    A -->|"place-type queries only\n(e.g. 'office parks')"| PL
    PL -->|normalized PlaceCandidates| R
```

Five distinct reasoning jobs, one model, one contract. Each job sends a grounded
prompt, demands strict JSON against a closed schema, and has a deterministic
on-device fallback — so the flow completes even with no model and no network.

## The reasoning jobs

| # | Call | Gemma decides | Grounded in |
| --- | --- | --- | --- |
| 1 | `interviewStep` | Whether it can already picture the ideal customer — else the single most useful next question | The conversation so far |
| 2 | `summarizeInterview` | Who the ideal customer is, how to recognize them, **where they physically gather**, how to reach them | The full transcript (identity/geo come from the stored profile, never the model) |
| 3 | `analyzeBusiness` | Today's one mission + 3–5 **target segments**, each classified into a closed customer taxonomy with a literal Maps query | Profile + inferred customer |
| 4 | `rankOpportunities` | Score, confidence, reasons, evidence, risk, best time, and a do-it-today action per place | Only the normalized candidates we hand it — it cannot add places |
| 5 | `generateOutreach` | A channel- and tone-shaped draft that leads with what the prospect gets | Profile + the selected opportunity's real attributes only |

## One call, end to end (validate-or-fallback)

Every call goes through the same orchestration in `src/services/gemma.ts` — the
only file in the app that talks to a model:

```mermaid
sequenceDiagram
    participant UI as Screen
    participant S as gemma.ts
    participant T as Transport (llama.rn / Ollama)
    participant F as Deterministic fallback

    UI->>S: analyzeBusiness(profile, onProgress)
    S-->>UI: step: "Reading <name> — <type> in <city>"
    S->>T: grounded JSON-only prompt
    loop token stream
        T-->>S: text so far + token count
        S-->>UI: step/note the moment a JSON field appears
    end
    T->>S: full response
    S->>S: parse → validate against closed schema
    alt valid
        S-->>UI: done (source: gemma, latency)
        S->>UI: typed result + InferenceMeta
    else timeout / malformed / off-contract
        S->>F: same inputs
        S-->>UI: step: "switching to deterministic planner"
        S->>UI: fallback result + InferenceMeta (source: fallback, note: why)
    end
```

Key properties:

- **Strict JSON contract.** Prompts demand a single JSON value; transports
  constrain generation to JSON (`format: "json"` / `response_format`); output is
  parsed and validated against typed shapes with closed enums. Free-text strays
  are *coerced* onto the closed sets (`coerceCategory`, `coerceSegmentType`,
  `coerceReach`) or rejected.
- **Provenance on every answer.** Results carry
  `InferenceMeta { source, model, latencyMs, validated, note }`, surfaced in the
  UI — a judge can always see whether real Gemma or the fallback answered.
- **Bounded time.** Every call has a timeout; no loading state can hang.

## The progress you see is the model actually thinking

The "thinking" screens are not an animation. Transports stream tokens as they
are generated (llama.rn partial-completion callback; Ollama NDJSON read
progressively). `gemma.ts` watches the accumulating JSON and emits a
`ReasoningEvent` **the moment the model reaches each field of its answer**:

```mermaid
flowchart LR
    T["Token stream\n(llama.rn / Ollama NDJSON)"] --> W{{key-stage watcher}}
    W -->|"&quot;summary&quot; appeared"| E1["step: Sizing up <name>…"]
    W -->|"&quot;focus&quot; appeared"| E2["step: Choosing today's mission"]
    W -->|"segment label streamed"| E3["note: 'Office parks at lunch'"]
    W -->|every chunk| E4["tokens: live count"]
    E1 & E2 & E3 & E4 --> UI["Analysis screen ticker\n+ elapsed clock + model badge"]
```

So when the demo shows *"Deciding exactly who to look for…"* and segment names
ticking in, that is Gemma emitting those fields **right then**, on the device —
with a live token counter and wall clock to prove it. If the model is
unavailable, the same channel honestly reports the switch to the deterministic
planner. (The UI paces reveals by a few hundred ms for readability; it never
invents a step.)

Chain-of-thought is never shown — only stage labels and the validated output
(reasons, evidence, risks, confidence).

## Where the model runs (transport ladder)

```mermaid
flowchart TD
    A{EXPO_PUBLIC_GEMMA_TRANSPORT} -->|auto, on a phone| L["llama.rn — Gemma inside the app process\n(Metal GPU · survives airplane mode)"]
    A -->|auto, web/simulator| O["Ollama HTTP — localhost/LAN\n(dev loop + eval harness)"]
    L -->|model not downloaded /\nmodule missing| O
    O -->|unreachable / timeout /\nbad JSON| D["Deterministic on-device engine\n(no model, no network — labeled 'fallback')"]
```

Same interface, same prompts, same validation on every rung — the UI only ever
learns which rung answered via `InferenceMeta.source`.

## Why the model can't lie to you

- **No invented places.** Rankings are joined back to our candidate ids;
  unknown ids are dropped (`validateRanked`).
- **No invented evidence.** A model-written evidence line survives only if it
  overlaps the data we actually gave the model; known facts (distance, rating)
  are always appended (`groundedEvidence`).
- **No identity drift.** Business name, type, and coordinates always come from
  the stored profile — the model only fills the soft fields
  (`validateProfile`).
- **No invented outreach facts.** Drafts are grounded in the selected
  opportunity; prompts forbid invented names, numbers, and discounts, and the
  owner edits + copies manually — nothing is ever auto-sent.
