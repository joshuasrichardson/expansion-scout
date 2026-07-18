# Expansion Scout — Implementation Plan

An on-device AI business growth consultant for **field-working local business
owners** (canonical persona: a **Utah-County taco truck**). This is the hackathon
build plan for the "On-Device AI with Gemma 4" track. Optimize for a **polished,
reliably demoable vertical slice**, not production completeness.

Read [CLAUDE.md](./CLAUDE.md) first — it holds the product vision, brand, privacy
framing, and architecture boundaries. This file is the ordered work backlog.
[JUDGING_RUBRIC.md](./JUDGING_RUBRIC.md) holds the 100-point rubric and our
self-assessment — **every ticket below names the rubric category it advances**, and
the ruthless fallback plan protects the highest-scoring categories first.

## Demo flow

```
Launch → Daily Mission → AI Conversation → Analysis ("thinking") →
Today's Growth Plan (map + swipeable cards) → Opportunity Details →
Generate Outreach → Today's Plan
```

The reveal of ranked opportunities after the analysis animation is the strongest
moment — it must land within ~45s of the demo start.

## Stack

- **Expo SDK 57** · React Native 0.86 · React 19 · TypeScript (strict)
- **Expo Router** — file-based, typed routes, single Stack (guided narrative, not tabs)
- **Gemma 4** via a thin local inference adapter (`services/gemma.ts`)
- **Google Places** for real candidate retrieval, behind a safe adapter (`services/places.ts`)

## Target project structure

Everything lives under `src/` (routes in `src/app/`). When a ticket says `app/…` or
`services/…`, place it under `src/`.

```
src/
  app/                     # Expo Router routes (one file per screen)
    _layout.tsx            #   root Stack + theme provider
    index.tsx              #   Launch / Home
    daily-mission.tsx      #   Daily Mission (signature screen)
    interview.tsx          #   AI Conversation (chip/voice Q&A)
    analysis.tsx           #   Analysis "thinking" transition
    opportunities.tsx      #   Today's Growth Plan (map + swipeable cards)
    opportunity/[id].tsx   #   Opportunity Details (bottom sheet)
    outreach.tsx           #   Generate Outreach
    plan.tsx               #   Today's Plan (timeline)
    profile.tsx            #   Business Profile
  components/              # design-system + feature components
  services/
    gemma.ts               #   analyzeBusiness / rankOpportunities / generateOutreach (+ fallback)
    places.ts              #   Google Places adapter → internal candidate model
    opportunityRanking.ts  #   deterministic local ranking fallback
  data/                   # demoBusiness, demoOpportunities (guaranteed fallback)
  types.ts                # shared domain models
  constants/theme.ts      # brand tokens (forest green, warm white, amber scores…)
```

## Domain models (target shape — migrate the legacy generic types toward this)

```ts
type BusinessProfile = {
  name: string; type: string; description: string;
  city: string; latitude: number; longitude: number;
  serviceRadiusMiles: number; availability: string;
  goals: string[]; capabilities: string[];
};

type Opportunity = {
  id: string; name: string;
  category: "partnership" | "lunch" | "catering" | "event";
  score: number; latitude: number; longitude: number; address: string;
  distanceMiles: number; estimatedTravelMinutes: number; bestTime: string;
  summary: string; reasons: string[]; risks: string[];
  recommendedAction: string; estimatedValue?: string;
};

type PlanStop = {
  id: string; opportunityId: string; time: string;
  actionType: string; objective: string;
};
```

The current `src/types.ts` still carries the earlier generic B2B shape
(`industry`, `homeMarket`, `readinessScore`, `matchScore`, `estimatedValueUsd`,
`effort`, `linkedin`). See the migration table in CLAUDE.md and converge on the
above as tickets are worked.

## Design decisions (hackathon scope)

- **No auth, no database, no backend.** State is in-memory / component-local; lift
  shared interview + plan state into Context/Zustand when a second screen needs it.
- **On-device AI behind one adapter.** UI only calls `analyzeBusiness` /
  `rankOpportunities` / `generateOutreach`; it never knows whether real Gemma or the
  deterministic fallback answered. Never expose chain-of-thought.
- **Google retrieves, Gemma reasons.** Normalize Places responses into our domain
  models before the UI sees them.
- **Reskinnable theme.** Brand tokens in `src/constants/theme.ts`; swap for the
  forest-green Expansion Scout / Halda palette without touching screen code.
- **Resilience is a feature.** Demo mode seeds the whole flow; every external
  dependency degrades to a local fallback; no loading state hangs forever.

---

## Rubric alignment (where the points come from)

Full detail in [JUDGING_RUBRIC.md](./JUDGING_RUBRIC.md). Map of category → the
tickets that earn it:

| Category (pts) | Primary tickets | The thing a judge must see live |
| --- | --- | --- |
| **1. Value (25)** | T3, T7, T9, T10, T16 | Mission → ranked plan → outreach; narrate the contrast vs. their current alternative (guessing / staring at Maps pins). |
| **2. Inputs & Data (15)** | **T5b**, T8, T14 | `DATA_FLOW.md` + in-app "what data is used" note; Google discovers, Gemma reasons privately; observable fallbacks. |
| **3. Enablement (20)** | T1, T4, T6, T14, T15 | One decision per screen, bounded latency, a11y (contrast/large-text/screen-reader/reduced-motion), generate-then-edit outreach (never auto-send). |
| **4. Underlying Model (20)** | **T5a**, T5, T6 | Real Gemma runs on-device — provable in airplane mode, on-screen path indicator (real vs. fallback) + model name/size. Highest risk; protect it. |
| **5. Evidence & Evaluation (20)** | **T5c**, T5, T16, T17 | Explicit success criteria, eval set + metrics (latency, JSON-valid rate), honest limitations, in-app self-verification of results. |

**Do not let the deterministic fallback become the demo.** It exists for resilience;
the scored demo must run — and be shown running — on real on-device Gemma (T5a).

## Backlog (hand to a coding agent one ticket at a time)

Prioritizes a polished, demoable vertical slice over production completeness.
Preserve the visual direction, but don't recreate every screen before the core flow
works.

- **T0 — Foundation.** ✅ Repo, routes, types, mock data, theme scaffolded. (Built
  against the earlier generic vision; migrate toward the models above.)
- **T1 — Design system.** *(Rubric 3.)* Tokens (warm off-white / forest green /
  charcoal / muted gray / blue AI accent / amber scores) + `Screen`, `AppText`,
  `PrimaryButton`, `SecondaryButton`, `Card`, `Chip`, `LocalAiBadge`,
  `BottomNavigation`. Large touch targets, safe areas, no cramped text. **Bake in
  accessibility from the start:** WCAG-AA contrast on the forest-green palette,
  Dynamic Type / large-text support, screen-reader labels on interactive components,
  and reduced-motion awareness. Temp showcase screen.
- **T2 — Domain types + realistic demo data.** Utah-County taco truck + ≥6
  opportunities (office campus, brewery, apartments, sports complex, wedding venue,
  industrial park). Guaranteed fallback; coordinates cluster on one map. Keep API
  shapes out of the domain models.
- **T3 — Home + Daily Mission.** "Ready to grow today?" → one clear objective,
  confidence, estimated recurring value, why-it-matters, nearby preview, Start Mission.
- **T4 — AI Interview.** Four questions, one at a time, big answer chips, 1-of-4
  progress, always-visible business summary, in-memory answers. Mic control visual
  only; completion never blocks on speech.
- **T5 — Gemma service abstraction.** *(Rubric 4, 5.)* `analyzeBusiness`,
  `rankOpportunities`, `generateOutreach`. Configurable local endpoint/model via env;
  strict JSON output; validate against a schema + timeout + deterministic fallback;
  **record which path answered (real Gemma vs. fallback), the model name/size, and the
  inference latency** on each result so the UI and metrics can surface it. Unit-test
  parsing, schema validation, and fallback.
- **T5a — Real on-device Gemma inference + locality proof.** *(Rubric 4 — highest
  risk, do not skip.)* Wire `services/gemma.ts` to an actual on-device Gemma 4 runtime
  (e.g. a local inference build), not just the fallback. Prove locality: (1) an
  on-screen indicator showing the reasoning ran on-device with the model name/size;
  (2) the full analysis → ranking → outreach flow completes in **airplane mode** with
  real inference; (3) a visible "reasoned locally on this device" state distinct from
  the fallback state. This is the category On-Device judges must verify — make it
  undeniable.
- **T5b — Data flow & provenance.** *(Rubric 2.)* Write `DATA_FLOW.md`: every input
  (interview answers, GPS, Places candidates), where each is processed (device vs.
  Google), and what is stored (in-memory only) or transmitted (Places/map tiles only —
  never business strategy). Add a concise in-app "What data is used" note reachable
  from the AI/privacy badge. Keep the exact distinction: Google *discovers* places;
  Gemma *reasons* privately on-device.
- **T5c — Evaluation harness & self-verification.** *(Rubric 5.)* Write
  `EVALUATION.md` with explicit success criteria (see JUDGING_RUBRIC.md) and a small
  eval set of business profiles → expected opportunity categories. Measure and report
  on-device inference latency (p50/p95), Gemma JSON-valid rate, and fallback rate. In
  the app, **verify results rather than claim them**: validate model JSON against the
  schema, show a confidence score with the evidence behind it, flag low-confidence
  opportunities, and confirm plan actions actually applied.
- **T6 — Analysis "thinking" transition.** Progressive steps ("Understanding your
  business → … → Building today's plan"), invoke Gemma while it animates, 3–6s in
  demo mode, auto-advance, never hang. "Gemma is reasoning privately on this device."
- **T7 — Opportunities map + swipeable cards (hero screen).** Map upper ~55%,
  horizontal cards below, card ↔ pin selection synced both ways. Cards: name, score,
  category, travel time, best time, one-line reason, View Details. Pins distinguish
  category by shape/label, not color alone. All pins fit initial region.
- **T8 — Google Places adapter** *(optional for demo).* Search taco-truck-relevant
  categories, normalize, de-dupe, cap results, merge with heuristics. Works with **no
  API key** (falls back to demo data); never commit the key; errors never block.
- **T9 — Opportunity Details bottom sheet.** Name, score, category, travel/best time,
  "Why Expansion Scout recommends this," evidence, risks, recommended action,
  estimated value. Actions: Generate Outreach, Add to Today's Plan (updates state),
  Navigate (opens device maps or safe fallback).
- **T10 — Outreach generator.** *(Rubric 1, 3.)* Email / Phone / Walk-in × Friendly /
  Professional / Direct. Gemma when available, strong templates as fallback. **Safety
  around consequential actions: generate → edit → copy only; never auto-send.** Edit,
  copy, regenerate. Label "Generated privately using Gemma." No invented facts (only
  attributes present in the selected opportunity).
- **T11 — Today's Growth Plan.** Timeline of selected stops (time, place, objective,
  category, travel, potential value). Add from details (no dupes), remove, Start
  Navigation opens first stop. Local state only; preloaded demo plan.
- **T12 — Business Profile** *(medium).* Identity, area, radius, capabilities, goals,
  availability, preferences, recent missions, local-AI privacy note. In-memory edits,
  no accounts.
- **T13 — Voice input** *(stretch).* Mic permission handling + idle/listening/
  processing states + transcription into current answer. Additive only; chips +
  keyboard always work; failures degrade gracefully.
- **T14 — App-wide demo mode + failure protection.** Preloaded profile, deterministic
  interview answers + analysis timing, ranked opportunities, stable outreach,
  preloaded plan, reset action. Guard against missing keys, Gemma timeout, malformed
  JSON, Places/map failure, mic denial, slow network. Full flow runs in airplane mode
  (except map tiles).
- **T15 — Polish** *(after slice works).* Transitions, bottom-sheet motion, pin/card
  selection animation, card entrance, analysis progression, press states, subtle
  haptics, add-to-plan confirmation, skeletons, empty states. The opportunity reveal
  is the strongest transition. Respect reduced motion; never delay the demo.
- **T16 — Three-minute demo path + `DEMO_SCRIPT.md`.** *(Rubric 1, 4, 5.)*
  Deterministic path Home → Mission → short Interview → Analysis → Opportunities →
  Brewery Detail → Outreach → Add to Plan → Growth Plan. Best content seeded, reveal
  within ~45s, reliable reset. Script documents exact taps, expected content,
  narration, and backup behavior. The narration **must** hit these scored beats:
  (a) the contrast vs. the owner's current alternative (guessing / undifferentiated
  Maps pins); (b) Google *discovers* places, Gemma *reasons* privately on-device;
  (c) a shown proof that Gemma runs locally (airplane mode + on-screen path
  indicator); (d) one deliberately injected failure to show graceful recovery.
- **T17 — Release-readiness audit.** *(Rubric 3, 5.)* No new features. TypeScript +
  lint, clean install + launch, env config, permissions, no exposed secrets, no dead
  navigation / placeholder copy / tiny text, no endless loading, no dupe plan entries,
  demo reset, offline fallback, honest README + documented limitations. **Accessibility
  pass** (contrast, large-text, screen-reader labels, reduced motion) and a
  **verification pass** against the success criteria in JUDGING_RUBRIC.md (each one
  demonstrably met, metrics recorded). Run the full flow twice.

### Recommended execution order

`0 → 1 → 2 → 3 → 4 → 5 → 5a → 6 → 7 → 9 → 10 → 11 → 5c → 14 → 5b → 16 → 17`.
Only attempt **T8, T12, T13, T15** after the full vertical slice works.

**T5a is on the critical path, not optional** — it is the difference between scoring
and forfeiting the 20-point Underlying Model category on an On-Device track. Do it as
soon as the service abstraction (T5) exists and a screen consumes it. T5b (data flow)
and T5c (evaluation) are lightweight docs + small UI hooks; fold them in before the
demo-script and audit tickets so their claims are already true.

### Ruthless fallback plan

If time gets tight, the minimum winning product is: Home · short interview · **real
on-device Gemma** analysis animation · ranked opportunity map · one excellent detail
view · generated outreach · reliable demo mode — plus the three artifacts that carry
otherwise-unearned points (`DATA_FLOW.md`, `EVALUATION.md`, and the local-inference
proof). Profile, real Places API, voice, route optimization, history, notifications,
and full navigation are all expendable. **Never cut T5a to save time** — a slick flow
running only on the deterministic fallback loses the category the whole track is
about; cut breadth (screens, polish) before you cut proof of local inference.
