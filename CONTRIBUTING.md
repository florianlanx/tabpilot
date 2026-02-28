# Contributing to TabPilot

Thank you for your interest in contributing to TabPilot! This guide will help you get started.

[🇨🇳 简体中文](#贡献指南)

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [pnpm](https://pnpm.io/) 10+
- Chrome browser

### Setup

```bash
git clone https://github.com/florianlanx/tabpilot.git
cd tabpilot
pnpm install
pnpm dev
```

Load `dist/` as an unpacked extension in `chrome://extensions` (enable Developer Mode).

## How to Contribute

### Reporting Bugs

Use the [Bug Report](https://github.com/florianlanx/tabpilot/issues/new?template=bug_report.yml) template. Include:
- Chrome version and OS
- Steps to reproduce
- Expected vs actual behavior

### Suggesting Features

Use the [Feature Request](https://github.com/florianlanx/tabpilot/issues/new?template=feature_request.yml) template.

### Pull Requests

1. Fork the repo and create a branch from `main`:
   - `feat/your-feature` for new features
   - `fix/issue-description` for bug fixes
   - `docs/what-changed` for documentation
2. Make your changes
3. Ensure the build passes: `pnpm build && pnpm test && pnpm typecheck`
4. Submit a PR with a clear description

## Commit Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add tab deduplication
fix: preserve groups across service worker restart
refactor: extract cache logic into separate module
docs: update AI provider setup guide
```

## Code Standards

- **TypeScript strict mode** — no `any` unless unavoidable (add comment explaining why)
- **Naming**: files `kebab-case.ts`, types `PascalCase`, variables `camelCase`, constants `UPPER_SNAKE_CASE`
- **Vue**: extract complex template expressions into `computed`, avoid nested ternaries
- **Functions**: keep them short and focused (~40 lines max), single responsibility
- **No dead code**: remove unused imports, variables, and functions before committing

## Project Architecture

```
src/
├── background/     # Service worker (runs in background)
│   ├── classifier  # Rule engine + AI classification
│   ├── tab-manager # Chrome Tab Groups API operations
│   ├── searcher    # Tab search with relevance scoring
│   └── storage     # Local tab history
├── popup/          # Extension popup (Vue 3)
├── content/        # Spotlight search overlay (injected into pages)
├── shared/         # Shared code
│   ├── rules       # 155+ domain rules, 20+ keyword patterns
│   ├── ai-client   # Multi-provider AI client (OpenAI, Claude, Gemini, Custom)
│   ├── types       # TypeScript type definitions
│   └── i18n        # Internationalization (EN, ZH_CN)
└── styles/         # Tailwind CSS
```

## Development Commands

```bash
pnpm dev          # Dev server with HMR
pnpm build        # Production build
pnpm test         # Run tests
pnpm typecheck    # Type check
```

---

<h1 id="贡献指南">贡献指南</h1>

感谢你对 TabPilot 的关注！以下是贡献指南。

## 开始

### 环境要求

- [Node.js](https://nodejs.org/) 20+
- [pnpm](https://pnpm.io/) 10+
- Chrome 浏览器

### 本地开发

```bash
git clone https://github.com/florianlanx/tabpilot.git
cd tabpilot
pnpm install
pnpm dev
```

在 `chrome://extensions` 中加载 `dist/` 目录（需开启开发者模式）。

## 如何贡献

### 报告 Bug

使用 [Bug 报告](https://github.com/florianlanx/tabpilot/issues/new?template=bug_report.yml) 模板，请提供：
- Chrome 版本和操作系统
- 复现步骤
- 期望行为 vs 实际行为

### 功能建议

使用 [功能请求](https://github.com/florianlanx/tabpilot/issues/new?template=feature_request.yml) 模板。

### 提交 PR

1. Fork 仓库并从 `main` 创建分支：
   - `feat/功能描述` 新功能
   - `fix/问题描述` Bug 修复
   - `docs/改动内容` 文档更新
2. 完成修改
3. 确保构建通过：`pnpm build && pnpm test && pnpm typecheck`
4. 提交 PR 并附上清晰的描述

## 提交规范

遵循 [Conventional Commits](https://www.conventionalcommits.org/)：

```
feat: 添加标签去重功能
fix: 修复 service worker 重启后分组丢失
refactor: 提取缓存逻辑到独立模块
docs: 更新 AI 供应商配置指南
```

## 代码规范

- **TypeScript 严格模式** — 除非不可避免，否则不使用 `any`（需添加注释说明原因）
- **命名**：文件 `kebab-case.ts`，类型 `PascalCase`，变量 `camelCase`，常量 `UPPER_SNAKE_CASE`
- **Vue**：复杂模板表达式提取为 `computed`，避免嵌套三元运算符
- **函数**：保持简短聚焦（约 40 行以内），单一职责
- **无死代码**：提交前删除未使用的导入、变量和函数
