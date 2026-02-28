import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { useActiveHackathon } from '@/lib/active-hackathon'
import { useAuth } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Loader2 } from 'lucide-react'
import { PromotionStatus } from '@/lib/types'

type RoundBoardItem = {
  id: string
  projectId: string
  sessionId: string
  promotionStatus: PromotionStatus
  averageScore: number
  totalAssignments: number
  completedAssignments: number
  pendingAssignments: number
  inProgressAssignments: number
  project: {
    id: string
    title: string
    oneLiner: string
    submitterName?: string | null
    submitterEmail: string
  }
  session?: {
    id: string
    name: string
  }
  nextSession?: {
    id: string
    name: string
  } | null
}

const DECISIONS: PromotionStatus[] = ['pending', 'advanced', 'eliminated']

export function PromotionManager() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const { activeHackathon } = useActiveHackathon()

  const orderedSessions = useMemo(
    () => [...(activeHackathon?.sessions || [])].sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()),
    [activeHackathon?.sessions]
  )

  const [fromSessionId, setFromSessionId] = useState('')
  const [nextSessionId, setNextSessionId] = useState('')
  const [decisionByRound, setDecisionByRound] = useState<Record<string, PromotionStatus>>({})
  const [selectedJudgeIds, setSelectedJudgeIds] = useState<string[]>([])

  useEffect(() => {
    if (orderedSessions.length === 0) return
    if (!fromSessionId || !orderedSessions.some((session) => session.id === fromSessionId)) {
      setFromSessionId(orderedSessions[0].id)
    }
  }, [orderedSessions, fromSessionId])

  useEffect(() => {
    if (!fromSessionId || orderedSessions.length === 0) return
    const currentIndex = orderedSessions.findIndex((session) => session.id === fromSessionId)
    const defaultNextSession = orderedSessions[currentIndex + 1]
    if (!defaultNextSession) {
      setNextSessionId('')
      return
    }
    if (!nextSessionId || nextSessionId === fromSessionId || !orderedSessions.some((session) => session.id === nextSessionId)) {
      setNextSessionId(defaultNextSession.id)
    }
  }, [fromSessionId, orderedSessions, nextSessionId])

  const { data: judges = [] } = useQuery({
    queryKey: ['users', 'judges'],
    queryFn: () => api.getUsers({ role: 'judge' }),
  })

  useEffect(() => {
    if (judges.length === 0) return
    if (selectedJudgeIds.length === 0) {
      setSelectedJudgeIds(judges.map((judge) => judge.id))
    }
  }, [judges, selectedJudgeIds.length])

  const { data: rounds = [], isLoading } = useQuery({
    queryKey: ['project-rounds', activeHackathon?.id, fromSessionId],
    queryFn: () => api.getProjectRounds({ hackathonId: activeHackathon?.id, sessionId: fromSessionId }) as Promise<RoundBoardItem[]>,
    enabled: !!activeHackathon?.id && !!fromSessionId,
  })

  useEffect(() => {
    if (rounds.length === 0) {
      setDecisionByRound({})
      return
    }
    const nextState: Record<string, PromotionStatus> = {}
    rounds.forEach((round) => {
      nextState[round.id] = round.promotionStatus || 'pending'
    })
    setDecisionByRound(nextState)
  }, [rounds])

  const previousSessionId = useMemo(() => {
    if (!fromSessionId) return undefined
    const currentIndex = orderedSessions.findIndex((session) => session.id === fromSessionId)
    if (currentIndex <= 0) return undefined
    return orderedSessions[currentIndex - 1]?.id
  }, [fromSessionId, orderedSessions])

  const initializeMutation = useMutation({
    mutationFn: () => api.initializeProjectRounds({ sessionId: fromSessionId, sourceSessionId: previousSessionId }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['project-rounds'] })
      toast.success(t('promotions.initialized', { count: data.initializedCount, defaultValue: 'Initialized {{count}} round records' }))
    },
    onError: () => {
      toast.error(t('promotions.initialize_failed', 'Failed to initialize round records'))
    },
  })

  const applySingleMutation = useMutation({
    mutationFn: (params: { roundId: string; decision: PromotionStatus }) => {
      const payload = {
        decision: params.decision,
        nextSessionId: params.decision === 'advanced' ? nextSessionId || undefined : undefined,
        decidedById: user?.id,
        judgeIds: selectedJudgeIds,
      }
      return api.updateProjectRoundPromotion(params.roundId, payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-rounds'] })
      queryClient.invalidateQueries({ queryKey: ['assignments'] })
      queryClient.invalidateQueries({ queryKey: ['project-scoring-report'] })
      toast.success(t('promotions.updated', 'Promotion decision updated'))
    },
    onError: (error: any) => {
      const message = error?.response?.data?.error || t('promotions.update_failed', 'Failed to update promotion decision')
      toast.error(message)
    },
  })

  const applyBulkMutation = useMutation({
    mutationFn: () => {
      const decisions = rounds.map((round) => {
        const decision = decisionByRound[round.id] || 'pending'
        return {
          projectRoundId: round.id,
          decision,
          nextSessionId: decision === 'advanced' ? nextSessionId || undefined : undefined,
          decidedById: user?.id,
        }
      })

      return api.bulkUpdateProjectRoundPromotions({
        decisions,
        nextSessionId: nextSessionId || undefined,
        decidedById: user?.id,
        judgeIds: selectedJudgeIds,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-rounds'] })
      queryClient.invalidateQueries({ queryKey: ['assignments'] })
      queryClient.invalidateQueries({ queryKey: ['project-scoring-report'] })
      toast.success(t('promotions.bulk_applied', 'Bulk promotion decisions applied'))
    },
    onError: () => {
      toast.error(t('promotions.bulk_failed', 'Failed to apply bulk promotion decisions'))
    },
  })

  const toggleJudge = (judgeId: string) => {
    setSelectedJudgeIds((prev) => (prev.includes(judgeId) ? prev.filter((id) => id !== judgeId) : [...prev, judgeId]))
  }

  const canAdvance = !!nextSessionId

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            {t('promotions.title', 'Round Promotions')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t('promotions.subtitle', 'Set promotion decisions and auto-create next-round reviews')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => initializeMutation.mutate()} disabled={!fromSessionId || initializeMutation.isPending}>
            {initializeMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('promotions.initialize', 'Initialize Rounds')}
          </Button>
          <Button onClick={() => applyBulkMutation.mutate()} disabled={rounds.length === 0 || applyBulkMutation.isPending}>
            {applyBulkMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('promotions.apply_all', 'Apply All Decisions')}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle>{t('promotions.current_round', 'Current Round')}</CardTitle>
            <CardDescription>{t('promotions.current_round_desc', 'Pick the session you are finalizing')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={fromSessionId} onValueChange={setFromSessionId}>
              <SelectTrigger>
                <SelectValue placeholder={t('reports.session', 'Session')} />
              </SelectTrigger>
              <SelectContent>
                {orderedSessions.map((session) => (
                  <SelectItem key={session.id} value={session.id}>
                    {session.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle>{t('promotions.next_round', 'Next Round')}</CardTitle>
            <CardDescription>{t('promotions.next_round_desc', 'Advanced projects will be moved here')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={nextSessionId || 'none'} onValueChange={(value) => setNextSessionId(value === 'none' ? '' : value)}>
              <SelectTrigger>
                <SelectValue placeholder={t('promotions.no_next_round', 'No next round')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t('promotions.no_next_round', 'No next round')}</SelectItem>
                {orderedSessions
                  .filter((session) => session.id !== fromSessionId)
                  .map((session) => (
                    <SelectItem key={session.id} value={session.id}>
                      {session.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle>{t('promotions.reviewers', 'Next-round Reviewers')}</CardTitle>
            <CardDescription>{t('promotions.reviewers_desc', 'Advanced projects will auto-create assignments for selected judges')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
              {judges.map((judge) => (
                <label key={judge.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={selectedJudgeIds.includes(judge.id)} onCheckedChange={() => toggleJudge(judge.id)} />
                  <span>{judge.name}</span>
                </label>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle>{t('promotions.board', 'Promotion Board')}</CardTitle>
          <CardDescription>
            {t('promotions.board_desc', 'Review scores, set decision, and push advanced teams to the next round')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rounds.length === 0 ? (
            <div className="rounded-md border p-6 text-sm text-muted-foreground">
              {t('promotions.empty', 'No round records found for this session. Click "Initialize Rounds" first.')}
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('reports.project', 'Project')}</TableHead>
                    <TableHead>{t('reports.submitter', 'Submitter')}</TableHead>
                    <TableHead>{t('reports.average', 'Average')}</TableHead>
                    <TableHead>{t('reports.progress', 'Progress')}</TableHead>
                    <TableHead>{t('promotions.current_status', 'Current')}</TableHead>
                    <TableHead>{t('promotions.decision', 'Decision')}</TableHead>
                    <TableHead className="text-right">{t('projects.actions', 'Actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rounds.map((round) => {
                    const decision = decisionByRound[round.id] || 'pending'
                    return (
                      <TableRow key={round.id}>
                        <TableCell>
                          <button
                            type="button"
                            className="font-medium text-left hover:underline"
                            onClick={() => navigate(`/dashboard/projects/${round.projectId}?tab=scores&roundId=${round.id}`)}
                          >
                            {round.project.title}
                          </button>
                          <p className="text-xs text-muted-foreground">{round.project.oneLiner}</p>
                        </TableCell>
                        <TableCell>{round.project.submitterName || round.project.submitterEmail}</TableCell>
                        <TableCell>{round.averageScore > 0 ? round.averageScore.toFixed(1) : '-'}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {round.completedAssignments}/{round.totalAssignments}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{round.promotionStatus}</Badge>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={decision}
                            onValueChange={(value) => setDecisionByRound((prev) => ({ ...prev, [round.id]: value as PromotionStatus }))}
                          >
                            <SelectTrigger className="w-[140px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {DECISIONS.map((value) => (
                                <SelectItem key={value} value={value}>
                                  {value}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              if (decision === 'advanced' && !canAdvance) {
                                toast.error(t('promotions.need_next_round', 'Choose a next round before advancing projects'))
                                return
                              }
                              applySingleMutation.mutate({ roundId: round.id, decision })
                            }}
                            disabled={applySingleMutation.isPending}
                          >
                            {t('common.save', 'Save')}
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
