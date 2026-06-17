/**
 * AI功能使用示例
 *
 * 这个文件展示了如何在OpenHackathon中集成和使用AI功能
 */

import { AIService, getAIService } from '../api/services/ai'
import { prisma } from '../api/config'

// ==================== 示例1：分析单个项目 ====================

async function example1_analyzeProject() {
  console.log('示例1：分析单个项目')

  const aiService = getAIService()

  const project = {
    title: 'AI驱动的代码审查助手',
    description: `这是一个基于大语言模型的代码审查工具，能够自动识别代码中的潜在问题：

    核心功能：
    1. 静态代码分析：检测常见的代码异味和bug
    2. 安全漏洞扫描：识别SQL注入、XSS等安全问题
    3. 性能优化建议：发现低效的算法和数据结构
    4. 代码风格检查：确保团队代码规范一致性

    技术栈：Python、FastAPI、OpenAI API、Docker

    创新点：
    - 使用RAG技术结合项目历史代码库，提供上下文感知的审查
    - 支持多种编程语言（Python、JavaScript、Go、Java）
    - 可集成到CI/CD pipeline，自动化审查流程
    `,
    repoURL: 'https://github.com/example/ai-code-reviewer',
    demoURL: 'https://demo.aireviewer.dev',
  }

  const assessment = await aiService.analyzeProject(project)

  console.log('AI评估结果：')
  console.log(`综合评分：${assessment.overallScore}/100`)
  console.log(`推荐优先级：${assessment.suggestedPriority}`)
  console.log(`复杂度：${assessment.estimatedComplexity}`)
  console.log('\n各维度评分：')
  Object.entries(assessment.dimensions).forEach(([key, dim]) => {
    console.log(`  ${key}: ${dim.score}/100 - ${dim.reasoning}`)
  })
  console.log('\n项目亮点：')
  assessment.highlights.forEach((h, i) => console.log(`  ${i + 1}. ${h}`))
  console.log('\n待改进：')
  assessment.concerns.forEach((c, i) => console.log(`  ${i + 1}. ${c}`))
  console.log('\n技术标签：', assessment.technicalTags.join(', '))
}

// ==================== 示例2：批量分析项目 ====================

async function example2_batchAnalyze() {
  console.log('\n示例2：批量分析项目')

  const aiService = getAIService()

  // 假设这是从数据库获取的项目列表
  const projects = await prisma.project.findMany({
    where: { hackathonId: 'some-hackathon-id' },
    take: 5, // 只分析前5个作为示例
  })

  console.log(`开始分析 ${projects.length} 个项目...`)

  for (const project of projects) {
    try {
      const assessment = await aiService.analyzeProject({
        title: project.title,
        description: project.description || '',
        repoURL: project.repoUrl || undefined,
        demoURL: project.demoUrl || undefined,
      })

      // 保存到数据库
      await prisma.aIAssessment.create({
        data: {
          projectId: project.id,
          type: 'quality_assessment',
          result: assessment as any,
        },
      })

      console.log(`✓ ${project.title}: ${assessment.overallScore}/100`)
    } catch (error) {
      console.error(`✗ ${project.title}: 分析失败`, error)
    }
  }

  console.log('批量分析完成')
}

// ==================== 示例3：评分一致性分析 ====================

async function example3_scoringConsistency() {
  console.log('\n示例3：评分一致性分析')

  const aiService = getAIService()

  // 模拟评委评分数据
  const judgeScores = [
    {
      judgeId: 'judge-1',
      judgeName: 'Alice（资深工程师）',
      scores: [85, 90, 78, 92, 88], // 较高分段，标准差较小
    },
    {
      judgeId: 'judge-2',
      judgeName: 'Bob（技术专家）',
      scores: [60, 65, 55, 68, 62], // 较低分段，偏严格
    },
    {
      judgeId: 'judge-3',
      judgeName: 'Charlie（产品经理）',
      scores: [75, 70, 80, 72, 77], // 中等分段，较均衡
    },
  ]

  const avgScore = 73 // 全体平均分

  const consistencyAnalysis = await aiService.analyzeScoringConsistency(judgeScores, avgScore)

  console.log('评分一致性分析结果：')
  consistencyAnalysis.forEach((analysis) => {
    console.log(`\n评委：${analysis.judgeName}`)
    console.log(`  平均分：${analysis.avgScore.toFixed(1)} (全体平均：${avgScore})`)
    console.log(`  标准差：${analysis.stdDeviation.toFixed(1)}`)
    console.log(`  偏差：${analysis.biasScore.toFixed(1)} (${analysis.bias})`)
    console.log(`  建议：${analysis.suggestion}`)
  })
}

// ==================== 示例4：内容审核 ====================

async function example4_contentModeration() {
  console.log('\n示例4：内容审核')

  const aiService = getAIService()

  const testContents = [
    '这是一个正常的黑客松项目描述，使用了React和Node.js',
    '免费领取iPhone 15！点击链接：http://scam.com',
    '该项目完全抄袭自GitHub上的XXX项目',
  ]

  for (const content of testContents) {
    const moderation = await aiService.moderateContent(content, 'project')

    console.log(`\n内容：${content.substring(0, 50)}...`)
    console.log(`  是否合适：${moderation.isAppropriate ? '✓' : '✗'}`)
    console.log(`  建议操作：${moderation.suggestedAction}`)
    if (moderation.flags.length > 0) {
      console.log('  标记问题：')
      moderation.flags.forEach((flag) => {
        console.log(`    - ${flag.type} (${flag.severity}): ${flag.description}`)
      })
    }
  }
}

// ==================== 示例5：智能内容生成 ====================

async function example5_contentGeneration() {
  console.log('\n示例5：智能内容生成')

  const aiService = getAIService()

  // 生成README
  console.log('生成README.md...')
  const readme = await aiService.generateContent({
    type: 'readme',
    context: {
      title: '智能健康监测手环',
      description: '基于AI的实时健康数据分析系统',
      techStack: ['React Native', 'TensorFlow Lite', 'BLE', 'AWS IoT'],
    },
    language: 'zh',
  })
  console.log('生成的README：')
  console.log(readme.substring(0, 300) + '...\n')

  // 优化项目描述
  console.log('优化项目描述...')
  const optimized = await aiService.generateContent({
    type: 'description',
    context: {
      original: '我们做了个app可以监测健康数据很厉害',
    },
    language: 'zh',
    style: 'business',
  })
  console.log('优化后：')
  console.log(optimized)

  // 生成评分标准
  console.log('\n生成评分标准...')
  const criteria = await aiService.generateContent({
    type: 'criteria',
    context: {
      theme: 'AI + 医疗健康',
      focus: '创新性、可行性、社会价值',
    },
    language: 'zh',
  })
  console.log(criteria)
}

// ==================== 示例6：相似度检测（抄袭识别）====================

async function example6_plagiarismCheck() {
  console.log('\n示例6：相似度检测')

  const aiService = getAIService()

  const project1 = `智能停车系统是一个基于计算机视觉的解决方案，通过摄像头
    实时监测停车位状态，使用深度学习模型识别车辆，并通过移动应用向用户
    推送空余车位信息。系统采用YOLOv8目标检测算法，在边缘设备上运行，
    实现低延迟的实时处理。`

  const project2 = `本项目是一个智能停车管理系统，利用计算机视觉技术实时监控
    停车场状态。通过部署在停车场的摄像头，使用深度学习算法识别车辆占用
    情况，并将空闲车位信息通过手机App推送给用户。技术上采用了YOLOv8
    目标检测网络，部署在边缘计算设备实现实时处理。`

  const project3 = `这是一个完全不同的项目，专注于使用区块链技术构建去中心化
    的社交网络平台，用户数据完全加密存储，采用IPFS进行分布式存储。`

  console.log('检测项目相似度：')

  const similarity1 = await aiService.detectSimilarity(project1, project2)
  console.log(`项目1 vs 项目2：相似度 ${similarity1}%`)

  const similarity2 = await aiService.detectSimilarity(project1, project3)
  console.log(`项目1 vs 项目3：相似度 ${similarity2}%`)

  if (similarity1 > 70) {
    console.log('⚠️ 警告：项目1和项目2高度相似，疑似抄袭！')
  }
}

// ==================== 示例7：评委智能建议 ====================

async function example7_judgeSuggestions() {
  console.log('\n示例7：评委智能建议')

  // 假设评委正在评审一个项目
  const projectId = 'some-project-id'

  // 获取AI评估结果
  const assessment = await prisma.aIAssessment.findFirst({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
  })

  if (!assessment) {
    console.log('该项目尚未进行AI分析')
    return
  }

  const result = assessment.result as any

  console.log('给评委的AI建议：')
  console.log('\n📊 项目综合评估')
  console.log(`AI评分：${result.overallScore}/100`)
  console.log(`复杂度：${result.estimatedComplexity}`)
  console.log(`推荐优先级：${result.suggestedPriority}`)

  console.log('\n✨ 建议关注的亮点：')
  result.highlights.forEach((h: string, i: number) => console.log(`  ${i + 1}. ${h}`))

  console.log('\n⚠️ 建议关注的问题：')
  result.concerns.forEach((c: string, i: number) => console.log(`  ${i + 1}. ${c}`))

  console.log('\n🏷️ 技术标签：', result.technicalTags.join(', '))

  console.log('\n💡 评分建议：')
  console.log('根据AI分析，该项目在以下维度表现突出：')
  Object.entries(result.dimensions).forEach(([key, dim]: [string, any]) => {
    if (dim.score >= 80) {
      console.log(`  ✓ ${key}: ${dim.reasoning}`)
    }
  })
}

// ==================== 示例8：完整的AI辅助评审工作流 ====================

async function example8_fullWorkflow() {
  console.log('\n示例8：完整的AI辅助评审工作流')

  const hackathonId = 'demo-hackathon'
  const aiService = getAIService()

  // 步骤1：批量分析所有项目
  console.log('\n步骤1：批量分析所有提交项目...')
  const projects = await prisma.project.findMany({
    where: { hackathonId },
  })

  for (const project of projects) {
    const assessment = await aiService.analyzeProject({
      title: project.title,
      description: project.description || '',
      repoURL: project.repoUrl || undefined,
      demoURL: project.demoUrl || undefined,
    })

    await prisma.aIAssessment.create({
      data: { projectId: project.id, type: 'quality_assessment', result: assessment as any },
    })
  }
  console.log(`✓ 完成 ${projects.length} 个项目的AI分析`)

  // 步骤2：根据AI评分排序，优先分配高分项目
  console.log('\n步骤2：根据AI评分智能分配评审任务...')
  const assessments = await prisma.aIAssessment.findMany({
    where: {
      project: { hackathonId },
      type: 'quality_assessment',
    },
    include: { project: true },
  })

  // 按分数排序
  const sortedProjects = assessments
    .sort((a, b) => ((b.result as any).overallScore - (a.result as any).overallScore))
    .slice(0, 10) // 前10个项目

  console.log('AI推荐优先评审的项目：')
  sortedProjects.forEach((item, i) => {
    const result = item.result as any
    console.log(`  ${i + 1}. ${item.project?.title} (AI: ${result.overallScore}/100)`)
  })

  // 步骤3：评审完成后，分析评分一致性
  console.log('\n步骤3：分析评委评分一致性...')
  // (此处省略实际代码，参见示例3)

  console.log('\n✓ AI辅助评审工作流完成！')
}

// ==================== 运行所有示例 ====================

async function runAllExamples() {
  console.log('='.repeat(60))
  console.log('OpenHackathon AI功能使用示例')
  console.log('='.repeat(60))

  try {
    await example1_analyzeProject()
    await example3_scoringConsistency()
    await example4_contentModeration()
    await example5_contentGeneration()
    await example6_plagiarismCheck()

    // 注意：以下示例需要真实数据库数据
    // await example2_batchAnalyze()
    // await example7_judgeSuggestions()
    // await example8_fullWorkflow()

    console.log('\n' + '='.repeat(60))
    console.log('所有示例运行完成！')
    console.log('='.repeat(60))
  } catch (error) {
    console.error('示例运行出错：', error)
  }
}

// 导出示例函数
export {
  example1_analyzeProject,
  example2_batchAnalyze,
  example3_scoringConsistency,
  example4_contentModeration,
  example5_contentGeneration,
  example6_plagiarismCheck,
  example7_judgeSuggestions,
  example8_fullWorkflow,
  runAllExamples,
}

// 如果直接运行此文件，执行所有示例
if (require.main === module) {
  runAllExamples()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
}
