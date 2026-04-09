import type { Meta, StoryObj } from '@storybook/react-vite'
import { ErrorBoundary } from './ErrorBoundary'

const meta: Meta<typeof ErrorBoundary> = {
  title: 'Components/ErrorBoundary',
  component: ErrorBoundary,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof meta>

// Component that throws an error
function BuggyComponent(): never {
  throw new Error('This is a test error!')
}

export const Default: Story = {
  args: {
    children: <div className="p-4">正常渲染的内容</div>,
  },
}

export const WithError: Story = {
  args: {
    children: <BuggyComponent />,
  },
}

export const WithCustomFallback: Story = {
  args: {
    children: <BuggyComponent />,
    fallback: (
      <div className="p-6 text-center">
        <h3 className="text-lg font-semibold text-destructive">自定义错误提示</h3>
        <p className="text-muted-foreground">这是自定义的错误回退 UI</p>
      </div>
    ),
  },
}
