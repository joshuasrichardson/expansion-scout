# Expansion Scout — a business growth consultant that lives in your pocket

**Subtitle:** Gemma 4 reasons privately on your phone about where your business should grow next — today. Google Maps discovers places; Gemma decides which ones matter and why.

**Track:** On-Device AI with Gemma 4

## The problem

Field-working local operators — taco trucks, mobile detailers, pressure washers — are never at a desk. When they ask "where do I find more business?", their current tool is a map full of undifferentiated pins. Expansion Scout replaces that with an experienced mentor: a short interview, then a ranked, reasoned, ready-to-act growth plan for today, in under a minute.

## Architecture

The design splits retrieval from reasoning: **Google Places retrieves public candidate places; Gemma 4 evaluates and ranks them privately, on the device.** The owner's profile, goals, and strategy never leave the phone.

One file (`services/gemma.ts`) owns all model transport. Behind it sits a transport ladder: **llama.rn** (Gemma inside the app process on the phone's Metal GPU — survives airplane mode) → **Ollama over localhost** (dev loop and eval harness) → a **deterministic on-device engine**. Every rung uses the same prompts, the same strict JSON schema validation, and the same typed domain models; every answer carries provenance (`source`, `model`, `latencyMs`, `validated`) surfaced in the UI, so you can always see whether real Gemma answered. We chose **Gemma 4 E2B (QAT, Q4_0, 3.35 GB)** as the largest variant that fits a modern iPhone's memory while keeping JSON reliability high.

## How Gemma 4 is used

Gemma does five distinct reasoning jobs, not one prompt: it runs an **adaptive interview** (deciding each turn whether it can already picture the ideal customer, or what single question fills the biggest gap), **distills the transcript** into who the customer is and where they physically gather, **analyzes the business** into today's one mission plus 3–5 target segments — each classified into a closed customer taxonomy and carrying the literal Maps query to find it — then **ranks real nearby places** with a score, honest confidence, reasons, evidence, risks, and a do-it-today action, and finally **drafts outreach** the owner edits and sends manually.

The "thinking" screen streams Gemma's actual token stream: a watcher over the accumulating JSON fires a stage the moment the model reaches each field of its answer, with segment names appearing as Gemma emits them, plus a live token count and wall clock. Nothing is timer-faked — and chain-of-thought is never shown, only stage labels and validated output.

## Challenges we overcame

- **A 3.35 GB model vs. iOS memory limits.** The app was killed mid-generation because llama.rn's Expo plugin silently skips the increased-memory-limit entitlement in local builds. We declare the entitlements explicitly and verify the plist at build time.
- **Small models drift off schema.** E2B omitted the `category` field on segments in 14/14 audited runs; requiring it silently replaced real reasoning with templates. We now coerce free-text strays onto closed enums and derive missing fields from their counterparts, dropping a segment only when nothing survives.
- **Small models don't reliably emit all N array items.** Candidate lists are capped at 6 so one bounded generation can reason about every place; a deterministic ranker backfills anything the model omits, and the UI states exactly how much Gemma covered.
- **Small models parrot examples.** Any concrete example phrase in a prompt came back verbatim, so prompts describe the *shape* of an answer (verb + buyer type + countable target) instead.
- **Keeping the model honest.** Rankings join back to our candidate IDs (no invented places); a grounding guard keeps a model-written evidence line only if it overlaps data we actually supplied; identity and coordinates always come from the stored profile.
- **Streaming in React Native.** RN's fetch can't stream bodies, so the Ollama path reads NDJSON progressively over XHR; llama.rn streams via its native partial-completion callback.

## Evaluation

A repeatable harness (`npm run gemma:eval`) runs the real reasoning jobs across three business profiles and enforces JSON-valid rate, closed-set validity, warm-latency p95, and grounding coverage, failing CI on any miss. Every external dependency has a timeout and a labeled fallback: the full flow completes offline, degrades observably, and never hangs.
