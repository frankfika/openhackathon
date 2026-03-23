import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SubmissionConfigBuilder } from '@/components/SubmissionConfigBuilder'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

describe('SubmissionConfigBuilder', () => {
  it('disables save when a select field has no options, then enables after options are added', () => {
    const onSave = vi.fn()

    render(
      <SubmissionConfigBuilder
        initialSchema={[
          {
            id: 'field_track',
            label: 'Track',
            type: 'select',
            required: false,
            placeholder: '',
            options: [],
          },
        ]}
        onSave={onSave}
      />
    )

    const saveButton = screen.getByRole('button', { name: 'common.save_changes' })
    expect(saveButton).toBeDisabled()
    expect(screen.getAllByText('submission.field_options_required').length).toBeGreaterThan(0)

    const optionsTextarea = screen.getByPlaceholderText('submission.field_options_placeholder')
    fireEvent.change(optionsTextarea, { target: { value: 'AI Agent' } })

    expect(saveButton).toBeEnabled()
  })
})

