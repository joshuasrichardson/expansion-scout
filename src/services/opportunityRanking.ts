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

import type {
  BusinessAnalysis,
  BusinessProfileInput,
  OpportunityCategory,
  OutreachChannel,
  OutreachDraft,
  OutreachTone,
  PlaceCandidate,
  RankedOpportunity,
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

export function analyzeBusinessLocal(profile: BusinessProfileInput): BusinessAnalysis {
  const goal = profile.goals[0]?.toLowerCase() ?? '';
  const wantsRecurring = /recur|steady|regular|catering|contract/.test(goal);
  const recommended: OpportunityCategory[] = wantsRecurring
    ? ['catering', 'partnership', 'lunch', 'event']
    : ['partnership', 'lunch', 'catering', 'event'];

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
  };
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
