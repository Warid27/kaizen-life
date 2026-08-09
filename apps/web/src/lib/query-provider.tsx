import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * Wraps children in a React Query provider.
 *
 * Usage in Astro islands:
 * ```astro
 * ---
 * import { QueryProvider } from '@/lib/query-provider';
 * ---
 * <QueryProvider>
 *   <ClientOnly>
 *     <MyComponent client:load />
 *   </ClientOnly>
 * </QueryProvider>
 * ```
 *
 * Or directly inside an island:
 * ```tsx
 * export default function App() {
 *   return (
 *     <QueryProvider>
 *       <Dashboard />
 *     </QueryProvider>
 *   );
 * }
 * ```
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000, // 1 minute
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
