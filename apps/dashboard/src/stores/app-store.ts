import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Project, Environment } from '@/types';

interface AppState {
  // Current project context
  currentProject: Project | null;
  currentEnvironment: Environment | null;

  // Sidebar state
  sidebarCollapsed: boolean;

  // Actions
  setCurrentProject: (project: Project | null) => void;
  setCurrentEnvironment: (environment: Environment | null) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // Initial state
      currentProject: null,
      currentEnvironment: null,
      sidebarCollapsed: false,

      // Actions
      setCurrentProject: (project) => set({ currentProject: project }),
      setCurrentEnvironment: (environment) => set({ currentEnvironment: environment }),
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
    }),
    {
      name: 'launchlayer-app-store',
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        // Don't persist project/environment - will be loaded from URL/API
      }),
    }
  )
);

// Selector hooks for common use cases
export const useCurrentProject = () => useAppStore((state) => state.currentProject);
export const useCurrentEnvironment = () => useAppStore((state) => state.currentEnvironment);
export const useSidebarCollapsed = () => useAppStore((state) => state.sidebarCollapsed);
