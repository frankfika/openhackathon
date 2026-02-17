import React, { createContext, useContext, useState, useMemo } from 'react'
import { hackathons, Hackathon } from './mock-data'

type ActiveHackathonContextType = {
  activeHackathon: Hackathon
  setActiveHackathonId: (id: string) => void
}

const ActiveHackathonContext = createContext<ActiveHackathonContextType | undefined>(undefined)

function getDefaultHackathon(): Hackathon {
  return hackathons.find(h => h.status === 'active') || hackathons[0]
}

export function ActiveHackathonProvider({ children }: { children: React.ReactNode }) {
  const [activeId, setActiveId] = useState<string>(() => {
    const saved = localStorage.getItem('openhackathon_active_id')
    if (saved && hackathons.some(h => h.id === saved)) return saved
    return getDefaultHackathon().id
  })

  const activeHackathon = useMemo(() => {
    return hackathons.find(h => h.id === activeId) || getDefaultHackathon()
  }, [activeId])

  const setActiveHackathonId = (id: string) => {
    setActiveId(id)
    localStorage.setItem('openhackathon_active_id', id)
  }

  return (
    <ActiveHackathonContext.Provider value={{ activeHackathon, setActiveHackathonId }}>
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
