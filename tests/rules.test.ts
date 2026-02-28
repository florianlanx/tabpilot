import { describe, it, expect } from 'vitest'
import { extractDomain } from '../src/shared/utils'
import { DOMAIN_RULES, KEYWORD_RULES } from '../src/shared/rules'

describe('extractDomain', () => {
  it('extracts domain from standard URLs', () => {
    expect(extractDomain('https://github.com/user/repo')).toBe('github.com')
    expect(extractDomain('https://www.youtube.com/watch?v=123')).toBe('youtube.com')
    expect(extractDomain('https://docs.google.com/document/d/1')).toBe('docs.google.com')
  })

  it('removes www prefix', () => {
    expect(extractDomain('https://www.amazon.com/dp/123')).toBe('amazon.com')
  })

  it('handles empty/invalid URLs', () => {
    expect(extractDomain('')).toBe('')
    expect(extractDomain(undefined)).toBe('')
    expect(extractDomain('not-a-url')).toBe('')
  })
})

describe('DOMAIN_RULES', () => {
  it('has entries for major categories', () => {
    expect(DOMAIN_RULES['github.com']).toBe('dev')
    expect(DOMAIN_RULES['youtube.com']).toBe('media')
    expect(DOMAIN_RULES['amazon.com']).toBe('shop')
    expect(DOMAIN_RULES['coursera.org']).toBe('learn')
    expect(DOMAIN_RULES['twitter.com']).toBe('social')
    expect(DOMAIN_RULES['mail.google.com']).toBe('work')
    expect(DOMAIN_RULES['developer.mozilla.org']).toBe('docs')
  })

  it('covers Chinese platforms', () => {
    expect(DOMAIN_RULES['bilibili.com']).toBe('media')
    expect(DOMAIN_RULES['taobao.com']).toBe('shop')
    expect(DOMAIN_RULES['zhihu.com']).toBe('social')
    expect(DOMAIN_RULES['feishu.cn']).toBe('work')
  })

  it('has at least 50 domain entries', () => {
    expect(Object.keys(DOMAIN_RULES).length).toBeGreaterThanOrEqual(50)
  })
})

describe('KEYWORD_RULES', () => {
  it('matches development keywords', () => {
    const devRule = KEYWORD_RULES.find(
      (r) => r.category === 'dev' && r.pattern.test('Fix pull request #42'),
    )
    expect(devRule).toBeTruthy()
  })

  it('matches Chinese keywords', () => {
    const shopRule = KEYWORD_RULES.find(
      (r) => r.category === 'shop' && r.pattern.test('购物车 - 淘宝'),
    )
    expect(shopRule).toBeTruthy()
  })

  it('matches learning keywords', () => {
    const learnRule = KEYWORD_RULES.find(
      (r) => r.category === 'learn' && r.pattern.test('Machine Learning Course'),
    )
    expect(learnRule).toBeTruthy()
  })

  it('is case insensitive', () => {
    const rule = KEYWORD_RULES.find(
      (r) => r.category === 'dev' && r.pattern.test('PULL REQUEST review'),
    )
    expect(rule).toBeTruthy()
  })
})
