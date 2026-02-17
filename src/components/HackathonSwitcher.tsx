import React, { useMemo } from 'react'
import { Check, ChevronsUpDown, PlusCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { hackathons } from '@/lib/mock-data'
import { useActiveHackathon } from '@/lib/active-hackathon'
import { useTranslation } from 'react-i18next'

export function HackathonSwitcher() {
  const { t } = useTranslation()
  const [open, setOpen] = React.useState(false)
  const { activeHackathon, setActiveHackathonId } = useActiveHackathon()

  const formattedHackathons = useMemo(() => {
    return hackathons.map((h) => ({
      label: h.title,
      value: h.id,
      status: h.status
    }))
  }, [])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[250px] justify-between rounded-xl border-input bg-background/50 backdrop-blur-sm"
        >
          <div className="flex items-center gap-2 truncate">
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
              {activeHackathon.title.charAt(0)}
            </div>
            <span className="truncate">{activeHackathon.title}</span>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[250px] p-0">
        <Command>
          <CommandInput placeholder={t('dashboard.search_hackathons', 'Search hackathons...')} />
          <CommandList>
            <CommandEmpty>{t('dashboard.no_hackathon_found', 'No hackathon found.')}</CommandEmpty>
            <CommandGroup heading={t('dashboard.active_hackathons', 'Active')}>
              {formattedHackathons
                .filter((h) => h.status === 'active' || h.status === 'judging')
                .map((hackathon) => (
                  <CommandItem
                    key={hackathon.value}
                    onSelect={() => {
                      setActiveHackathonId(hackathon.value)
                      setOpen(false)
                    }}
                    className="text-sm"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        activeHackathon.id === hackathon.value
                          ? "opacity-100"
                          : "opacity-0"
                      )}
                    />
                    {hackathon.label}
                  </CommandItem>
                ))}
            </CommandGroup>
            <CommandGroup heading={t('dashboard.past_hackathons', 'Past')}>
              {formattedHackathons
                .filter((h) => h.status === 'completed')
                .map((hackathon) => (
                  <CommandItem
                    key={hackathon.value}
                    onSelect={() => {
                      setActiveHackathonId(hackathon.value)
                      setOpen(false)
                    }}
                    className="text-sm text-muted-foreground"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        activeHackathon.id === hackathon.value
                          ? "opacity-100"
                          : "opacity-0"
                      )}
                    />
                    {hackathon.label}
                  </CommandItem>
                ))}
            </CommandGroup>
          </CommandList>
          <CommandSeparator />
          <CommandList>
            <CommandGroup>
              <CommandItem onSelect={() => setOpen(false)}>
                <PlusCircle className="mr-2 h-4 w-4" />
                {t('dashboard.create_new_hackathon', 'Create Hackathon')}
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
