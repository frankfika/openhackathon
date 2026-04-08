import { useState, useMemo } from 'react'
import { Plus } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

interface AddJudgePopoverProps {
  judges: { id: string; name: string }[]
  isMutating: boolean
  onAdd: (judgeId: string) => void
  t: (key: string) => string
}

export function AddJudgePopover({ judges, isMutating, onAdd, t }: AddJudgePopoverProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!search.trim()) return judges
    const q = search.trim().toLowerCase()
    return judges.filter((j) => j.name.toLowerCase().includes(q))
  }, [judges, search])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={isMutating}
          className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-muted-foreground/30 text-muted-foreground/50 hover:border-primary hover:text-primary hover:bg-primary/5 transition-colors disabled:pointer-events-none"
          title={t('assignments.click_to_assign')}
        >
          <Plus className="h-3 w-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-2" align="start">
        {judges.length > 5 && (
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('assignments.search_judge')}
            className="h-7 text-xs mb-2"
            autoFocus
          />
        )}
        <div className="max-h-48 overflow-y-auto space-y-0.5">
          {filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-2">{t('assignments.no_judges')}</p>
          ) : (
            filtered.map((judge) => (
              <button
                key={judge.id}
                type="button"
                onClick={() => {
                  onAdd(judge.id)
                  setOpen(false)
                  setSearch('')
                }}
                disabled={isMutating}
                className="w-full text-left rounded px-2 py-1.5 text-sm hover:bg-accent transition-colors disabled:pointer-events-none"
              >
                {judge.name}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
