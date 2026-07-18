# Architecture notes — owner-centric rebuild & iteration log

A running record of the significant architectural decisions made after the
original scaffold, and why. Newest last. (Product vision: CLAUDE.md · data
handling: DATA_FLOW.md · backlog: IMPLEMENTATION_PLAN.md.)

## 1. The owner's business is the root object (no demo data)

There is no bundled persona. `src/services/profileStore.ts` persists a single
`StoredBusiness` record — profile, Gemma's inferred customer picture, and its
latest analysis — to the device (document directory on iOS/Android,
localStorage on web). `src/state/business-context.tsx` hydrates it at launch
and is the only writer. Every screen, prompt, and fallback derives from it.

**Identity rule:** editing details (radius, goals, availability) preserves the
accumulated customer/analysis; changing *what the business is* (name or type)
drops them, and the profile screen also resets the in-session opportunities and
plan state. A cached analysis whose categories predate the current closed set
is discarded on load. This rule exists because simulation caught the previous
business's mission leaking into a newly entered one.

## 2. Categories are keyed by revenue shape, not industry

`OpportunityCategory = recurring | partnership | event | direct` (was
`lunch/catering/...`, which only made sense for food). Every layer keys off
this closed set: prompt enums, validators/coercers, the deterministic ranker's
weights/templates, discovery queries, map icons, and outreach channel defaults.
Adding a category means touching those six places — grep for a category name.

## 3. Reasoning contract: argument + evidence + confidence

`RankedOpportunity` carries `reasons` (the argument), `evidence` (data points),
`confidence` (0–100), `risks`, and an operator-grade `recommendedAction`
(who to ask, what to offer). Two guards keep this honest:

- **Grounding guard** (`gemma.ts:groundedEvidence`): a model-written evidence
  line survives only if it overlaps the data we actually gave the model; known
  facts (distance, rating, context) are always appended.
- The deterministic ranker caps its scores below 100, breaks ties, computes
  confidence from how much grounding it had, and **never invents dollar
  values** — only Gemma estimates value, as an explicit rough range.

The details screen renders this as: why → backed by → confidence bar (with a
low-confidence caution under 55) → worth knowing → recommended action.

## 4. Discovery is segment-driven, enriched, and cached

- Gemma's analysis emits a per-segment **`mapsQuery`** — the literal 2–5 word
  phrase to type into Maps. Discovery uses it directly (prose "discovery"
  strings made terrible text-search queries; small models parrot instructions).
- Places Text Search requests **rating, review count, phone, website** along
  with the basics. These flow through `PlaceCandidate` → `RankedOpportunity`
  into evidence lines ("4.6★ across 320 reviews"), the rank prompt, one-tap
  Call/website actions, and plan stops.
- **On-device discovery cache** (`src/services/placesCache.ts`): the latest
  live results, keyed by location+radius+queries. Fresh (<12 h) results are
  served without searching — Text Search has a small daily quota (100/day on
  the free tier, which simulation exhausted) and owners reopen the app all
  day. After a failed search, results **from the same area** up to 7 days old
  beat synthetic targets. Location must match so a business/city change never
  resurfaces the old business's places.

Fallback ladder for discovery: live search → fresh cache → stale same-area
cache → targets synthesized from the owner's own profile
(`localCandidates.ts`) — honestly labeled kinds-of-places, never fabricated
specific businesses. The map badge states which tier answered.

## 5. Weather as a planning signal

`src/services/weather.ts` (Open-Meteo, keyless; request carries only rounded
coordinates) classifies today as good/bad for field work and phrases one
plain-English hint on the Daily Mission. 4-second timeout, null → the line is
simply omitted.

## 6. Prompting rules that came from observed failures

- Never put a concrete example phrase in a prompt — Gemma 4 E2B parrots it
  verbatim (the "focus" line once echoed the example word-for-word). Describe
  the *shape* of the answer instead (verb + buyer type + countable target).
- Rank prompt demands per-item evidence quoting only supplied facts, honest
  confidence ("lower it when the context is thin"), and actions naming the
  person to ask and the offer to lead with.
- Candidate lists sent for ranking are capped (6) so an on-device model can
  cover every item with full reasoning inside one bounded generation; the
  deterministic baseline backfills anything the model omits (`mergeRankings`).

## 7. Resilience invariants (unchanged, re-verified)

Every external call has a timeout and a deterministic local fallback; no
loading state can hang; provenance (`InferenceMeta`, `PlacesResult.source`)
is surfaced in the UI rather than inferred. The full flow runs with no key,
no network, and no model — it just says so honestly while doing it.
