import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ToastMessage } from '../types';

let toastCounter = 0;

interface ToastStore {
  toasts: ToastMessage[];
  addToast: (type: ToastMessage['type'], message: string) => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (type, message) => {
    const id = `toast-${++toastCounter}`;
    set((s) => ({ toasts: [...s.toasts, { id, type, message }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 3000);
  },
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

interface UIStore {
  sidebarCollapsed: boolean;
  commandPaletteOpen: boolean;
  searchModalOpen: boolean;
  notificationPanelOpen: boolean;
  syncCenterOpen: boolean;
  quickNotesOpen: boolean;
  denseMode: boolean;
  toggleSidebar: () => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setSearchModalOpen: (open: boolean) => void;
  setNotificationPanelOpen: (open: boolean) => void;
  setSyncCenterOpen: (open: boolean) => void;
  setQuickNotesOpen: (open: boolean) => void;
  toggleQuickNotes: () => void;
  setDenseMode: (dense: boolean) => void;
}

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      commandPaletteOpen: false,
      searchModalOpen: false,
      notificationPanelOpen: false,
      syncCenterOpen: false,
      quickNotesOpen: false,
      denseMode: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
      setSearchModalOpen: (open) => set({ searchModalOpen: open }),
      setNotificationPanelOpen: (open) => set({ notificationPanelOpen: open }),
      setSyncCenterOpen: (open) => set({ syncCenterOpen: open }),
      setQuickNotesOpen: (open) => set({ quickNotesOpen: open }),
      toggleQuickNotes: () => set((s) => ({ quickNotesOpen: !s.quickNotesOpen })),
      setDenseMode: (denseMode) => {
        set({ denseMode });
        if (denseMode) document.body.classList.add('dense');
        else document.body.classList.remove('dense');
      },
    }),
    {
      name: 'personal-hq-ui',
      partialize: (s) => ({ sidebarCollapsed: s.sidebarCollapsed, denseMode: s.denseMode }),
      onRehydrateStorage: () => (state) => {
        if (state?.denseMode) document.body.classList.add('dense');
      },
    }
  )
);
