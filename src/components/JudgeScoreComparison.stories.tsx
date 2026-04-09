import type { Meta, StoryObj } from '@storybook/react-vite'
import { JudgeScoreComparison } from './JudgeScoreComparison'
import type { Assignment, AdminUser } from '@/lib/types'

const meta: Meta<typeof JudgeScoreComparison> = {
  title: 'Charts/JudgeScoreComparison',
  component: JudgeScoreComparison,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof meta>

const mockJudges: AdminUser[] = [
  { id: 'j1', name: '张三', email: 'zhang@example.com', role: 'judge' },
  { id: 'j2', name: '李四', email: 'li@example.com', role: 'judge' },
  { id: 'j3', name: '王五', email: 'wang@example.com', role: 'judge' },
  { id: 'j4', name: '赵六', email: 'zhao@example.com', role: 'judge' },
  { id: 'j5', name: '钱七', email: 'qian@example.com', role: 'judge' },
]

function generateAssignments(judgeId: string, count: number, avgScore: number): Assignment[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `${judgeId}-a${i}`,
    projectId: `p${i}`,
    judgeId,
    status: 'completed',
    totalScore: Math.max(0, Math.min(100, Math.floor(avgScore + (Math.random() - 0.5) * 20))),
  } as Assignment))
}

export const Empty: Story = {
  args: {
    assignments: [],
    judges: mockJudges,
    title: '暂无评分',
  },
}

export const SingleJudge: Story = {
  args: {
    assignments: generateAssignments('j1', 10, 75),
    judges: [mockJudges[0]],
    title: '单个评委评分',
  },
}

export const MultipleJudges: Story = {
  args: {
    assignments: [
      ...generateAssignments('j1', 12, 82),
      ...generateAssignments('j2', 10, 76),
      ...generateAssignments('j3', 15, 88),
      ...generateAssignments('j4', 8, 71),
      ...generateAssignments('j5', 11, 85),
    ],
    judges: mockJudges,
    title: '评委评分对比',
  },
}

export const StrictJudge: Story = {
  args: {
    assignments: [
      ...generateAssignments('j1', 10, 65),
      ...generateAssignments('j2', 10, 63),
      ...generateAssignments('j3', 10, 68),
    ],
    judges: mockJudges.slice(0, 3),
    title: '严格评委',
  },
}

export const GenerousJudge: Story = {
  args: {
    assignments: [
      ...generateAssignments('j1', 10, 88),
      ...generateAssignments('j2', 10, 92),
      ...generateAssignments('j3', 10, 85),
    ],
    judges: mockJudges.slice(0, 3),
    title: '宽松评委',
  },
}

export const WithInactiveJudges: Story = {
  args: {
    assignments: [
      ...generateAssignments('j1', 10, 80),
      ...generateAssignments('j2', 0, 0), // No assignments
      ...generateAssignments('j3', 10, 85),
    ],
    judges: mockJudges.slice(0, 3),
    title: '含未评分评委',
  },
}
