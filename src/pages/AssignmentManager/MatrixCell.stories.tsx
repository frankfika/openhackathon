import type { Meta, StoryObj } from '@storybook/react-vite'
import { MatrixCell } from './MatrixCell'
import type { Assignment } from '@/lib/types'

const meta: Meta<typeof MatrixCell> = {
  title: 'AssignmentManager/MatrixCell',
  component: MatrixCell,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    assignment: {
      control: 'object',
    },
    isMutating: {
      control: 'boolean',
    },
  },
}

export default meta
type Story = StoryObj<typeof meta>

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    'assignments.click_to_assign': '点击分配',
    'judging.status.pending': '待评分',
    'judging.status.in_progress': '评分中',
    'judging.status.completed': '已完成',
  }
  return translations[key] || key
}

export const Empty: Story = {
  args: {
    assignment: undefined,
    isMutating: false,
    onToggle: () => console.log('Toggle clicked'),
    t: mockT,
  },
}

export const Pending: Story = {
  args: {
    assignment: {
      id: '1',
      projectId: 'p1',
      judgeId: 'j1',
      status: 'pending',
    } as Assignment,
    isMutating: false,
    onToggle: () => console.log('Toggle clicked'),
    t: mockT,
  },
}

export const InProgress: Story = {
  args: {
    assignment: {
      id: '1',
      projectId: 'p1',
      judgeId: 'j1',
      status: 'in_progress',
    } as Assignment,
    isMutating: false,
    onToggle: () => {},
    t: mockT,
  },
}

export const Completed: Story = {
  args: {
    assignment: {
      id: '1',
      projectId: 'p1',
      judgeId: 'j1',
      status: 'completed',
      totalScore: 85,
    } as Assignment,
    isMutating: false,
    onToggle: () => {},
    t: mockT,
  },
}

export const CompletedNoScore: Story = {
  args: {
    assignment: {
      id: '1',
      projectId: 'p1',
      judgeId: 'j1',
      status: 'completed',
    } as Assignment,
    isMutating: false,
    onToggle: () => {},
    t: mockT,
  },
}

export const Mutating: Story = {
  args: {
    assignment: {
      id: '1',
      projectId: 'p1',
      judgeId: 'j1',
      status: 'pending',
    } as Assignment,
    isMutating: true,
    onToggle: () => {},
    t: mockT,
  },
}
