/**
 * In-memory fixtures for the demo. Swap these for real on-device AI output
 * as each feature is wired up — screens read from here so the whole flow is
 * click-through demoable from day one.
 */

import type {
  AnalysisResult,
  BusinessProfile,
  DailyMission,
  InterviewQuestion,
  Opportunity,
  OutreachDraft,
  TodayPlan,
} from '@/types';

export const businessProfile: BusinessProfile = {
  id: 'biz-1',
  name: 'Rivertown Roasters',
  industry: 'Specialty Coffee',
  homeMarket: 'Portland, OR',
  employeeCount: 14,
  monthlyRevenueUsd: 82000,
  description:
    'A neighborhood specialty coffee roaster with two cafés and a small wholesale program supplying local restaurants.',
};

export const todaysMission: DailyMission = {
  id: 'mission-1',
  date: '2026-07-17',
  title: 'Find your next wholesale market',
  summary:
    'Answer a few quick questions so Scout can pinpoint the best nearby market to expand your wholesale roasting business.',
  estimatedMinutes: 4,
  status: 'available',
};

/**
 * The interview's opening question. Shown immediately (no cold-start wait) before
 * Gemma takes over and adaptively decides what — if anything — to ask next.
 */
export const SEED_QUESTION = {
  question: 'What product or service do you most want to grow right now?',
  placeholder: 'e.g. weekday lunch service, catering for local offices',
} as const;

export const interviewQuestions: InterviewQuestion[] = [
  {
    id: 'q-1',
    prompt: 'What product or service do you most want to grow right now?',
    placeholder: 'e.g. wholesale beans to restaurants and offices',
  },
  {
    id: 'q-2',
    prompt: 'Which type of customer buys the most from you today?',
    placeholder: 'e.g. independent cafés and mid-size offices',
  },
  {
    id: 'q-3',
    prompt: 'What has been holding you back from expanding?',
    placeholder: 'e.g. limited delivery range, unsure which city to target',
  },
];

export const analysisResult: AnalysisResult = {
  id: 'analysis-1',
  readinessScore: 78,
  summary:
    'Rivertown Roasters has a proven wholesale playbook and healthy margins. The main constraint is geographic reach — nearby metros show strong demand and low competition for premium local roasters.',
  strengths: [
    'Established wholesale relationships and repeatable onboarding',
    'Healthy 34% gross margin on wholesale accounts',
    'Strong local brand recognition and reviews',
  ],
  gaps: [
    'Delivery logistics not yet proven beyond 30 miles',
    'No dedicated outbound sales motion',
    'Limited brand awareness in neighboring metros',
  ],
};

export const opportunities: Opportunity[] = [
  {
    id: 'opp-1',
    title: 'Office coffee programs in the Pearl District',
    market: 'Portland, OR',
    category: 'Corporate wholesale',
    matchScore: 92,
    rationale:
      'Dense cluster of mid-size offices within your current delivery range, few premium local suppliers, and high willingness to pay.',
    estimatedValueUsd: 18000,
    effort: 'low',
    coordinates: { latitude: 45.5289, longitude: -122.6839 },
  },
  {
    id: 'opp-2',
    title: 'Independent cafés in Vancouver, WA',
    market: 'Vancouver, WA',
    category: 'Café wholesale',
    matchScore: 84,
    rationale:
      'A growing café scene just across the river with limited specialty roaster options and a short delivery hop from your roastery.',
    estimatedValueUsd: 26000,
    effort: 'medium',
    coordinates: { latitude: 45.6387, longitude: -122.6615 },
  },
  {
    id: 'opp-3',
    title: 'Boutique hotels in Bend',
    market: 'Bend, OR',
    category: 'Hospitality wholesale',
    matchScore: 71,
    rationale:
      'Tourism-driven demand for premium local coffee, though the distance requires a new fulfillment approach.',
    estimatedValueUsd: 34000,
    effort: 'high',
    coordinates: { latitude: 44.0582, longitude: -121.3153 },
  },
];

export const outreachDrafts: OutreachDraft[] = [
  {
    id: 'draft-1',
    opportunityId: 'opp-1',
    channel: 'email',
    recipientHint: 'Office manager / workplace experience lead',
    subject: 'Locally roasted coffee for your Pearl District office',
    body: "Hi there,\n\nI'm reaching out from Rivertown Roasters — we roast specialty coffee a few blocks from you and supply several offices in the neighborhood. I'd love to set up a free tasting for your team and share a simple office program that keeps great coffee flowing without the hassle.\n\nWould next week work for a quick 15-minute chat?\n\nBest,\nRivertown Roasters",
  },
  {
    id: 'draft-2',
    opportunityId: 'opp-2',
    channel: 'email',
    recipientHint: 'Café owner or head of buying',
    subject: 'A short-hop wholesale partner for your café',
    body: "Hi,\n\nWe roast specialty coffee just across the river in Portland and are expanding our wholesale program into Vancouver. We'd love to send a sample box and talk through pricing that works for an independent café.\n\nOpen to a quick call this week?\n\nCheers,\nRivertown Roasters",
  },
  {
    id: 'draft-3',
    opportunityId: 'opp-3',
    channel: 'email',
    recipientHint: 'Hotel F&B or general manager',
    subject: 'Elevating the coffee experience at your property',
    body: "Hello,\n\nGuests increasingly expect a memorable local coffee experience. Rivertown Roasters partners with boutique hotels to provide premium, locally roasted coffee and simple brewing setups.\n\nCould we arrange a tasting for your team?\n\nWarm regards,\nRivertown Roasters",
  },
];

export const todayPlan: TodayPlan = {
  id: 'plan-1',
  date: '2026-07-17',
  tasks: [
    {
      id: 'task-1',
      title: 'Send 5 office outreach emails',
      detail: 'Use the Pearl District draft; target offices within your delivery range.',
      durationMinutes: 30,
      priority: 'high',
      opportunityId: 'opp-1',
      done: false,
    },
    {
      id: 'task-2',
      title: 'Assemble 3 sample boxes for Vancouver cafés',
      detail: 'Prep tasting kits to mail with your café outreach.',
      durationMinutes: 45,
      priority: 'medium',
      opportunityId: 'opp-2',
      done: false,
    },
    {
      id: 'task-3',
      title: 'Sketch a delivery plan for cross-river accounts',
      detail: 'Rough out routing and cost to serve Vancouver reliably.',
      durationMinutes: 20,
      priority: 'low',
      opportunityId: 'opp-2',
      done: false,
    },
  ],
};

/** Look up a single opportunity by id (used by the details route). */
export function getOpportunity(id: string): Opportunity | undefined {
  return opportunities.find((o) => o.id === id);
}

/** Find the best outreach draft for an opportunity. */
export function getDraftForOpportunity(opportunityId: string): OutreachDraft | undefined {
  return outreachDrafts.find((d) => d.opportunityId === opportunityId);
}
