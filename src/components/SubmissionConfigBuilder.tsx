import React, { useState } from 'react'
import { Plus, Trash2, GripVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SubmissionField } from '@/lib/mock-data'
import { Card, CardContent } from '@/components/ui/card'
import { useTranslation } from 'react-i18next'

interface SubmissionConfigBuilderProps {
  initialSchema?: SubmissionField[]
  onSave: (schema: SubmissionField[]) => void
}

export function SubmissionConfigBuilder({ initialSchema = [], onSave }: SubmissionConfigBuilderProps) {
  const { t } = useTranslation()
  const [fields, setFields] = useState<SubmissionField[]>(initialSchema)

  const addField = () => {
    const newField: SubmissionField = {
      id: `field_${Date.now()}`,
      label: 'New Field',
      type: 'text',
      required: false,
      placeholder: ''
    }
    setFields([...fields, newField])
  }

  const removeField = (index: number) => {
    const newFields = [...fields]
    newFields.splice(index, 1)
    setFields(newFields)
  }

  const updateField = (index: number, updates: Partial<SubmissionField>) => {
    const newFields = [...fields]
    newFields[index] = { ...newFields[index], ...updates }
    setFields(newFields)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">{t('submission.config_title', 'Submission Form Configuration')}</h3>
        <Button onClick={addField} size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          {t('submission.add_field', 'Add Field')}
        </Button>
      </div>

      <div className="space-y-4">
        {fields.map((field, index) => (
          <Card key={field.id} className="relative">
            <CardContent className="pt-6">
              <div className="grid gap-4 md:grid-cols-12 items-start">
                <div className="md:col-span-1 flex justify-center pt-3 cursor-move text-muted-foreground">
                  <GripVertical className="h-5 w-5" />
                </div>
                
                <div className="md:col-span-4 space-y-2">
                  <Label>{t('submission.field_label', 'Label')}</Label>
                  <Input 
                    value={field.label} 
                    onChange={(e) => updateField(index, { label: e.target.value })}
                    placeholder="Field Label"
                  />
                </div>

                <div className="md:col-span-3 space-y-2">
                  <Label>{t('submission.field_type', 'Type')}</Label>
                  <Select 
                    value={field.type} 
                    onValueChange={(value) => updateField(index, { type: value as SubmissionField['type'] })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Text Input</SelectItem>
                      <SelectItem value="textarea">Text Area</SelectItem>
                      <SelectItem value="url">URL</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="md:col-span-3 space-y-2">
                  <Label>{t('submission.placeholder', 'Placeholder')}</Label>
                  <Input 
                    value={field.placeholder || ''} 
                    onChange={(e) => updateField(index, { placeholder: e.target.value })}
                    placeholder="Placeholder text"
                  />
                </div>

                <div className="md:col-span-1 flex flex-col items-center gap-4 pt-1">
                  <div className="flex flex-col items-center gap-1.5">
                    <Label className="text-xs text-muted-foreground">{t('submission.required', 'Req.')}</Label>
                    <Switch 
                      checked={field.required}
                      onCheckedChange={(checked) => updateField(index, { required: checked })}
                    />
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="text-destructive hover:text-destructive/90"
                    onClick={() => removeField(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {fields.length === 0 && (
          <div className="text-center py-10 border border-dashed rounded-lg text-muted-foreground">
            {t('submission.no_fields', 'No fields configured. Add a field to get started.')}
          </div>
        )}
      </div>

      <div className="flex justify-end pt-4">
        <Button onClick={() => onSave(fields)}>
          {t('common.save_changes', 'Save Changes')}
        </Button>
      </div>
    </div>
  )
}
