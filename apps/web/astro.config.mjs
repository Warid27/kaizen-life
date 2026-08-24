import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  integrations: [react(), tailwind()],
  // Prefetch internal links on hover (P12: MPA nav was a full reload + refetch)
  prefetch: { prefetchAll: true },
});
