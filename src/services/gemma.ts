/**
 * The ONLY place model transport lives (CLAUDE.md architecture boundary).
 *
 * The rest of the app calls `analyzeBusiness`, `rankOpportunities`, and
 * `generateOutreach` and never knows whether real on-device Gemma or the
 * deterministic fallback answered — it reads `InferenceMeta.source` if it cares.
 *
 * On-device transport
 * -------------------
 * Real Gemma 4 inference runs through a local runtime that exposes an
 * Ollama-compatible HTTP API (`/api/generate`, `/api/tags`). Default target:
 * Gemma 4 **E2B (QAT)** — the quality/memory balance that fits an iPhone 17
 * (~4.3 GB; see EVALUATION.md). In the iOS Simulator, `localhost` reaches the
 * same machine hosting the runtime; on a physical device set
 * `EXPO_PUBLIC_GEMMA_BASE_URL` to the host's LAN IP.
 *
 * This transport is deliberately swappable: a future truly-embedded runtime
 * (llama.rn / MediaPipe LLM Inference) can implement `GemmaTransport` without any
 * change to the three public functions or their callers.
 *
 * Never expose chain-of-thought — surface only summaries, reasons, evidence,
 * risks, confidence, and recommended actions.
 */

import { Platform } from 'react-native';

import { LlamaTransport } from './llamaTransport';
import {
  analyzeBusinessLocal,
  generateOutreachLocal,
  interviewStepLocal,
  rankOpportunitiesLocal,
  segmentsFromCategories,
  summarizeInterviewLocal,
} from './opportunityRanking';
import {
  CUSTOMER_SEGMENT_TYPES,
  OPPORTUNITY_CATEGORIES,
  type BusinessAnalysis,
  type BusinessProfileInput,
  type CustomerProfile,
  type CustomerSegment,
  type CustomerSegmentType,
  type InferenceMeta,
  type InterviewDecision,
  type InterviewProfile,
  type InterviewTurn,
  type OpportunityCategory,
  type OutreachChannel,
  type OutreachDraft,
  type OutreachTone,
  type PlaceCandidate,
  type RankedOpportunity,
  type WithMeta,
} from './gemmaTypes';

export * from './gemmaTypes';

/* -------------------------------------------------------------------------- */
/* Config                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * All knobs come from `EXPO_PUBLIC_*` env (inlined by Metro; also readable in
 * Node for the eval harness). Sensible defaults mean the app runs with zero
 * config against a local Ollama, and degrades to the fallback if it's absent.
 */
export const GemmaConfig = {
  baseUrl: process.env.EXPO_PUBLIC_GEMMA_BASE_URL ?? 'http://localhost:11434',
  model: process.env.EXPO_PUBLIC_GEMMA_MODEL ?? 'gemma4:e2b-it-qat',
  /** Set to "false" to force the deterministic fallback (e.g. for a safe demo). */
  enabled: process.env.EXPO_PUBLIC_GEMMA_ENABLED !== 'false',
  /** Per-call ceiling. Cold start loads the model (~10–15s), so keep generous. */
  timeoutMs: Number(process.env.EXPO_PUBLIC_GEMMA_TIMEOUT_MS ?? 22000),
} as const;

/* -------------------------------------------------------------------------- */
/* Transport                                                                  */
/* -------------------------------------------------------------------------- */

export interface GemmaTransport {
  /** Returns raw model text (expected to be JSON) plus how long it took. */
  generate(prompt: string, opts?: { maxTokens?: number; temperature?: number }): Promise<{
    text: string;
    latencyMs: number;
  }>;
  /** Cheap reachability + model-present check for the locality-proof UI. */
  probe(): Promise<{ available: boolean; model: string; baseUrl: string; latencyMs: number }>;
}

/** Real on-device transport over an Ollama-compatible local HTTP runtime. */
export class OllamaTransport implements GemmaTransport {
  constructor(
    private readonly baseUrl = GemmaConfig.baseUrl,
    private readonly model = GemmaConfig.model,
    private readonly timeoutMs = GemmaConfig.timeoutMs,
  ) {}

  async generate(prompt: string, opts?: { maxTokens?: number; temperature?: number }) {
    const started = nowMs();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          model: this.model,
          prompt,
          stream: false,
          format: 'json', // constrain output to a JSON object
          options: {
            temperature: opts?.temperature ?? 0.4,
            num_predict: opts?.maxTokens ?? 512,
          },
        }),
      });
      if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
      const json = (await res.json()) as { response?: string };
      return { text: json.response ?? '', latencyMs: Math.round(nowMs() - started) };
    } finally {
      clearTimeout(timer);
    }
  }

  async probe() {
    const started = nowMs();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`, { signal: controller.signal });
      const json = (await res.json()) as { models?: { name?: string; model?: string }[] };
      const names = (json.models ?? []).map((m) => m.model ?? m.name ?? '');
      return {
        available: res.ok && names.some((n) => n === this.model),
        model: this.model,
        baseUrl: this.baseUrl,
        latencyMs: Math.round(nowMs() - started),
      };
    } catch {
      return { available: false, model: this.model, baseUrl: this.baseUrl, latencyMs: Math.round(nowMs() - started) };
    } finally {
      clearTimeout(timer);
    }
  }
}

/**
 * Tries transports in order and sticks with the first that's actually available.
 * Used for `auto`: on device we prefer embedded llama.rn (true on-device) and
 * fall back to Ollama (dev/simulator over LAN); a per-call failure re-resolves.
 */
class AutoTransport implements GemmaTransport {
  private chosen: GemmaTransport | null = null;
  constructor(private readonly candidates: GemmaTransport[]) {}

  private async pick(): Promise<GemmaTransport | null> {
    if (this.chosen) return this.chosen;
    for (const c of this.candidates) {
      const p = await c.probe();
      if (p.available) {
        this.chosen = c;
        return c;
      }
    }
    return null;
  }

  async generate(prompt: string, opts?: { maxTokens?: number; temperature?: number }) {
    const t = await this.pick();
    if (!t) throw new Error('No on-device transport available');
    try {
      return await t.generate(prompt, opts);
    } catch (err) {
      this.chosen = null; // re-resolve next time (e.g. runtime went away)
      throw err;
    }
  }

  async probe() {
    const t = await this.pick();
    return t ? t.probe() : this.candidates[0].probe();
  }
}

/**
 * Choose the transport from `EXPO_PUBLIC_GEMMA_TRANSPORT`:
 *   • `llama`  — force embedded llama.rn (device only)
 *   • `ollama` — force the local HTTP runtime (dev/simulator)
 *   • `auto` (default) — device: llama → ollama; web: ollama
 */
function resolveTransport(): GemmaTransport {
  const choice = (process.env.EXPO_PUBLIC_GEMMA_TRANSPORT ?? 'auto').toLowerCase();
  if (choice === 'llama') return new LlamaTransport();
  if (choice === 'ollama') return new OllamaTransport();
  const isNative = Platform.OS === 'ios' || Platform.OS === 'android';
  return isNative ? new AutoTransport([new LlamaTransport(), new OllamaTransport()]) : new OllamaTransport();
}

/** Swap this to route all reasoning through a different runtime. */
let transport: GemmaTransport = resolveTransport();
export function setGemmaTransport(next: GemmaTransport) {
  transport = next;
}

/* -------------------------------------------------------------------------- */
/* Locality proof (rubric §4)                                                 */
/* -------------------------------------------------------------------------- */

export interface GemmaStatus {
  /** True only when Gemma will actually answer (enabled + reachable + model present). */
  onDevice: boolean;
  model: string;
  baseUrl: string;
  latencyMs: number;
  /** Why it's off, when it is — shown in the UI. */
  detail: string;
}

/** Backs the on-screen "reasoning runs on this device" indicator. */
export async function getGemmaStatus(): Promise<GemmaStatus> {
  if (!GemmaConfig.enabled) {
    return {
      onDevice: false,
      model: GemmaConfig.model,
      baseUrl: GemmaConfig.baseUrl,
      latencyMs: 0,
      detail: 'Disabled via config — using deterministic fallback.',
    };
  }
  const p = await transport.probe();
  return {
    onDevice: p.available,
    model: p.model,
    baseUrl: p.baseUrl,
    latencyMs: p.latencyMs,
    detail: p.available
      ? `${p.model} ready on-device — reasoning stays local.`
      : `Runtime not reachable at ${p.baseUrl} — using deterministic fallback.`,
  };
}

/** Preload the model so the first real call isn't a 10–15s cold start. */
export async function warmUpGemma(): Promise<boolean> {
  if (!GemmaConfig.enabled) return false;
  try {
    await transport.generate('Return {"ok":true} as JSON.', { maxTokens: 8, temperature: 0 });
    return true;
  } catch {
    return false;
  }
}

/* -------------------------------------------------------------------------- */
/* Public reasoning API                                                       */
/* -------------------------------------------------------------------------- */

export async function analyzeBusiness(
  profile: BusinessProfileInput | InterviewProfile,
): Promise<WithMeta<BusinessAnalysis>> {
  return run(
    ANALYZE_PROMPT(profile),
    (raw) => validateAnalysis(raw),
    () => analyzeBusinessLocal(profile),
    { maxTokens: 600 },
  );
}

/**
 * The adaptive-interview reasoning step. Given the conversation so far, Gemma
 * decides whether it can already infer the business and its ideal customer well
 * enough to run good place searches — and either returns the single most useful
 * next question, or `done: true`. The caller (interview screen) enforces the
 * MIN/MAX question bounds around this decision.
 */
export async function interviewStep(
  history: InterviewTurn[],
): Promise<WithMeta<InterviewDecision>> {
  return run(
    INTERVIEW_STEP_PROMPT(history),
    (raw) => validateDecision(raw),
    () => interviewStepLocal(history),
    { maxTokens: 200, temperature: 0.4 },
  );
}

/**
 * Condense a completed interview into a structured profile: the business fields
 * plus Gemma's inferred customer picture (who they are, how to recognize them,
 * where they gather, how to reach them). Geo/name come from `base` — never the
 * model — so coordinates can't be hallucinated.
 */
export async function summarizeInterview(
  history: InterviewTurn[],
  base: BusinessProfileInput,
): Promise<WithMeta<InterviewProfile>> {
  return run(
    INTERVIEW_SUMMARY_PROMPT(history, base),
    (raw) => validateProfile(raw, base),
    () => summarizeInterviewLocal(history, base),
    { maxTokens: 500, temperature: 0.3 },
  );
}

/**
 * Hybrid ranking. The deterministic ranker guarantees EVERY candidate is present
 * (with real coords/facts); Gemma's scores and reasoning are merged over it
 * wherever the model spoke. Small on-device models don't reliably emit all N
 * array items, so this backfill is what lets the UI always show a complete,
 * reasoned list — and `meta.note` stays honest about how much Gemma covered.
 */
export async function rankOpportunities(
  profile: BusinessProfileInput,
  analysis: BusinessAnalysis,
  candidates: PlaceCandidate[],
): Promise<WithMeta<RankedOpportunity[]>> {
  const baseline = rankOpportunitiesLocal(profile, analysis, candidates);
  const model = GemmaConfig.model;

  if (!GemmaConfig.enabled) {
    return { data: baseline, meta: meta('fallback', model, 0, false, 'Gemma disabled via config.') };
  }

  let latencyMs = 0;
  try {
    const { text, latencyMs: ms } = await transport.generate(RANK_PROMPT(profile, analysis, candidates), {
      maxTokens: 1600, // room for reasons + evidence + confidence per candidate
      temperature: 0.3, // lower temp ⇒ more reliable JSON from the small model
    });
    latencyMs = ms;
    const ranked = validateRanked(parseJson(text), candidates); // grounded subset, may be []
    if (!ranked.length) {
      return { data: baseline, meta: meta('fallback', model, latencyMs, false, 'Model returned no usable ranking.') };
    }
    const merged = mergeRankings(baseline, ranked);
    const note =
      ranked.length < candidates.length
        ? `Gemma ranked ${ranked.length}/${candidates.length}; remainder ordered on-device.`
        : undefined;
    return { data: merged, meta: meta('gemma', model, latencyMs, true, note) };
  } catch (err) {
    return { data: baseline, meta: meta('fallback', model, latencyMs, false, describeError(err)) };
  }
}

/** Prefer Gemma's entry per id, backfill with the deterministic one, re-sort. */
function mergeRankings(baseline: RankedOpportunity[], gemma: RankedOpportunity[]): RankedOpportunity[] {
  const byId = new Map(gemma.map((o) => [o.id, o]));
  return baseline.map((b) => byId.get(b.id) ?? b).sort((a, b) => b.score - a.score);
}

export async function generateOutreach(
  profile: BusinessProfileInput,
  opportunity: RankedOpportunity,
  channel: OutreachChannel,
  tone: OutreachTone,
): Promise<WithMeta<OutreachDraft>> {
  return run(
    OUTREACH_PROMPT(profile, opportunity, channel, tone),
    (raw) => validateOutreach(raw, channel, tone),
    () => generateOutreachLocal(profile, opportunity, channel, tone),
    { maxTokens: 400, temperature: 0.6 },
  );
}

/* -------------------------------------------------------------------------- */
/* Orchestration: try Gemma → validate → else deterministic fallback          */
/* -------------------------------------------------------------------------- */

async function run<T>(
  prompt: string,
  validate: (raw: unknown) => T,
  fallback: () => T,
  opts?: { maxTokens?: number; temperature?: number },
): Promise<WithMeta<T>> {
  const model = GemmaConfig.model;

  if (!GemmaConfig.enabled) {
    return { data: fallback(), meta: meta('fallback', model, 0, false, 'Gemma disabled via config.') };
  }

  let latencyMs = 0;
  try {
    const { text, latencyMs: ms } = await transport.generate(prompt, opts);
    latencyMs = ms;
    const parsed = parseJson(text);
    const data = validate(parsed); // throws on malformed / off-contract output
    return { data, meta: meta('gemma', model, latencyMs, true) };
  } catch (err) {
    return {
      data: fallback(),
      meta: meta('fallback', model, latencyMs, false, describeError(err)),
    };
  }
}

function meta(
  source: InferenceMeta['source'],
  model: string,
  latencyMs: number,
  validated: boolean,
  note?: string,
): InferenceMeta {
  return { source, model, latencyMs, validated, note };
}

/* -------------------------------------------------------------------------- */
/* JSON extraction + validation (never trust raw model output)                */
/* -------------------------------------------------------------------------- */

/** Parse model text as JSON, tolerating prose or code fences around the object. */
export function parseJson(text: string): unknown {
  const trimmed = (text ?? '').trim();
  if (!trimmed) throw new Error('Empty model response');
  try {
    return JSON.parse(trimmed);
  } catch {
    // Fall back to the first {...} or [...] block in the text.
    const match = trimmed.match(/[{[][\s\S]*[}\]]/);
    if (!match) throw new Error('No JSON found in model response');
    return JSON.parse(match[0]);
  }
}

function asObject(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('Expected a JSON object');
  return v as Record<string, unknown>;
}

function asStringArray(v: unknown, max = 4): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x) => typeof x === 'string' && x.trim()).slice(0, max) as string[];
}

/** Coerce free-text category guesses onto our closed set (the model strays). */
export function coerceCategory(v: unknown): OpportunityCategory | null {
  if (typeof v !== 'string') return null;
  const s = v.toLowerCase();
  const exact = OPPORTUNITY_CATEGORIES.find((c) => c === s);
  if (exact) return exact;
  if (/recur|contract|account|standing|fleet|cater|subscription|retainer|b2b/.test(s)) return 'recurring';
  if (/partner|collab|venue|referr|co-?market|brewery|apartment|salon|gym/.test(s)) return 'partnership';
  if (/event|festival|market|tournament|game|sport|fair|expo/.test(s)) return 'event';
  if (/direct|walk-?up|foot|traffic|lunch|office|weekday|rush|retail|consumer/.test(s)) return 'direct';
  return null;
}

/** Coerce free-text segment-type guesses onto our closed archetype set. */
export function coerceSegmentType(v: unknown): CustomerSegmentType | null {
  if (typeof v !== 'string') return null;
  const s = v.toLowerCase();
  const exact = CUSTOMER_SEGMENT_TYPES.find((t) => t === s);
  if (exact) return exact;
  if (/apartment|resident|hoa|housing|community|neighborhood/.test(s)) return 'residential-community';
  if (/event|venue|resort|wedding|sport|complex|arena/.test(s)) return 'event-venue';
  if (/market|festival|fair|gathering|tournament|street/.test(s)) return 'public-gathering';
  if (/partner|nonprofit|school|church|org|club/.test(s)) return 'partner-org';
  if (/office|business|brewery|bar|retail|store|campus|company/.test(s)) return 'physical-business';
  return null;
}

/** Coerce free-text reach/channel guesses onto our closed outreach-channel set. */
export function coerceReach(v: unknown): OutreachChannel | null {
  if (typeof v !== 'string') return null;
  const s = v.toLowerCase();
  if (/walk|in.?person|visit|drop.?by|door/.test(s)) return 'walk-in';
  if (/phone|call|text|sms/.test(s)) return 'phone';
  if (/email|mail|message|form/.test(s)) return 'email';
  return null;
}

/** Default reach for a segment type, when the model omits or garbles it. */
const SEGMENT_DEFAULT_REACH: Record<CustomerSegmentType, OutreachChannel> = {
  'physical-business': 'walk-in',
  'residential-community': 'phone',
  'event-venue': 'email',
  'public-gathering': 'phone',
  'partner-org': 'walk-in',
};

function clampScore(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return 60;
  const scaled = n > 0 && n <= 1 ? n * 100 : n; // accept 0–1 or 0–100
  return Math.max(0, Math.min(100, Math.round(scaled)));
}

export function validateAnalysis(raw: unknown): BusinessAnalysis {
  const o = asObject(raw);
  const summary = typeof o.summary === 'string' ? o.summary.trim() : '';
  const focus = typeof o.focus === 'string' ? o.focus.trim() : '';
  if (!summary || !focus) throw new Error('Analysis missing summary/focus');
  const recommended = asStringArray(o.recommendedCategories, 4)
    .map(coerceCategory)
    .filter((c): c is OpportunityCategory => c !== null);
  const recommendedCategories: OpportunityCategory[] = recommended.length
    ? dedupe(recommended)
    : ['recurring', 'partnership'];
  return {
    summary,
    focus,
    strengths: asStringArray(o.strengths, 4),
    recommendedCategories,
    targetSegments: validateSegments(o.targetSegments, recommendedCategories),
  };
}

function asString(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

/** Parse one model segment, dropping it unless the closed-set fields survive. */
function parseSegment(raw: unknown): CustomerSegment | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const type = coerceSegmentType(o.type);
  const category = coerceCategory(o.category);
  const label = asString(o.label);
  if (!type || !category || !label) return null;
  return {
    label,
    type,
    whoTheyAre: asString(o.whoTheyAre),
    discovery: asString(o.discovery),
    mapsQuery: asString(o.mapsQuery) || undefined,
    reach: coerceReach(o.reach) ?? SEGMENT_DEFAULT_REACH[type],
    why: asString(o.why),
    category,
  };
}

/**
 * Validate the model's target segments; if none survive, synthesize a sensible
 * set from the recommended categories so the "who to look for" field is never
 * empty (the thinking screen always has cards to reveal).
 */
export function validateSegments(
  raw: unknown,
  recommendedCategories: OpportunityCategory[],
): CustomerSegment[] {
  const arr = Array.isArray(raw) ? raw : [];
  const parsed = arr
    .map(parseSegment)
    .filter((s): s is CustomerSegment => s !== null)
    .slice(0, 5);
  return parsed.length ? parsed : segmentsFromCategories(recommendedCategories);
}

/** A safe next question when the model flags "not done" but omits one. */
const FALLBACK_GAP_QUESTION =
  'Where do your best customers tend to be — the kinds of places, neighborhoods, or events where they gather?';

export function validateDecision(raw: unknown): InterviewDecision {
  const o = asObject(raw);
  const done = o.done === true || o.done === 'true';
  if (done) return { done: true };
  const question = typeof o.question === 'string' && o.question.trim() ? o.question.trim() : '';
  const placeholder =
    typeof o.placeholder === 'string' && o.placeholder.trim() ? o.placeholder.trim() : undefined;
  return { done: false, question: question || FALLBACK_GAP_QUESTION, placeholder };
}

export function validateProfile(raw: unknown, base: BusinessProfileInput): InterviewProfile {
  const o = asObject(raw);
  const c = o.customer && typeof o.customer === 'object' ? (o.customer as Record<string, unknown>) : {};
  const customer: CustomerProfile = {
    description:
      typeof c.description === 'string' && c.description.trim()
        ? c.description.trim()
        : `Customers who need a ${base.type}`,
    signals: asStringArray(c.signals, 4),
    locations: asStringArray(c.locations, 6),
    outreach: asStringArray(c.outreach, 4),
  };

  const goals = asStringArray(o.goals, 4);
  const capabilities = asStringArray(o.capabilities, 4);

  // Geo/name always come from `base` — the model only supplies the soft fields.
  return {
    ...base,
    type: typeof o.type === 'string' && o.type.trim() ? o.type.trim() : base.type,
    description:
      typeof o.description === 'string' && o.description.trim() ? o.description.trim() : base.description,
    availability:
      typeof o.availability === 'string' && o.availability.trim()
        ? o.availability.trim()
        : base.availability,
    goals: goals.length ? goals : base.goals,
    capabilities: capabilities.length ? capabilities : base.capabilities,
    customer,
  };
}

/**
 * The model ranks/justifies; we keep the *facts* (coords, address, distance) from
 * our own candidate data so it can never hallucinate a location. It only supplies
 * score, reasons, risks, best time, and the recommended action.
 */
export function validateRanked(raw: unknown, candidates: PlaceCandidate[]): RankedOpportunity[] {
  const arr = Array.isArray(raw) ? raw : asObject(raw).opportunities;
  if (!Array.isArray(arr)) throw new Error('Ranking is not an array');
  const byId = new Map(candidates.map((c) => [c.id, c]));

  const ranked = arr
    .map((item) => {
      const o = asObject(item);
      const source = byId.get(String(o.id));
      if (!source) return null; // ignore anything not grounded in our candidates
      const category = coerceCategory(o.category) ?? source.category;
      const reasons = asStringArray(o.reasons, 3);
      if (!reasons.length) return null; // a ranking with no reasoning is worthless
      // Evidence must be verifiable: keep the model's lines only when they echo
      // the grounding we gave it; always anchor with the known facts.
      const evidence = dedupe([
        ...groundedEvidence(asStringArray(o.evidence, 3), source),
        ...factEvidence(source),
      ]).slice(0, 3);
      const result: RankedOpportunity = {
        id: source.id,
        name: source.name,
        category,
        score: clampScore(o.score),
        confidence: clampScore(o.confidence ?? 65),
        latitude: source.latitude,
        longitude: source.longitude,
        address: source.address,
        distanceMiles: source.distanceMiles,
        evidence,
        bestTime: typeof o.bestTime === 'string' && o.bestTime.trim() ? o.bestTime.trim() : 'Flexible',
        summary: typeof o.summary === 'string' ? o.summary.trim() : `${source.name} — ${category}`,
        reasons,
        risks: asStringArray(o.risks, 3),
        recommendedAction:
          typeof o.recommendedAction === 'string' && o.recommendedAction.trim()
            ? o.recommendedAction.trim()
            : `Reach out to ${source.name}.`,
        estimatedValue: typeof o.estimatedValue === 'string' ? o.estimatedValue : undefined,
        phone: source.phone,
        website: source.website,
        rating: source.rating,
        reviewCount: source.reviewCount,
      };
      return result;
    })
    .filter((x): x is RankedOpportunity => x !== null)
    .sort((a, b) => b.score - a.score);

  // May be empty (model grounded nothing) — the caller merges/backfills.
  return ranked;
}

/**
 * Grounding guard for evidence lines: keep a model-written line only when it
 * overlaps the data we actually gave the model about this candidate. This is
 * what lets the UI present "backed by" facts without trusting free generation.
 */
function groundedEvidence(lines: string[], source: PlaceCandidate): string[] {
  const grounding =
    `${source.name} ${source.context ?? ''} ${source.category} ${source.address} ` +
    `${source.rating ?? ''} ${source.reviewCount ?? ''} rating reviews stars`.toLowerCase();
  return lines.filter((line) => {
    const words = line.toLowerCase().match(/[a-z]{5,}/g) ?? [];
    return words.some((w) => grounding.includes(w));
  });
}

/** The always-true facts about a candidate, as evidence lines. */
function factEvidence(source: PlaceCandidate): string[] {
  const facts = [`${source.distanceMiles.toFixed(1)} mi from you`];
  if (source.rating !== undefined) {
    facts.push(
      `${source.rating.toFixed(1)}★${source.reviewCount ? ` across ${source.reviewCount} reviews` : ' on Google'}`,
    );
  }
  if (source.context) facts.push(capitalizeFirst(source.context));
  return facts;
}

function capitalizeFirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function validateOutreach(
  raw: unknown,
  channel: OutreachChannel,
  tone: OutreachTone,
): OutreachDraft {
  const o = asObject(raw);
  const body = typeof o.body === 'string' ? o.body.trim() : '';
  if (!body) throw new Error('Outreach missing body');
  return {
    channel,
    tone,
    subject: typeof o.subject === 'string' && o.subject.trim() ? o.subject.trim() : undefined,
    body,
  };
}

/* -------------------------------------------------------------------------- */
/* Prompts (grounded, JSON-only, no chain-of-thought requested)               */
/* -------------------------------------------------------------------------- */

const JSON_RULES =
  'Respond with ONLY a single minified JSON value. No markdown, no prose, no explanation of your reasoning.';

/**
 * The customer taxonomy Gemma classifies prospects into — keyed by HOW each kind
 * is discovered and reached, so a discovery strategy + outreach channel follow
 * from the type. Kept compact and closed so the small model stays on-contract.
 */
const CUSTOMER_TAXONOMY = [
  'physical-business (offices, breweries, retail — found on Maps, reached by walk-in/phone)',
  'residential-community (apartments, HOAs — found on Maps, reached via property manager)',
  'event-venue (sports complexes, resorts, wedding venues — found on Maps/listings, reached by email/phone)',
  'public-gathering (markets, festivals, tournaments — found via event calendars/social, reached via organizer)',
  'partner-org (complementary local orgs to co-market with — found on Maps, reached by walk-in)',
].join(' · ');

function ANALYZE_PROMPT(p: BusinessProfileInput | InterviewProfile): string {
  const customer = 'customer' in p ? p.customer : undefined;
  return [
    `You are an experienced growth consultant who has helped many businesses like this one. Think like an owner-operator: concrete places, real buyers, this week.`,
    `Business: ${p.name}, a ${p.type} in ${p.city}. Serves within ${p.serviceRadiusMiles} miles.`,
    p.availability ? `Availability: ${p.availability}.` : '',
    `Owner's goals: ${p.goals.join('; ') || 'grow revenue'}.`,
    `What they're great at: ${p.capabilities.join('; ') || 'core service'}.`,
    customer
      ? `Ideal customer so far: ${customer.description}. Buying signals: ${customer.signals.join('; ')}. Gathers at: ${customer.locations.join(', ')}.`
      : '',
    `Analyze where a ${p.type} with these strengths should focus to hit these goals. "focus" must be ONE concrete mission for today: start with an action verb, name the buyer type and a countable target, and make it specific to THIS business — no generic phrasing, and do not copy wording from these instructions.`,
    'Then decide WHAT KINDS OF CUSTOMERS to look for. Every segment must be specific to a ' +
      p.type +
      " — name the kind of place or buyer, why they need THIS service, and why they'd pay repeatedly. Classify each into exactly one type from this taxonomy, and give its discovery method (how to FIND them) and reach channel (how to CONTACT them):",
    CUSTOMER_TAXONOMY,
    'Return 3–5 target segments, best-first. Rank segments that serve the owner\'s stated goals highest (recurring goals ⇒ recurring segments first).',
    'Category meanings: recurring = standing accounts/contracts; partnership = venues/orgs to co-serve or co-market with; event = high-volume gatherings; direct = high-traffic spots to serve individuals.',
    '"type" is one of: physical-business|residential-community|event-venue|public-gathering|partner-org. "reach" is one of: walk-in|phone|email. "category" is one of: recurring|partnership|event|direct. "mapsQuery" is the literal 2–5 word phrase to type into Google Maps to find this segment nearby (a kind of place, e.g. "property management offices" — never an instruction). Keep every string under 14 words.',
    'JSON shape: {"summary":string,"strengths":string[2..3],"focus":string,"recommendedCategories":("recurring"|"partnership"|"event"|"direct")[],"targetSegments":[{"label":string,"type":string,"whoTheyAre":string,"discovery":string,"mapsQuery":string,"reach":string,"why":string,"category":string}]}',
    JSON_RULES,
  ]
    .filter(Boolean)
    .join('\n');
}

/** The distilled customer-discovery lens that guides the adaptive interview. */
const EXPANSION_QUESTIONS = [
  'Who needs this?',
  'How would I recognize them?',
  'Where do they physically gather (places, neighborhoods, events)?',
  'What problem are they trying to solve?',
  'What signals show they need help right now?',
  'How can I reach them?',
  'How valuable are they, and how likely to buy?',
  'How could I find ten more just like them?',
].join(' · ');

function transcript(history: InterviewTurn[]): string {
  if (!history.length) return '(no answers yet)';
  return history.map((t, i) => `Q${i + 1}: ${t.question}\nA${i + 1}: ${t.answer}`).join('\n');
}

function INTERVIEW_STEP_PROMPT(history: InterviewTurn[]): string {
  return [
    'You are an experienced local-business growth consultant running a SHORT discovery interview with a busy owner.',
    'Your goal: gather just enough to confidently infer WHO their ideal customer is, HOW to recognize them, WHERE they physically gather, and HOW to reach them — enough to search for real nearby places to grow into.',
    `Use this lens to find the biggest missing gap: ${EXPANSION_QUESTIONS}`,
    'Conversation so far:',
    transcript(history),
    'Decide the single most useful NEXT step. Ask ONE focused question that fills the biggest gap and, when possible, unlocks physical-place searches. Never ask what you can already infer from the answers above. Keep the question under 20 words and plain-spoken.',
    'Set "done" to true as soon as you could confidently describe the ideal customer and where to find them — do not pad the interview.',
    'JSON shape: {"done":boolean,"question":string,"placeholder":string}. When done is true, question/placeholder may be empty.',
    JSON_RULES,
  ].join('\n');
}

function INTERVIEW_SUMMARY_PROMPT(history: InterviewTurn[], base: BusinessProfileInput): string {
  return [
    'You are a local-business growth consultant. Condense this discovery interview into a structured profile.',
    `Business name: ${base.name}. Location: ${base.city} (serves within ${base.serviceRadiusMiles} miles).`,
    'Interview:',
    transcript(history),
    'Infer the ideal-customer picture that will drive searches for real nearby places. "locations" must be concrete, searchable place types (e.g. "office parks", "breweries with patios", "weekend sports tournaments").',
    'Do NOT output city, coordinates, or radius — those are already known. Keep every string under 16 words.',
    'JSON shape: {"type":string,"description":string,"availability":string,"goals":string[2..3],"capabilities":string[2..3],"customer":{"description":string,"signals":string[2..3],"locations":string[3..5],"outreach":string[2..3]}}',
    JSON_RULES,
  ].join('\n');
}

function RANK_PROMPT(
  p: BusinessProfileInput,
  a: BusinessAnalysis,
  candidates: PlaceCandidate[],
): string {
  const list = candidates.map((c) => ({
    id: c.id,
    name: c.name,
    category: c.category,
    distanceMiles: Number(c.distanceMiles.toFixed(1)),
    context: c.context ?? '',
    ...(c.rating !== undefined ? { rating: c.rating, reviews: c.reviewCount ?? 0 } : {}),
  }));
  return [
    `You are a growth consultant ranking nearby opportunities for a ${p.type}. Think like an operator: who is the buyer at each place, what exactly do they buy, how does the first sale happen.`,
    `Business: ${p.name} (${p.type}) in ${p.city}. Today's focus: ${a.focus}.`,
    `Owner's goals: ${p.goals.join('; ') || 'grow revenue'}. Great at: ${p.capabilities.join('; ') || 'core service'}.`,
    `Candidates (JSON): ${JSON.stringify(list)}`,
    `Output EXACTLY ${candidates.length} objects — one for every id: [${candidates.map((c) => c.id).join(', ')}]. Omitting any id is an error. Order them best-first — candidates that serve the owner's goals rank higher. Use ONLY the given id/category — never invent places.`,
    'For each: score 0–100; "confidence" 0–100 (how sure you are given the data — be honest, lower it when the context is thin); "bestTime" (day + time window when the buyer is reachable); a one-line "summary" naming WHO buys and WHAT they buy; TWO short "reasons" (why it fits THIS business and its goals); TWO "evidence" lines quoting only facts from the candidate data above (distance, context) — never invented numbers; ONE "risk"; one "recommendedAction" that is a first move an owner could do TODAY — name the person to ask for and the specific offer to lead with (e.g. "Ask the fleet manager; offer one free demo on their dirtiest van"); and "estimatedValue" as a conservative dollar range with a period (e.g. "$300–600/mo"). Keep every string under 16 words.',
    'JSON shape: {"opportunities":[{"id":string,"category":string,"score":number,"confidence":number,"bestTime":string,"summary":string,"reasons":string[2],"evidence":string[2],"risks":string[1],"recommendedAction":string,"estimatedValue":string}]}',
    JSON_RULES,
  ].join('\n');
}

function OUTREACH_PROMPT(
  p: BusinessProfileInput,
  o: RankedOpportunity,
  channel: OutreachChannel,
  tone: OutreachTone,
): string {
  const format =
    channel === 'email'
      ? 'a short email (under 120 words): specific subject, one-line who-we-are, the concrete offer, one low-friction ask with a day/time.'
      : channel === 'phone'
        ? 'a 30-second call script: intro line, the concrete offer, one question to land a specific next step.'
        : 'a natural in-person opener (2–4 sentences): who you are, the concrete offer, and the ask.';
  return [
    `You are drafting a ${tone} ${channel} outreach message for a local business owner. Write ${format}`,
    `From: ${p.name}, a ${p.type} in ${p.city}.${p.capabilities[0] ? ` Their edge: ${p.capabilities[0]}.` : ''}`,
    `To: ${o.name} (${o.category}). The move: ${o.recommendedAction}`,
    'Lead with what THEY get, not what you want. Make the ask easy to say yes to (a free sample/demo/trial beats a contract). Use ONLY facts given above — do not invent names, numbers, discounts, or offers.',
    channel === 'email'
      ? 'JSON shape: {"subject":string,"body":string}'
      : 'JSON shape: {"body":string}',
    JSON_RULES,
  ].join('\n');
}

/* -------------------------------------------------------------------------- */
/* small utils                                                                */
/* -------------------------------------------------------------------------- */

function dedupe<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

function nowMs(): number {
  // performance.now when present (RN/web), else Date.now (Node).
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

function describeError(err: unknown): string {
  if (err instanceof Error) {
    if (err.name === 'AbortError') return `Timed out after ${GemmaConfig.timeoutMs}ms.`;
    return err.message;
  }
  return 'Unknown reasoning error';
}
