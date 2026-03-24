import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScoringCriteriaBuilder } from '@/components/ScoringCriteriaBuilder'
import { ScoringCriterion } from '@/lib/types'
import { useTranslation } from 'react-i18next'

export interface ScoringTabProps {
  isLocked: boolean
  scoringCriteria: ScoringCriterion[]
  judgesPerProject: number
  setJudgesPerProject: (value: number) => void
  onSaveScoringCriteria: (criteria: ScoringCriterion[]) => void
  onSaveJudgesPerProject: () => Promise<void>
  updateMutationIsPending: boolean
}

export function ScoringTab({
  isLocked,
  scoringCriteria,
  judgesPerProject,
  setJudgesPerProject,
  onSaveScoringCriteria,
  onSaveJudgesPerProject,
  updateMutationIsPending,
}: ScoringTabProps) {
  const { t } = useTranslation()

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
    </>
  )
}
