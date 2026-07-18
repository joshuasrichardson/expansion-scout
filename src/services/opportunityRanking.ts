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
  recurring: 1.0, // standing accounts — predictable revenue
  partnership: 0.9, // recurring pipeline via someone else's traffic
  event: 0.75, // one-off but high volume
  direct: 0.7, // steady but lower ticket
};

const CATEGORY_BEST_TIME: Record<OpportunityCategory, string> = {
  recurring: 'Weekday mornings (9–11a)',
  partnership: 'Weekday mid-afternoon (2–4p)',
  event: 'Evenings & weekends',
  direct: 'Peak hours for the spot',
};

/**
 * A curated, ordered discovery script — the offline backbone of the adaptive
 * interview. Each item covers a different slice of the customer-discovery lens,
 * ordered so the earliest answers unlock the most search value.
 */
const INTERVIEW_SCRIPT: { question: string; placeholder: string }[] = [
  {
    question: 'Which type of customer buys the most from you today?',
    placeholder: 'e.g. homeowners, property managers, weekday office workers',
  },
  {
    question: 'Where do those customers tend to gather — what kinds of places or events?',
    placeholder: 'e.g. office parks, dealerships, apartment complexes, tournaments',
  },
  {
    question: 'When are you available to serve them?',
    placeholder: 'e.g. weekdays 10a–8p, some Saturdays',
  },
  {
    question: 'What has been holding you back from growing?',
    placeholder: 'e.g. slow weekday mornings, unsure which spots to target',
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
 * fields and synthesize a reasonable customer picture over `base` (the owner's
 * stored profile), so this always yields a non-empty profile.
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
      'Office parks and business campuses',
      'Apartment complexes and managed properties',
      'Busy local venues',
      'Weekend events and markets',
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
  const goalText = profile.goals.join(' ').toLowerCase();
  const wantsRecurring = /recur|steady|regular|contract|fleet|account|standing|monthly|weekly/.test(goalText);
  const wantsVolume = /event|weekend|crowd|volume|traffic|busy/.test(goalText);
  const recommended: OpportunityCategory[] = wantsRecurring
    ? ['recurring', 'partnership', 'direct', 'event']
    : wantsVolume
      ? ['event', 'direct', 'partnership', 'recurring']
      : ['partnership', 'recurring', 'direct', 'event'];
  const customer = 'customer' in profile ? profile.customer : undefined;
  const goal = profile.goals[0] ?? 'more predictable revenue';

  return {
    summary: `${profile.name} is a ${profile.type} in ${profile.city} serving within ${profile.serviceRadiusMiles} miles. Its clearest path to "${goal}" is going to where its best customers already are, nearby.`,
    strengths: [
      profile.capabilities[0] ?? `Established ${profile.type} service`,
      ...(profile.capabilities[1] ? [profile.capabilities[1]] : []),
      'Local and close to every customer it serves',
    ].slice(0, 3),
    focus: wantsRecurring
      ? `Pitch one standing, repeat arrangement today — a first step toward ${goal.toLowerCase()}`
      : `Get in front of one concentrated group of likely customers today — toward ${goal.toLowerCase()}`,
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
  recurring: {
    type: 'physical-business',
    reach: 'phone',
    label: 'Businesses that could book you on a schedule',
    whoTheyAre: 'Offices, fleets & property managers with a repeating need',
    discovery: 'Search Maps for offices, dealerships & managed properties',
    why: 'One yes becomes predictable monthly revenue',
    keywords: /office|fleet|dealership|property|manager|campus|corporate|company|clinic|warehouse/i,
  },
  partnership: {
    type: 'partner-org',
    reach: 'walk-in',
    label: 'Local businesses whose customers overlap yours',
    whoTheyAre: 'Established spots that could host or refer you',
    discovery: 'Search Maps for busy complementary businesses nearby',
    why: 'Their existing traffic becomes your pipeline',
    keywords: /brewery|bar|gym|salon|shop|store|venue|apartment|complex|hoa|resident|cafe/i,
  },
  event: {
    type: 'public-gathering',
    reach: 'email',
    label: 'Recurring local events & gatherings',
    whoTheyAre: 'Organizers of markets, tournaments & community events',
    discovery: 'Check event calendars & venue listings in your radius',
    why: 'One booking puts you in front of a crowd',
    keywords: /market|festival|fair|tournament|game|sport|gathering|expo|show/i,
  },
  direct: {
    type: 'physical-business',
    reach: 'walk-in',
    label: 'High-traffic spots where your customers cluster',
    whoTheyAre: 'People who need you, where they already spend time',
    discovery: 'Search Maps for the busiest spots in your radius',
    why: 'Immediate sales while bigger accounts develop',
    keywords: /park|plaza|downtown|mall|campus|lot|street|neighborhood/i,
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
  const cats: OpportunityCategory[] = categories.length ? categories : ['recurring', 'partnership'];
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
      // Heuristic ranking is honest about its certainty: richer grounding
      // (context, proximity, goal match) earns more, but never model-level sureness.
      const confidence = Math.min(
        85,
        55 + (c.context ? 12 : 0) + (c.distanceMiles <= radius / 2 ? 8 : 0) + (focusBoost.has(c.category) ? 8 : 0),
      );
      const evidence = [
        `${c.distanceMiles.toFixed(1)} mi from you (~${travelMinutes} min)`,
        ...(c.context ? [capitalizeFirst(c.context)] : []),
        ...(focusBoost.has(c.category) ? [`Matches your focus: ${c.category}`] : []),
      ].slice(0, 3);

      return {
        id: c.id,
        name: c.name,
        category: c.category,
        score,
        confidence,
        evidence,
        latitude: c.latitude,
        longitude: c.longitude,
        address: c.address,
        distanceMiles: c.distanceMiles,
        bestTime: CATEGORY_BEST_TIME[c.category],
        summary: `${c.name} is a strong ${CATEGORY_NOUN[c.category]} prospect ${c.distanceMiles.toFixed(1)} mi away (~${travelMinutes} min).`,
        reasons: buildReasons(c),
        risks: buildRisks(c),
        recommendedAction: buildAction(c, profile),
        // The heuristic ranker doesn't invent dollar figures — only Gemma
        // estimates value, and only as an explicit rough range.
        estimatedValue: undefined,
      } satisfies RankedOpportunity;
    })
    .sort((a, b) => b.score - a.score)
    // Heuristic scores shouldn't read as certainty: cap below 100 and break
    // ties so the list doesn't show a wall of identical "perfect" scores.
    .map((o, i) => ({ ...o, score: Math.max(35, Math.min(96 - i, o.score)) }));
}

function capitalizeFirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** How each category reads in a sentence. */
const CATEGORY_NOUN: Record<OpportunityCategory, string> = {
  recurring: 'standing-account',
  partnership: 'partnership',
  event: 'event',
  direct: 'walk-up',
};

function buildReasons(c: PlaceCandidate): string[] {
  const base: Record<OpportunityCategory, string[]> = {
    recurring: ['A standing arrangement beats one-off jobs', 'Business buyers rebook on a schedule'],
    partnership: ['Their existing customers become your pipeline', 'Shared audience, no ad spend'],
    event: ['High volume in a short window', 'One yes reaches a whole crowd'],
    direct: ['Customers are already gathered there', 'Short drive keeps margins healthy'],
  };
  // Context now surfaces as evidence; reasons stay the argument itself.
  return base[c.category].slice(0, 3);
}

function buildRisks(c: PlaceCandidate): string[] {
  const base: Record<OpportunityCategory, string[]> = {
    recurring: ['May need approval from a manager or owner'],
    partnership: ['Needs the venue’s permission or a trial run'],
    event: ['Vendor fee or application may apply'],
    direct: ['Competition from options already nearby'],
  };
  return base[c.category];
}

/** A concrete first move an owner could make today, in their own trade. */
function buildAction(c: PlaceCandidate, profile: BusinessProfileInput): string {
  const service = profile.type || 'service';
  switch (c.category) {
    case 'recurring':
      return `Call ${c.name}, ask who books services, and offer a free first ${service} visit.`;
    case 'partnership':
      return `Walk into ${c.name} and propose a regular on-site ${service} day for their customers.`;
    case 'event':
      return `Email ${c.name} about vendor openings at their next event.`;
    case 'direct':
      return `Set up near ${c.name} at peak time with a first-visit offer.`;
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

  const edge = profile.capabilities[0] ? ` We're known for ${profile.capabilities[0].toLowerCase()}.` : '';
  const ask = `I'd love to explore working with ${opportunity.name}.${edge} ${opportunity.recommendedAction}`;

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
