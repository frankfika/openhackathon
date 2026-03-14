import { describe, expect, it } from 'vitest'
import type { SubmissionField } from '@/lib/types'
import { getFilterableSubmissionFields, getProjectSubmissionFieldValue, getSubmissionFieldFilterOptions, getSubmissionFields } from '@/lib/submission-fields'

describe('submission field helpers', () => {
  it('normalizes submission schema fields from object form', () => {
    const fields = getSubmissionFields({
      fields: [
        { id: 'track', label: 'Track', type: 'select', required: false, options: ['AI', ' AI ', 'Web3'] },
      ],
    })

    expect(fields[0].options).toEqual(['AI', 'Web3'])
  })

  it('returns only supported filterable fields', () => {
    const fields = getFilterableSubmissionFields({
      fields: [
        { id: 'track', label: 'Track', type: 'select', required: false, filterable: true, options: ['AI'] },
        { id: 'notes', label: 'Notes', type: 'textarea', required: false, filterable: true },
      ],
    })

    expect(fields.map((field) => field.id)).toEqual(['track'])
  })

  it('builds filter options from schema and project data', () => {
    const field: SubmissionField = { id: 'track', label: 'Track', type: 'select', required: false, filterable: true, options: ['AI', 'Fintech'] }
    const projects = [
      { id: 'p1', submissionData: { track: 'AI' } },
      { id: 'p2', submissionData: { track: 'Healthcare' } },
    ] as never

    expect(getSubmissionFieldFilterOptions(field, projects)).toEqual(['AI', 'Fintech', 'Healthcare'])
    expect(getProjectSubmissionFieldValue(projects[1], 'track')).toBe('Healthcare')
  })
})
