import { Component, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onReset?: () => void
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  handleReset = () => {
    this.props.onReset?.()
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center">
          <div className="rounded-full bg-destructive/10 p-4 mb-4">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <h2 className="text-xl font-semibold mb-2">出错了</h2>
          <p className="text-muted-foreground max-w-md mb-6">
            应用程序遇到了意外错误。请尝试刷新页面或返回首页。
          </p>
          {this.state.error && (
            <pre className="text-xs text-muted-foreground bg-muted p-4 rounded-lg max-w-full overflow-auto mb-6">
              {this.state.error.message}
            </pre>
          )}
          <div className="flex gap-3">
            <Button onClick={this.handleReset} variant="outline">
              重试
            </Button>
            <Button onClick={() => window.location.href = '/'}>
              返回首页
            </Button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
