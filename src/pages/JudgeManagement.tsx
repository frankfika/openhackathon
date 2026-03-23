import React, { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Gavel, Loader2, Plus, UserPlus, UserX } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/lib/api'
import { useActiveHackathon } from '@/lib/active-hackathon'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { buildAdminPath, useAdminRoutes } from '@/lib/admin-routing'
import { formatDateRange } from '@/lib/types'

type MutationApiError = {
  response?: {
    data?: {
      error?: string
      code?: string
    }
  }
}

export function JudgeManagement() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { adminBasePath } = useAdminRoutes()
  const { activeHackathon, hackathons } = useActiveHackathon()
  const hackathonName = activeHackathon.title?.trim() || activeHackathon.id || t('judges.unknown_hackathon', 'Unknown Hackathon')
  const hasMultipleHackathons = hackathons.length > 1
  const hackathonPeriod =
    activeHackathon.startAt && activeHackathon.endAt
      ? formatDateRange(activeHackathon.startAt, activeHackathon.endAt)
      : ''

  const [newJudge, setNewJudge] = useState({ name: '', email: '', password: '' })
  const [showCreateForm, setShowCreateForm] = useState(false)

  const { data: allJudges = [], isLoading: isLoadingAllJudges } = useQuery({
    queryKey: ['users', 'judge'],
    queryFn: () => api.getUsers({ role: 'judge' }),
    staleTime: 30_000,
  })

  const {
    data: registeredJudges = [],
    isLoading: isLoadingRegisteredJudges,
  } = useQuery({
    queryKey: ['hackathon-judges', activeHackathon.id],
    queryFn: () => api.getHackathonJudges(activeHackathon.id),
    enabled: !!activeHackathon.id,
    staleTime: 30_000,
  })

  const registerMutation = useMutation({
    mutationFn: (judgeId: string) => {
      if (!activeHackathon.id) throw new Error('No active hackathon')
      return api.registerHackathonJudges(activeHackathon.id, [judgeId])
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hackathon-judges', activeHackathon.id] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats', activeHackathon.id] })
      toast.success(t('judges.registered', { hackathon: hackathonName, defaultValue: 'Judge registered to {{hackathon}}' }))
    },
    onError: (error: unknown) => {
      const mutationError = error as MutationApiError
      toast.error(mutationError?.response?.data?.error || t('judges.register_failed', 'Failed to register judge'))
    },
  })

  const unregisterMutation = useMutation({
    mutationFn: (judgeId: string) => {
      if (!activeHackathon.id) throw new Error('No active hackathon')
      return api.removeHackathonJudge(activeHackathon.id, judgeId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hackathon-judges', activeHackathon.id] })
      queryClient.invalidateQueries({ queryKey: ['assignments'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats', activeHackathon.id] })
      toast.success(t('judges.removed', { hackathon: hackathonName, defaultValue: 'Judge removed from {{hackathon}}' }))
    },
    onError: (error: unknown, judgeId: string) => {
      const mutationError = error as MutationApiError
      const message = mutationError?.response?.data?.error || t('judges.remove_failed', 'Failed to remove judge')
      const errorCode = mutationError?.response?.data?.code
      if (errorCode === 'JUDGE_REGISTRATION_BLOCKED_BY_ASSIGNMENTS' || message.includes('assignments exist')) {
        const params = new URLSearchParams({ judgeId })
        toast.error(
          t(
            'judges.remove_blocked_assignments',
            'Cannot unregister this judge yet. Clear their assignments in this hackathon first.'
          ),
          {
            action: {
              label: t('judges.go_to_assignments', 'Go to assignments'),
              onClick: () => navigate(`${buildAdminPath(adminBasePath, 'assignments')}?${params.toString()}`),
            },
            duration: 10000,
          }
        )
        return
      }
      toast.error(message)
    },
  })

  const createAndRegisterMutation = useMutation({
    mutationFn: async (payload: { name: string; email: string; password: string }) => {
      if (!activeHackathon.id) throw new Error('No active hackathon')
      const created = await api.createUser({ ...payload, role: 'judge' })
      await api.registerHackathonJudges(activeHackathon.id, [created.id])
      return created
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users', 'judge'] })
      queryClient.invalidateQueries({ queryKey: ['hackathon-judges', activeHackathon.id] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats', activeHackathon.id] })
      toast.success(t('settings.judge_created', 'Judge account created'))
      setShowCreateForm(false)
      setNewJudge({ name: '', email: '', password: '' })
    },
    onError: (error: unknown) => {
      const mutationError = error as MutationApiError
      const message = mutationError?.response?.data?.error || t('settings.judge_create_failed', 'Failed to create judge')
      toast.error(message)
    },
  })

  const registeredJudgeIdSet = useMemo(
    () => new Set(registeredJudges.map((judge) => judge.id)),
    [registeredJudges]
  )

  const availableJudges = useMemo(
    () => allJudges.filter((judge) => !registeredJudgeIdSet.has(judge.id)),
    [allJudges, registeredJudgeIdSet]
  )

  const isLoading = isLoadingAllJudges || isLoadingRegisteredJudges
  const isMutating = registerMutation.isPending || unregisterMutation.isPending || createAndRegisterMutation.isPending
  const canCreateJudge =
    !!newJudge.name &&
    !!newJudge.email &&
    /\S+@\S+\.\S+/.test(newJudge.email) &&
    newJudge.password.length >= 8

  if (!activeHackathon.id) {
    return (
      <div className="surface-inset p-6 text-sm text-muted-foreground">
        {t('judges.no_hackathon', 'Please select a hackathon first.')}
      </div>
    )
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
          {t('settings.judge_management', 'Judge Management')}
        </h1>
        <p className="text-sm md:text-base text-muted-foreground">
          {t(
            'judges.subtitle',
            {
              hackathon: hackathonName,
              defaultValue:
                'Judges are registered per hackathon. Current hackathon: {{hackathon}}. Only registered judges can be assigned here.',
            }
          )}
        </p>
        <div className="surface-inset flex flex-wrap items-center justify-between gap-3 rounded-xl p-3">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">{t('judges.current_hackathon', 'Current Hackathon')}</p>
            <p className="text-sm font-semibold">{hackathonName}</p>
            {hackathonPeriod ? <p className="text-xs text-muted-foreground">{hackathonPeriod}</p> : null}
          </div>
          {hasMultipleHackathons ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(buildAdminPath(adminBasePath, 'hackathons'))}
            >
              {t('judges.switch_hackathon', 'Switch Hackathon')}
            </Button>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{activeHackathon.title}</Badge>
          <Badge variant="secondary">{t('judges.registered_count', { count: registeredJudges.length, defaultValue: 'Registered {{count}}' })}</Badge>
        </div>
      </div>

      <Card className="surface-panel border-none shadow-none">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Gavel className="h-5 w-5 text-primary" />
                {t('judges.registered_title', {
                  hackathon: hackathonName,
                  defaultValue: 'Registered Judges · {{hackathon}}',
                })}
              </CardTitle>
              <CardDescription className="mt-1">
                {t('judges.registered_desc', {
                  hackathon: hackathonName,
                  defaultValue: 'These judges are eligible for assignment under {{hackathon}}.',
                })}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : registeredJudges.length === 0 ? (
            <div className="surface-inset border-dashed p-8 text-center text-muted-foreground">
              <Gavel className="mx-auto mb-2 h-8 w-8 opacity-40" />
              <p>{t('judges.no_registered', 'No judges registered to this hackathon yet.')}</p>
            </div>
          ) : (
            <div className="surface-inset divide-y">
              {registeredJudges.map((judge) => (
                <div key={judge.id} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                      {judge.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-sm font-medium">{judge.name}</div>
                      <div className="text-xs text-muted-foreground">{judge.email}</div>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    disabled={isMutating}
                    onClick={() => {
                      const confirmed = confirm(
                        t(
                          'judges.unregister_confirm',
                          'Remove judge "{{name}}" from this hackathon? This is allowed only after their assignments are cleared.',
                          { name: judge.name }
                        )
                      )
                      if (confirmed) {
                        unregisterMutation.mutate(judge.id)
                      }
                    }}
                  >
                    <UserX className="h-3.5 w-3.5" />
                    {t('judges.unregister', 'Unregister')}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="surface-panel border-none shadow-none">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{t('judges.pool_title', 'Judge Account Pool')}</CardTitle>
              <CardDescription>
                {t('judges.pool_desc', {
                  hackathon: hackathonName,
                  defaultValue: 'Register existing judge accounts to {{hackathon}}.',
                })}
              </CardDescription>
            </div>
            <Button size="sm" onClick={() => setShowCreateForm((prev) => !prev)}>
              <Plus className="mr-1 h-4 w-4" />
              {t('settings.add_judge', 'Add Judge')}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {showCreateForm ? (
            <div className="surface-inset space-y-3 p-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <Label htmlFor="judgeName" className="text-xs">
                    {t('common.name', 'Name')}
                  </Label>
                  <Input
                    id="judgeName"
                    placeholder={t('settings.judge_name_placeholder', 'Judge name')}
                    value={newJudge.name}
                    onChange={(event) => setNewJudge((prev) => ({ ...prev, name: event.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="judgeEmail" className="text-xs">
                    {t('common.email', 'Email')}
                  </Label>
                  <Input
                    id="judgeEmail"
                    type="email"
                    placeholder={t('settings.judge_email_placeholder', 'judge@example.com')}
                    value={newJudge.email}
                    onChange={(event) => setNewJudge((prev) => ({ ...prev, email: event.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="judgePassword" className="text-xs">
                    {t('common.password', 'Password')}
                  </Label>
                  <Input
                    id="judgePassword"
                    type="password"
                    placeholder={t('judges.password_hint', 'Min 8 characters')}
                    value={newJudge.password}
                    onChange={(event) => setNewJudge((prev) => ({ ...prev, password: event.target.value }))}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowCreateForm(false)
                    setNewJudge({ name: '', email: '', password: '' })
                  }}
                >
                  {t('common.cancel', 'Cancel')}
                </Button>
                <Button
                  size="sm"
                  disabled={!canCreateJudge || createAndRegisterMutation.isPending}
                  onClick={() => createAndRegisterMutation.mutate(newJudge)}
                >
                  {createAndRegisterMutation.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
                  {t('judges.create_and_register', 'Create & Register')}
                </Button>
              </div>
            </div>
          ) : null}

          {availableJudges.length === 0 ? (
            <div className="surface-inset border-dashed p-6 text-center text-sm text-muted-foreground">
              {t('judges.no_available', 'No available judge accounts outside current registration.')}
            </div>
          ) : (
            <div className="surface-inset divide-y">
              {availableJudges.map((judge) => (
                <div key={judge.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <div className="text-sm font-medium">{judge.name}</div>
                    <div className="text-xs text-muted-foreground">{judge.email}</div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1"
                    disabled={isMutating}
                    onClick={() => registerMutation.mutate(judge.id)}
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    {t('judges.register', 'Register')}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
