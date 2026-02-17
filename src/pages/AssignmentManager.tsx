import React, { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { projects, judges, assignments as initialAssignments, sessions } from '@/lib/mock-data'
import { useActiveHackathon } from '@/lib/active-hackathon'
import { toast } from 'sonner'
import { Users, CheckSquare, Info } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Alert, AlertDescription } from '@/components/ui/alert'

export function AssignmentManager() {
  const { t } = useTranslation()
  const { activeHackathon } = useActiveHackathon()
  const [assignments, setAssignments] = useState(initialAssignments)

  // Filter projects by active hackathon
  const hackathonProjects = useMemo(() => {
    return projects.filter(p => p.hackathonId === activeHackathon.id && p.status === 'submitted')
  }, [activeHackathon.id])

  // Get session info
  const getSession = (projectId: string) => {
    const project = projects.find(p => p.id === projectId)
    if (!project?.sessionId) return null
    return sessions.find(s => s.id === project.sessionId)
  }

  // Check if a project is assigned to a judge
  const isAssigned = (projectId: string, judgeId: string) => {
    return assignments.some(a => a.projectId === projectId && a.judgeId === judgeId)
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
    const existingAssignment = assignments.find(
      a => a.projectId === projectId && a.judgeId === judgeId
    )

    if (existingAssignment) {
      // Remove assignment
      setAssignments(assignments.filter(a => a.id !== existingAssignment.id))
      toast.success('Assignment removed')
    } else {
      // Create new assignment
      const project = projects.find(p => p.id === projectId)
      const newAssignment = {
        id: `as-${Date.now()}`,
        sessionId: project?.sessionId || '',
        projectId,
        judgeId,
        status: 'pending' as const,
      }
      setAssignments([...assignments, newAssignment])
      toast.success('Assignment created')
    }
  }

  // Assign all projects to a judge
  const assignAllToJudge = (judgeId: string) => {
    const newAssignments = [...assignments]
    hackathonProjects.forEach(project => {
      const exists = assignments.some(a => a.projectId === project.id && a.judgeId === judgeId)
      if (!exists) {
        newAssignments.push({
          id: `as-${Date.now()}-${project.id}`,
          sessionId: project.sessionId || '',
          projectId: project.id,
          judgeId,
          status: 'pending' as const,
        })
      }
    })
    setAssignments(newAssignments)
    toast.success(`All projects assigned to ${judges.find(j => j.id === judgeId)?.name}`)
  }

  // Save assignments
  const handleSave = () => {
    console.log('Saving assignments:', assignments)
    toast.success('Assignments saved successfully')
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            {t('assignments.title', 'Project Assignments')}
          </h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Assign projects to judges for evaluation
          </p>
        </div>
        <Button onClick={handleSave}>
          <CheckSquare className="mr-2 h-4 w-4" />
          Save Assignments
        </Button>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Check the boxes to assign projects to judges. Each project can be assigned to multiple judges.
        </AlertDescription>
      </Alert>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Projects Panel */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Projects ({hackathonProjects.length})
            </CardTitle>
            <CardDescription>
              Select projects to assign to judges
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
              {hackathonProjects.map(project => {
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
                        {assignedCount} {assignedCount === 1 ? 'judge' : 'judges'}
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
              Judges ({judges.length})
            </CardTitle>
            <CardDescription>
              View judge assignments and assign all projects
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
              {judges.map(judge => {
                const assignedCount = getJudgeAssignmentCount(judge.id)
                const assignedProjects = assignments
                  .filter(a => a.judgeId === judge.id)
                  .map(a => projects.find(p => p.id === a.projectId))
                  .filter(Boolean)

                return (
                  <div
                    key={judge.id}
                    className="p-4 rounded-lg border bg-card"
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{judge.name}</h4>
                          {judge.isAi && (
                            <Badge variant="outline" className="text-xs">AI</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {judge.title}
                        </p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {judge.expertise.map(exp => (
                            <Badge key={exp} variant="secondary" className="text-xs">
                              {exp}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <Badge variant="default">
                        {assignedCount} projects
                      </Badge>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => assignAllToJudge(judge.id)}
                    >
                      Assign All Projects
                    </Button>

                    {assignedProjects.length > 0 && (
                      <div className="mt-3 pt-3 border-t">
                        <p className="text-xs text-muted-foreground mb-2">Assigned to:</p>
                        <div className="space-y-1">
                          {assignedProjects.slice(0, 3).map(project => (
                            <p key={project!.id} className="text-xs truncate">
                              • {project!.title}
                            </p>
                          ))}
                          {assignedProjects.length > 3 && (
                            <p className="text-xs text-muted-foreground">
                              +{assignedProjects.length - 3} more
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
