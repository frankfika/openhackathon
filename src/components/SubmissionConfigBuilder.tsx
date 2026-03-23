import React, { useState, useEffect } from 'react'
import { Plus, Trash2, GripVertical, Mail, User, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
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
import { Badge } from '@/components/ui/badge'
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
  const hasSelectWithoutOptions = fields.some((field) => field.type === 'select' && (field.options || []).length === 0)

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-medium">{t('submission.config_title')}</h3>
        <p className="text-sm text-muted-foreground mt-1">{t('submission.config_desc')}</p>
      </div>

      {/* Built-in fields preview */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-muted-foreground" />
          <h4 className="text-sm font-medium">{t('submission.builtin_fields_title')}</h4>
        </div>
        <p className="text-xs text-muted-foreground">{t('submission.builtin_fields_desc')}</p>

        <Card className="border-dashed bg-muted/30">
          <CardContent className="pt-5 pb-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <Mail className="h-3.5 w-3.5" />
                  {t('submission.contact_email_label')}
                  <span className="text-destructive">*</span>
                  <Badge variant="secondary" className="text-[10px] ml-1">{t('submission.required')}</Badge>
                </Label>
                <Input
                  disabled
                  placeholder={t('submission.contact_email_placeholder')}
                  className="bg-background/50"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <User className="h-3.5 w-3.5" />
                  {t('submission.contact_name_label')}
                  <Badge variant="outline" className="text-[10px] ml-1">{t('submission.optional')}</Badge>
                </Label>
                <Input
                  disabled
                  placeholder={t('submission.contact_name_placeholder')}
                  className="bg-background/50"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Custom fields */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-medium">{t('submission.custom_fields_title')}</h4>
            <p className="text-xs text-muted-foreground mt-0.5">{t('submission.custom_fields_desc')}</p>
          </div>
          <Button onClick={addField} size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            {t('submission.add_field')}
          </Button>
        </div>

        <div className="space-y-3">
          {fields.map((field, index) => (
            <Card key={field.id}>
              <CardContent className="pt-5 pb-4">
                <div className="flex gap-3 items-start">
                  <div className="flex-shrink-0 pt-7 cursor-move text-muted-foreground/50 hover:text-muted-foreground transition-colors">
                    <GripVertical className="h-5 w-5" />
                  </div>

                  <div className="flex-1 space-y-3">
                    <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr_auto]  items-end">
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">{t('submission.field_label')}</Label>
                        <Input
                          value={field.label}
                          onChange={(e) => updateField(index, { label: e.target.value })}
                          placeholder={t('submission.field_label')}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">{t('submission.field_type')}</Label>
                        <Select
                          value={field.type}
                          onValueChange={(value) => updateField(index, { type: value as SubmissionField['type'] })}
                        >
                          <SelectTrigger className="w-[140px]">
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

                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">{t('submission.placeholder')}</Label>
                        <Input
                          value={field.placeholder || ''}
                          onChange={(e) => updateField(index, { placeholder: e.target.value })}
                          placeholder={t('submission.placeholder')}
                        />
                      </div>

                      <div className="flex items-center gap-3 pb-0.5">
                        <div className="flex items-center gap-2">
                          <Switch
                            id={`required-${field.id}`}
                            checked={field.required}
                            onCheckedChange={(checked) => updateField(index, { required: checked })}
                          />
                          <Label
                            htmlFor={`required-${field.id}`}
                            className={cn(
                              "text-xs cursor-pointer whitespace-nowrap",
                              field.required ? "text-destructive font-medium" : "text-muted-foreground"
                            )}
                          >
                            {t('submission.required')}
                          </Label>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive/60 hover:text-destructive"
                          onClick={() => removeField(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {field.type === 'select' && (
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">{t('submission.field_options')}</Label>
                        <Textarea
                          value={optionsToText(field)}
                          onChange={(e) => updateField(index, { options: parseOptions(e.target.value) })}
                          placeholder={t('submission.field_options_placeholder')}
                          className="min-h-[100px]"
                        />
                        <p className="text-[11px] text-muted-foreground">{t('submission.field_options_help')}</p>
                        {(field.options || []).length === 0 && (
                          <p className="text-[11px] text-destructive">{t('submission.field_options_required')}</p>
                        )}
                      </div>
                    )}

                    {(field.type === 'text' || field.type === 'select') && (
                      <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5">
                        <div>
                          <span className="text-xs font-medium">{t('submission.filterable')}</span>
                          <p className="text-[11px] text-muted-foreground mt-0.5">{t('submission.filterable_desc')}</p>
                        </div>
                        <Switch
                          checked={Boolean(field.filterable)}
                          onCheckedChange={(checked) => updateField(index, { filterable: checked })}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {fields.length === 0 && (
            <div className="text-center py-8 border border-dashed rounded-lg text-muted-foreground text-sm">
              {t('submission.no_fields')}
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <Button onClick={() => onSave(fields)} disabled={hasSelectWithoutOptions}>
          {t('common.save_changes')}
        </Button>
      </div>
      {hasSelectWithoutOptions && (
        <p className="text-xs text-destructive text-right -mt-1">{t('submission.field_options_required')}</p>
      )}
    </div>
  )
}
