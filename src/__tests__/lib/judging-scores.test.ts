import { describe, expect, it } from 'vitest'
import {
  countUnscoredCriteria,
  createEmptyScoreDraft,
  isScoreDraftComplete,
  scoreDraftToPayload,
  sumScoreDraft,
} from '@/lib/judging-scores'

const criteria = [
  { id: 'c1', name: 'Innovation', maxScore: 60 },
  { id: 'c2', name: 'Execution', maxScore: 40 },
]

describe('judging score drafts', () => {
  it('creates an empty draft with null values', () => {
    expect(createEmptyScoreDraft(criteria)).toEqual({
      c1: null,
      c2: null,
    })
  })

  it('tracks unscored criteria and completion state', () => {
    const draft = { c1: 50, c2: null }

    expect(countUnscoredCriteria(draft, criteria)).toBe(1)
    expect(isScoreDraftComplete(draft, criteria)).toBe(false)
  })

  it('sums only scored values and serializes completed entries', () => {
    const draft = { c1: 50, c2: null }

    expect(sumScoreDraft(draft)).toBe(50)
    expect(scoreDraftToPayload(draft, criteria)).toEqual([
      { criterionId: 'c1', score: 50 },
    ])
  })
})
