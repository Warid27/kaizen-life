import { create } from 'zustand';

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

function todayStr(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
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
