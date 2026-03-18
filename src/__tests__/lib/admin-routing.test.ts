import { describe, expect, it } from 'vitest'
import { buildAdminPath, normalizeAdminBasePath } from '@/lib/admin-routing'

describe('admin routing helpers', () => {
  it('normalizes admin base paths', () => {
    expect(normalizeAdminBasePath()).toBe('/admin')
    expect(normalizeAdminBasePath('admin')).toBe('/admin')
    expect(normalizeAdminBasePath('/secret/')).toBe('/secret')
    expect(normalizeAdminBasePath('//ops//console//')).toBe('/ops/console')
    expect(normalizeAdminBasePath('/')).toBe('/admin')
  })

  it('builds child paths from the normalized admin base path', () => {
    expect(buildAdminPath('/admin', 'projects')).toBe('/admin/projects')
    expect(buildAdminPath('/secret/', '/settings')).toBe('/secret/settings')
  })
})
