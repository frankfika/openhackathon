import type { Meta, StoryObj } from '@storybook/react-vite'
import { ScoreDistributionChart } from './ScoreDistributionChart'
import type { Assignment } from '@/lib/types'

const meta: Meta<typeof ScoreDistributionChart> = {
  title: 'Charts/ScoreDistributionChart',
  component: ScoreDistributionChart,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  argTypes: {
    maxScore: {
      control: { type: 'number', min: 10, max: 200, step: 10 },
    },
  },
}

export default meta
type Story = StoryObj<typeof meta>

// Generate mock assignments
function generateAssignments(count: number, scoreRange: [number, number]): Assignment[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `a${i}`,
    projectId: `p${i}`,
    judgeId: `j${i % 5}`,
    status: 'completed',
    totalScore: Math.floor(Math.random() * (scoreRange[1] - scoreRange[0]) + scoreRange[0]),
  } as Assignment))
}

export const Empty: Story = {
  args: {
    assignments: [],
    maxScore: 100,
    title: '暂无评分',
  },
}

export const FewScores: Story = {
  args: {
    assignments: generateAssignments(5, [60, 95]),
    maxScore: 100,
    title: '少量评分分布',
  },
}

export const ManyScores: Story = {
  args: {
    assignments: generateAssignments(50, [40, 100]),
    maxScore: 100,
    title: '大量评分分布',
  },
}

export const HighScores: Story = {
  args: {
    assignments: generateAssignments(20, [80, 100]),
    maxScore: 100,
    title: '高分项目分布',
  },
}

export const LowScores: Story = {
  args: {
    assignments: generateAssignments(20, [40, 70]),
    maxScore: 100,
    title: '低分项目分布',
  },
}

export const LargeMaxScore: Story = {
  args: {
    assignments: generateAssignments(30, [80, 180]),
    maxScore: 200,
    title: '200分制评分分布',
  },
}
