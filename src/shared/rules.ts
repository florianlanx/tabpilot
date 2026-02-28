import type { GroupCategory } from './types'

/**
 * Domain → Category mapping.
 * Exact hostname match (after removing www. prefix).
 */
export const DOMAIN_RULES: Record<string, GroupCategory> = {
  // --- Development ---
  'github.com': 'dev',
  'gitlab.com': 'dev',
  'bitbucket.org': 'dev',
  'stackoverflow.com': 'dev',
  'stackexchange.com': 'dev',
  'npmjs.com': 'dev',
  'pypi.org': 'dev',
  'crates.io': 'dev',
  'hub.docker.com': 'dev',
  'codepen.io': 'dev',
  'codesandbox.io': 'dev',
  'replit.com': 'dev',
  'vercel.com': 'dev',
  'netlify.com': 'dev',
  'heroku.com': 'dev',
  'railway.app': 'dev',
  'fly.io': 'dev',
  'render.com': 'dev',
  'cloudflare.com': 'dev',
  'aws.amazon.com': 'dev',
  'console.cloud.google.com': 'dev',
  'portal.azure.com': 'dev',
  'leetcode.com': 'dev',
  'hackerrank.com': 'dev',
  'codewars.com': 'dev',

  // --- Documentation ---
  'developer.mozilla.org': 'docs',
  'devdocs.io': 'docs',
  'docs.github.com': 'docs',
  'docs.google.com': 'docs',
  'notion.so': 'docs',
  'confluence.atlassian.com': 'docs',
  'readthedocs.io': 'docs',
  'gitbook.io': 'docs',
  'medium.com': 'docs',
  'dev.to': 'docs',
  'hashnode.dev': 'docs',
  'vuejs.org': 'docs',
  'react.dev': 'docs',
  'typescriptlang.org': 'docs',
  'tailwindcss.com': 'docs',
  'vitejs.dev': 'docs',

  // --- Work ---
  'mail.google.com': 'work',
  'outlook.office.com': 'work',
  'outlook.office365.com': 'work',
  'calendar.google.com': 'work',
  'meet.google.com': 'work',
  'zoom.us': 'work',
  'teams.microsoft.com': 'work',
  'slack.com': 'work',
  'app.slack.com': 'work',
  'trello.com': 'work',
  'asana.com': 'work',
  'linear.app': 'work',
  'jira.atlassian.com': 'work',
  'figma.com': 'work',
  'canva.com': 'work',
  'docs.qq.com': 'work',
  'wps.cn': 'work',
  'feishu.cn': 'work',
  'dingtalk.com': 'work',
  'wecom.work': 'work',

  // --- Social Media ---
  'twitter.com': 'social',
  'x.com': 'social',
  'facebook.com': 'social',
  'instagram.com': 'social',
  'linkedin.com': 'social',
  'reddit.com': 'social',
  'discord.com': 'social',
  'telegram.org': 'social',
  'web.telegram.org': 'social',
  'weibo.com': 'social',
  's.weibo.com': 'social',
  'zhihu.com': 'social',
  'xiaohongshu.com': 'social',
  'douban.com': 'social',
  'tieba.baidu.com': 'social',
  'v2ex.com': 'social',
  'threads.net': 'social',

  // --- Entertainment / Media ---
  'youtube.com': 'media',
  'netflix.com': 'media',
  'bilibili.com': 'media',
  'twitch.tv': 'media',
  'spotify.com': 'media',
  'music.apple.com': 'media',
  'music.163.com': 'media',
  'y.qq.com': 'media',
  'iqiyi.com': 'media',
  'v.qq.com': 'media',
  'youku.com': 'media',
  'disneyplus.com': 'media',
  'hbomax.com': 'media',
  'primevideo.com': 'media',
  'tiktok.com': 'media',
  'douyin.com': 'media',
  'vimeo.com': 'media',

  // --- Shopping ---
  'amazon.com': 'shop',
  'amazon.cn': 'shop',
  'ebay.com': 'shop',
  'etsy.com': 'shop',
  'taobao.com': 'shop',
  'tmall.com': 'shop',
  'jd.com': 'shop',
  'pinduoduo.com': 'shop',
  'shopee.com': 'shop',
  'lazada.com': 'shop',
  'walmart.com': 'shop',
  'target.com': 'shop',
  'bestbuy.com': 'shop',
  'newegg.com': 'shop',
  'suning.com': 'shop',
  'dangdang.com': 'shop',

  // --- Learning ---
  'coursera.org': 'learn',
  'udemy.com': 'learn',
  'edx.org': 'learn',
  'khanacademy.org': 'learn',
  'pluralsight.com': 'learn',
  'codecademy.com': 'learn',
  'freecodecamp.org': 'learn',
  'egghead.io': 'learn',
  'frontendmasters.com': 'learn',
  'skillshare.com': 'learn',
  'mooc.cn': 'learn',
  'icourse163.org': 'learn',
  'xuetangx.com': 'learn',
  'wikipedia.org': 'learn',
  'en.wikipedia.org': 'learn',
  'zh.wikipedia.org': 'learn',
  'scholar.google.com': 'learn',
  'arxiv.org': 'learn',
  'chatgpt.com': 'learn',
  'chat.openai.com': 'learn',
  'claude.ai': 'learn',
  'poe.com': 'learn',
  'huggingface.co': 'learn',
}

/**
 * Keyword → Category mapping.
 * Matched against tab title (case-insensitive).
 * Order matters: first match wins.
 */
export interface KeywordRule {
  pattern: RegExp
  category: GroupCategory
}

export const KEYWORD_RULES: KeywordRule[] = [
  // Development keywords
  { pattern: /\b(pull request|merge request|commit|branch|deploy|CI\/CD|pipeline|build)\b/i, category: 'dev' },
  { pattern: /\b(API|SDK|npm|yarn|pnpm|webpack|vite|eslint|prettier)\b/i, category: 'dev' },
  { pattern: /\b(bug|issue|debug|error|fix|patch|hotfix)\b/i, category: 'dev' },
  { pattern: /\bgit(hub|lab)?\b/i, category: 'dev' },

  // Documentation keywords
  { pattern: /\b(documentation|docs|reference|guide|manual|handbook)\b/i, category: 'docs' },
  { pattern: /\b(tutorial|how[\s-]to|getting[\s-]started|quickstart)\b/i, category: 'docs' },
  { pattern: /(文档|手册|指南|教程|参考)/, category: 'docs' },

  // Work keywords
  { pattern: /\b(meeting|agenda|standup|sprint|roadmap|OKR|KPI)\b/i, category: 'work' },
  { pattern: /\b(invoice|report|presentation|proposal|contract)\b/i, category: 'work' },
  { pattern: /(会议|日报|周报|汇报|需求|排期)/, category: 'work' },

  // Learning keywords
  { pattern: /\b(course|lesson|lecture|workshop|bootcamp|certification)\b/i, category: 'learn' },
  { pattern: /\b(learn|study|training|exam|quiz)\b/i, category: 'learn' },
  { pattern: /(课程|学习|培训|考试|教学)/, category: 'learn' },

  // Shopping keywords
  { pattern: /\b(cart|checkout|order|shipping|delivery|payment|price|discount|coupon)\b/i, category: 'shop' },
  { pattern: /(购物车|下单|付款|发货|优惠|折扣|比价)/, category: 'shop' },
  { pattern: /\$\d+|\¥\d+|USD|CNY|€\d+/i, category: 'shop' },

  // Entertainment keywords
  { pattern: /\b(watch|stream|playlist|episode|season|movie|film|music|song|album)\b/i, category: 'media' },
  { pattern: /\b(game|gaming|play|esports)\b/i, category: 'media' },
  { pattern: /(视频|电影|音乐|直播|动漫|综艺|游戏)/, category: 'media' },

  // Social keywords
  { pattern: /\b(feed|timeline|post|tweet|comment|follow|like|share|profile)\b/i, category: 'social' },
  { pattern: /\b(chat|message|DM)\b|群聊|朋友圈|动态/i, category: 'social' },
]
