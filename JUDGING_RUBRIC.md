# Judging Rubric & Self-Assessment

The hackathon scores every eligible project on the **Architected Intelligence
framework** — five categories, 100 points. This file holds the rubric verbatim and
our honest self-assessment: what already earns points, where the gaps are, and
**what the judge must see live** to award each category. Treat the "what proves it
live" column as demo requirements, not aspirations.

> Read alongside [CLAUDE.md](./CLAUDE.md) (vision/brand/architecture) and
> [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) (ordered backlog). Every ticket
> should name the rubric category it advances.

---

## The rubric (100 points)

### 1. Value — 25 points
Does the project solve a specific, important problem for a clearly identified user?
Judges score demonstrated usefulness — not market-size claims or hypothetical future
features.

**Evidence**
- Clear user and problem
- Useful outcome demonstrated live
- Meaningful improvement over the user's current alternative

### 2. Inputs & Data — 15 points
Does the system use the right inputs and data for the task, with clear provenance,
privacy, and failure handling? Teams must explain what enters the system, where it is
processed, and what is stored or transmitted.

**Evidence**
- Relevant, trustworthy inputs
- Clear data flow and provenance
- Appropriate privacy, permissions, and failure handling

### 3. Enablement & Ease of Use — 20 points
Can the intended user successfully operate the product without developer assistance?
Judges assess workflow simplicity, latency, accessibility, error recovery, and safety
around consequential actions.

**Evidence**
- Simple end-to-end user workflow
- Responsive interaction and understandable feedback
- Recovery from errors and safeguards where appropriate

### 4. Underlying Model — 20 points
Is the selected model essential to the product, appropriately deployed, and used
beyond a superficial API call? Judges assess model choice, architecture, grounding,
tool use, local execution where required, and technical depth.

**Evidence**
- Model choice fits the task and constraints
- Model capability is central to the working product
- Architecture and tool use are technically coherent
- **On-Device track: judges must verify that Gemma 4 performs the core inference
  locally.**
- Voice-to-Action track: any model stack is eligible; score technical merit and
  meaningful model use, not model brand alone.

### 5. Evidence & Evaluation — 20 points
Has the team defined success and demonstrated that the project achieves it? Judges
assess live task completion, repeatable tests, relevant metrics, edge cases, known
limitations, and whether the product verifies its own results.

**Evidence**
- Explicit success criteria
- Repeatable test cases or relevant metrics
- Honest edge cases and limitations
- Product verifies completion rather than merely claiming it

---

## Self-assessment & what must be shown live

### 1. Value (25) — currently strong
| | |
| --- | --- |
| **User & problem** | Field-working local operator (taco truck) who is never at a desk and doesn't know where to find more business. Sharp, specific, sympathetic. |
| **Useful outcome live** | The Daily Mission → Analysis → ranked Growth Plan → generated outreach flow ends with a concrete, actionable plan for *today*. |
| **Improvement over alternative** | **State this explicitly in narration.** Today the owner guesses, or opens Google Maps and stares at undifferentiated pins with no reasoning, no ranking, no outreach. Expansion Scout hands them a *ranked, reasoned, ready-to-act* plan in ~45s. |
| **Gap to close** | Make the "vs. their current alternative" contrast an on-screen/narration beat in `DEMO_SCRIPT.md` (T16), not just an implied benefit. |

### 2. Inputs & Data (15) — needs an explicit provenance artifact
| | |
| --- | --- |
| **Relevant inputs** | Interview answers (business type, goals, capabilities, availability), GPS location, Google Places candidates. All genuinely drive the ranking. |
| **Provenance / data flow** | **Gap:** no single artifact a judge can read to see what enters, where it's processed, what's stored/transmitted. → `DATA_FLOW.md` (T5b) + an in-app "What data is used" note (T12/T14). |
| **Privacy** | Strong framing already: *Google discovers places; Gemma reasons privately on-device; business strategy never leaves the device.* Keep the distinction exact — the map tiles/Places lookups are the only network calls; reasoning is local. |
| **Failure handling** | Every dependency degrades to a local fallback (T14). Make the fallbacks *observable* so judges see graceful degradation, not just trust it. |

### 3. Enablement & Ease of Use (20) — strong; harden two edges
| | |
| --- | --- |
| **Simple workflow** | Single guided Stack, big chips, one decision per screen, no auth. Excellent. |
| **Latency & feedback** | Analysis "thinking" screen sets expectations; 3–6s bounded; no state hangs forever. Show the actual on-device inference latency as a metric (ties to category 5). |
| **Accessibility** | **Gap:** commit to concrete a11y — adequate contrast on the forest-green palette, Dynamic Type / large-text support, screen-reader labels on pins & cards, and honoring reduced-motion. Add to T1/T15 and audit in T17. |
| **Safety around consequential actions** | Outreach is **generate → edit → copy**, never auto-send — this is the right safeguard; say so out loud. Navigation hands off to the device maps app with a confirm. No destructive or irreversible action happens without user confirmation. |

### 4. Underlying Model (20) — HIGHEST RISK; make local Gemma undeniable
This is an On-Device track. **Judges must verify Gemma 4 runs the core inference
locally.** The deterministic fallback is a resilience feature, but if the demo
silently runs on the fallback, we forfeit most of this category.

| | |
| --- | --- |
| **Model is essential, not superficial** | Gemma does three real reasoning jobs: analyze the business, rank/justify opportunities, draft outreach. This is structured reasoning over grounded inputs, not a single prompt. Good — keep it. |
| **Local execution, verified** | **Gap / must-do:** ship a real on-device Gemma path (not only the fallback) and make its locality *provable* on demand: an on-screen indicator of which path answered (real Gemma vs. fallback), the model name/size, and the ability to run the whole reasoning flow in **airplane mode** to prove no server is involved. → new **T5a — Real on-device Gemma inference** and its verification in T16/T17. |
| **Grounding & tool use** | Places results are the grounding; the interview is structured input; outreach is grounded in the selected opportunity's real attributes (no invented facts). The "Google retrieves, Gemma reasons" split is a coherent architecture story — tell it. |
| **Technical depth** | Strict JSON contract, schema validation, timeout, and typed domain models between model and UI (T5) demonstrate depth beyond an API call. |

### 5. Evidence & Evaluation (20) — needs success criteria, metrics & self-verification
| | |
| --- | --- |
| **Explicit success criteria** | **Gap:** define them (below) in `EVALUATION.md` (T5c). |
| **Repeatable tests / metrics** | Unit tests exist for JSON parsing + fallback (T5). Extend to a small **evaluation set** of business profiles → expected opportunity categories, plus measured metrics (on-device inference latency, JSON-valid rate, fallback rate). |
| **Honest edge cases & limitations** | README has a limitations note; expand into a maintained list (no key, model unavailable, malformed JSON, mic denied, offline, sparse Places area). |
| **Product verifies its own results** | **Gap:** the app should *check* its work, not just claim it — validate Gemma's JSON against the schema, show a confidence score with the evidence behind it, flag low-confidence opportunities, and confirm plan actions succeeded. Surface this verification in the UI. |

---

## Success criteria (define here, prove in the demo)

The product is a success when, **offline except for map tiles**, a first-time user
who has never seen it can:

1. Complete the interview and reach a ranked Growth Plan in **under 60 seconds**.
2. See **≥3 opportunities**, each with a score, a plain-language reason, evidence,
   and a recommended action.
3. Generate editable outreach for a chosen opportunity that invents **no facts** not
   present in that opportunity's data.
4. Do all of the above with **Gemma reasoning verified to run on-device** (provable in
   airplane mode, with an on-screen path indicator).
5. Encounter at least one **injected failure** (e.g. model timeout) and watch the app
   degrade gracefully with understandable feedback — no hang, no crash.

Metrics we report: on-device inference latency (p50/p95), Gemma JSON-valid rate,
fallback-invocation rate, and end-to-end time-to-plan.

---

## Score-driving additions folded into the plan

These close the gaps above and are added as tickets in
[IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md):

- **T5a — Real on-device Gemma inference + path/locality proof** (category 4).
- **T5b — `DATA_FLOW.md` + in-app "what data is used" note** (category 2).
- **T5c — `EVALUATION.md`: success criteria, eval set, metrics, self-verification**
  (category 5).
- **Accessibility commitments** in T1/T15, audited in T17 (category 3).
- **"Vs. current alternative" + failure-recovery beats** scripted in T16 (categories
  1 & 5).
