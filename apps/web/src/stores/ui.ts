import { create } from 'zustand';
import { todayStr as sharedTodayStr, shiftDate } from '@kaizenlife/shared';

// ─── Types ────────────────────────────────────────────────────────────────────

interface UIState {
  /** Currently selected date (YYYY-MM-DD) */
  selectedDate: string;

  /** Sidebar collapsed state */
  sidebarCollapsed: boolean;

  /** Command palette open */
  commandPaletteOpen: boolean;

  /** Active modal (if any) */
  activeModal: string | null;

  // ── Actions ───────────────────────────────────────────────────────────────

  setSelectedDate: (date: string) => void;
  goToToday: () => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
  openModal: (modalId: string) => void;
  closeModal: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
// Canonical browser-local "today" from the shared package — fixes the
// split-brain where each app hand-rolled its own (sometimes UTC-wrong) copy.

export function todayStr(): string {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return sharedTodayStr(tz);
}

/** Shift a YYYY-MM-DD date by N days using the shared util. */
export function shiftDays(date: string, days: number): string {
  return shiftDate(date, days);
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useUIStore = create<UIState>((set) => ({
  selectedDate: todayStr(),
  sidebarCollapsed: false,
  commandPaletteOpen: false,
  activeModal: null,

  setSelectedDate: (date) => set({ selectedDate: date }),
  goToToday: () => set({ selectedDate: todayStr() }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  openCommandPalette: () => set({ commandPaletteOpen: true }),
  closeCommandPalette: () => set({ commandPaletteOpen: false }),
  openModal: (modalId) => set({ activeModal: modalId }),
  closeModal: () => set({ activeModal: null }),
}));
