import React from 'react'
import { Moon, Sun, Monitor, Languages, Palette, Check } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import { useTranslation } from 'react-i18next'

export function ThemeLanguageSwitcher() {
  const { setTheme } = useTheme()
  const { i18n, t } = useTranslation()

  const currentLang = (i18n.resolvedLanguage || i18n.language || 'en').slice(0, 2)

  const changeLanguage = (lang: 'en' | 'zh') => i18n.changeLanguage(lang)

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-9 w-9">
            <Palette className="h-4 w-4" />
            <span className="sr-only">{t('common.theme')}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>{t('common.theme')}</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => setTheme('light')}>
            <Sun className="mr-2 h-4 w-4" />
            {t('common.light')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTheme('dark')}>
            <Moon className="mr-2 h-4 w-4" />
            {t('common.dark')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTheme('system')}>
            <Monitor className="mr-2 h-4 w-4" />
            {t('common.system')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="relative h-9 w-9">
            <Languages className="h-4 w-4" />
            <span className="sr-only">{t('common.language')}</span>
            <span className="absolute -bottom-1 -right-1 text-[10px] font-bold">
              {currentLang.toUpperCase()}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>{t('common.language')}</DropdownMenuLabel>
          <DropdownMenuItem
            className="flex items-center justify-between gap-3"
            onClick={() => changeLanguage('en')}
          >
            <span>{t('common.english')}</span>
            {currentLang === 'en' && <Check className="h-4 w-4" />}
          </DropdownMenuItem>
          <DropdownMenuItem
            className="flex items-center justify-between gap-3"
            onClick={() => changeLanguage('zh')}
          >
            <span>{t('common.chinese')}</span>
            {currentLang === 'zh' && <Check className="h-4 w-4" />}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
