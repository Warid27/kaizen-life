/**
 * DateDisplay — renders the current date client-side only.
 *
 * This island replaces the static `{today}` in BaseLayout.astro to prevent
 * stale dates being served from Cloudflare Pages' static cache.
 */
export default function DateDisplay() {
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return <h1 className="text-sm font-semibold text-foreground">{today}</h1>;
}
