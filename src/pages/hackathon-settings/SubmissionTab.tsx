import { SubmissionConfigBuilder } from '@/components/SubmissionConfigBuilder'
import { SubmissionField } from '@/lib/types'

export interface SubmissionTabProps {
  isLocked: boolean
  submissionSchema: SubmissionField[]
  onSaveSubmissionSchema: (schema: SubmissionField[]) => void
}

export function SubmissionTab({ isLocked, submissionSchema, onSaveSubmissionSchema }: SubmissionTabProps) {
  if (isLocked) {
    return (
      <div className="pointer-events-none opacity-60">
        <SubmissionConfigBuilder
          initialSchema={submissionSchema}
          onSave={() => {}}
        />
      </div>
    )
  }

  return (
    <SubmissionConfigBuilder
      initialSchema={submissionSchema}
      onSave={onSaveSubmissionSchema}
    />
  )
}
