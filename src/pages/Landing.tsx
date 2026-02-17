import React from 'react'
import { EventLandingSections } from '@/components/EventLandingSections'
import { useActiveHackathon } from '@/lib/active-hackathon'

export function Landing() {
  const { activeHackathon } = useActiveHackathon()

  return (
    <div className="flex flex-col min-h-screen">
      <section className="py-10 md:py-16">
        <div className="container px-4 md:px-6">
          <EventLandingSections hackathon={activeHackathon} />
        </div>
      </section>
    </div>
  )
}
