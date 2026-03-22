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

export function supportsSubmissionFieldFilter(field: SubmissionField) {
  return field.type === 'text' || field.type === 'select'
}

export function getFilterableSubmissionFields(schema?: Hackathon['submissionSchema']) {
  return getSubmissionFields(schema).filter((field) => Boolean(field.filterable) && supportsSubmissionFieldFilter(field))
}

export function getProjectSubmissionFieldValue(project: Project, fieldId: string) {
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
