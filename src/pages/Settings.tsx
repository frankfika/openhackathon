import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Eye, EyeOff, Save, Key, Server, Cpu } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export function Settings() {
  const { t } = useTranslation()
  const [showKey, setShowKey] = useState(false)
  const [config, setConfig] = useState({
    baseUrl: '',
    apiKey: '',
    model: ''
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

      <div className="grid gap-4 md:gap-6 md:grid-cols-2">
        <Card className="border-0 shadow-sm md:col-span-2 lg:col-span-1">
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
                Compatible with OpenAI, DeepSeek, SiliconFlow, or local LLMs (e.g. Ollama).
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

        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle>Account & Security</CardTitle>
            <CardDescription>
              Manage your profile and session settings.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <div className="rounded-lg border border-dashed p-8 text-center">
              <p>Account management features coming soon.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

