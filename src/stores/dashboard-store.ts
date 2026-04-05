import { create } from 'zustand'
import type { DashboardMetrics } from '@/types/recovery'

interface DashboardState {
  metrics: DashboardMetrics | null
  loading: boolean
  error: string | null
  fetchMetrics: () => Promise<void>
}

export const useDashboardStore = create<DashboardState>((set) => ({
  metrics: null,
  loading: false,
  error: null,
  fetchMetrics: async () => {
    set({ loading: true, error: null })
    try {
      const res = await fetch('/api/dashboard/metrics')
      const json = await res.json()
      if (json.error) throw new Error(json.error.message)
      set({ metrics: json.data, loading: false })
    } catch (err) {
      set({ error: (err as Error).message, loading: false })
    }
  },
}))
