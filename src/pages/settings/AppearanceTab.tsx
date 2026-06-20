import React from 'react'
import { useTranslation } from 'react-i18next'
import { Moon, Sun, Monitor, Type, Text } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { useTheme, type Theme } from '@/hooks/useTheme'
import { useFontSettings, type FontSize, type FontFamily } from '@/hooks/useFontSettings'

interface OptionButtonProps<T extends string> {
  value: T
  current: T
  onChange: (value: T) => void
  label: string
  icon?: React.ReactNode
}

function OptionButton<T extends string>({ value, current, onChange, label, icon }: OptionButtonProps<T>) {
  return (
    <button
      type="button"
      onClick={() => onChange(value)}
      className={cn(
        'flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-all',
        current === value
          ? 'border-primary bg-primary text-primary-foreground shadow-sm'
          : 'border-border bg-background/60 text-foreground hover:bg-accent'
      )}
      aria-pressed={current === value}
    >
      {icon}
      {label}
    </button>
  )
}

export function AppearanceTab() {
  const { t } = useTranslation()
  const { theme, setTheme } = useTheme()
  const { fontSize, setFontSize, fontFamily, setFontFamily } = useFontSettings()

  return (
    <Card className="surface-panel border-none shadow-none">
      <CardHeader>
        <CardTitle>{t('settings.appearance_title', 'Appearance')}</CardTitle>
        <CardDescription>
          {t('settings.appearance_desc', 'Customize theme and font settings for your account.')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        <div className="space-y-3">
          <Label className="text-base">{t('settings.theme_label', 'Theme')}</Label>
          <div className="grid grid-cols-3 gap-3">
            <OptionButton<Theme>
              value="light"
              current={theme}
              onChange={setTheme}
              label={t('common.light', 'Light')}
              icon={<Sun className="h-4 w-4" />}
            />
            <OptionButton<Theme>
              value="dark"
              current={theme}
              onChange={setTheme}
              label={t('common.dark', 'Dark')}
              icon={<Moon className="h-4 w-4" />}
            />
            <OptionButton<Theme>
              value="system"
              current={theme}
              onChange={setTheme}
              label={t('common.system', 'System')}
              icon={<Monitor className="h-4 w-4" />}
            />
          </div>
        </div>

        <div className="space-y-3">
          <Label className="text-base">{t('settings.font_size_label', 'Font Size')}</Label>
          <div className="grid grid-cols-3 gap-3">
            <OptionButton<FontSize>
              value="small"
              current={fontSize}
              onChange={setFontSize}
              label={t('settings.font_size_small', 'Small')}
              icon={<Type className="h-3.5 w-3.5" />}
            />
            <OptionButton<FontSize>
              value="normal"
              current={fontSize}
              onChange={setFontSize}
              label={t('settings.font_size_normal', 'Normal')}
              icon={<Type className="h-4 w-4" />}
            />
            <OptionButton<FontSize>
              value="large"
              current={fontSize}
              onChange={setFontSize}
              label={t('settings.font_size_large', 'Large')}
              icon={<Type className="h-5 w-5" />}
            />
          </div>
        </div>

        <div className="space-y-3">
          <Label className="text-base">{t('settings.font_family_label', 'Font Family')}</Label>
          <div className="grid grid-cols-2 gap-3">
            <OptionButton<FontFamily>
              value="geist"
              current={fontFamily}
              onChange={setFontFamily}
              label={t('settings.font_family_geist', 'Geist')}
              icon={<Text className="h-4 w-4" />}
            />
            <OptionButton<FontFamily>
              value="system"
              current={fontFamily}
              onChange={setFontFamily}
              label={t('settings.font_family_system', 'System UI')}
              icon={<Text className="h-4 w-4" />}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
