import React, { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useActiveHackathon } from '@/lib/active-hackathon'
import { Download, BarChart3, TrendingUp, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { api } from '@/lib/api'
import { useQuery } from '@tanstack/react-query'

export function ScoringReport() {
  const { t } = useTranslation()
  const { activeHackathon } = useActiveHackathon()

  // Fetch report data from API
  const { data: reportData = [], isLoading: isLoadingReport } = useQuery({
    queryKey: ['scoring-report', activeHackathon?.id],
    queryFn: () => api.getScoringReport({ hackathonId: activeHackathon?.id }),
    enabled: !!activeHackathon?.id,
  })

  // Fetch projects
  const { data: projects = [] } = useQuery({
    queryKey: ['projects', activeHackathon?.id],
    queryFn: () => api.getProjects({ hackathonId: activeHackathon?.id }),
    enabled: !!activeHackathon?.id,
  })

  // Fetch judges
  const { data: judges = [] } = useQuery({
    queryKey: ['users', 'judges'],
    queryFn: () => api.getUsers({ role: 'judge' }),
  })

  // Calculate statistics
  const stats = useMemo(() => {
    const totalProjects = projects.length
    const scoredProjects = new Set(reportData.map(r => r.projectId)).size
    const avgScore = reportData.length > 0
      ? reportData.reduce((sum, r) => sum + (r.totalScore || 0), 0) / reportData.length
      : 0
    const totalAssignments = projects.length * judges.length
    const completionRate = totalAssignments > 0
      ? (reportData.length / totalAssignments) * 100
      : 0

    return {
      totalProjects,
      scoredProjects,
      avgScore: avgScore.toFixed(1),
      completionRate: completionRate.toFixed(0)
    }
  }, [projects, reportData, judges.length])

  // Get judge scores for a project
  const getJudgeScores = (projectId: string) => {
    const projectScores = reportData.filter(r => r.projectId === projectId)
    const scores: Record<string, number | null> = {}
    judges.forEach(judge => {
      const entry = projectScores.find(r => r.judgeId === judge.id)
      scores[judge.id] = entry?.totalScore ?? null
    })
    return scores
  }

  // Get average score for a project
  const getProjectAvgScore = (projectId: string) => {
    const projectScores = reportData.filter(r => r.projectId === projectId)
    if (projectScores.length === 0) return 0
    return projectScores.reduce((sum, r) => sum + (r.totalScore || 0), 0) / projectScores.length
  }

  // {t('reports.download_csv')}
  const downloadCSV = () => {
    const headers = ['Rank', 'Project', 'Submitter', ...judges.map(j => j.name), 'Average Score']

    const rows = projects.map((project, index) => {
      const judgeScores = getJudgeScores(project.id)
      const scoreValues = judges.map(j => judgeScores[j.id] !== null ? judgeScores[j.id] : '-')
      const avgScore = getProjectAvgScore(project.id)

      return [
        index + 1,
        `"${project.title}"`,
        `"${project.submitterName || project.submitterEmail}"`,
        ...scoreValues,
        avgScore > 0 ? avgScore.toFixed(1) : '-'
      ]
    })

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `scoring-report-${activeHackathon.id}-${Date.now()}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  if (isLoadingReport) {
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
            {t('reports.title', 'Scoring Report')}
          </h1>
          <p className="text-sm md:text-base text-muted-foreground">
            {t('reports.subtitle')}
          </p>
        </div>
        <Button onClick={downloadCSV}>
          <Download className="mr-2 h-4 w-4" />
          {t('reports.download_csv')}
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('reports.total_projects')}</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalProjects}</div>
            <p className="text-xs text-muted-foreground">
              {t('reports.scored_count', { count: stats.scoredProjects })}
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('reports.avg_score')}</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avgScore}</div>
            <p className="text-xs text-muted-foreground">{t('reports.out_of', { max: 100 })}</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('reports.completion_rate')}</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completionRate}%</div>
            <p className="text-xs text-muted-foreground">
              {t('reports.assignments_completed')}
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('reports.judges')}</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{judges.length}</div>
            <p className="text-xs text-muted-foreground">{t('reports.evaluating')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Scoring Matrix Table */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle>{t('reports.scoring_matrix')}</CardTitle>
          <CardDescription>
            {t('reports.scoring_matrix_desc')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">{t('reports.rank')}</TableHead>
                  <TableHead className="min-w-[200px]">{t('reports.project')}</TableHead>
                  <TableHead className="min-w-[150px]">{t('reports.submitter')}</TableHead>
                  {judges.map(judge => (
                    <TableHead key={judge.id} className="text-center min-w-[100px]">
                      {judge.name}
                    </TableHead>
                  ))}
                  <TableHead className="text-center font-semibold min-w-[100px]">
                    {t('reports.average')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((project, index) => {
                  const judgeScores = getJudgeScores(project.id)
                  const avgScore = getProjectAvgScore(project.id)

                  return (
                    <TableRow key={project.id}>
                      <TableCell className="font-medium">
                        {index + 1}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{project.title}</div>
                        <div className="text-sm text-muted-foreground truncate max-w-[200px]">
                          {project.oneLiner}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {project.submitterName || project.submitterEmail}
                      </TableCell>
                      {judges.map(judge => (
                        <TableCell key={judge.id} className="text-center">
                          {judgeScores[judge.id] !== null ? (
                            <Badge variant="secondary">
                              {judgeScores[judge.id]}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      ))}
                      <TableCell className="text-center">
                        {avgScore > 0 ? (
                          <Badge variant="default" className="font-semibold">
                            {avgScore.toFixed(1)}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
