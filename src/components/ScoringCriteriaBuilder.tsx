import React, { useState } from 'react'
import { Plus, Trash2, GripVertical, AlertCircle, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ScoringCriterion } from '@/lib/types'
import { useTranslation } from 'react-i18next'

interface ScoringCriteriaBuilderProps {
  initialCriteria?: ScoringCriterion[]
  onSave: (criteria: ScoringCriterion[]) => void
}

export function ScoringCriteriaBuilder({ initialCriteria = [], onSave }: ScoringCriteriaBuilderProps) {
  const { t } = useTranslation()
  const [criteria, setCriteria] = useState<ScoringCriterion[]>(initialCriteria)

  const totalScore = criteria.reduce((sum, c) => sum + (c.maxScore || 0), 0)
  const isValid = totalScore === 100

  const normalizeScoreInput = (raw: string) => {
    const digitsOnly = raw.replace(/[^\d]/g, '')
    if (!digitsOnly) return 0
    const normalized = digitsOnly.replace(/^0+(?=\d)/, '')
    const parsed = Number.parseInt(normalized, 10)
    if (!Number.isFinite(parsed)) return 0
    return Math.min(100, Math.max(0, parsed))
  }

  const addCriterion = () => {
    const newCriterion: ScoringCriterion = {
      id: `sc_${Date.now()}`,
      name: t('scoring_builder.new_criterion'),
      maxScore: 0
    }
    setCriteria([...criteria, newCriterion])
  }

  const removeCriterion = (index: number) => {
    const newCriteria = [...criteria]
    newCriteria.splice(index, 1)
    setCriteria(newCriteria)
  }

  const updateCriterion = (index: number, updates: Partial<ScoringCriterion>) => {
    const newCriteria = [...criteria]
    newCriteria[index] = { ...newCriteria[index], ...updates }
    setCriteria(newCriteria)
  }

  const handleSave = () => {
    if (isValid) {
      onSave(criteria)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">{t('scoring_builder.config_title')}</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {t('scoring_builder.config_desc')}
          </p>
        </div>
        <Button onClick={addCriterion} size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          {t('scoring_builder.add_criterion')}
        </Button>
      </div>

      <div className="space-y-4">
        {criteria.map((criterion, index) => (
          <Card key={criterion.id} className="relative">
            <CardContent className="pt-6">
              <div className="grid gap-4 md:grid-cols-12 items-start">
                <div className="md:col-span-1 flex justify-center pt-3 cursor-move text-muted-foreground">
                  <GripVertical className="h-5 w-5" />
                </div>

                <div className="md:col-span-7 space-y-2">
                  <Label>{t('scoring_builder.criterion_name')}</Label>
                  <Input
                    value={criterion.name}
                    onChange={(e) => updateCriterion(index, { name: e.target.value })}
                    placeholder={t('scoring_builder.criterion_name_placeholder')}
                  />
                </div>

                <div className="md:col-span-3 space-y-2">
                  <Label>{t('scoring_builder.max_score')}</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={criterion.maxScore || 0}
                    onChange={(e) => updateCriterion(index, { maxScore: normalizeScoreInput(e.target.value) })}
                    placeholder="0"
                  />
                </div>

                <div className="md:col-span-1 flex items-end pb-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive/90"
                    onClick={() => removeCriterion(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {criteria.length === 0 && (
          <div className="text-center py-10 border border-dashed rounded-lg text-muted-foreground">
            {t('scoring_builder.no_criteria')}
          </div>
        )}
      </div>

      {criteria.length > 0 && (
        <Alert variant={isValid ? "default" : "destructive"}>
          <div className="flex items-center gap-2">
            {isValid ? (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <AlertDescription>
              <span className="font-semibold">{t('scoring_builder.total_score', { score: totalScore })}</span>
              {!isValid && (
                <span className="ml-2">
                  {totalScore < 100
                    ? t('scoring_builder.need_more', { count: 100 - totalScore })
                    : t('scoring_builder.reduce_by', { count: totalScore - 100 })}
                </span>
              )}
            </AlertDescription>
          </div>
        </Alert>
      )}

      <div className="flex justify-end pt-4">
        <Button onClick={handleSave} disabled={!isValid}>
          {t('common.save_changes')}
        </Button>
      </div>
    </div>
  )
}
