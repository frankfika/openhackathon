/**
 * Minimal structured logger for the API.
 *
 * Why not pino / winston: this app is a single Node process and the deployment
 * target is a container whose stdout is harvested by the platform log driver
 * (Render / Docker / systemd). A zero-dep JSON-line logger covers the same
 * ground without pulling in pino (~3MB) or winston. Future migration path
 * stays open: any pino-compatible aggregator can ingest this format.
 *
 * Usage:
 *   import { logger } from '../logger'
 *   logger.error({ err, userId }, 'AI call failed')
 *
 * Conventions:
 *   - Always pass an object as the first arg (ctx) for grep-ability.
 *   - Pass the error as `err` so the serializer can extract message + stack.
 *   - Never log raw user input or JWT tokens; sanitize at the call site.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

type LogContext = Record<string, unknown>

function serializeErr(value: unknown): unknown {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    }
  }
  return value
}

function formatLine(level: LogLevel, msg: string, ctx?: LogContext): string {
  const merged: LogContext = {
    level,
    time: new Date().toISOString(),
    msg,
    ...ctx,
  }
  // Serialize Error objects so JSON.stringify doesn't drop them
  if (merged.err !== undefined) {
    merged.err = serializeErr(merged.err)
  }
  try {
    return JSON.stringify(merged)
  } catch {
    // Circular reference or BigInt — fall back to a safe shape
    return JSON.stringify({
      level,
      time: new Date().toISOString(),
      msg,
      ctx: '[unserializable]',
    })
  }
}

function emit(level: LogLevel, msg: string, ctx?: LogContext): void {
  const line = formatLine(level, msg, ctx)
  // Errors go to stderr, everything else to stdout
  if (level === 'error' || level === 'warn') {
    process.stderr.write(line + '\n')
  } else {
    process.stdout.write(line + '\n')
  }
}

export const logger = {
  debug: (msg: string, ctx?: LogContext) => emit('debug', msg, ctx),
  info: (msg: string, ctx?: LogContext) => emit('info', msg, ctx),
  warn: (msg: string, ctx?: LogContext) => emit('warn', msg, ctx),
  error: (msg: string, ctx?: LogContext) => emit('error', msg, ctx),
}
