import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'

// Create a client with optimized defaults
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Cache queries for 5 minutes
      staleTime: 5 * 60 * 1000,
      // Keep inactive queries in cache for 10 minutes
      gcTime: 10 * 60 * 1000,
      // Retry failed queries up to 3 times
      retry: 3,
      // Retry delay function (exponential backoff)
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      // Refetch on window focus for real-time data
      refetchOnWindowFocus: true,
      // Don't refetch on reconnect to avoid spam
      refetchOnReconnect: false,
      // Enable background refetching
      refetchOnMount: true,
    },
    mutations: {
      // Retry mutations only once
      retry: 1,
      // Retry delay for mutations
      retryDelay: 1000,
    },
  },
})

// Query keys for consistent cache management
export const queryKeys = {
  // Dashboard queries
  dashboard: {
    all: ['dashboard'] as const,
    stats: (workspaceId: string) => ['dashboard', 'stats', workspaceId] as const,
    recentActivity: (workspaceId: string) => ['dashboard', 'recent-activity', workspaceId] as const,
    chartData: (workspaceId: string) => ['dashboard', 'chart-data', workspaceId] as const,
  },
  
  // Campaigns queries
  campaigns: {
    all: ['campaigns'] as const,
    list: (workspaceId: string) => ['campaigns', 'list', workspaceId] as const,
    stats: (workspaceId: string) => ['campaigns', 'stats', workspaceId] as const,
    detail: (id: string) => ['campaigns', 'detail', id] as const,
  },
  
  // Leads queries
  leads: {
    all: ['leads'] as const,
    list: (workspaceId: string) => ['leads', 'list', workspaceId] as const,
    stats: (workspaceId: string) => ['leads', 'stats', workspaceId] as const,
    detail: (id: string) => ['leads', 'detail', id] as const,
  },
  
  // Templates queries
  templates: {
    all: ['templates'] as const,
    list: (workspaceId: string) => ['templates', 'list', workspaceId] as const,
    detail: (id: string) => ['templates', 'detail', id] as const,
  },
  
  // Workspace queries
  workspace: {
    all: ['workspace'] as const,
    current: (userId: string) => ['workspace', 'current', userId] as const,
    members: (workspaceId: string) => ['workspace', 'members', workspaceId] as const,
  },
  
  // User queries
  user: {
    all: ['user'] as const,
    current: ['user', 'current'] as const,
    profile: (id: string) => ['user', 'profile', id] as const,
  },
} as const

// Utility function to invalidate related queries
export const invalidateQueries = {
  dashboard: (workspaceId: string) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
    queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.stats(workspaceId) })
    queryClient.invalidateQueries({ queryKey: queryKeys.leads.stats(workspaceId) })
  },
  
  campaigns: (workspaceId: string) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.all })
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.stats(workspaceId) })
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.chartData(workspaceId) })
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.recentActivity(workspaceId) })
  },
  
  leads: (workspaceId: string) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.leads.all })
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.stats(workspaceId) })
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.chartData(workspaceId) })
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.recentActivity(workspaceId) })
  },
  
  all: () => {
    queryClient.invalidateQueries()
  },
}

// Prefetch utilities
export const prefetchQueries = {
  dashboard: async (workspaceId: string) => {
    await Promise.all([
      queryClient.prefetchQuery({
        queryKey: queryKeys.dashboard.stats(workspaceId),
        staleTime: 2 * 60 * 1000, // 2 minutes
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.dashboard.recentActivity(workspaceId),
        staleTime: 1 * 60 * 1000, // 1 minute
      }),
    ])
  },
}

// Error handling utilities
export const handleQueryError = (error: any, context: string) => {
  console.error(`Query error in ${context}:`, error)
  
  // You can add global error handling here
  // For example, toast notifications, logging to external services, etc.
  
  return error
}

// Cache management utilities
export const cacheUtils = {
  // Clear all cache
  clearAll: () => {
    queryClient.clear()
  },
  
  // Clear specific workspace cache
  clearWorkspace: (workspaceId: string) => {
    queryClient.removeQueries({ queryKey: ['dashboard', 'stats', workspaceId] })
    queryClient.removeQueries({ queryKey: ['campaigns', 'list', workspaceId] })
    queryClient.removeQueries({ queryKey: ['leads', 'list', workspaceId] })
  },
  
  // Get cache size info
  getCacheInfo: () => {
    const cache = queryClient.getQueryCache()
    return {
      totalQueries: cache.getAll().length,
      queries: cache.getAll().map(query => ({
        key: query.queryKey,
        state: query.state,
        dataUpdatedAt: query.state.dataUpdatedAt,
        staleTime: query.options.staleTime,
      }))
    }
  },
}