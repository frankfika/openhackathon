import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Eye, EyeOff, Save, Key, Server, Cpu, Gavel, Plus, Trash2, Loader2, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { api } from '@/lib/api'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export function Settings() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [showKey, setShowKey] = useState(false)
  const [config, setConfig] = useState({
    baseUrl: '',
    apiKey: '',
    model: ''
  })
  const [newJudge, setNewJudge] = useState({ name: '', email: '', password: '' })
  const [showCreateForm, setShowCreateForm] = useState(false)

  // Fetch judges
  const { data: judges = [], isLoading: isLoadingJudges } = useQuery({
    queryKey: ['users', 'judge'],
    queryFn: () => api.getUsers({ role: 'judge' }),
  })

  const createJudgeMutation = useMutation({
    mutationFn: (data: { name: string; email: string; password: string }) =>
      api.createUser({ ...data, role: 'judge' }),
    onSuccess: () => {
      toast.success(t('settings.judge_created', 'Judge account created'))
      queryClient.invalidateQueries({ queryKey: ['users', 'judge'] })
      setNewJudge({ name: '', email: '', password: '' })
      setShowCreateForm(false)
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.error || t('settings.judge_create_failed', 'Failed to create judge')
      toast.error(msg)
    },
  })

  const deleteJudgeMutation = useMutation({
    mutationFn: (id: string) => api.deleteUser(id),
    onSuccess: () => {
      toast.success(t('settings.judge_deleted', 'Judge account deleted'))
      queryClient.invalidateQueries({ queryKey: ['users', 'judge'] })
    },
    onError: () => {
      toast.error(t('settings.judge_delete_failed', 'Failed to delete judge'))
    },
  })

  useEffect(() => {
    // Load from localStorage on mount
    const savedConfig = localStorage.getItem('ai_config')
    if (savedConfig) {
      try {
        setConfig(JSON.parse(savedConfig))
      } catch (e) {
        console.error('Failed to parse saved AI config', e)
      }
    } else {
      // Fallback to env vars if not set in local storage
      setConfig({
        baseUrl: import.meta.env.VITE_AI_BASE_URL || 'https://api.openai.com/v1',
        apiKey: import.meta.env.VITE_AI_API_KEY || '',
        model: import.meta.env.VITE_AI_MODEL || 'gpt-3.5-turbo'
      })
    }
  }, [])

  const handleSave = () => {
    localStorage.setItem('ai_config', JSON.stringify(config))
    toast.success(t('settings.saved'), {
      description: t('settings.saved_desc')
    })
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">{t('settings.title')}</h1>
        <p className="text-sm md:text-base text-muted-foreground">{t('settings.subtitle')}</p>
      </div>

      {/* Judge Management */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Gavel className="h-5 w-5 text-primary" />
                {t('settings.judge_management', 'Judge Management')}
              </CardTitle>
              <CardDescription className="mt-1">
                {t('settings.judge_management_desc', 'Create and manage judge accounts for your hackathons.')}
              </CardDescription>
            </div>
            <Button size="sm" onClick={() => setShowCreateForm(!showCreateForm)}>
              <Plus className="mr-1 h-4 w-4" />
              {t('settings.add_judge', 'Add Judge')}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {showCreateForm && (
            <div className="rounded-lg border p-4 space-y-3 bg-muted/30">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="judgeName" className="text-xs">{t('common.name', 'Name')}</Label>
                  <Input
                    id="judgeName"
                    placeholder={t('settings.judge_name_placeholder', 'Judge name')}
                    value={newJudge.name}
                    onChange={(e) => setNewJudge({ ...newJudge, name: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="judgeEmail" className="text-xs">{t('common.email', 'Email')}</Label>
                  <Input
                    id="judgeEmail"
                    type="email"
                    placeholder={t('settings.judge_email_placeholder', 'judge@example.com')}
                    value={newJudge.email}
                    onChange={(e) => setNewJudge({ ...newJudge, email: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="judgePassword" className="text-xs">{t('common.password', 'Password')}</Label>
                  <Input
                    id="judgePassword"
                    type="password"
                    placeholder={t('settings.judge_password_placeholder', 'Min 6 characters')}
                    value={newJudge.password}
                    onChange={(e) => setNewJudge({ ...newJudge, password: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" size="sm" onClick={() => { setShowCreateForm(false); setNewJudge({ name: '', email: '', password: '' }) }}>
                  {t('common.cancel', 'Cancel')}
                </Button>
                <Button
                  size="sm"
                  disabled={!newJudge.name || !newJudge.email || !/\S+@\S+\.\S+/.test(newJudge.email) || newJudge.password.length < 6 || createJudgeMutation.isPending}
                  onClick={() => createJudgeMutation.mutate(newJudge)}
                >
                  {createJudgeMutation.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                  {t('settings.create_judge', 'Create Judge')}
                </Button>
              </div>
            </div>
          )}

          {isLoadingJudges ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : judges.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
              <Gavel className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p>{t('settings.no_judges', 'No judges yet. Click "Add Judge" to create one.')}</p>
            </div>
          ) : (
            <div className="divide-y rounded-lg border">
              {judges.map((judge) => (
                <div key={judge.id} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-medium">
                      {judge.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-medium text-sm">{judge.name}</div>
                      <div className="text-xs text-muted-foreground">{judge.email}</div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => {
                      if (confirm(t('settings.judge_delete_confirm', 'Delete judge "{{name}}"? This will also remove all their assignments.', { name: judge.name }))) {
                        deleteJudgeMutation.mutate(judge.id)
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:gap-6 md:grid-cols-2">
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cpu className="h-5 w-5 text-primary" />
              {t('settings.ai_config')}
            </CardTitle>
            <CardDescription>
              {t('settings.ai_desc')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="baseUrl">{t('settings.base_url')}</Label>
              <div className="relative">
                <Server className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="baseUrl"
                  placeholder="https://api.openai.com/v1"
                  className="pl-9"
                  value={config.baseUrl}
                  onChange={(e) => setConfig({ ...config, baseUrl: e.target.value })}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {t('settings.ai_compatible_desc', 'Compatible with OpenAI, DeepSeek, SiliconFlow, or local LLMs (e.g. Ollama).')}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="apiKey">{t('settings.api_key')}</Label>
              <div className="relative">
                <Key className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="apiKey"
                  type={showKey ? 'text' : 'password'}
                  placeholder="sk-..."
                  className="pl-9 pr-9"
                  value={config.apiKey}
                  onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="model">{t('settings.model')}</Label>
              <Input
                id="model"
                placeholder="gpt-3.5-turbo"
                value={config.model}
                onChange={(e) => setConfig({ ...config, model: e.target.value })}
              />
            </div>

            <Button onClick={handleSave} className="w-full">
              <Save className="mr-2 h-4 w-4" />
              {t('settings.save')}
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-4 md:space-y-6">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle>{t('settings.account_security', 'Account & Security')}</CardTitle>
              <CardDescription>
                {t('settings.account_security_desc', 'Manage your profile and session settings.')}
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <div className="rounded-lg border border-dashed p-8 text-center">
                <p>{t('settings.account_coming_soon', 'Account management features coming soon.')}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/20 dark:to-purple-950/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-indigo-500" />
                {t('settings.ai_copilot', 'AI Copilot')}
                <Badge variant="secondary" className="text-xs">{t('common.coming_soon', 'Coming Soon')}</Badge>
              </CardTitle>
              <CardDescription>
                {t('settings.ai_copilot_desc', 'AI-powered tools to enhance the hackathon experience.')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-dashed border-indigo-200 dark:border-indigo-800 p-8 text-center text-muted-foreground">
                <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-40 text-indigo-400" />
                <p className="font-medium">{t('settings.ai_copilot_coming_soon', 'AI-assisted scoring and project summarization coming soon')}</p>
                <p className="text-sm mt-1">{t('settings.ai_copilot_coming_soon_desc', 'Auto-generate project summaries, suggest scores based on criteria, and detect scoring anomalies.')}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

