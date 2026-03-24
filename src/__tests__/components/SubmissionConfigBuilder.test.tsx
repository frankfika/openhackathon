import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SubmissionConfigBuilder } from '@/components/SubmissionConfigBuilder'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue?: string) => defaultValue ?? key,
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

    // The component already shows one empty option input when options is empty.
    // Fill it to enable the save button.
    const optionInput = screen.getByPlaceholderText('Option value')
    fireEvent.change(optionInput, { target: { value: 'AI Agent' } })

    expect(saveButton).toBeEnabled()
  })
})
