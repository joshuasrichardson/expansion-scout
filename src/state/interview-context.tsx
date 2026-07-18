/**
 * Shared state for the adaptive interview's result.
 *
 * The interview screen produces an `InterviewProfile` (business fields + inferred
 * customer picture) and stores it here so downstream screens — analysis,
 * opportunities, outreach — can read it instead of the static mock. Keeping it in
 * Context (not route params) means the whole plan travels with the session and
 * survives back-navigation. In-memory only; no persistence (CLAUDE.md).
 */

import { createContext, useCallback, useContext, useMemo, useState } from 'react';

import type { InterviewProfile, InterviewTurn } from '@/services/gemma';

interface InterviewState {
  /** The completed profile, or null until the interview finishes. */
  profile: InterviewProfile | null;
  /** The full Q/A transcript that produced it. */
  history: InterviewTurn[];
  /** Called by the interview screen when Gemma has enough to search. */
  setResult: (profile: InterviewProfile, history: InterviewTurn[]) => void;
  /** Clear state to re-run the interview from scratch. */
  reset: () => void;
}

const InterviewContext = createContext<InterviewState | null>(null);

export function InterviewProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<InterviewProfile | null>(null);
  const [history, setHistory] = useState<InterviewTurn[]>([]);

  const setResult = useCallback((next: InterviewProfile, turns: InterviewTurn[]) => {
    setProfile(next);
    setHistory(turns);
  }, []);

  const reset = useCallback(() => {
    setProfile(null);
    setHistory([]);
  }, []);

  const value = useMemo(
    () => ({ profile, history, setResult, reset }),
    [profile, history, setResult, reset],
  );

  return <InterviewContext.Provider value={value}>{children}</InterviewContext.Provider>;
}

export function useInterview(): InterviewState {
  const ctx = useContext(InterviewContext);
  if (!ctx) throw new Error('useInterview must be used within an InterviewProvider');
  return ctx;
}
