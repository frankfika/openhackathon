import React, { useState, useEffect } from 'react'
import { Plus, Trash2, GripVertical, AlertCircle, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ScoringCriterion } from '@/lib/mock-data'
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

  const addCriterion = () => {
    const newCriterion: ScoringCriterion = {
      id: `sc_${Date.now()}`,
      name: 'New Criterion',
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
          <h3 className="text-lg font-medium">Scoring Criteria Configuration</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Define the scoring criteria for judges. Total must equal 100 points.
          </p>
        </div>
        <Button onClick={addCriterion} size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Add Criterion
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
                  <Label>Criterion Name</Label>
                  <Input
                    value={criterion.name}
                    onChange={(e) => updateCriterion(index, { name: e.target.value })}
                    placeholder="e.g., Innovation, Technical Implementation"
                  />
                </div>

                <div className="md:col-span-3 space-y-2">
                  <Label>Max Score</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={criterion.maxScore || 0}
                    onChange={(e) => updateCriterion(index, { maxScore: parseInt(e.target.value) || 0 })}
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
            No scoring criteria configured. Add a criterion to get started.
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
              <span className="font-semibold">Total Score: {totalScore} / 100</span>
              {!isValid && (
                <span className="ml-2">
                  {totalScore < 100
                    ? `Need ${100 - totalScore} more points`
                    : `Reduce by ${totalScore - 100} points`}
                </span>
              )}
            </AlertDescription>
          </div>
        </Alert>
      )}

      <div className="flex justify-end pt-4">
        <Button onClick={handleSave} disabled={!isValid}>
          {t('common.save_changes', 'Save Changes')}
        </Button>
      </div>
    </div>
  )
}
