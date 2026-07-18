# Three-minute demo script

The app centers on a **real business you enter live** — there is no canned demo
dataset, which is itself a demo beat: nothing you're about to see was pre-baked.
Practice once with your chosen business so the interview answers are ready to type.

**Setup (before you present):** device with the Gemma GGUF downloaded (Privacy →
*Your data* → model card shows "downloaded"); optionally `EXPO_PUBLIC_GOOGLE_PLACES_KEY`
set for live discovery. To reset between runs: Profile → **Forget this business**.

## The path (≈3:00, reveal lands ~0:45)

| ⏱ | Screen | Do | Say |
| --- | --- | --- | --- |
| 0:00 | Home | Point at the **On-device AI** badge | "Every owner knows the feeling: *I don't know where to find more business.* Their current tools are guessing, or staring at undifferentiated map pins." |
| 0:10 | Profile (first run) | Enter your business: name, type, city, radius, one goal, one capability → Save | "Thirty seconds of setup. This profile is cached on the phone and never uploaded — the consultant lives *in* the device." |
| 0:35 | Daily Mission | Read the mission line | "Scout doesn't hand me a search box. It hands me one goal for today." |
| 0:45 | Interview → Analysis | Answer 3 short questions; let the thinking screen play | "Gemma 4 is reasoning **privately on this device** — watch the steps. No prompt leaves the phone." |
| 1:15 | Analysis reveal | Segment cards slide in | "It decided *who* to look for — and for each kind of customer, how to find them and how to reach them." |
| 1:30 | Today's Growth Plan | Swipe cards; tap a pin | "Google discovers the places. Gemma ranks them — for *my* business. Pin and card stay in sync; the badge in the corner shows exactly which engine answered." |
| 1:50 | Opportunity details | Scroll: reasons → **Backed by** → confidence bar → risks | "This is the transparency story: every recommendation shows its argument, the evidence it rests on — only facts from the data, never invented — and how confident it is." |
| 2:15 | Outreach | Toggle tone; tap Regenerate; edit a word | "Drafted on-device, grounded in this opportunity only. I edit and copy — Scout **never** auto-sends anything." |
| 2:35 | Add to plan → Today's Plan | Add the stop, show the itinerary | "From 'I don't know where to grow' to a field itinerary with times and objectives — in under three minutes." |
| 2:50 | Privacy screen | Show the data table + locality proof | "And here's the receipt: what's used, what stays, what leaves." |

## Scored beats — do not skip

1. **Contrast** (0:00 & 2:35): guessing / staring at Maps pins → a reasoned, ranked plan.
2. **Discovers vs. reasons** (1:30): say it exactly — *Google discovers places; Gemma
   reasons about them privately on-device.*
3. **Locality proof**: flip on **airplane mode** before the interview (or at 2:50 and
   re-run "sample reasoning"). The flow still completes; the source badge still reads
   *on-device Gemma*.
4. **Injected failure**: run once with no Places key (or airplane mode) — the map
   badge switches to "Targets from your profile" and the plan still builds. Narrate
   it: "every dependency degrades on-device; nothing hangs."

## Backup behavior

If Gemma is genuinely unavailable (model not downloaded), every screen still works
via the deterministic on-device ranker — badges will honestly read "fallback". Do
not present that run as model output; show the model card and download state instead.
