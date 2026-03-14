import { describe, expect, it } from 'vitest'
import { createSetupWizardBlueprint, planSetupWizardSessions, shouldSuggestSetupWizard } from '@/lib/setup-wizard'

describe('setup wizard blueprint', () => {
  it('creates a two-stage default blueprint with selected dimensions', () => {
    const result = createSetupWizardBlueprint({
      startAt: '2026-04-01T00:00:00.000Z',
      endAt: '2026-04-05T00:00:00.000Z',
      format: 'prelim_final',
      submissionStyle: 'standard',
      dimensions: ['region', 'category'],
    })

    expect(result.sessions).toHaveLength(2)
    expect(result.sessions[0].key).toBe('preliminary')
    expect(result.sessions[1].key).toBe('final')
    expect(result.submissionFields.some((field) => field.id === 'region' && field.filterable)).toBe(true)
    expect(result.submissionFields.some((field) => field.id === 'category' && field.filterable)).toBe(true)
    expect(result.scoringCriteria.map((criterion) => criterion.maxScore)).toEqual([40, 35, 25])
  })

  it('keeps lean mode minimal', () => {
    const result = createSetupWizardBlueprint({
      startAt: '2026-04-01T00:00:00.000Z',
      endAt: '2026-04-05T00:00:00.000Z',
      format: 'single_round',
      submissionStyle: 'lean',
      dimensions: [],
    })

    expect(result.submissionFields.map((field) => field.id)).toEqual(['title', 'demoUrl', 'repoUrl'])
  })
})

describe('shouldSuggestSetupWizard', () => {
  it('suggests setup when core config is still sparse', () => {
    expect(shouldSuggestSetupWizard({ sessionCount: 1, submissionFieldCount: 0, scoringCriteriaCount: 0 })).toBe(true)
    expect(shouldSuggestSetupWizard({ sessionCount: 3, submissionFieldCount: 4, scoringCriteriaCount: 3 })).toBe(false)
  })
})

describe('planSetupWizardSessions', () => {
  it('reuses the first existing session id when there is only one session', () => {
    const blueprint = createSetupWizardBlueprint({
      startAt: '2026-04-01T00:00:00.000Z',
      endAt: '2026-04-05T00:00:00.000Z',
      format: 'prelim_final',
      submissionStyle: 'standard',
      dimensions: [],
    })

    const result = planSetupWizardSessions([{ id: 'session-existing' }], blueprint.sessions)

    expect(result.mode).toBe('generated')
    expect(result.sessions?.[0]?.id).toBe('session-existing')
    expect(result.sessions?.[1]?.id).toBeUndefined()
  })

  it('preserves existing sessions when multiple sessions already exist', () => {
    const blueprint = createSetupWizardBlueprint({
      startAt: '2026-04-01T00:00:00.000Z',
      endAt: '2026-04-05T00:00:00.000Z',
      format: 'three_stage',
      submissionStyle: 'detailed',
      dimensions: ['region'],
    })

    const result = planSetupWizardSessions([{ id: 's1' }, { id: 's2' }], blueprint.sessions)

    expect(result).toEqual({ mode: 'preserve_existing' })
  })
})
