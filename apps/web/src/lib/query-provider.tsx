import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster, toast } from '@/components/ui/toast';

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
    mutations: {
      // Global safety net: every failed mutation surfaces an error toast, so a
      // failed save is never silent. Islands with inline form errors keep them;
      // the toast adds the missing "what happened" signal.
      onError: (error) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        toast.error(
          error instanceof Error && error.message
            ? error.message
            : 'Something went wrong. Please try again.',
        );
      },
    },
  },
});

/**
 * Wraps children in a React Query provider using the shared singleton.
 * Also mounts the <Toaster /> so every island gets toast feedback for free.
 * Usage in Astro islands / islands unchanged.
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster />
    </QueryClientProvider>
  );
}
