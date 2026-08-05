/**
 * Logger output tests.
 *
 * Verifies the JSON-line contract: each emit produces a single newline-
 * terminated JSON object with level/time/msg/ctx fields, and Error
 * instances are flattened into a serializable shape.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { logger } from '../logger'

describe('logger', () => {
  let stdoutWrites: string[]
  let stderrWrites: string[]
  let originalStdout: typeof process.stdout.write
  let originalStderr: typeof process.stderr.write

  beforeEach(() => {
    stdoutWrites = []
    stderrWrites = []
    originalStdout = process.stdout.write
    originalStderr = process.stderr.write
    process.stdout.write = ((chunk: string | Uint8Array) => {
      stdoutWrites.push(typeof chunk === 'string' ? chunk : chunk.toString())
      return true
    }) as typeof process.stdout.write
    process.stderr.write = ((chunk: string | Uint8Array) => {
      stderrWrites.push(typeof chunk === 'string' ? chunk : chunk.toString())
      return true
    }) as typeof process.stderr.write
  })

  afterEach(() => {
    process.stdout.write = originalStdout
    process.stderr.write = originalStderr
  })

  it('emits one JSON line per call, ending in newline', () => {
    logger.info('hello world', { userId: 'u1' })
    expect(stdoutWrites).toHaveLength(1)
    const line = stdoutWrites[0]
    expect(line.endsWith('\n')).toBe(true)
    const parsed = JSON.parse(line.trim())
    expect(parsed.level).toBe('info')
    expect(parsed.msg).toBe('hello world')
    expect(parsed.userId).toBe('u1')
    expect(typeof parsed.time).toBe('string')
  })

  it('routes errors to stderr, everything else to stdout', () => {
    logger.info('info-msg')
    logger.warn('warn-msg')
    logger.error('error-msg')
    logger.debug('debug-msg')

    expect(stdoutWrites.map((s) => JSON.parse(s.trim()).msg)).toEqual(['info-msg', 'debug-msg'])
    expect(stderrWrites.map((s) => JSON.parse(s.trim()).msg)).toEqual(['warn-msg', 'error-msg'])
  })

  it('serializes Error instances via the `err` key', () => {
    const err = new Error('boom')
    logger.error('AI call failed', { err })
    const parsed = JSON.parse(stderrWrites[0].trim())
    expect(parsed.err).toMatchObject({
      name: 'Error',
      message: 'boom',
    })
    expect(typeof parsed.err.stack).toBe('string')
  })

  it('survives circular references in context', () => {
    const circular: Record<string, unknown> = { name: 'c' }
    circular.self = circular
    expect(() => logger.info('circular test', { ctx: circular })).not.toThrow()
    const parsed = JSON.parse(stdoutWrites[0].trim())
    expect(parsed.ctx).toBe('[unserializable]')
  })
})
