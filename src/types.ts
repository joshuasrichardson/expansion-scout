/**
 * Expansion Scout — shared domain types.
 *
 * These model the full demo flow:
 *   Home → Daily Mission → AI Interview → Analysis →
 *   Opportunities Map → Opportunity Details → Outreach → Today's Plan
 *
 * Everything is in-memory for the hackathon. No persistence layer, no API
 * contracts — keep these lean and extend only when a screen actually needs it.
 */

export type Effort = 'low' | 'medium' | 'high';
export type Priority = 'low' | 'medium' | 'high';

/** The user's business — captured once, reused everywhere. */
export interface BusinessProfile {
  id: string;
  name: string;
  industry: string;
  /** Where the business operates today. */
  homeMarket: string;
  employeeCount: number;
  monthlyRevenueUsd: number;
  description: string;
}

export type MissionStatus = 'available' | 'in_progress' | 'complete';

/** The single daily prompt that kicks off the flow. */
export interface DailyMission {
  id: string;
  /** ISO date, e.g. "2026-07-17". */
  date: string;
  title: string;
  summary: string;
  estimatedMinutes: number;
  status: MissionStatus;
}

/** One question the on-device AI asks during the interview. */
export interface InterviewQuestion {
  id: string;
  prompt: string;
  placeholder: string;
}

export interface InterviewAnswer {
  questionId: string;
  text: string;
}

export interface InterviewSession {
  id: string;
  missionId: string;
  answers: InterviewAnswer[];
  completedAt?: string;
}

/** Output of the on-device analysis pass over the interview. */
export interface AnalysisResult {
  id: string;
  /** 0–100 — how ready the business is to expand. */
  readinessScore: number;
  summary: string;
  strengths: string[];
  gaps: string[];
}

/** An expansion opportunity surfaced on the map. */
export interface Opportunity {
  id: string;
  title: string;
  /** Human-readable market/region label, e.g. "Austin, TX". */
  market: string;
  category: string;
  /** 0–100 fit score. */
  matchScore: number;
  rationale: string;
  estimatedValueUsd: number;
  effort: Effort;
  /** For the map pin. */
  coordinates: { latitude: number; longitude: number };
}

export type OutreachChannel = 'email' | 'linkedin' | 'call';

/** A draft the user can send to pursue an opportunity. */
export interface OutreachDraft {
  id: string;
  opportunityId: string;
  channel: OutreachChannel;
  recipientHint: string;
  subject?: string;
  body: string;
}

/** A concrete action for today, optionally tied to an opportunity. */
export interface PlanTask {
  id: string;
  title: string;
  detail: string;
  durationMinutes: number;
  priority: Priority;
  opportunityId?: string;
  done: boolean;
}

export interface TodayPlan {
  id: string;
  date: string;
  tasks: PlanTask[];
}
