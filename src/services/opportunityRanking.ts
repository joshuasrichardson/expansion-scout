/**
 * Deterministic, local fallbacks for the reasoning layer.
 *
 * These run with no model and no network. They exist so the demo *never* hangs
 * or blanks when Gemma is unavailable (missing runtime, timeout, malformed JSON).
 * Resilience is a feature (CLAUDE.md) — but this is the safety net, not the star.
 * The scored demo should run on real on-device Gemma; see `gemma.ts`.
 *
 * The output shape is identical to Gemma's, so the UI cannot tell which path
 * answered except by reading `InferenceMeta.source`.
 */

import {
  MIN_QUESTIONS,
  type BusinessAnalysis,
  type BusinessProfileInput,
  type CustomerProfile,
  type CustomerSegment,
  type CustomerSegmentType,
  type InterviewDecision,
  type InterviewProfile,
  type InterviewTurn,
  type OpportunityCategory,
  type OutreachChannel,
  type OutreachDraft,
  type OutreachTone,
  type PlaceCandidate,
  type RankedOpportunity,
} from './gemmaTypes';

/** Relative weight per category — recurring, high-value work ranks higher. */
const CATEGORY_WEIGHT: Record<OpportunityCategory, number> = {
  catering: 1.0, // recurring, high ticket
  partnership: 0.9, // recurring foot-traffic
  event: 0.75, // one-off but high volume
  lunch: 0.7, // steady but lower ticket
};

const CATEGORY_BEST_TIME: Record<OpportunityCategory, string> = {
  lunch: 'Weekdays 11:30a–1:30p',
  partnership: 'Weekday mid-afternoon (2–4p)',
  catering: 'Weekday mornings',
  event: 'Evenings & weekends',
};

const CATEGORY_VALUE: Record<OpportunityCategory, string> = {
  catering: '~$600–900/mo recurring',
  partnership: '~$400–700/mo recurring',
  event: '~$500–1,200 per event',
  lunch: '~$200–400/wk',
};

/**
 * A curated, ordered discovery script — the offline backbone of the adaptive
 * interview. Each item covers a different slice of the customer-discovery lens,
 * ordered so the earliest answers unlock the most search value.
 */
const INTERVIEW_SCRIPT: { question: string; placeholder: string }[] = [
  {
    question: 'Which type of customer buys the most from you today?',
    placeholder: 'e.g. weekday office crowds, families at weekend events',
  },
  {
    question: 'Where do those customers tend to gather — what kinds of places or events?',
    placeholder: 'e.g. office parks, breweries, apartment complexes, tournaments',
  },
  {
    question: 'When are you available to serve them?',
    placeholder: 'e.g. weekdays 10a–8p, some Saturdays',
  },
  {
    question: 'What has been holding you back from growing?',
    placeholder: 'e.g. slow weekday afternoons, unsure which spots to target',
  },
];

/**
 * Deterministic interview loop: hand back the next unused scripted question, or
 * stop once the script is exhausted or we've met the minimum. Mirrors what Gemma
 * does, minus the adaptivity, so the flow never stalls offline.
 */
export function interviewStepLocal(history: InterviewTurn[]): InterviewDecision {
  const next = INTERVIEW_SCRIPT[history.length - 1]; // history[0] is the seed opener
  if (!next || history.length >= Math.max(MIN_QUESTIONS, INTERVIEW_SCRIPT.length)) {
    return { done: true };
  }
  return { done: false, question: next.question, placeholder: next.placeholder };
}

/**
 * Deterministic profile extraction: fold the free-text answers into the business
 * fields and synthesize a reasonable customer picture over `base`. For the demo
 * taco truck `base` is `demoBusiness`, so this always yields a non-empty profile.
 */
export function summarizeInterviewLocal(
  history: InterviewTurn[],
  base: BusinessProfileInput,
): InterviewProfile {
  const answers = history.map((t) => t.answer.trim()).filter(Boolean);
  const [wants, who, where, when] = answers;

  const description = wants ? `${base.name}: ${wants}` : base.description ?? `${base.type} in ${base.city}`;

  const customer: CustomerProfile = {
    description: who || `Local customers who need a ${base.type} in ${base.city}`,
    signals: ['Nearby and easy to reach', 'Predictable, recurring demand'],
    locations: splitLocations(where) ?? [
      'Office parks',
      'Breweries and taprooms',
      'Apartment complexes',
      'Weekend events and tournaments',
    ],
    outreach: ['Walk in and introduce yourself', 'Call or email the manager'],
  };

  return {
    ...base,
    description,
    availability: when || base.availability,
    goals: wants ? Array.from(new Set([wants, ...base.goals])).slice(0, 3) : base.goals,
    customer,
  };
}

/** Turn a free-text "where" answer into a few searchable place types. */
function splitLocations(where?: string): string[] | null {
  if (!where) return null;
  const parts = where
    .split(/[,;]|\band\b|\bor\b/i)
    .map((s) => s.trim())
    .filter((s) => s.length > 2);
  return parts.length ? parts.slice(0, 5) : null;
}

export function analyzeBusinessLocal(profile: BusinessProfileInput | InterviewProfile): BusinessAnalysis {
  const goal = profile.goals[0]?.toLowerCase() ?? '';
  const wantsRecurring = /recur|steady|regular|catering|contract/.test(goal);
  const recommended: OpportunityCategory[] = wantsRecurring
    ? ['catering', 'partnership', 'lunch', 'event']
    : ['partnership', 'lunch', 'catering', 'event'];
  const customer = 'customer' in profile ? profile.customer : undefined;

  return {
    summary: `${profile.name} is a ${profile.type} in ${profile.city} serving within ${profile.serviceRadiusMiles} miles. The clearest path to growth is turning one-off sales into recurring, predictable revenue nearby.`,
    strengths: [
      'Mobile — can meet demand wherever it clusters',
      profile.capabilities[0] ?? 'Fast service with a focused menu',
      'Low overhead vs. a fixed storefront',
    ].filter(Boolean),
    focus: wantsRecurring
      ? 'Land one recurring customer (catering or a standing partnership) this week'
      : 'Put the truck where hungry crowds already gather at predictable times',
    recommendedCategories: recommended,
    targetSegments: segmentsFromCategories(recommended, customer),
  };
}

/**
 * A per-category segment template — the deterministic mapping from an opportunity
 * category to the *kind* of customer it represents, with its discovery method and
 * reach channel. `segmentsFromCategories` personalizes the label/discovery from the
 * owner's own answers (`customer.locations`) when they match, else uses the template.
 */
const CATEGORY_SEGMENT: Record<
  OpportunityCategory,
  Omit<CustomerSegment, 'category'> & { keywords: RegExp }
> = {
  lunch: {
    type: 'physical-business',
    reach: 'walk-in',
    label: 'Nearby workplaces at lunch',
    whoTheyAre: 'Office crowds with few fast lunch options',
    discovery: 'Search Maps for office parks within your radius',
    why: 'Steady weekday demand fills slow afternoons',
    keywords: /office|campus|company|tech|business park|workplace/i,
  },
  partnership: {
    type: 'physical-business',
    reach: 'walk-in',
    label: 'Venues without a kitchen',
    whoTheyAre: 'Breweries & taprooms whose guests want food',
    discovery: 'Search Maps for breweries and bars nearby',
    why: 'Recurring foot traffic with a built-in crowd',
    keywords: /brewery|bar|taproom|pub|venue|apartment|complex|hoa|resident/i,
  },
  catering: {
    type: 'event-venue',
    reach: 'email',
    label: 'Offices & venues that host events',
    whoTheyAre: 'Workplaces booking group lunches and parties',
    discovery: 'Search Maps for corporate offices & event venues',
    why: 'High-ticket, recurring catering orders',
    keywords: /corporate|event|wedding|resort|conference|banquet/i,
  },
  event: {
    type: 'public-gathering',
    reach: 'phone',
    label: 'Weekend events & tournaments',
    whoTheyAre: 'Families gathering at recurring local events',
    discovery: 'Check event calendars for markets & tournaments',
    why: 'High-volume weekend sales when you are free',
    keywords: /market|festival|fair|tournament|game|sport|gathering/i,
  },
};

// Some locations imply a residential archetype more specifically than the
// partnership template's default "physical-business" — refine after matching.
const RESIDENTIAL = /apartment|complex|hoa|resident|housing|neighborhood/i;

/**
 * Build 3–5 target customer segments deterministically. Guarantees coverage of
 * the recommended categories (so the list is never empty offline), and, when the
 * owner named concrete places in the interview, personalizes the matching segment
 * from their own words. Shared by the Gemma path (synthesize-when-empty) and the
 * offline fallback, so both produce the same shape.
 */
export function segmentsFromCategories(
  categories: OpportunityCategory[],
  customer?: CustomerProfile,
): CustomerSegment[] {
  const cats: OpportunityCategory[] = categories.length ? categories : ['catering', 'partnership'];
  const locations = customer?.locations ?? [];
  const seen = new Set<OpportunityCategory>();
  const segments: CustomerSegment[] = [];

  for (const cat of cats) {
    if (seen.has(cat)) continue;
    seen.add(cat);
    const t = CATEGORY_SEGMENT[cat];
    const match = locations.find((l) => t.keywords.test(l));
    let type: CustomerSegmentType = t.type;
    let reach: OutreachChannel = t.reach;
    if (match && RESIDENTIAL.test(match)) {
      type = 'residential-community';
      reach = 'phone';
    }
    segments.push({
      label: match ? titleCase(match) : t.label,
      type,
      whoTheyAre: t.whoTheyAre,
      discovery: match ? `Search Maps for ${match.toLowerCase()} nearby` : t.discovery,
      reach,
      why: t.why,
      category: cat,
    });
    if (segments.length >= 5) break;
  }

  return segments;
}

/** Title-case a short free-text place phrase for use as a segment label. */
function titleCase(s: string): string {
  const cleaned = s.trim().replace(/\s+/g, ' ');
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

/**
 * Score = category weight (0–1) × distance decay, mapped to 0–100.
 * Closer + higher-value category ⇒ higher score. Fully deterministic.
 */
export function rankOpportunitiesLocal(
  profile: BusinessProfileInput,
  analysis: BusinessAnalysis,
  candidates: PlaceCandidate[],
): RankedOpportunity[] {
  const focusBoost = new Set(analysis.recommendedCategories.slice(0, 2));

  return candidates
    .map((c) => {
      const weight = CATEGORY_WEIGHT[c.category] ?? 0.6;
      // Distance decay: full credit within 3mi, tapering to the service radius.
      const radius = Math.max(profile.serviceRadiusMiles, 1);
      const distanceFactor = Math.max(0.35, 1 - c.distanceMiles / (radius * 1.5));
      const boost = focusBoost.has(c.category) ? 1.08 : 1;
      const score = Math.round(Math.min(100, weight * distanceFactor * boost * 100));
      const travelMinutes = Math.max(4, Math.round(c.distanceMiles * 3));

      return {
        id: c.id,
        name: c.name,
        category: c.category,
        score,
        latitude: c.latitude,
        longitude: c.longitude,
        address: c.address,
        distanceMiles: c.distanceMiles,
        bestTime: CATEGORY_BEST_TIME[c.category],
        summary: `${c.name} is a strong ${c.category} fit ${c.distanceMiles.toFixed(1)} mi away (~${travelMinutes} min).`,
        reasons: buildReasons(c),
        risks: buildRisks(c),
        recommendedAction: buildAction(c),
        estimatedValue: CATEGORY_VALUE[c.category],
      } satisfies RankedOpportunity;
    })
    .sort((a, b) => b.score - a.score);
}

function buildReasons(c: PlaceCandidate): string[] {
  const base: Record<OpportunityCategory, string[]> = {
    catering: ['Recurring orders beat one-off walk-ups', 'Corporate budgets pay on time'],
    partnership: ['Steady built-in foot traffic', 'Shared audience, no ad spend'],
    event: ['High volume in a short window', 'One yes reaches hundreds of people'],
    lunch: ['Predictable weekday rush', 'Short drive keeps margins healthy'],
  };
  const reasons = [...base[c.category]];
  if (c.context) reasons.unshift(c.context);
  return reasons.slice(0, 3);
}

function buildRisks(c: PlaceCandidate): string[] {
  const base: Record<OpportunityCategory, string[]> = {
    catering: ['May require a minimum order or lead time'],
    partnership: ['Needs a permission/permit from the venue'],
    event: ['Vendor fee or application may apply'],
    lunch: ['Competition from nearby options'],
  };
  return base[c.category];
}

function buildAction(c: PlaceCandidate): string {
  switch (c.category) {
    case 'catering':
      return `Call ${c.name} and offer a free tasting for their next team lunch.`;
    case 'partnership':
      return `Walk into ${c.name} and pitch a weekly taco night on their patio.`;
    case 'event':
      return `Email ${c.name} to ask about their upcoming vendor slots.`;
    case 'lunch':
      return `Park near ${c.name} during the weekday rush and hand out samples.`;
  }
}

export function generateOutreachLocal(
  profile: BusinessProfileInput,
  opportunity: RankedOpportunity,
  channel: OutreachChannel,
  tone: OutreachTone,
): OutreachDraft {
  const opener: Record<OutreachTone, string> = {
    friendly: `Hi there! I'm with ${profile.name}, a local ${profile.type} here in ${profile.city}.`,
    professional: `Hello, I'm reaching out on behalf of ${profile.name}, a ${profile.type} serving ${profile.city}.`,
    direct: `I run ${profile.name}, a ${profile.type} in ${profile.city}.`,
  };

  const ask = `I'd love to explore ${opportunity.category === 'catering' ? 'catering for your team' : `working with ${opportunity.name}`}. ${opportunity.recommendedAction}`;

  const body =
    channel === 'walk-in'
      ? `${opener[tone]} I'm stopping by in person — ${ask}`
      : `${opener[tone]} ${ask}\n\nWould this week work for a quick chat?\n\n— ${profile.name}`;

  return {
    channel,
    tone,
    subject: channel === 'email' ? `${profile.name} × ${opportunity.name}` : undefined,
    body,
  };
}
