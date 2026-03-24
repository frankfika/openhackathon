import type { TFunction } from 'i18next'
import type { Hackathon, Project, SubmissionField } from './types'

const KNOWN_FIELD_I18N: Record<string, string> = {
  title: 'projects.project_name',
  oneLiner: 'projects.one_liner',
  description: 'projects.description',
  demoUrl: 'projects.demo_url',
  repoUrl: 'projects.repo_url',
  tags: 'projects.tags',
}

/** Return the i18n label for a known field id, or the raw label as fallback. */
export function getFieldLabel(fieldId: string, rawLabel: string, t: TFunction): string {
  const key = KNOWN_FIELD_I18N[fieldId]
  return key ? t(key) : rawLabel
}

export function formatSubmissionFieldValue(value: unknown): string {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed || '-'
  }
  if (Array.isArray(value)) {
    const normalized = value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean)
    return normalized.length > 0 ? normalized.join(', ') : '-'
  }
  if (value && typeof value === 'object') {
    try {
      return JSON.stringify(value)
    } catch {
      return String(value)
    }
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return '-'
}

export function getSubmissionFields(schema?: Hackathon['submissionSchema']): SubmissionField[] {
  const fields = Array.isArray(schema) ? schema : schema?.fields || []
  return fields.map((field) => ({
    ...field,
    options: normalizeSubmissionFieldOptions(field.options),
  }))
}

export function normalizeSubmissionFieldOptions(options?: string[]) {
  const seen = new Set<string>()
  const normalized: string[] = []

  for (const option of options || []) {
    const value = typeof option === 'string' ? option.trim() : ''
    if (!value || seen.has(value)) continue
    seen.add(value)
    normalized.push(value)
  }

  return normalized
}

export function getSubmissionFieldLabelMap(schema: Hackathon['submissionSchema'] | undefined, t: TFunction) {
  const fields = getSubmissionFields(schema)
  return new Map(fields.map((field) => [field.id, getFieldLabel(field.id, field.label, t)]))
}

export function getVisibleSubmissionDataEntries(
  submissionData: Record<string, unknown> | undefined,
  schema: Hackathon['submissionSchema'] | undefined,
  t: TFunction
) {
  const labelMap = getSubmissionFieldLabelMap(schema, t)

  return Object.entries(submissionData || {})
    .filter(([key]) => !key.startsWith('_'))
    .map(([key, value]) => ({
      key,
      label: labelMap.get(key) || key,
      value: formatSubmissionFieldValue(value),
    }))
    .filter((entry) => entry.value !== '-')
}

export function supportsSubmissionFieldFilter(field: SubmissionField) {
  return field.type === 'text' || field.type === 'select'
}

export function getFilterableSubmissionFields(schema?: Hackathon['submissionSchema']) {
  return getSubmissionFields(schema).filter((field) => Boolean(field.filterable) && supportsSubmissionFieldFilter(field))
}

export function getProjectSubmissionFieldValue(project: Project, fieldId: string) {
  const projectColumnValue = project[fieldId as keyof Project]
  if (typeof projectColumnValue === 'string') return projectColumnValue.trim()
  if (Array.isArray(projectColumnValue)) {
    return projectColumnValue
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean)
      .join(', ')
  }

  const value = project.submissionData?.[fieldId]
  if (typeof value === 'string') return value.trim()
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean)
      .join(', ')
  }
  return ''
}

export function getSubmissionFieldFilterOptions(field: SubmissionField, projects: Project[]) {
  const options = new Set<string>(normalizeSubmissionFieldOptions(field.options))
  for (const project of projects) {
    const value = getProjectSubmissionFieldValue(project, field.id)
    if (value) options.add(value)
  }
  return [...options].sort((left, right) => left.localeCompare(right, 'zh-CN'))
}
