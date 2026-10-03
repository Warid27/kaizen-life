import { useEffect, useState } from 'react';
import CommandPalette from '@/components/shared/CommandPalette';
import { useUIStore } from '@/stores/ui';

/**
 * Mounts the CommandPalette in the layout shell.
 * Bridges vanilla-JS topbar buttons to the Zustand store.
 */
export default function CommandPaletteMount() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const store = useUIStore.getState;

    const handleOpenCmd = () => store().openCommandPalette();
    const handleQuickCapture = () => store().openCommandPalette();

    document.addEventListener('kaizenlife:open-cmd-palette', handleOpenCmd);
    document.addEventListener('kaizenlife:quick-capture', handleQuickCapture);

    return () => {
      document.removeEventListener('kaizenlife:open-cmd-palette', handleOpenCmd);
      document.removeEventListener('kaizenlife:quick-capture', handleQuickCapture);
    };
  }, []);

  if (!mounted) return null;

  return <CommandPalette />;
}
