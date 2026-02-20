import React, { createContext, useContext, useState, useMemo, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './api'
import { Hackathon } from './types'

type ActiveHackathonContextType = {
  activeHackathon: Hackathon
  setActiveHackathonId: (id: string) => void
  hackathons: Hackathon[]
  isLoading: boolean
  refreshHackathons: () => void
}

const ActiveHackathonContext = createContext<ActiveHackathonContextType | undefined>(undefined)

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

  const { data: hackathons = [], isLoading } = useQuery({
    queryKey: ['hackathons'],
    queryFn: api.getHackathons,
    staleTime: 30_000,
  })

  const [activeId, setActiveId] = useState<string>(() => {
    return localStorage.getItem('openhackathon_active_id') || ''
  })

  const activeHackathon = useMemo(() => {
    if (hackathons.length === 0) return PLACEHOLDER_HACKATHON
    // If saved ID exists in the list, use it
    const found = hackathons.find(h => h.id === activeId)
    if (found) return found
    // Fallback: first active hackathon, or first in list
    return hackathons.find(h => h.status === 'active') || hackathons[0]
  }, [activeId, hackathons])

  const setActiveHackathonId = useCallback((id: string) => {
    setActiveId(id)
    localStorage.setItem('openhackathon_active_id', id)
  }, [])

  const refreshHackathons = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['hackathons'] })
  }, [queryClient])

  return (
    <ActiveHackathonContext.Provider value={{
      activeHackathon,
      setActiveHackathonId,
      hackathons,
      isLoading,
      refreshHackathons,
    }}>
      {children}
    </ActiveHackathonContext.Provider>
  )
}

export function useActiveHackathon() {
  const context = useContext(ActiveHackathonContext)
  if (context === undefined) {
    throw new Error('useActiveHackathon must be used within an ActiveHackathonProvider')
  }
  return context
}
