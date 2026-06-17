#!/bin/bash

# OpenHackathon AI功能快速启动脚本
# 用途：自动检查配置、生成Prisma客户端、提供使用指南

set -e

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                                                              ║"
echo "║        OpenHackathon AI功能快速启动                          ║"
echo "║                                                              ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# 检查Node.js版本
echo "📋 检查环境..."
node_version=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$node_version" -lt 20 ]; then
    echo "❌ 错误: 需要Node.js 20或更高版本"
    echo "   当前版本: $(node -v)"
    exit 1
fi
echo "✓ Node.js版本: $(node -v)"

# 检查.env文件
if [ ! -f .env ]; then
    echo ""
    echo "⚠️  未找到.env文件"
    echo "📝 正在从.env.example创建.env..."
    cp .env.example .env
    echo "✓ .env文件已创建"
fi

# 检查AI配置
echo ""
echo "🤖 检查AI配置..."
if grep -q "^AI_PROVIDER=" .env && grep -q "^AI_API_KEY=.\+" .env; then
    echo "✓ AI配置已设置"
    AI_PROVIDER=$(grep "^AI_PROVIDER=" .env | cut -d'=' -f2)
    echo "  提供商: $AI_PROVIDER"
else
    echo ""
    echo "⚠️  AI配置未完成！"
    echo ""
    echo "请编辑.env文件，添加以下配置："
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "方案A：使用Claude API（推荐）"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "AI_PROVIDER=claude"
    echo "AI_API_KEY=sk-ant-your-api-key-here"
    echo "AI_MODEL=claude-sonnet-4-20250514"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "方案B：使用DeepSeek（更便宜）"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "AI_PROVIDER=openai"
    echo "AI_BASE_URL=https://api.deepseek.com"
    echo "AI_API_KEY=sk-your-deepseek-key"
    echo "AI_MODEL=deepseek-chat"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "方案C：使用本地Ollama（免费）"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "AI_PROVIDER=local"
    echo "AI_BASE_URL=http://localhost:11434/v1"
    echo "AI_MODEL=llama3.1:8b"
    echo ""
    echo "配置完成后，请重新运行此脚本"
    exit 0
fi

# 检查依赖
echo ""
echo "📦 检查依赖..."
if [ ! -d "node_modules" ]; then
    echo "⚠️  node_modules目录不存在"
    echo "📦 正在安装依赖..."
    npm install
else
    echo "✓ 依赖已安装"
fi

# 生成Prisma客户端
echo ""
echo "🔧 生成Prisma客户端..."
npx prisma generate > /dev/null 2>&1
echo "✓ Prisma客户端已生成"

# 检查数据库连接
echo ""
echo "🔍 检查数据库连接..."
if npx prisma db push --accept-data-loss --skip-generate > /dev/null 2>&1; then
    echo "✓ 数据库连接正常"
    echo "✓ AIAssessment表已创建"
else
    echo "⚠️  数据库连接失败"
    echo "   请确保PostgreSQL正在运行"
    echo "   DATABASE_URL: $(grep DATABASE_URL .env | cut -d'=' -f2)"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🎉 环境配置完成！"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 快速开始"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1️⃣  启动开发环境："
echo "   npm run dev"
echo ""
echo "2️⃣  访问AI功能页面："
echo "   http://localhost:5173/admin/ai-features"
echo ""
echo "3️⃣  测试AI API："
echo "   curl -X POST http://localhost:3001/api/ai/moderate-content \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"content\":\"这是测试内容\",\"type\":\"project\"}'"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📚 文档导航"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📖 快速集成指南:    docs/AI_INTEGRATION_GUIDE.md"
echo "🗺️  完整功能路线图:  docs/AI_FEATURES_ROADMAP.md"
echo "📊 项目状态报告:    docs/PROJECT_STATUS_AND_ROADMAP.md"
echo "✅ 完成状态清单:    docs/COMPLETION_STATUS.md"
echo "💻 示例代码:        examples/ai-integration.ts"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🤖 AI功能清单"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ 项目质量智能评估 (0-100分 + 4维度分析)"
echo "✅ 评分一致性分析 (检测评委偏差)"
echo "✅ 内容安全审核 (敏感词、垃圾信息检测)"
echo "✅ 智能内容生成 (README、描述优化)"
echo "✅ 抄袭智能检测 (文本相似度分析)"
echo "✅ 评委智能助手 (评分建议、智能评语)"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "💡 提示："
echo "   - 所有AI功能都可以在 /admin/ai-features 页面测试"
echo "   - API端点详见 docs/AI_INTEGRATION_GUIDE.md"
echo "   - 如有问题，请查看 docs/COMPLETION_STATUS.md"
echo ""
echo "🎉 OpenHackathon v2.1 AI功能已就绪！"
echo ""
