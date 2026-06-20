# OpenHackathon v2.1 上线前部署检测计划

## 项目概况
- **技术栈**: React 18 + Vite + TailwindCSS + shadcn/ui + Express + Prisma + PostgreSQL
- **测试**: Vitest + Playwright + Testing Library + Storybook
- **部署**: GitHub Actions + PM2 + Nginx / Render
- **目标**: 全面检测功能性、UI/UX、安全性、性能、部署配置

## 检测维度与任务

### Stage 1: 功能性检测（并行执行）
- **任务 1.1**: TypeScript 编译检查 (`npm run check` / `tsc --noEmit`)
- **任务 1.2**: 单元测试运行 (`npm run test:unit`)
- **任务 1.3**: API 集成测试运行 (`npm run test:api`)
- **任务 1.4**: E2E Smoke 测试运行 (`npx playwright test smoke.spec.ts`)
- **任务 1.5**: 前端路由完整性检查 - 验证所有 lazy import 路径存在
- **任务 1.6**: 数据库迁移文件完整性检查 - 验证 migration.sql 与 schema.prisma 一致
- **任务 1.7**: API 路由完整性检查 - 验证所有后端路由注册无遗漏

### Stage 2: 部署与配置检测（并行执行）
- **任务 2.1**: Dockerfile 检查 - 多阶段构建、端口、启动命令、环境变量
- **任务 2.2**: CI/CD 工作流检查 - deploy.yml 配置、密钥引用、部署脚本
- **任务 2.3**: Render 部署配置检查 - render.yaml 环境变量、构建命令
- **任务 2.4**: 环境变量完整性检查 - .env.example 与 config.ts 一致性
- **任务 2.5**: 构建脚本检查 - package.json scripts 完整性
- **任务 2.6**: 部署时数据库迁移命令检查 - `prisma migrate deploy` 与 fallback

### Stage 3: UI/UX 布局与可用性检测（并行执行）
- **任务 3.1**: 前端路由结构检查 - 路由懒加载、ErrorBoundary 包裹、导航逻辑
- **任务 3.2**: 响应式布局检查 - Tailwind 断点使用、移动端适配
- **任务 3.3**: 组件可用性检查 - shadcn/ui 组件使用、键盘导航、空状态、加载状态
- **任务 3.4**: 交互体验检查 - Suspense fallback、toast 通知、错误处理
- **任务 3.5**: 可访问性检查 - aria-label、色彩对比度、focus 状态

### Stage 4: 安全与性能检测（并行执行）
- **任务 4.1**: 安全机制检查 - JWT、CORS、Helmet、速率限制、输入验证
- **任务 4.2**: 错误处理检查 - 全局错误处理、API 错误响应、ErrorBoundary
- **任务 4.3**: 性能检查 - 代码分割、懒加载、QueryClient 配置、缓存策略
- **任务 4.4**: 依赖安全检查 - 依赖版本、已知漏洞检查（npm audit）

## 执行策略
- 所有 Stage 1-4 的子任务并行执行
- 每个子代理读取相关文件后生成检测项与发现的问题
- 主代理汇总所有检测结果，生成最终报告

## 质量标准
- TypeScript 编译零错误
- 单元测试通过率 100%
- E2E Smoke 测试通过
- 无未注册路由或导入错误
- 部署配置完整（Dockerfile + CI/CD + 环境变量）
- 安全基线满足（JWT Secret、CORS、Helmet、Rate Limiting）
- UI/UX 无明显布局问题、响应式正常、交互反馈完整
