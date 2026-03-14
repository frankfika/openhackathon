import React, { useState, useEffect } from 'react'
import { Plus, Trash2, GripVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SubmissionField } from '@/lib/types'
import { Card, CardContent } from '@/components/ui/card'
import { useTranslation } from 'react-i18next'

interface SubmissionConfigBuilderProps {
  initialSchema?: SubmissionField[]
  onSave: (schema: SubmissionField[]) => void
}

export function SubmissionConfigBuilder({ initialSchema = [], onSave }: SubmissionConfigBuilderProps) {
  const { t } = useTranslation()
  const [fields, setFields] = useState<SubmissionField[]>(initialSchema)

  useEffect(() => {
    setFields(initialSchema)
  }, [initialSchema])

  const addField = () => {
    const newField: SubmissionField = {
      id: `field_${Date.now()}`,
      label: t('submission.new_field'),
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
    const nextField = { ...newFields[index], ...updates }
    if (updates.type && updates.type !== 'select') {
      nextField.options = []
    }
    if (updates.type && updates.type !== 'text' && updates.type !== 'select') {
      nextField.filterable = false
    }
    newFields[index] = nextField
    setFields(newFields)
  }

  const optionsToText = (field: SubmissionField) => (field.options || []).join('\n')
  const parseOptions = (value: string) => value.split('\n').map((item) => item.trim()).filter(Boolean)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">{t('submission.config_title')}</h3>
          <p className="text-sm text-muted-foreground mt-1">{t('submission.config_desc')}</p>
        </div>
        <Button onClick={addField} size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          {t('submission.add_field')}
        </Button>
      </div>

      <div className="space-y-4">
        {fields.map((field, index) => (
          <Card key={field.id}>
            <CardContent className="pt-6">
              <div className="grid gap-4 md:grid-cols-12 items-start">
                <div className="md:col-span-1 flex flex-col items-center gap-1 pt-3 cursor-move text-muted-foreground">
                  <GripVertical className="h-5 w-5" />
                  <span className="text-[10px] text-muted-foreground/60 font-mono">{field.id}</span>
                </div>

                <div className="md:col-span-4 space-y-2">
                  <Label>{t('submission.field_label')}</Label>
                  <Input
                    value={field.label}
                    onChange={(e) => updateField(index, { label: e.target.value })}
                    placeholder={t('submission.field_label')}
                  />
                </div>

                <div className="md:col-span-3 space-y-2">
                  <Label>{t('submission.field_type')}</Label>
                  <Select
                    value={field.type}
                    onValueChange={(value) => updateField(index, { type: value as SubmissionField['type'] })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">{t('submission.field_types.text')}</SelectItem>
                      <SelectItem value="textarea">{t('submission.field_types.textarea')}</SelectItem>
                      <SelectItem value="url">{t('submission.field_types.url')}</SelectItem>
                      <SelectItem value="select">{t('submission.field_types.select')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="md:col-span-3 space-y-2">
                  <Label>{t('submission.placeholder')}</Label>
                  <Input
                    value={field.placeholder || ''}
                    onChange={(e) => updateField(index, { placeholder: e.target.value })}
                    placeholder={t('submission.placeholder')}
                  />
                </div>

                <div className="md:col-span-1 flex flex-col items-center gap-4 pt-1">
                  <div className="flex flex-col items-center gap-1.5">
                    <Label className="text-xs text-muted-foreground">{t('submission.required')}</Label>
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

                {field.type === 'select' && (
                  <div className="md:col-span-6 space-y-2">
                    <Label>{t('submission.field_options')}</Label>
                    <Textarea
                      value={optionsToText(field)}
                      onChange={(e) => updateField(index, { options: parseOptions(e.target.value) })}
                      placeholder={t('submission.field_options_placeholder')}
                      className="min-h-[120px]"
                    />
                    <p className="text-xs text-muted-foreground">{t('submission.field_options_help')}</p>
                  </div>
                )}

                {(field.type === 'text' || field.type === 'select') && (
                  <div className="md:col-span-6 space-y-2">
                    <div className="flex items-center justify-between rounded-xl border border-border/60 bg-background/60 px-4 py-3">
                      <div>
                        <Label className="text-sm">{t('submission.filterable')}</Label>
                        <p className="mt-1 text-xs text-muted-foreground">{t('submission.filterable_desc')}</p>
                      </div>
                      <Switch
                        checked={Boolean(field.filterable)}
                        onCheckedChange={(checked) => updateField(index, { filterable: checked })}
                      />
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}

        {fields.length === 0 && (
          <div className="text-center py-10 border border-dashed rounded-lg text-muted-foreground">
            {t('submission.no_fields')}
          </div>
        )}
      </div>

      <div className="flex justify-end pt-4">
        <Button onClick={() => onSave(fields)}>
          {t('common.save_changes')}
        </Button>
      </div>
    </div>
  )
}
