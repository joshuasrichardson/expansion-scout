@AGENTS.md

# Expansion Scout

An **on-device AI business growth consultant** for local business owners, built for
the **"On-Device AI with Gemma 4"** hackathon track. This file is the durable brief —
read it fully at the start of every session. Detailed, ordered work lives in
[IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md).

## The one-line pitch

> An experienced business mentor in your pocket that tells a field-working owner
> **where to grow next today** — and turns that into a concrete plan.

Not Google Maps. Not a CRM. Not ChatGPT. The hero is **Gemma's private reasoning**,
not the map. The map is one tool the consultant uses.

## Who it's for (this drove the pivot)

Field-working local operators who are **never at a desk**: taco trucks, mobile
detailers, pressure washers, pet groomers, landscapers, photographers. They're
driving, walking into breweries, meeting apartment managers, scouting events. That
is *why* this is **mobile-first**, voice-friendly, and GPS-aware — and why it sells
the Gemma track: "This AI literally lives in your pocket."

The canonical demo persona is a **fictional taco truck in Utah County**.

## The emotional arc (optimize every decision for this)

```
"I don't know where to find more business."
  → "My AI understands my business."
  → "I have a clear mission for today."
  → "I know exactly where to go."
  → "I'm excited to grow my business."
```

Concretely: *"Tell me about your business" → "Let me think…" → "I found three ways
to grow today."* That story beats "here's a map with pins" every time — lead with it.

## Demo flow (the vertical slice that must work)

```
Launch → Daily Mission → AI Conversation → Analysis ("thinking") →
Today's Growth Plan (map + swipeable cards) → Opportunity Details →
Generate Outreach → Today's Plan
```

Signature moments to nail:
- **Daily Mission** is the signature screen — a coach handing you one goal for the
  day (e.g. *"Book one recurring catering customer — 94% confidence, +$850/mo"*),
  not a search box.
- **Analysis "thinking" screen** — a live reasoning ticker streamed from the model's
  actual token stream (business-specific stages, segment names appearing as Gemma
  emits them, model name + wall clock + token count) with *"Gemma 4 is reasoning
  privately on your device."* Never a timer-faked checklist.
- **The reveal** — ranked opportunities slide up, map pins animate in. This is the
  strongest transition; it must land within ~45s of the demo start.

Note the naming: we call the opportunities screen **"Today's Growth Plan,"** not
"Today's Opportunities" — it signals Gemma *already reasoned and assembled a plan*.

## Brand & visual direction

- **Name:** Expansion Scout · **Tagline:** *Find where your business should grow next.*
- **Palette:** warm off-white backgrounds · deep **forest green** primary accent ·
  deep charcoal type · muted gray secondary · **blue** for AI-reasoning accents ·
  **amber only** for opportunity scores.
- **Feel:** premium startup — Apple HIG, Linear, Arc, Material 3, Notion AI. Large
  rounded cards, generous spacing, subtle motion, App-Store-quality polish. No
  clutter; every screen has breathing room. Avoid the cramped text of the Stitch mocks.

### Privacy framing (say it exactly like this)

- *Powered locally by Gemma 4* · *Your business strategy stays on your device.*
- **Google Maps discovers places. Gemma reasons about those places privately.**
  Never imply the map data itself is on-device; the *reasoning* is what's private.

## Architecture boundaries (keep these clean)

- **Google Places retrieves** public candidate places. **Gemma privately evaluates
  and ranks** them. Never let the UI touch a raw Google Places object — normalize
  into our domain models first.
- **`services/gemma.ts` is the only place model transport lives.** Everything else
  calls `analyzeBusiness` / `rankOpportunities` / `generateOutreach` and never knows
  whether real Gemma or the deterministic fallback answered.
- **Never expose chain-of-thought.** Surface only concise reasons, evidence, risks,
  confidence, and recommended actions.

## Resilience is a feature, not polish — the demo must survive airplane mode

Every external dependency has a deterministic local fallback, and **demo mode** seeds
the whole flow (taco-truck profile, interview answers, 3–6s analysis, ranked
opportunities, outreach text, preloaded plan). Guard against: missing Maps/Places
key, Gemma timeout, malformed model JSON, map render failure, mic denial, slow
network. **No loading state may hang indefinitely.** Aside from map tiles, the full
flow runs offline.

## Current state vs. target (IMPORTANT — the scaffold predates this brief)

The repo was scaffolded (Ticket 0) against an *earlier, generic B2B "desktop
expansion consultant"* idea. Several things do **not** yet match the refined vision
above and should be migrated as tickets are worked:

| Area | Current (legacy) | Target (this brief) |
| --- | --- | --- |
| Accent color | blue `#208AEF` | forest green |
| `BusinessProfile` | `industry`, `homeMarket`, `employeeCount`, `monthlyRevenueUsd` | `type`, `city`, `latitude/longitude`, `serviceRadiusMiles`, `availability`, `goals[]`, `capabilities[]` |
| `AnalysisResult` | `readinessScore`, `strengths`, `gaps` | business analysis feeding opportunity ranking |
| `Opportunity` | `market`, `matchScore`, `estimatedValueUsd`, `effort` | `category` union, `score`, `bestTime`, `reasons[]`, `risks[]`, `recommendedAction` |
| `OutreachChannel` | `email`/`linkedin`/`call` | `email`/`phone`/`walk-in` + tone |
| Services layer | none | `services/gemma.ts`, `services/places.ts`, `services/opportunityRanking.ts` |
| Demo mode | none | app-wide demo mode + `DEMO_SCRIPT.md` |
| Profile screen | none | `profile.tsx` |

Treat the demo persona as a **Utah-County taco truck**, not a generic enterprise.

## Stack & conventions

- **Expo SDK 57** · React Native 0.86 · React 19 · TypeScript (strict) · **Expo Router**
  (file-based, typed routes, single Stack — the demo is a guided story, not tabs).
- **Expo has changed** — read the versioned docs at
  https://docs.expo.dev/versions/v57.0.0/ before writing Expo code (see AGENTS.md).
- Source lives under **`src/`** (routes in `src/app/`), *not* a root `app/`. When the
  backlog says `app/…` or `services/…`, place it under `src/`.
- Brand-facing theme tokens live in `src/constants/theme.ts` (`accent`, `onAccent`,
  `success`, `warning`, `border`) — reskin there, never hardcode hex in screens.
- No auth, no database, no backend. State is in-memory / component-local; lift shared
  interview + plan state into Context/Zustand when a second screen needs it.
- Verify TypeScript passes after changes; keep the app launchable at every ticket.

## What to optimize for

A polished, reliably demoable **vertical slice** over production completeness. If time
gets tight, the minimum winning product is: Home → short interview → analysis
animation → ranked opportunity map → one excellent detail view → generated outreach,
all behind reliable demo mode. Profile, real Places API, voice recognition, route
optimization, and push notifications are expendable (Tickets 8, 12, 13, 15).
