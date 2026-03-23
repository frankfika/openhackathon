import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useActiveHackathon } from '@/lib/active-hackathon'
import { useTranslation } from 'react-i18next'
import { ActivityLog as ActivityLogType, ActivityAction, ActivityEntityType } from '@/lib/types'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Loader2,
  History,
  User,
  Users,
  FileText,
  Gavel,
  Star,
  RefreshCcw,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

const PAGE_SIZE = 50

const actionLabels: Record<ActivityAction, string> = {
  create: '创建',
  update: '更新',
  delete: '删除',
  submit: '提交',
  assign: '分配',
  unassign: '取消分配',
  score: '评分',
  update_score: '更新评分',
  complete_review: '完成评审',
  login: '登录',
  logout: '退出',
  invite: '邀请',
}

const entityLabels: Record<ActivityEntityType, string> = {
  project: '项目',
  assignment: '分配',
  score: '评分',
  hackathon: '赛事',
  judge: '评委',
  user: '用户',
  session: '场次',
  setting: '设置',
}

const roleColors: Record<string, string> = {
  admin: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  judge: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  user: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  system: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400',
}

const actionColors: Record<string, string> = {
  create: 'bg-green-100 text-green-800 dark:bg-green-900/30',
  update: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30',
  delete: 'bg-red-100 text-red-800 dark:bg-red-900/30',
  submit: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30',
  assign: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30',
  unassign: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30',
  score: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30',
  update_score: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30',
  complete_review: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30',
  login: 'bg-gray-100 text-gray-800 dark:bg-gray-800',
  logout: 'bg-gray-100 text-gray-800 dark:bg-gray-800',
  invite: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30',
}

function getEntityIcon(type: ActivityEntityType) {
  switch (type) {
    case 'project':
      return <FileText className="h-4 w-4" />
    case 'judge':
    case 'user':
      return <User className="h-4 w-4" />
    case 'assignment':
      return <Gavel className="h-4 w-4" />
    case 'score':
      return <Star className="h-4 w-4" />
    case 'hackathon':
      return <Users className="h-4 w-4" />
    default:
      return <History className="h-4 w-4" />
  }
}

function formatDateTime(value: string): string {
  const date = new Date(value)
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function ActivityDescription({ log }: { log: ActivityLogType }): React.ReactNode {
  const { metadata } = log

  switch (log.action) {
    case 'submit':
      return (
        <span>
          提交了项目 <strong>{(metadata?.title as string) ?? 'Unknown'}</strong>
        </span>
      )
    case 'assign':
      return (
        <span>
          将评委 <strong>{(metadata?.judgeName as string) ?? 'Unknown'}</strong> 分配给项目{' '}
          <strong>{(metadata?.projectTitle as string) ?? 'Unknown'}</strong>
        </span>
      )
    case 'unassign':
      return (
        <span>
          取消了 <strong>{(metadata?.judgeName as string) ?? 'Unknown'}</strong> 对项目{' '}
          <strong>{(metadata?.projectTitle as string) ?? 'Unknown'}</strong> 的分配
        </span>
      )
    case 'score':
    case 'update_score':
      return (
        <span>
          {log.action === 'update_score' ? '更新了' : '提交了'}对{' '}
          <strong>{(metadata?.projectTitle as string) ?? 'Unknown'}</strong> 的评分
          {metadata?.totalScore !== undefined && (
            <span className="ml-1 font-semibold text-primary">({metadata.totalScore as number} 分)</span>
          )}
        </span>
      )
    case 'invite':
      return (
        <span>
          邀请评委 <strong>{(metadata?.judgeName as string) ?? 'Unknown'}</strong> 加入赛事
        </span>
      )
    case 'create':
      return (
        <span>
          创建了{entityLabels[log.entityType] ?? log.entityType}{' '}
          <strong>{(metadata?.title as string) ?? (metadata?.name as string) ?? log.entityId?.slice(0, 8) ?? ''}</strong>
        </span>
      )
    case 'update':
      return (
        <span>
          更新了{entityLabels[log.entityType] ?? log.entityType}{' '}
          <strong>{(metadata?.title as string) ?? (metadata?.name as string) ?? log.entityId?.slice(0, 8) ?? ''}</strong>
        </span>
      )
    case 'delete':
      return (
        <span>
          删除了{entityLabels[log.entityType] ?? log.entityType}{' '}
          {metadata?.name ? <strong>{String(metadata.name)}</strong> : <span>{log.entityId?.slice(0, 8)}</span>}
        </span>
      )
    default:
      return (
        <span>
          {actionLabels[log.action] ?? log.action} {entityLabels[log.entityType] ?? log.entityType}
        </span>
      )
  }
}

export function ActivityLogPage() {
  const { t } = useTranslation()
  const { activeHackathon } = useActiveHackathon()
  const [page, setPage] = useState(0)
  const [actionFilter, setActionFilter] = useState<string>('')
  const [entityFilter, setEntityFilter] = useState<string>('')
  const [actorFilter, setActorFilter] = useState('')

  const hackathonId = activeHackathon?.id

  const { data: logsData, isLoading: isLoadingLogs } = useQuery({
    queryKey: ['activity-logs', hackathonId, page, actionFilter, entityFilter, actorFilter],
    queryFn: () =>
      api.getActivityLogs({
        hackathonId,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
        action: actionFilter || undefined,
        entityType: entityFilter || undefined,
        actorId: actorFilter || undefined,
      }),
    enabled: !!hackathonId,
    staleTime: 30_000,
  })

  const logs = logsData?.logs ?? []
  const total = logsData?.total ?? 0
  // Stats are inlined in the first unfiltered page response
  const stats = (logsData as { stats?: { totalActions: number; recentActions: number; byRole: Record<string, number>; byEntity: Record<string, number> } })?.stats
  const totalPages = Math.ceil(total / PAGE_SIZE)

  const uniqueActors = useMemo(() => {
    const map = new Map<string, { id?: string; name: string; role: string }>()
    for (const log of logs) {
      if (!map.has(log.actorName)) {
        map.set(log.actorName, { id: log.actorId, name: log.actorName, role: log.actorRole })
      }
    }
    return Array.from(map.values())
  }, [logs])

  const clearFilters = () => {
    setActionFilter('')
    setEntityFilter('')
    setActorFilter('')
    setPage(0)
  }

  const hasFilters = actionFilter || entityFilter || actorFilter

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('activity_log.title', '操作日志')}</h1>
          <p className="text-muted-foreground">
            {t('activity_log.subtitle', '查看所有用户、评委和管理员的操作记录')}
          </p>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border bg-card p-3">
            <div className="text-2xl font-bold">{stats.totalActions}</div>
            <div className="text-xs text-muted-foreground">总操作数</div>
          </div>
          <div className="rounded-lg border bg-card p-3">
            <div className="text-2xl font-bold">{stats.recentActions}</div>
            <div className="text-xs text-muted-foreground">近7天</div>
          </div>
          <div className="rounded-lg border bg-card p-3">
            <div className="text-2xl font-bold">{stats.byRole.judge ?? 0}</div>
            <div className="text-xs text-muted-foreground">评委操作</div>
          </div>
          <div className="rounded-lg border bg-card p-3">
            <div className="text-2xl font-bold">{stats.byRole.admin ?? 0}</div>
            <div className="text-xs text-muted-foreground">管理员操作</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={actionFilter || 'all'} onValueChange={(v) => setActionFilter(v === 'all' ? '' : v)}>
          <SelectTrigger className="h-8 w-[130px]">
            <SelectValue placeholder="操作类型" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部操作</SelectItem>
            {Object.entries(actionLabels).map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={entityFilter || 'all'} onValueChange={(v) => setEntityFilter(v === 'all' ? '' : v)}>
          <SelectTrigger className="h-8 w-[130px]">
            <SelectValue placeholder="对象类型" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部对象</SelectItem>
            {Object.entries(entityLabels).map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={actorFilter || 'all'} onValueChange={(v) => setActorFilter(v === 'all' ? '' : v)}>
          <SelectTrigger className="h-8 w-[150px]">
            <SelectValue placeholder="操作人" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部人员</SelectItem>
            {uniqueActors.map((actor) => (
              <SelectItem key={actor.name} value={actor.id ?? actor.name}>
                {actor.name} ({actor.role})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={clearFilters}>
            <RefreshCcw className="mr-1 h-3 w-3" />
            清除筛选
          </Button>
        )}

        <div className="flex-1" />

        <div className="text-sm text-muted-foreground">
          共 <span className="font-medium text-foreground">{total}</span> 条记录
        </div>
      </div>

      {/* Log List */}
      <div className="rounded-lg border">
        {isLoadingLogs ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <History className="mb-2 h-8 w-8 opacity-50" />
            <p>暂无操作记录</p>
            {hasFilters && <p className="text-xs">尝试清除筛选条件</p>}
          </div>
        ) : (
          <div className="divide-y">
            {logs.map((log) => (
              <div key={log.id} className="flex items-start gap-3 p-3 hover:bg-muted/30">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  {getEntityIcon(log.entityType)}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className={roleColors[log.actorRole] ?? ''}>
                      {log.actorRole === 'admin' && '管理员'}
                      {log.actorRole === 'judge' && '评委'}
                      {log.actorRole === 'user' && '用户'}
                      {log.actorRole === 'system' && '系统'}
                    </Badge>
                    <span className="font-medium">{log.actorName}</span>
                    <Badge
                      variant="outline"
                      className={actionColors[log.action] ?? 'bg-gray-100 text-gray-800'}
                    >
                      {actionLabels[log.action] ?? log.action}
                    </Badge>
                  </div>

                  <div className="mt-1 text-sm text-muted-foreground">
                    <ActivityDescription log={log} />
                  </div>

                  {log.ipAddress && (
                    <div className="mt-1 text-[11px] text-muted-foreground/60">IP: {log.ipAddress}</div>
                  )}
                </div>

                <div className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {formatDateTime(log.createdAt)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            上一页
          </Button>
          <span className="text-sm text-muted-foreground">
            第 {page + 1} / {totalPages} 页
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
          >
            下一页
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
