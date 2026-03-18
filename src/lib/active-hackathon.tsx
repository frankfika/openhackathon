import React, { createContext, useContext, useMemo, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './api'
import { Hackathon } from './types'

type ActiveHackathonContextType = {
  activeHackathon: Hackathon
  setActiveHackathonId: (id: string) => void
  hackathons: Hackathon[]
  isLoading: boolean
  refreshHackathons: () => void
  isMultiHackathonMode: boolean
}

const ActiveHackathonContext = createContext<ActiveHackathonContextType | undefined>(undefined)

const isMultiHackathonMode = false

const PLACEHOLDER_HACKATHON: Hackathon = {
  id: '',
  title: 'Loading…',
  tagline: '',
  startAt: '',
  endAt: '',
  status: 'draft',
  coverGradient: 'from-gray-200 to-gray-300',
}

export function ActiveHackathonProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient()

  const { data: currentHackathon = null, isLoading } = useQuery({
    queryKey: ['current-hackathon'],
    queryFn: api.getCurrentHackathon,
    staleTime: 30_000,
  })

  const hackathons = useMemo(() => {
    return currentHackathon ? [currentHackathon] : []
  }, [currentHackathon])

  const activeHackathon = useMemo(() => {
    if (hackathons.length === 0) return PLACEHOLDER_HACKATHON
    return hackathons[0]
  }, [hackathons])

  const setActiveHackathonId = useCallback((_id: string) => {
    // Single-hackathon mode keeps one global event; ID switching is disabled.
  }, [])

  const refreshHackathons = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['current-hackathon'] })
    queryClient.invalidateQueries({ queryKey: ['hackathons'] })
  }, [queryClient])

  return (
    <ActiveHackathonContext.Provider value={{
      activeHackathon,
      setActiveHackathonId,
      hackathons,
      isLoading,
      refreshHackathons,
      isMultiHackathonMode,
    }}>
      {children}
    </ActiveHackathonContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useActiveHackathon() {
  const context = useContext(ActiveHackathonContext)
  if (context === undefined) {
    throw new Error('useActiveHackathon must be used within an ActiveHackathonProvider')
  }
  return context
}
