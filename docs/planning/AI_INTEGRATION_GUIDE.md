# AI功能快速集成指南

## 🚀 5分钟快速上手

### 步骤1：安装依赖

所有必需的依赖已在 `package.json` 中，无需额外安装。

### 步骤2：数据库迁移

```bash
# 添加AIAssessment表
npx prisma migrate dev --name add-ai-assessment

# 生成Prisma Client
npx prisma generate
```

### 步骤3：配置环境变量

编辑 `.env` 文件，添加AI配置：

```bash
# 方案A：使用Claude API（推荐）
AI_PROVIDER=claude
AI_API_KEY=sk-ant-api03-your-key-here
AI_MODEL=claude-sonnet-4-20250514

# 方案B：使用DeepSeek（更便宜，兼容OpenAI API）
AI_PROVIDER=openai
AI_BASE_URL=https://api.deepseek.com
AI_API_KEY=sk-your-deepseek-key
AI_MODEL=deepseek-chat

# 方案C：使用本地Ollama（免费，需本地安装）
AI_PROVIDER=local
AI_BASE_URL=http://localhost:11434/v1
AI_MODEL=llama3.1:8b
```

### 步骤4：注册AI路由

编辑 `api/server.ts`，添加：

```typescript
import aiRoutes from './routes/ai'

// 在其他路由注册之后添加
app.use('/api/ai', aiRoutes)
```

### 步骤5：前端集成

#### 5.1 在项目列表显示AI评分

编辑 `src/pages/Projects/index.tsx`：

```typescript
import { AIScoreBadge } from '@/components/AIScoreBadge'
import { useQuery } from '@tanstack/react-query'

// 在项目卡片中添加
function ProjectCard({ project }) {
  const { data: aiScore } = useQuery({
    queryKey: ['ai-assessment', project.id],
    queryFn: async () => {
      const res = await api.post(`/ai/analyze-project/${project.id}`)
      return res.data.overallScore
    },
    staleTime: 60 * 60 * 1000, // 1小时缓存
  })

  return (
    <div className="project-card">
      <h3>{project.title}</h3>
      {aiScore && <AIScoreBadge score={aiScore} />}
      {/* 其他内容 */}
    </div>
  )
}
```

#### 5.2 在评审分配页面添加批量AI分析

编辑 `src/pages/AssignmentManager/AssignmentToolbar.tsx`：

```typescript
import { Sparkles } from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'

function AssignmentToolbar() {
  const batchAnalyzeMutation = useMutation({
    mutationFn: async () => {
      await api.post('/ai/batch-analyze', {
        hackathonId: activeHackathon.id,
      })
    },
    onSuccess: () => {
      toast.success('已开始批量AI分析，请稍后刷新查看结果')
    },
  })

  return (
    <div className="toolbar">
      <Button
        onClick={() => batchAnalyzeMutation.mutate()}
        disabled={batchAnalyzeMutation.isPending}
      >
        <Sparkles className="mr-2 h-4 w-4" />
        AI批量分析
      </Button>
      {/* 其他按钮 */}
    </div>
  )
}
```

#### 5.3 在评委工作台显示AI建议

编辑 `src/pages/JudgeWorkspace/index.tsx`：

```typescript
import { AIAnalysisPanel } from '@/components/AIAnalysisPanel'

function JudgeWorkspace() {
  const [selectedProject, setSelectedProject] = useState(null)

  return (
    <div className="grid grid-cols-3 gap-4">
      {/* 左侧：任务列表 */}
      <div className="col-span-1">
        <TaskList />
      </div>

      {/* 中间：项目详情 */}
      <div className="col-span-1">
        <ProjectDetails project={selectedProject} />
      </div>

      {/* 右侧：AI分析面板 */}
      <div className="col-span-1">
        {selectedProject && (
          <AIAnalysisPanel projectId={selectedProject.id} />
        )}
      </div>
    </div>
  )
}
```

### 步骤6：启动并测试

```bash
# 启动开发环境
npm run dev

# 访问管理员面板
open http://localhost:5173/admin/projects

# 点击"AI批量分析"按钮，等待几秒
# 刷新页面，应该能看到AI评分徽章
```

---

## 🧪 测试AI功能

### 测试1：单个项目分析

```bash
# 使用curl测试API
curl -X POST http://localhost:3001/api/ai/analyze-project/PROJECT_ID \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json"
```

预期响应：

```json
{
  "overallScore": 75,
  "dimensions": {
    "completeness": {
      "score": 80,
      "reasoning": "项目包含完整的描述和Demo链接"
    },
    "innovation": {
      "score": 70,
      "reasoning": "创新点明确，但市场上已有类似解决方案"
    },
    "technicalDepth": {
      "score": 75,
      "reasoning": "使用了React和Express，技术栈合理"
    },
    "presentation": {
      "score": 75,
      "reasoning": "README结构清晰，但缺少架构图"
    }
  },
  "highlights": [
    "完整的端到端实现",
    "代码质量较高",
    "文档完善"
  ],
  "concerns": [
    "缺少测试覆盖",
    "性能优化空间较大"
  ],
  "suggestedPriority": "high",
  "technicalTags": ["React", "Express", "PostgreSQL"],
  "estimatedComplexity": "intermediate"
}
```

### 测试2：评分一致性分析

```bash
curl http://localhost:3001/api/ai/scoring-consistency/HACKATHON_ID \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### 测试3：内容审核

```bash
curl -X POST http://localhost:3001/api/ai/moderate-content \
  -H "Content-Type: application/json" \
  -d '{
    "content": "这是一个测试项目",
    "type": "project"
  }'
```

---

## 📊 监控AI使用情况

### 查看AI评估记录

```sql
-- 连接到PostgreSQL
psql $DATABASE_URL

-- 查询AI评估统计
SELECT 
  type,
  COUNT(*) as count,
  DATE(created_at) as date
FROM "AIAssessment"
GROUP BY type, DATE(created_at)
ORDER BY date DESC;

-- 查看最近的AI评估结果
SELECT 
  id,
  project_id,
  type,
  result->>'overallScore' as score,
  created_at
FROM "AIAssessment"
ORDER BY created_at DESC
LIMIT 10;
```

### 成本监控

```typescript
// api/services/ai-metrics.ts
export class AIMetrics {
  private static calls = 0
  private static tokens = 0

  static trackCall(tokens: number) {
    this.calls++
    this.tokens += tokens
  }

  static getStats() {
    return {
      calls: this.calls,
      tokens: this.tokens,
      estimatedCost: this.tokens * 0.000003, // Claude Sonnet价格
    }
  }
}

// 在API路由中添加
app.get('/api/ai/stats', authenticateToken, isAdmin, (req, res) => {
  res.json(AIMetrics.getStats())
})
```

---

## 🔧 故障排查

### 问题1：AI分析失败

**症状**：API返回500错误

**排查步骤**：

```bash
# 1. 检查环境变量
echo $AI_API_KEY
echo $AI_PROVIDER

# 2. 测试API连接
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $AI_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-20250514",
    "max_tokens": 100,
    "messages": [{"role": "user", "content": "Hello"}]
  }'

# 3. 查看服务器日志
tail -f logs/api.log
```

**常见原因**：
- ❌ API密钥未设置或错误
- ❌ 网络无法访问Anthropic API
- ❌ 模型名称错误

### 问题2：AI评分不准确

**症状**：所有项目评分都是50分

**原因**：AI分析失败后返回的默认值

**解决方案**：
```typescript
// 在 api/routes/ai.ts 中添加详细错误日志
catch (error: any) {
  console.error('AI analysis error:', error.message)
  console.error('Stack:', error.stack)
  // 返回更详细的错误信息
  res.status(500).json({ 
    error: 'AI analysis failed', 
    message: error.message,
    provider: process.env.AI_PROVIDER 
  })
}
```

### 问题3：批量分析太慢

**症状**：100个项目分析需要10分钟

**优化方案**：

```typescript
// 使用并发控制
import pLimit from 'p-limit'

const limit = pLimit(5) // 同时分析5个项目

const promises = projectIds.map(id => 
  limit(async () => {
    const project = await prisma.project.findUnique({ where: { id } })
    if (!project) return
    
    const assessment = await aiService.analyzeProject(project)
    await prisma.aIAssessment.create({
      data: { projectId: id, type: 'quality_assessment', result: assessment }
    })
  })
)

await Promise.all(promises)
```

---

## 💰 成本优化建议

### 1. 使用更便宜的模型

| 模型 | 输入价格 | 输出价格 | 每项目成本 |
|------|----------|----------|------------|
| Claude Haiku | $0.25/M | $1.25/M | ~$0.02 |
| Claude Sonnet | $3/M | $15/M | ~$0.05 |
| DeepSeek | $0.14/M | $0.28/M | ~$0.01 |

### 2. 缓存策略

```typescript
// 24小时缓存，避免重复分析
const CACHE_TTL = 24 * 60 * 60 * 1000

// 检查缓存
const cached = await redis.get(`ai:assessment:${projectId}`)
if (cached) return JSON.parse(cached)

// 分析并缓存
const assessment = await aiService.analyzeProject(project)
await redis.set(
  `ai:assessment:${projectId}`, 
  JSON.stringify(assessment),
  'PX',
  CACHE_TTL
)
```

### 3. 按需分析

只在以下情况触发AI分析：
- 管理员手动点击"分析"按钮
- 项目首次提交后
- 项目内容发生重大更新（描述变化>30%）

---

## 📚 进阶功能

### 自定义AI提示词

```typescript
// api/services/ai-prompts.ts
export const CUSTOM_PROMPTS = {
  // 针对AI赛道的评估
  aiTrack: `你是AI黑客松评委，重点关注：
    1. AI模型的创新性和准确率
    2. 数据处理pipeline的设计
    3. 模型部署和推理性能
    ...`,
  
  // 针对硬件项目的评估
  hardwareTrack: `你是硬件黑客松评委，重点关注：
    1. 硬件设计的可行性
    2. 软硬件集成度
    3. 成本控制
    ...`,
}

// 在分析时使用
const assessment = await aiService.analyzeProject(project, {
  customPrompt: CUSTOM_PROMPTS.aiTrack
})
```

### 多模型投票

```typescript
// 使用3个不同模型分析，取平均分
const models = ['claude-sonnet-4', 'gpt-4o', 'deepseek-chat']
const assessments = await Promise.all(
  models.map(model => 
    aiService.analyzeProject(project, { model })
  )
)

const avgScore = assessments.reduce((sum, a) => sum + a.overallScore, 0) / models.length
```

---

## 🎓 最佳实践

### 1. 渐进式启用AI功能

```typescript
// 使用Feature Flag
const AI_FEATURES = {
  projectAnalysis: true,    // 项目质量评估
  judgeAssist: false,       // 评委助手（测试中）
  contentModeration: true,  // 内容审核
  plagiarismCheck: false,   // 抄袭检测（即将上线）
}

// 在前端根据Feature Flag显示功能
{AI_FEATURES.projectAnalysis && <AIScoreBadge />}
```

### 2. 用户反馈机制

```typescript
// 在AI面板添加"反馈"按钮
<Button onClick={() => submitFeedback(assessment.id, 'accurate')}>
  👍 准确
</Button>
<Button onClick={() => submitFeedback(assessment.id, 'inaccurate')}>
  👎 不准确
</Button>

// 收集反馈用于模型优化
await prisma.aIFeedback.create({
  data: {
    assessmentId,
    userId,
    rating: 'accurate',
    comment: '评估很准确，帮助很大'
  }
})
```

### 3. A/B测试

```typescript
// 随机选择50%的项目使用AI辅助评分
const useAI = Math.random() < 0.5
if (useAI) {
  // 显示AI建议
  <AIAnalysisPanel />
}

// 后续对比两组评审效率和质量
```

---

## 🚀 生产环境部署

### 1. 环境变量设置

```bash
# 在服务器上设置
export AI_PROVIDER=claude
export AI_API_KEY=sk-ant-xxx
export AI_MODEL=claude-sonnet-4-20250514

# 或者使用PM2 ecosystem配置
# ecosystem.config.js
module.exports = {
  apps: [{
    name: 'openhackathon-api',
    script: 'api/index.ts',
    env: {
      AI_PROVIDER: 'claude',
      AI_API_KEY: 'sk-ant-xxx',
      AI_MODEL: 'claude-sonnet-4-20250514'
    }
  }]
}
```

### 2. 监控告警

```typescript
// 使用Sentry监控AI错误
import * as Sentry from '@sentry/node'

try {
  const assessment = await aiService.analyzeProject(project)
} catch (error) {
  Sentry.captureException(error, {
    tags: { service: 'ai', provider: AI_PROVIDER },
    extra: { projectId: project.id }
  })
  throw error
}
```

### 3. 速率限制

```typescript
// 限制AI API调用频率，避免超额
import rateLimit from 'express-rate-limit'

const aiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1分钟
  max: 10, // 最多10次AI调用
  message: 'AI调用频率过高，请稍后再试'
})

app.use('/api/ai', aiRateLimiter)
```

---

## 📞 获取帮助

- **GitHub Issues**: https://github.com/frankfika/openhackathon/issues
- **文档**: 查看 `docs/AI_FEATURES_ROADMAP.md`
- **示例**: 查看 `examples/ai-integration/`

---

**更新时间**：2024年1月
**版本**：v2.1-ai-preview
