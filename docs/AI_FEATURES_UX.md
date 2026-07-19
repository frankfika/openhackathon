# AI 功能 UX 设计说明（v2.2）

> 配合 `AI_FEATURES_CHANGELOG.md` + `AI_FEATURES_API.md` 一起阅读。
> 本文档只描述 **UX 决策与用户故事**，代码改动看 CHANGELOG，API 形状看 API 文档。

## 设计原则

1. **每个 tab 都有 4 态**：loading / empty / error / success — 用户在任何时刻都知道系统在干什么
2. **错误分类不暴露原文**：5 类（network / unauthorized / forbidden / server / timeout），背后统一走 `classifyError` helper
3. **每个 mutation 都有 onError + 友好 toast**：admin 不会看到"操作失败"这种无意义提示
4. **i18n 全覆盖**：zh + en，跟项目其他 20 个 page 一致
5. **AI 调用结果可观测**：admin 面板直接看 calls / errors / duration（Tab 6），不用查后端日志

## 6 个 Tab 的用户故事

### Tab 1：项目分析（Batch Project Analysis）

**目标用户**：admin 想要批量评估所有项目质量

**主流程**：
1. Admin 选当前 hackathon → 点 "开始批量分析"
2. 看到 taskId 提示
3. 进度条每 2s 自动刷新（轮询 `/api/ai/batch-status/:taskId`）
4. 完成后展示 "X / Y 完成（Z 失败）"
5. 失败项目可展开看错误列表（最多 20 条）

**UX 决策**：
- 不阻塞 UI：batch 是异步任务，admin 触发后能继续操作其他 tab
- "force refresh" Switch：跳过 24h 缓存，AI 模型升级后强制重评
- 失败的项目可点开看具体错误，不用去后端日志翻

**常见卡点**：
- 任务过期（1h 后查不到）→ 友好提示"任务已过期或不存在"

### Tab 2：评分一致性（Scoring Consistency）

**目标用户**：admin 想知道哪些评委偏严 / 偏宽

**主流程**：
1. 点 "分析评分一致性"
2. 看到 3 张评委卡片：均分 / 标准差 / 偏差 / AI 建议
3. 偏差用颜色（蓝=偏低 / 橙=偏高 / 灰=均衡）

**UX 决策**：
- query enabled: false，必须手动点（数据可能很大，不预加载）
- 4 态完整：loading skeleton / error 提示 / empty state "暂无评分数据" / 成功展示

**常见卡点**：
- Hackathon 没评委数据 → empty state 提示 "请先分配评委并完成评分"
- 后端 500 → 友好错误，不暴露 stack

### Tab 3：内容审核（Content Moderation）

**目标用户**：admin 想测试 AI 审核能力 / 试用不同输入

**主流程**：
1. 在 textarea 粘贴要审核的内容
2. 或者点"样例"快捷按钮（spam / clean / sensitive）
3. 点 "审核内容"
4. 看到结果卡：是否合适 / 建议操作 / 检测到的问题列表

**UX 决策**：
- 显示输入字符数 + 超过 10K 时提示"已截断"（用户感知到不是全文审核）
- 3 个样例按钮：降低首次使用门槛
- 5 类 flag 类型用 Badge 颜色区分严重度

**常见卡点**：
- AI provider 不可达 → 友好错误（不会暴露 Anthropic 内部错误）
- 输入 100K 字符 → 自动截断 + 提示

### Tab 4：内容生成（Content Generation）

**目标用户**：admin / 参赛者想用 AI 生成 / 优化文案

**主流程**：
1. 选 type（README / description / pitch / news / email / criteria）— 6 种
2. 选 language（zh / en）— 2 种
3. 选 style（business / academic / casual / technical）— 4 种
4. 粘输入（不同 type 占位符不同，引导用户填什么）
5. 点 "生成"
6. 看到结果 + 一键复制

**UX 决策**：
- type 切换时占位符动态变化（`t(ai_features.generate.input_placeholder_${type})`）
- input 按行解析为 context 字段（README: title / description / techStack 三行）
- 复制按钮用 Clipboard API + 2s 反馈
- 6×2×4=48 种组合，每个组合都有对应 i18n key

**常见卡点**：
- 输入太短 → AI 生成内容质量差（无解，但占位符有提示）
- 后端 5xx → 友好错误

### Tab 5：抄袭检测（Plagiarism Detection）

**目标用户**：admin 想检查两个项目描述是否雷同

**主流程**：
1. 粘两段文本
2. 点 "对比相似度"
3. 看到 0-100% 数字 + 颜色进度条 + 风险等级

**UX 决策**：
- 视觉化：颜色区分风险（红 >70 / 黄 30-70 / 绿 <30）
- 解释性：自动给"高 / 中 / 低风险"标签
- 后续可扩展：粘 projectId 触发 `check-plagiarism/:projectId`（同赛事所有项目对比），目前先做文本对比

**常见卡点**：
- 文本太短 → AI 容易误判 0%（无解，但占位符引导用户粘完整描述）

### Tab 6：AI 运行状态（AI Metrics）

**目标用户**：admin 想知道 AI 服务健康度

**主流程**：
1. 点 "刷新"
2. 看到 4 个 metric card：总调用 / 总错误 / 超时 / 平均耗时
3. 看到按 provider 分类的 calls / errors

**UX 决策**：
- query enabled: false（不轮询，避免给 AI provider 加压）
- 错误数 > 0 时 metric card 用橙色
- 超时 > 0 时用红色
- 0 数据时显示 empty state "暂无 AI 调用数据"

**常见卡点**：
- AI 调用 0 次 → 新部署的项目正常，无需担心
- 错误率突然飙升 → 红色提示，看具体 provider 排查

## 错误分类（5 类）

所有 AI mutation 错误统一走 `classifyError(err, t)`，返回本地化的 5 类消息：

| 类别 | 触发条件 | 用户看到 |
|---|---|---|
| `error_network` | axios ERR_NETWORK / "Network Error" | "网络异常，请检查连接" |
| `error_unauthorized` | 401 | "未授权或登录已过期" |
| `error_forbidden` | 403 | "权限不足" |
| `error_server` | 5xx | "服务异常（5xx），请稍后重试" |
| `error_timeout` | ECONNABORTED / 含 "timeout" | "请求超时（>30s），AI 服务可能较慢" |
| `error_unknown` | 其他 | "未知错误" |

如果后端 response.data.error 是字符串（脱敏后），直接展示（如 "AI service timeout" / "AI service error"）。

## 加载 / 空 / 错误 态总览

| Tab | Loading | Empty | Error | Success |
|---|---|---|---|---|
| 1 项目分析 | mutation isPending | 任务列表无数据 | classifyError | 进度条 + 完成提示 |
| 2 评分一致性 | Skeleton (3-4 行) | "暂无评分数据" | XCircle + classifyError | 评委卡片 |
| 3 内容审核 | mutation isPending | （不适用，输入必填） | XCircle + classifyError | 审核结果卡 |
| 4 内容生成 | mutation isPending | （不适用，输入必填） | XCircle + classifyError | 生成结果 + 复制 |
| 5 抄袭检测 | mutation isPending | （不适用，输入必填） | XCircle + classifyError | 相似度进度条 |
| 6 AI Metrics | Skeleton | "暂无 AI 调用数据" | （不适用） | 4 metric + provider 列表 |

## i18n key 命名约定

```
ai_features.<feature>.<element>
```

例：
- `ai_features.tabs.analyze` — Tab 标题
- `ai_features.analyze.title` — Tab 1 卡片标题
- `ai_features.moderate.check_button` — Tab 3 按钮文字
- `ai_features.generate.input_placeholder_${type}` — Tab 4 占位符（按 type 动态）

所有 key 在 `src/lib/locales/{zh,en}.json` 的 `ai_features` section 下，约 100 个 key。
