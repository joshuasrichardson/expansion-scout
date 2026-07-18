# Expansion Scout — Implementation Plan

An on-device AI business growth consultant for **field-working local business
owners** (canonical persona: a **Utah-County taco truck**). This is the hackathon
build plan for the "On-Device AI with Gemma 4" track. Optimize for a **polished,
reliably demoable vertical slice**, not production completeness.

Read [CLAUDE.md](./CLAUDE.md) first — it holds the product vision, brand, privacy
framing, and architecture boundaries. This file is the ordered work backlog.

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

## Backlog (hand to a coding agent one ticket at a time)

Prioritizes a polished, demoable vertical slice over production completeness.
Preserve the visual direction, but don't recreate every screen before the core flow
works.

- **T0 — Foundation.** ✅ Repo, routes, types, mock data, theme scaffolded. (Built
  against the earlier generic vision; migrate toward the models above.)
- **T1 — Design system.** Tokens (warm off-white / forest green / charcoal / muted
  gray / blue AI accent / amber scores) + `Screen`, `AppText`, `PrimaryButton`,
  `SecondaryButton`, `Card`, `Chip`, `LocalAiBadge`, `BottomNavigation`. Large touch
  targets, safe areas, no cramped text. Temp showcase screen.
- **T2 — Domain types + realistic demo data.** Utah-County taco truck + ≥6
  opportunities (office campus, brewery, apartments, sports complex, wedding venue,
  industrial park). Guaranteed fallback; coordinates cluster on one map. Keep API
  shapes out of the domain models.
- **T3 — Home + Daily Mission.** "Ready to grow today?" → one clear objective,
  confidence, estimated recurring value, why-it-matters, nearby preview, Start Mission.
- **T4 — AI Interview.** Four questions, one at a time, big answer chips, 1-of-4
  progress, always-visible business summary, in-memory answers. Mic control visual
  only; completion never blocks on speech.
- **T5 — Gemma service abstraction.** `analyzeBusiness`, `rankOpportunities`,
  `generateOutreach`. Configurable local endpoint/model via env; strict JSON output;
  validate + timeout + deterministic fallback; log which path ran; unit-test parsing
  and fallback.
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
- **T10 — Outreach generator.** Email / Phone / Walk-in × Friendly / Professional /
  Direct. Gemma when available, strong templates as fallback. Edit, copy, regenerate.
  Label "Generated privately using Gemma." No invented facts.
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
- **T16 — Three-minute demo path + `DEMO_SCRIPT.md`.** Deterministic path Home →
  Mission → short Interview → Analysis → Opportunities → Brewery Detail → Outreach →
  Add to Plan → Growth Plan. Best content seeded, reveal within ~45s, reliable reset.
  Script documents exact taps, expected content, narration, and backup behavior.
  Narration must distinguish Google's retrieval from private on-device Gemma reasoning.
- **T17 — Release-readiness audit.** No new features. TypeScript + lint, clean install
  + launch, env config, permissions, no exposed secrets, no dead navigation /
  placeholder copy / tiny text, no endless loading, no dupe plan entries, demo reset,
  offline fallback, honest README + documented limitations. Run the full flow twice.

### Recommended execution order

`0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 9 → 10 → 11 → 14 → 16 → 17`.
Only attempt **T8, T12, T13, T15** after the full vertical slice works.

### Ruthless fallback plan

If time gets tight, the minimum winning product is: Home · short interview · Gemma
analysis animation · ranked opportunity map · one excellent detail view · generated
outreach · reliable demo mode. Profile, real Places API, voice, route optimization,
history, notifications, and full navigation are all expendable.
