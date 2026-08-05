import { Component, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
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

function ErrorBoundaryFallback({ error, onReset }: { error: Error | null; onReset: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center">
      <div className="rounded-full bg-destructive/10 p-4 mb-4">
        <AlertTriangle className="h-8 w-8 text-destructive" />
      </div>
      <h2 className="text-xl font-semibold mb-2">{t('error_boundary.title')}</h2>
      <p className="text-muted-foreground max-w-md mb-6">
        {t('error_boundary.description')}
      </p>
      {error && (
        <pre className="text-xs text-muted-foreground bg-muted p-4 rounded-lg max-w-full overflow-auto mb-6">
          {error.message}
        </pre>
      )}
      <div className="flex gap-3">
        <Button onClick={onReset} variant="outline">
          {t('common.retry')}
        </Button>
        <Button onClick={() => window.location.href = '/'}>
          {t('common.home')}
        </Button>
      </div>
    </div>
  )
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
    // Sprint 2.3 will replace this with structured logger.
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
      return <ErrorBoundaryFallback error={this.state.error} onReset={this.handleReset} />
    }

    return this.props.children
  }
}
