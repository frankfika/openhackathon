import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScoringCriteriaBuilder } from '@/components/ScoringCriteriaBuilder'
import { ScoringCriterion } from '@/lib/types'
import { useTranslation } from 'react-i18next'
import { Sparkles } from 'lucide-react'
import { AIGenerateModal, AICriterionSuggestion } from '@/components/ai/AIGenerateModal'

export interface ScoringTabProps {
  isLocked: boolean
  scoringCriteria: ScoringCriterion[]
  judgesPerProject: number
  setJudgesPerProject: (value: number) => void
  onSaveScoringCriteria: (criteria: ScoringCriterion[]) => void
  onSaveJudgesPerProject: () => Promise<void>
  updateMutationIsPending: boolean
  hackathonId?: string
}

export function ScoringTab({
  isLocked,
  scoringCriteria,
  judgesPerProject,
  setJudgesPerProject,
  onSaveScoringCriteria,
  onSaveJudgesPerProject,
  updateMutationIsPending,
  hackathonId,
}: ScoringTabProps) {
  const { t } = useTranslation()
  const [isAICriteriaOpen, setIsAICriteriaOpen] = useState(false)

  function applyCriteria(suggestions: AICriterionSuggestion[]) {
    // Translate AI suggestions into the project's ScoringCriterion shape.
    // weight stays on the criterion; maxScore defaults to 10.
    const criteria: ScoringCriterion[] = suggestions.map((s, idx) => ({
      id: `criterion_${idx + 1}_${Date.now().toString(36)}`,
      name: s.name,
      weight: s.weight,
      maxScore: s.maxScore ?? 10,
      sortOrder: s.sortOrder ?? idx + 1,
    }))
    onSaveScoringCriteria(criteria)
  }

  return (
    <>
      <fieldset disabled={isLocked}>
      <div className="mb-6 space-y-3">
        <div>
          <h3 className="text-lg font-medium">{t('settings.judges_per_project')}</h3>
          <p className="text-sm text-muted-foreground mt-1">{t('settings.judges_per_project_desc')}</p>
        </div>
        <div className="flex items-center gap-3">
          <Input
            type="number"
            min={1}
            max={20}
            className="w-24"
            value={judgesPerProject}
            onChange={(e) => {
              const v = Number.parseInt(e.target.value, 10)
              if (v > 0) setJudgesPerProject(v)
            }}
          />
          {!isLocked && (
            <Button
              size="sm"
              variant="outline"
              onClick={onSaveJudgesPerProject}
              disabled={updateMutationIsPending}
            >
              {t('common.save_changes')}
            </Button>
          )}
          {hackathonId && !isLocked && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1"
              onClick={() => setIsAICriteriaOpen(true)}
              data-testid="open-ai-criteria"
            >
              <Sparkles className="h-3.5 w-3.5 text-purple-500" />
              {t('ai.generate.open_button_criteria')}
            </Button>
          )}
        </div>
      </div>
      </fieldset>
      {isLocked ? (
        <div className="pointer-events-none opacity-60">
          <ScoringCriteriaBuilder
            initialCriteria={scoringCriteria}
            onSave={() => {}}
          />
        </div>
      ) : (
        <ScoringCriteriaBuilder
          initialCriteria={scoringCriteria}
          onSave={onSaveScoringCriteria}
        />
      )}

      {hackathonId && (
        <AIGenerateModal
          hackathonId={hackathonId}
          mode="criteria"
          open={isAICriteriaOpen}
          onOpenChange={setIsAICriteriaOpen}
          onApplyCriteria={applyCriteria}
        />
      )}
    </>
  )
}
