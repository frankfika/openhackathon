import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Project, Assignment } from '@/lib/mock-data'
import { useActiveHackathon } from '@/lib/active-hackathon'
import { useTranslation } from 'react-i18next'
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu'
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter 
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Search, MoreHorizontal, Pencil, Trash2, Eye, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

// Helper function to calculate score from assignments
function calculateProjectScore(projectId: string, assignments: Assignment[] = []) {
  const projectAssignments = assignments.filter(a => a.projectId === projectId && a.status === 'completed');
  if (projectAssignments.length === 0) return 0;
  
  const totalScore = projectAssignments.reduce((sum, a) => sum + (a.totalScore || 0), 0);
  return totalScore / projectAssignments.length;
}

export function Projects() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { activeHackathon } = useActiveHackathon()
  const queryClient = useQueryClient()
  
  const [query, setQuery] = useState('')
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null)
  
  // Fetch projects
  const { data: projects, isLoading, isError } = useQuery({
    queryKey: ['projects', activeHackathon.id],
    queryFn: () => api.getProjects(activeHackathon.id),
    enabled: !!activeHackathon.id
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteProject(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', activeHackathon.id] })
      toast.success(t('projects.delete_success', 'Project deleted successfully'))
      setProjectToDelete(null)
    },
    onError: (error) => {
      console.error('Delete error:', error)
      toast.error(t('projects.delete_error', 'Failed to delete project'))
    }
  })

  // Filter logic
  const filteredProjects = projects?.filter((p: any) => {
    if (!query) return true
    const lowerQuery = query.toLowerCase()
    return (
      p.title.toLowerCase().includes(lowerQuery) ||
      p.oneLiner.toLowerCase().includes(lowerQuery) ||
      (p.tags && p.tags.some((tag: string) => tag.toLowerCase().includes(lowerQuery)))
    )
  })

  const handleDelete = () => {
    if (projectToDelete) {
      deleteMutation.mutate(projectToDelete.id)
    }
  }

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{t('projects.title', 'Projects')}</h2>
          <p className="text-muted-foreground">
            {t('projects.subtitle', 'Manage and review project submissions')}
          </p>
        </div>
      </div>
      
      <div className="flex items-center justify-between space-x-2">
        <div className="flex flex-1 items-center space-x-2">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t('projects.search_placeholder', 'Search projects...')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Project Name</TableHead>
              <TableHead>Submitter</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Score</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  <div className="flex justify-center items-center">
                    <Loader2 className="h-6 w-6 animate-spin mr-2" />
                    Loading projects...
                  </div>
                </TableCell>
              </TableRow>
            ) : isError ? (
               <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-red-500">
                  Error loading projects
                </TableCell>
              </TableRow>
            ) : filteredProjects?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  No projects found.
                </TableCell>
              </TableRow>
            ) : (
              filteredProjects?.map((project: any) => (
                <TableRow key={project.id}>
                  <TableCell className="font-medium">
                    <div className="flex flex-col">
                      <span>{project.title}</span>
                      <span className="text-xs text-muted-foreground truncate max-w-[200px]">{project.oneLiner}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span>{project.submitterName || 'Anonymous'}</span>
                      <span className="text-xs text-muted-foreground">{project.submitterEmail}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={project.status === 'submitted' ? 'default' : 'secondary'}>
                      {project.status || 'Draft'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {(() => {
                      const score = calculateProjectScore(project.id, project.assignments || []);
                      return score > 0 ? score.toFixed(1) : '-';
                    })()}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => navigate(`/dashboard/judging/${project.id}`)}>
                          <Eye className="mr-2 h-4 w-4" />
                          View Details
                        </DropdownMenuItem>
                        {/* 
                        <DropdownMenuItem onClick={() => console.log('Edit', project.id)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem> 
                        */}
                        <DropdownMenuItem 
                          onClick={() => setProjectToDelete(project)}
                          className="text-red-600 focus:text-red-600"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!projectToDelete} onOpenChange={(open) => !open && setProjectToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Are you absolutely sure?</DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete the project
              "{projectToDelete?.title}" and remove all associated data.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProjectToDelete(null)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete Project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
