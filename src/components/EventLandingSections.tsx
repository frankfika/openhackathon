import React from 'react'
import type { Hackathon } from '@/lib/mock-data'
import { EventLandingHero } from '@/components/EventLandingHero'
import { EventLandingBody } from '@/components/EventLandingBody'

type Props = {
  hackathon: Hackathon
}

export function EventLandingSections({ hackathon }: Props) {
  return (
    <div>
      <EventLandingHero hackathon={hackathon} />
      <EventLandingBody hackathon={hackathon} />
    </div>
  )
}

