/**
 * API 错误处理 utilities
 *
 * - `extractApiErrorMessage`: 简单提取后端 message（向后兼容）
 * - `classifyApiError`: 5 类错误分类（network / unauthorized / forbidden / server / timeout）+ 后端脱敏消息优先
 *
 * 关键设计：先匹配具体错误（network / timeout / data.error）→ 再匹配 HTTP 状态码 → 最后兜底。
 * 5 类错误分类跨项目适用，配合 i18n 的 t() 函数使用。
 */

export type ErrorCategory = 'network' | 'unauthorized' | 'forbidden' | 'server' | 'timeout' | 'unknown'

/**
 * 简单提取后端 error message（保留向后兼容）
 */
export function extractApiErrorMessage(error: unknown, fallback: string): string {
  if (
    error &&
    typeof error === 'object' &&
    'response' in error
  ) {
    const response = (error as { response?: { data?: { error?: string } } }).response;
    if (typeof response?.data?.error === 'string') {
      return response.data.error;
    }
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

/**
 * 5 类错误分类 + 后端脱敏消息优先
 *
 * 顺序（重要！）：
 * 1. 客户端可识别的网络层错误（network / timeout）— 最具体
 * 2. 后端脱敏后的 data.error 消息（如 "AI service timeout"）— 优先于通用 5xx
 * 3. HTTP 状态码（401 / 403 / 5xx）— 兜底
 * 4. unknown
 *
 * @param error axios 错误 / fetch 错误 / 普通错误
 * @param t i18n 的 t 函数
 * @param i18nKeyPrefix i18n key 前缀，默认 'ai_features.common'（其他模块可传 'common' 等）
 */
export function classifyApiError(
  error: unknown,
  t: (key: string, opts?: Record<string, string>) => string,
  i18nKeyPrefix: string = 'ai_features.common',
): string {
  const e = error as {
    code?: string
    message?: string
    response?: { status?: number; data?: { error?: string } }
  }

  // 1. 客户端可识别的网络层错误
  if (e?.code === 'ERR_NETWORK' || e?.message?.includes('Network Error')) {
    return t(`${i18nKeyPrefix}.error_network`)
  }
  if (e?.code === 'ECONNABORTED' || e?.message?.includes('timeout')) {
    return t(`${i18nKeyPrefix}.error_timeout`)
  }

  // 2. 后端脱敏后的 data.error 消息（优先于通用 5xx）
  if (e?.response?.data?.error && typeof e.response.data.error === 'string') {
    return e.response.data.error
  }

  // 3. HTTP 状态码（兜底）
  if (e?.response?.status === 401) return t(`${i18nKeyPrefix}.error_unauthorized`)
  if (e?.response?.status === 403) return t(`${i18nKeyPrefix}.error_forbidden`)
  if (e?.response?.status && e.response.status >= 500) return t(`${i18nKeyPrefix}.error_server`)

  // 4. unknown
  return t(`${i18nKeyPrefix}.error_unknown`)
}

/**
 * 不依赖 i18n 的纯英文版错误分类（用于 server / 测试 / 非 i18n 上下文）
 */
export function classifyApiErrorPlain(error: unknown): string {
  const e = error as {
    code?: string
    message?: string
    response?: { status?: number; data?: { error?: string } }
  }

  if (e?.code === 'ERR_NETWORK' || e?.message?.includes('Network Error')) {
    return 'Network error, please check your connection'
  }
  if (e?.code === 'ECONNABORTED' || e?.message?.includes('timeout')) {
    return 'Request timeout, service may be slow'
  }
  if (e?.response?.data?.error && typeof e.response.data.error === 'string') {
    return e.response.data.error
  }
  if (e?.response?.status === 401) return 'Unauthorized or session expired'
  if (e?.response?.status === 403) return 'Insufficient permissions'
  if (e?.response?.status && e.response.status >= 500) return 'Server error, please retry later'
  return 'Unknown error'
}
