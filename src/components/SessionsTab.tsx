import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Pencil, Trash2, Check, X, CalendarClock } from 'lucide-react'
import { api } from '@/lib/api'
import { Session, SessionType, SessionStatus } from '@/lib/types'

type Props = {
  hackathonId: string
  sessions: Session[]
}

type SessionForm = {
  name: string
  type: SessionType
  region: string
  status: SessionStatus
  startAt: string
  endAt: string
}

const EMPTY_FORM: SessionForm = {
  name: '',
  type: 'preliminary',
  region: '',
  status: 'draft',
  startAt: '',
  endAt: '',
}

function toDateInput(iso: string): string {
  if (!iso) return ''
  return iso.split('T')[0]
}

function toIso(dateStr: string): string {
  if (!dateStr) return ''
  return `${dateStr}T00:00:00.000Z`
}

const TYPE_BADGE_CLASSES: Record<SessionType, string> = {
  preliminary: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  semi_final: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  final: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
}

export function SessionsTab({ hackathonId, sessions }: Props) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState<SessionForm>(EMPTY_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<SessionForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['hackathon', hackathonId] })
    queryClient.invalidateQueries({ queryKey: ['hackathons'] })
  }

  const handleAdd = async () => {
    if (!addForm.name.trim() || !addForm.startAt || !addForm.endAt) return
    setSaving(true)
    try {
      await api.createSession(hackathonId, {
        name: addForm.name.trim(),
        type: addForm.type,
        region: addForm.region.trim() || undefined,
        status: addForm.status,
        startAt: toIso(addForm.startAt),
        endAt: toIso(addForm.endAt),
      })
      toast.success(t('sessions.created'))
      setAddForm(EMPTY_FORM)
      setShowAdd(false)
      invalidate()
    } catch {
      toast.error(t('sessions.create_failed'))
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (session: Session) => {
    setEditingId(session.id)
    setEditForm({
      name: session.name,
      type: session.type,
      region: session.region || '',
      status: session.status,
      startAt: toDateInput(session.startAt),
      endAt: toDateInput(session.endAt),
    })
  }

  const handleUpdate = async (sessionId: string) => {
    if (!editForm.name.trim() || !editForm.startAt || !editForm.endAt) return
    setSaving(true)
    try {
      await api.updateSession(hackathonId, sessionId, {
        name: editForm.name.trim(),
        type: editForm.type,
        region: editForm.region,
        status: editForm.status,
        startAt: toIso(editForm.startAt),
        endAt: toIso(editForm.endAt),
      })
      toast.success(t('sessions.updated'))
      setEditingId(null)
      invalidate()
    } catch {
      toast.error(t('sessions.update_failed'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (session: Session) => {
    const confirmed = confirm(t('sessions.delete_confirm', { name: session.name }))
    if (!confirmed) return
    try {
      await api.deleteSession(hackathonId, session.id)
      toast.success(t('sessions.deleted'))
      invalidate()
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { error?: string } } }
      const msg = apiErr?.response?.data?.error
      if (msg) {
        toast.error(t('sessions.delete_blocked'))
      } else {
        toast.error(t('sessions.delete_failed'))
      }
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-primary" />
              {t('sessions.title')}
            </CardTitle>
            <CardDescription className="mt-1">{t('sessions.description')}</CardDescription>
          </div>
          <Button size="sm" onClick={() => { setShowAdd(!showAdd); setEditingId(null) }}>
            <Plus className="mr-1 h-4 w-4" />
            {t('sessions.add_session')}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {showAdd && (
          <div className="surface-inset space-y-3 p-4">
            <SessionFormFields
              form={addForm}
              onChange={setAddForm}
              t={t}
            />
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => { setShowAdd(false); setAddForm(EMPTY_FORM) }}>
                <X className="mr-1 h-3 w-3" />
                {t('common.cancel')}
              </Button>
              <Button
                size="sm"
                disabled={!addForm.name.trim() || !addForm.startAt || !addForm.endAt || saving}
                onClick={handleAdd}
              >
                <Check className="mr-1 h-3 w-3" />
                {t('common.save')}
              </Button>
            </div>
          </div>
        )}

        {sessions.length === 0 && !showAdd ? (
          <div className="surface-inset border-dashed p-8 text-center text-muted-foreground">
            <CalendarClock className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p>{t('sessions.no_sessions')}</p>
          </div>
        ) : (
          <div className="surface-inset divide-y">
            {sessions.map((session) => (
              <div key={session.id} className="px-4 py-3">
                {editingId === session.id ? (
                  <div className="space-y-3">
                    <SessionFormFields
                      form={editForm}
                      onChange={setEditForm}
                      t={t}
                    />
                    <div className="flex gap-2 justify-end">
                      <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>
                        <X className="mr-1 h-3 w-3" />
                        {t('common.cancel')}
                      </Button>
                      <Button
                        size="sm"
                        disabled={!editForm.name.trim() || !editForm.startAt || !editForm.endAt || saving}
                        onClick={() => handleUpdate(session.id)}
                      >
                        <Check className="mr-1 h-3 w-3" />
                        {t('common.save')}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                      <span className="font-medium text-sm truncate">{session.name}</span>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_BADGE_CLASSES[session.type]}`}>
                        {t(`sessions.type_${session.type}`)}
                      </span>
                      {session.region && (
                        <Badge variant="outline" className="text-xs px-1.5 py-0">
                          {session.region}
                        </Badge>
                      )}
                      <Badge variant="secondary" className="text-xs">
                        {t(`sessions.status_${session.status}`)}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {toDateInput(session.startAt)} – {toDateInput(session.endAt)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => startEdit(session)}
                        disabled={editingId !== null && editingId !== session.id}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(session)}
                        disabled={editingId !== null}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function SessionFormFields({
  form,
  onChange,
  t,
}: {
  form: SessionForm
  onChange: (f: SessionForm) => void
  t: (key: string, opts?: Record<string, unknown>) => string
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div className="space-y-1 sm:col-span-2">
        <Label className="text-xs">{t('sessions.name')}</Label>
        <Input
          placeholder={t('sessions.name_placeholder')}
          value={form.name}
          onChange={(e) => onChange({ ...form, name: e.target.value })}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">{t('sessions.type')}</Label>
        <Select value={form.type} onValueChange={(v) => onChange({ ...form, type: v as SessionType })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="preliminary">{t('sessions.type_preliminary')}</SelectItem>
            <SelectItem value="semi_final">{t('sessions.type_semi_final')}</SelectItem>
            <SelectItem value="final">{t('sessions.type_final')}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">{t('sessions.region')}</Label>
        <Input
          placeholder={t('sessions.region_placeholder')}
          value={form.region}
          onChange={(e) => onChange({ ...form, region: e.target.value })}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">{t('sessions.status')}</Label>
        <Select value={form.status} onValueChange={(v) => onChange({ ...form, status: v as SessionStatus })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="draft">{t('sessions.status_draft')}</SelectItem>
            <SelectItem value="active">{t('sessions.status_active')}</SelectItem>
            <SelectItem value="judging">{t('sessions.status_judging')}</SelectItem>
            <SelectItem value="completed">{t('sessions.status_completed')}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">{t('sessions.start_date')}</Label>
        <Input
          type="date"
          value={form.startAt}
          onChange={(e) => onChange({ ...form, startAt: e.target.value })}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">{t('sessions.end_date')}</Label>
        <Input
          type="date"
          value={form.endAt}
          onChange={(e) => onChange({ ...form, endAt: e.target.value })}
        />
      </div>
    </div>
  )
}
