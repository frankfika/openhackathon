import React, { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { useActiveHackathon } from '@/lib/active-hackathon'
import { toast } from 'sonner'
import { Users, CheckSquare, Info, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { api } from '@/lib/api'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export function AssignmentManager() {
  const { t } = useTranslation()
  const { activeHackathon } = useActiveHackathon()
  const queryClient = useQueryClient()
  const [expandedJudge, setExpandedJudge] = useState<string | null>(null)

  // Fetch projects
  const { data: projects = [], isLoading: isLoadingProjects } = useQuery({
    queryKey: ['projects', activeHackathon?.id],
    queryFn: () => api.getProjects({ hackathonId: activeHackathon?.id }),
    enabled: !!activeHackathon?.id,
  })

  // Fetch judges (users with judge role)
  const { data: judges = [], isLoading: isLoadingJudges } = useQuery({
    queryKey: ['users', 'judges'],
    queryFn: () => api.getUsers({ role: 'judge' }),
  })

  // Fetch existing assignments
  const { data: assignments = [], isLoading: isLoadingAssignments } = useQuery({
    queryKey: ['assignments', activeHackathon?.id],
    queryFn: async () => {
      const sessionId = activeHackathon?.sessions?.[0]?.id
      if (!sessionId) return []
      return api.getAssignments({ sessionId })
    },
    enabled: !!activeHackathon?.sessions?.[0]?.id,
  })

  // Create assignments mutation
  const createMutation = useMutation({
    mutationFn: (data: { sessionId: string; projectId: string; judgeId: string }[]) =>
      api.createAssignments(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignments'] })
      toast.success(t('assignments.created'))
    },
    onError: () => {
      toast.error(t('assignments.create_failed'))
    },
  })

  // Delete assignment mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteAssignment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignments'] })
      toast.success(t('assignments.removed'))
    },
    onError: () => {
      toast.error(t('assignments.remove_failed'))
    },
  })

  // Get session info
  const getSession = (projectId: string) => {
    const project = projects.find(p => p.id === projectId)
    if (!project?.sessionId) return null
    return activeHackathon?.sessions?.find(s => s.id === project.sessionId)
  }

  // Check if a project is assigned to a judge
  const isAssigned = (projectId: string, judgeId: string) => {
    return assignments.some(a => a.projectId === projectId && a.judgeId === judgeId)
  }

  // Get assignment ID
  const getAssignmentId = (projectId: string, judgeId: string) => {
    return assignments.find(a => a.projectId === projectId && a.judgeId === judgeId)?.id
  }

  // Get assignment counts
  const getJudgeAssignmentCount = (judgeId: string) => {
    return assignments.filter(a => a.judgeId === judgeId).length
  }

  const getProjectAssignmentCount = (projectId: string) => {
    return assignments.filter(a => a.projectId === projectId).length
  }

  // Toggle assignment
  const toggleAssignment = (projectId: string, judgeId: string) => {
    const existingId = getAssignmentId(projectId, judgeId)
    const sessionId = activeHackathon?.sessions?.[0]?.id

    if (existingId) {
      // Remove assignment
      deleteMutation.mutate(existingId)
    } else if (sessionId) {
      // Create new assignment
      createMutation.mutate([{ sessionId, projectId, judgeId }])
    }
  }

  // Assign all projects to a judge
  const assignAllToJudge = (judgeId: string) => {
    const sessionId = activeHackathon?.sessions?.[0]?.id
    if (!sessionId) return

    const newAssignments = projects
      .filter(project => !isAssigned(project.id, judgeId))
      .map(project => ({
        sessionId,
        projectId: project.id,
        judgeId,
      }))

    if (newAssignments.length > 0) {
      createMutation.mutate(newAssignments)
      toast.success(t('assignments.assigned_count', { count: newAssignments.length, name: judges.find(j => j.id === judgeId)?.name }))
    }
  }

  const isLoading = isLoadingProjects || isLoadingJudges || isLoadingAssignments

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
            {t('assignments.title', 'Project Assignments')}
          </h1>
          <p className="text-sm md:text-base text-muted-foreground">
            {t('assignments.subtitle')}
          </p>
        </div>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          {t('assignments.help')}
        </AlertDescription>
      </Alert>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Projects Panel */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {t('assignments.projects_count', { count: projects.length })}
            </CardTitle>
            <CardDescription>
              {t('assignments.projects_desc')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
              {projects.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  {t('assignments.no_projects')}
                </div>
              )}
              {projects.map(project => {
                const session = getSession(project.id)
                const assignedCount = getProjectAssignmentCount(project.id)

                return (
                  <div
                    key={project.id}
                    className="p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium truncate">{project.title}</h4>
                        <p className="text-sm text-muted-foreground truncate mt-1">
                          {project.oneLiner}
                        </p>
                        {session && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {session.name}
                          </p>
                        )}
                      </div>
                      <Badge variant="secondary" className="shrink-0">
                        {t(assignedCount === 1 ? 'assignments.judge_count' : 'assignments.judges_count_label', { count: assignedCount })}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap gap-2 mt-3">
                      {judges.map(judge => (
                        <label
                          key={judge.id}
                          className="flex items-center gap-2 text-sm cursor-pointer"
                        >
                          <Checkbox
                            checked={isAssigned(project.id, judge.id)}
                            onCheckedChange={() => toggleAssignment(project.id, judge.id)}
                            disabled={createMutation.isPending || deleteMutation.isPending}
                          />
                          <span className="text-xs">{judge.name.split(' ')[0]}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Judges Panel */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {t('assignments.judges_count', { count: judges.length })}
            </CardTitle>
            <CardDescription>
              {t('assignments.judges_desc')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
              {judges.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  {t('assignments.no_judges')}
                </div>
              )}
              {judges.map(judge => {
                const assignedCount = getJudgeAssignmentCount(judge.id)
                const isExpanded = expandedJudge === judge.id

                return (
                  <div
                    key={judge.id}
                    className="p-4 rounded-lg border bg-card"
                  >
                    <div
                      className="flex items-start justify-between gap-3 cursor-pointer"
                      onClick={() => setExpandedJudge(isExpanded ? null : judge.id)}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{judge.name}</h4>
                          {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {judge.email}
                        </p>
                      </div>
                      <Badge variant="default">
                        {assignedCount}/{projects.length}
                      </Badge>
                    </div>

                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs text-muted-foreground">{t('assignments.select_projects')}</p>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => assignAllToJudge(judge.id)}
                            disabled={createMutation.isPending || assignedCount === projects.length}
                          >
                            {t('common.select_all')}
                          </Button>
                        </div>
                        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                          {projects.map(project => (
                            <label
                              key={project.id}
                              className="flex items-center gap-2 p-2 rounded hover:bg-muted/50 cursor-pointer"
                            >
                              <Checkbox
                                checked={isAssigned(project.id, judge.id)}
                                onCheckedChange={() => toggleAssignment(project.id, judge.id)}
                                disabled={createMutation.isPending || deleteMutation.isPending}
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm truncate">{project.title}</p>
                                <p className="text-xs text-muted-foreground truncate">{project.oneLiner}</p>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    {!isExpanded && assignedCount > 0 && (
                      <div className="mt-3 pt-3 border-t">
                        <div className="space-y-1">
                          {projects
                            .filter(p => isAssigned(p.id, judge.id))
                            .slice(0, 3)
                            .map(project => (
                              <p key={project.id} className="text-xs truncate">
                                • {project.title}
                              </p>
                            ))}
                          {assignedCount > 3 && (
                            <p className="text-xs text-muted-foreground">
                              {t('common.more_count', { count: assignedCount - 3 })}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
