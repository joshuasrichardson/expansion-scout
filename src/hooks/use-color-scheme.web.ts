import { useSyncExternalStore } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

// Static rendering has no client color scheme; report hydration via
// useSyncExternalStore (server snapshot false → client snapshot true) so the
// value re-resolves on the client without a setState-in-effect cascade.
const noopSubscribe = () => () => {};
function useHasHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

/**
 * To support static rendering, this value needs to be re-calculated on the client side for web
 */
export function useColorScheme() {
  const hasHydrated = useHasHydrated();
  const colorScheme = useRNColorScheme();
  return hasHydrated ? colorScheme : 'light';
}
