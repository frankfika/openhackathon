import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { RotateCcw, Trash2, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { api } from '@/lib/api'
import { useMutation, useQueryClient } from '@tanstack/react-query'

export function SystemToolsTab() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [resetMode, setResetMode] = useState<'hackathon' | 'factory' | null>(null)
  const [resetConfirmText, setResetConfirmText] = useState('')

  const resetMutation = useMutation({
    mutationFn: (mode: 'hackathon' | 'factory') => api.resetSystem(mode),
    onSuccess: (_data, mode) => {
      toast.success(t('system_tools.reset_success'))
      setResetMode(null)
      setResetConfirmText('')
      if (mode === 'factory') {
        // Clear auth and redirect to setup
        localStorage.removeItem('openhackathon_admin_token')
        localStorage.removeItem('openhackathon_admin_user')
        localStorage.removeItem('openhackathon_judge_token')
        localStorage.removeItem('openhackathon_judge_user')
        window.location.href = '/setup'
      } else {
        queryClient.invalidateQueries()
        navigate('/')
      }
    },
    onError: () => {
      toast.error(t('system_tools.reset_failed'))
    },
  })

  return (
    <>
      <Card className="surface-panel border-none shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <RotateCcw className="h-5 w-5" />
            {t('system_tools.title')}
          </CardTitle>
          <CardDescription>{t('system_tools.desc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-border p-4">
            <div className="space-y-1">
              <p className="text-sm font-medium">{t('system_tools.reset_hackathon')}</p>
              <p className="text-xs text-muted-foreground">{t('system_tools.reset_hackathon_desc')}</p>
            </div>
            <Button variant="outline" className="shrink-0" onClick={() => setResetMode('hackathon')}>
              <RotateCcw className="mr-2 h-4 w-4" />
              {t('system_tools.reset_hackathon')}
            </Button>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/5 p-4">
            <div className="space-y-1">
              <p className="text-sm font-medium text-destructive">{t('system_tools.factory_reset')}</p>
              <p className="text-xs text-muted-foreground">{t('system_tools.factory_reset_desc')}</p>
            </div>
            <Button variant="destructive" className="shrink-0" onClick={() => setResetMode('factory')}>
              <Trash2 className="mr-2 h-4 w-4" />
              {t('system_tools.factory_reset')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Reset Confirmation Dialog */}
      <AlertDialog open={!!resetMode} onOpenChange={(open) => { if (!open) { setResetMode(null); setResetConfirmText('') } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('system_tools.confirm_title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {resetMode === 'factory' ? t('system_tools.confirm_factory') : t('system_tools.confirm_hackathon')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            placeholder={t('system_tools.confirm_placeholder')}
            value={resetConfirmText}
            onChange={(e) => setResetConfirmText(e.target.value)}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              disabled={resetConfirmText !== 'RESET' || resetMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault()
                if (resetMode) resetMutation.mutate(resetMode)
              }}
            >
              {resetMutation.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t('system_tools.resetting')}</>
              ) : (
                resetMode === 'factory' ? t('system_tools.factory_reset') : t('system_tools.reset_hackathon')
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
