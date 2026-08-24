import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * Module-singleton QueryClient — shared across ALL islands on the page.
 *
 * Previously every island mount created its own client (P11), fragmenting the
 * cache and duplicating in-flight fetches for identical keys. One client per
 * browser session means one cache, one set of poll timers.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000, // 1 minute
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

/**
 * Wraps children in a React Query provider using the shared singleton.
 * Usage in Astro islands / islands unchanged.
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
