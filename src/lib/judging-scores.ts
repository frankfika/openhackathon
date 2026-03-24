import type { Assignment, ScoringCriterion } from './types'

export type ScoreDraft = Record<string, number | null>

export function scoresToDraft(scores: Assignment['scores']): ScoreDraft {
  if (!scores) return {}
  if (Array.isArray(scores)) {
    return scores.reduce<ScoreDraft>((acc, item) => {
      acc[item.criterionId] = item.score
      return acc
    }, {})
  }
  return Object.fromEntries(
    Object.entries(scores).map(([criterionId, score]) => [criterionId, typeof score === 'number' ? score : null])
  )
}

export function createEmptyScoreDraft(criteria: ScoringCriterion[]): ScoreDraft {
  return criteria.reduce<ScoreDraft>((acc, criterion) => {
    acc[criterion.id] = null
    return acc
  }, {})
}

export function clampScore(value: number, maxScore: number) {
  if (Number.isNaN(value)) return 0
  return Math.min(Math.max(value, 0), maxScore)
}

export function sumScoreDraft(scores: ScoreDraft) {
  return Object.values(scores).reduce((sum, score) => sum + (score ?? 0), 0)
}

export function countUnscoredCriteria(scores: ScoreDraft, criteria: ScoringCriterion[]) {
  return criteria.filter((criterion) => scores[criterion.id] == null).length
}

export function isScoreDraftComplete(scores: ScoreDraft, criteria: ScoringCriterion[]) {
  return criteria.length > 0 && countUnscoredCriteria(scores, criteria) === 0
}

export function scoreDraftToPayload(scores: ScoreDraft, criteria: ScoringCriterion[]) {
  return criteria
    .map((criterion) => {
      const score = scores[criterion.id]
      if (score == null) return null
      return {
        criterionId: criterion.id,
        score,
      }
    })
    .filter((item): item is { criterionId: string; score: number } => item !== null)
}
