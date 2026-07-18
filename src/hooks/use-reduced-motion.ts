import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * True when the OS asks for reduced motion. Every decorative animation in the
 * app (pin drops, card entrances, count-ups, the reasoning pulse) checks this
 * and settles instantly instead — rubric §3 accessibility, honored live.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((value) => {
        if (!cancelled) setReduced(!!value);
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', (value) =>
      setReduced(!!value),
    );
    return () => {
      cancelled = true;
      sub?.remove?.();
    };
  }, []);

  return reduced;
}
