<p align="center">
  <img src="public/icons/icon-128.png" width="80" height="80" alt="TabPilot logo" />
</p>

<h1 align="center">TabPilot</h1>

<p align="center">
  <strong>标签页自动驾驶仪。</strong><br/>
  智能分组 · 即时搜索 · 可选 AI · 100% 隐私
</p>

<p align="center">
  <a href="https://github.com/florianlanx/tabpilot/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT License" /></a>
  <img src="https://img.shields.io/badge/manifest-v3-green.svg" alt="Manifest V3" />
  <img src="https://img.shields.io/badge/chrome-extension-yellow.svg" alt="Chrome Extension" />
  <img src="https://img.shields.io/badge/vue-3-brightgreen.svg" alt="Vue 3" />
  <img src="https://img.shields.io/badge/typescript-5-blue.svg" alt="TypeScript" />
</p>

<p align="center">
  <a href="#功能特性">功能特性</a> ·
  <a href="#安装">安装</a> ·
  <a href="#为什么选择-tabpilot">为什么选择 TabPilot</a> ·
  <a href="#开发">开发</a> ·
  <a href="#贡献">贡献</a>
</p>

<p align="center">
  <a href="README.md">🇬🇧 English</a>
</p>

---

## 功能特性

### 一键智能分组

单击即可将所有标签页整理为 Chrome 标签组。TabPilot 使用**内置规则引擎**，包含 155+ 域名规则和 20+ 关键词模式 — 无需 API 密钥。

<!-- TODO: 录制后替换为实际 GIF -->
<!-- ![智能分组演示](docs/assets/demo-grouping.gif) -->

### 闪电搜索

按 `Ctrl+Shift+F` 打开 Spotlight 风格的搜索浮层。跨**所有打开的标签和最近关闭的标签**搜索，支持模糊匹配、关键词高亮和相关性排序。

<!-- ![搜索演示](docs/assets/demo-search.gif) -->

### 可选 AI 增强

使用自己的 API 密钥将分类准确率从 ~75% 提升到 ~95%。TabPilot 支持 **4 种 AI 供应商**：

| 供应商 | 模型 |
|--------|------|
| OpenAI | gpt-4o-mini |
| Claude | claude-sonnet-4-20250514 |
| Gemini | gemini-2.5-flash |
| 自定义 | 任何 OpenAI 兼容端点（如 DeepSeek、Ollama、Groq） |

两种 AI 模式：
- **增强模式** — AI 仅处理规则引擎无法分类的标签
- **自由分组模式** — AI 动态创建自定义分组名称和颜色

### 新标签自动归类

AI 分组后，新打开的标签自动收集到"New Tabs"组。一键用 AI 将它们分到已有分组中。

### 隐私优先

- 所有数据通过 `chrome.storage.local` 存储在本地
- API 密钥仅发送到你选择的 AI 供应商
- 无账号、无追踪、无分析
- 完全开源 — 你可以自行审计代码

### 双语支持

完整的英文和简体中文支持，自动匹配你的 Chrome 语言设置。

## 安装

### 从 Chrome Web Store 安装

*（即将上架）*

### 从 GitHub Releases 下载（推荐）

1. 前往 [Releases](https://github.com/florianlanx/tabpilot/releases) 页面，下载最新的 `tabpilot-vX.X.X.zip`
2. 解压到一个文件夹
3. 打开 `chrome://extensions`，开启右上角的**开发者模式**
4. 点击**加载已解压的扩展程序**，选择解压后的文件夹
5. 完成！将 TabPilot 固定到工具栏方便使用

### 从源码构建

<details>
<summary>适合想要自行构建的开发者</summary>

```bash
git clone https://github.com/florianlanx/tabpilot.git
cd tabpilot
pnpm install
pnpm build
```

然后在 `chrome://extensions` 中加载 `dist/` 目录（需开启开发者模式）。

</details>

## 为什么选择 TabPilot

每个重度浏览器用户都有标签页焦虑。开发者尤其严重 — GitHub PR、Stack Overflow、文档、Jira、Slack 全混在一起。Chrome 原生标签组需要手动拖拽，没人会真的去做。

**现有方案都有痛点：**

| 类别 | 代表产品 | 问题 |
|------|---------|------|
| 标签保存类 | OneTab | 把标签收成列表 — 破坏性，无智能分类 |
| 工作区类 | Workona, Partizion | 需要提前手动设置工作区 |
| AI 驱动类 | AI Tab Master, Tabaroo | 必须有 API Key，没 Key 完全不能用 |
| 域名分组类 | Tabblar | 按网站分组，缺少上下文（GitHub PR ≠ GitHub 个人主页） |

**TabPilot 的方案：渐进增强。**

1. **Level 0（零配置）** — 规则引擎覆盖 155+ 域名和 20+ 关键词，约 75% 准确率
2. **Level 1（配置 API Key）** — AI 增强剩余 25%，准确率提升到 ~95%
3. **Level 2（AI 自由分组）** — AI 完全自定义分组名称和颜色

最好的标签管理器应该**零配置即可用**，然后用 AI 逐步增强。

## 技术栈

| 层级 | 技术 |
|------|------|
| 语言 | TypeScript |
| UI | Vue 3 + Composition API |
| 构建 | Vite + CRXJS |
| 样式 | Tailwind CSS |
| 扩展 | Manifest V3 |
| 测试 | Vitest |

## 项目结构

```
src/
├── background/     # Service Worker：分类器、标签管理、搜索、存储
├── popup/          # Popup UI（分组预览 + 操作）
├── content/        # Spotlight 搜索浮层
├── shared/         # 类型、常量、规则、AI 客户端、国际化、工具函数
└── styles/         # 全局 CSS（Tailwind）
```

## 开发

```bash
pnpm install          # 安装依赖
pnpm dev              # 开发服务器（HMR 热重载）
pnpm build            # 生产构建
pnpm test             # 运行测试
pnpm typecheck        # 类型检查
```

## 贡献

欢迎贡献！请参阅 [CONTRIBUTING.md](CONTRIBUTING.md) 了解贡献指南。

## 支持

如果 TabPilot 对你有帮助，欢迎：

- 在 GitHub 上 Star 这个项目
- 分享给你的朋友

## 许可证

[MIT](LICENSE) © Florian
