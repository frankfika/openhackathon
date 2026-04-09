import type { Meta, StoryObj } from '@storybook/react-vite'
import { JudgeChip } from './JudgeChip'

const meta: Meta<typeof JudgeChip> = {
  title: 'AssignmentManager/JudgeChip',
  component: JudgeChip,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    status: {
      control: 'select',
      options: ['pending', 'in_progress', 'completed'],
    },
    canRemove: {
      control: 'boolean',
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
    'judging.status.pending': '待评分',
    'judging.status.in_progress': '评分中',
    'judging.status.completed': '已完成',
  }
  return translations[key] || key
}

export const Pending: Story = {
  args: {
    judgeName: '张三',
    status: 'pending',
    canRemove: true,
    isMutating: false,
    onRemove: () => console.log('Remove clicked'),
    t: mockT,
  },
}

export const InProgress: Story = {
  args: {
    judgeName: '李四',
    status: 'in_progress',
    canRemove: false,
    isMutating: false,
    onRemove: () => {},
    t: mockT,
  },
}

export const Completed: Story = {
  args: {
    judgeName: '王五',
    status: 'completed',
    totalScore: 85,
    canRemove: false,
    isMutating: false,
    onRemove: () => {},
    t: mockT,
  },
}

export const CompletedNoScore: Story = {
  args: {
    judgeName: '赵六',
    status: 'completed',
    canRemove: false,
    isMutating: false,
    onRemove: () => {},
    t: mockT,
  },
}

export const Mutating: Story = {
  args: {
    judgeName: '张三',
    status: 'pending',
    canRemove: true,
    isMutating: true,
    onRemove: () => {},
    t: mockT,
  },
}

export const LongName: Story = {
  args: {
    judgeName: '非常长的评委名字测试',
    status: 'completed',
    totalScore: 92,
    canRemove: false,
    isMutating: false,
    onRemove: () => {},
    t: mockT,
  },
}
