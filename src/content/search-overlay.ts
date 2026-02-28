import cssText from './search-overlay.css?inline'

interface SearchResultItem {
  tab: {
    id?: number
    url: string
    title: string
    favIconUrl?: string
    lastAccessed?: number
  }
  score: number
  isOpen: boolean
}

// Guard against multiple injections
if (!(window as unknown as Record<string, boolean>).__ATM_SEARCH_LOADED__) {
  ;(window as unknown as Record<string, boolean>).__ATM_SEARCH_LOADED__ = true

  let hostEl: HTMLDivElement | null = null
  let shadow: ShadowRoot | null = null
  let visible = false
  let selectedIndex = 0
  let results: SearchResultItem[] = []
  let debounceTimer: ReturnType<typeof setTimeout> | undefined

  function init() {
    if (hostEl) return

    hostEl = document.createElement('div')
    hostEl.id = 'atm-search-host'
    hostEl.style.display = 'none'
    shadow = hostEl.attachShadow({ mode: 'closed' })

    const style = document.createElement('style')
    style.textContent = cssText
    shadow.appendChild(style)

    const backdrop = document.createElement('div')
    backdrop.className = 'atm-backdrop'
    backdrop.addEventListener('click', hide)

    const container = document.createElement('div')
    container.className = 'atm-container'
    container.addEventListener('click', (e) => e.stopPropagation())

    const inputWrap = document.createElement('div')
    inputWrap.className = 'atm-input-wrap'

    const searchIcon = document.createElement('div')
    searchIcon.className = 'atm-search-icon'
    searchIcon.innerHTML = '<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clip-rule="evenodd" /></svg>'

    const input = document.createElement('input')
    input.className = 'atm-input'
    input.type = 'text'
    input.placeholder = 'Search tabs...'
    input.addEventListener('input', () => {
      clearTimeout(debounceTimer)
      const query = input.value.trim()
      if (!query) {
        results = []
        renderResults(resultsList, query)
        return
      }
      debounceTimer = setTimeout(() => {
        doSearch(query, resultsList)
      }, 150)
    })
    input.addEventListener('keydown', (e) => {
      handleKeydown(e, input, resultsList)
    })

    const shortcut = document.createElement('span')
    shortcut.className = 'atm-shortcut'
    shortcut.textContent = 'ESC'

    inputWrap.appendChild(searchIcon)
    inputWrap.appendChild(input)
    inputWrap.appendChild(shortcut)

    const resultsList = document.createElement('div')
    resultsList.className = 'atm-results'

    const footer = document.createElement('div')
    footer.className = 'atm-footer'
    footer.innerHTML = '<kbd>↑↓</kbd> navigate <kbd>↵</kbd> open <kbd>esc</kbd> close'

    container.appendChild(inputWrap)
    container.appendChild(resultsList)
    container.appendChild(footer)

    backdrop.appendChild(container)
    shadow.appendChild(backdrop)

    document.documentElement.appendChild(hostEl)
  }

  function syncThemeAttribute() {
    if (!hostEl) return
    try {
      const raw = localStorage.getItem('atm_theme')
      const mode = raw || 'system'
      if (mode === 'dark') {
        hostEl.setAttribute('data-theme', 'dark')
      } else if (mode === 'light') {
        hostEl.setAttribute('data-theme', 'light')
      } else {
        hostEl.removeAttribute('data-theme')
      }
    } catch { /* ignore */ }
  }

  function show() {
    init()
    if (!hostEl || !shadow) return
    visible = true
    hostEl.style.display = 'block'
    syncThemeAttribute()
    results = []
    selectedIndex = 0
    const input = shadow.querySelector('.atm-input') as HTMLInputElement
    if (input) {
      input.value = ''
      setTimeout(() => input.focus(), 0)
    }
    const resultsList = shadow.querySelector('.atm-results') as HTMLDivElement
    if (resultsList) resultsList.innerHTML = ''
  }

  function hide() {
    if (!hostEl) return
    visible = false
    hostEl.style.display = 'none'
    clearTimeout(debounceTimer)
  }

  function toggle() {
    if (visible) {
      hide()
    } else {
      show()
    }
  }

  async function doSearch(query: string, resultsList: HTMLDivElement) {
    try {
      const res = await chrome.runtime.sendMessage({
        action: 'SEARCH_TABS',
        payload: { query },
      })
      if (Array.isArray(res)) {
        results = res
        selectedIndex = 0
        renderResults(resultsList, query)
      }
    } catch (err) {
      console.error('[TabPilot] Search failed:', err)
    }
  }

  function renderResults(resultsList: HTMLDivElement, query: string) {
    resultsList.innerHTML = ''

    if (results.length === 0 && query) {
      const empty = document.createElement('div')
      empty.className = 'atm-empty'
      empty.textContent = 'No matching tabs'
      resultsList.appendChild(empty)
      return
    }

    results.forEach((result, index) => {
      const item = document.createElement('div')
      item.className = 'atm-result-item' + (index === selectedIndex ? ' atm-selected' : '')
      item.addEventListener('click', () => activateResult(result))
      item.addEventListener('mouseenter', () => {
        selectedIndex = index
        updateSelection(resultsList)
      })

      if (result.tab.favIconUrl) {
        const favicon = document.createElement('img')
        favicon.className = 'atm-favicon'
        favicon.src = result.tab.favIconUrl
        favicon.alt = ''
        favicon.addEventListener('error', () => {
          favicon.replaceWith(createFaviconPlaceholder())
        })
        item.appendChild(favicon)
      } else {
        item.appendChild(createFaviconPlaceholder())
      }

      const content = document.createElement('div')
      content.className = 'atm-result-content'

      const title = document.createElement('div')
      title.className = 'atm-result-title'
      title.innerHTML = highlightText(result.tab.title || 'Untitled', query)

      const url = document.createElement('div')
      url.className = 'atm-result-url'
      url.innerHTML = highlightText(formatUrl(result.tab.url), query)

      content.appendChild(title)
      content.appendChild(url)
      item.appendChild(content)

      const badge = document.createElement('span')
      badge.className = 'atm-badge'
      if (result.isOpen) {
        badge.classList.add('atm-badge-open')
        badge.textContent = 'OPEN'
      } else {
        badge.classList.add('atm-badge-history')
        badge.textContent = formatTime(result.tab.lastAccessed)
      }
      item.appendChild(badge)

      resultsList.appendChild(item)
    })
  }

  function createFaviconPlaceholder(): HTMLSpanElement {
    const span = document.createElement('span')
    span.className = 'atm-favicon-placeholder'
    return span
  }

  function updateSelection(resultsList: HTMLDivElement) {
    const items = resultsList.querySelectorAll('.atm-result-item')
    items.forEach((item, i) => {
      item.classList.toggle('atm-selected', i === selectedIndex)
    })
    items[selectedIndex]?.scrollIntoView({ block: 'nearest' })
  }

  function handleKeydown(e: KeyboardEvent, _input: HTMLInputElement, resultsList: HTMLDivElement) {
    e.stopPropagation()

    if (e.key === 'Escape') {
      e.preventDefault()
      hide()
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (results.length > 0) {
        selectedIndex = (selectedIndex + 1) % results.length
        updateSelection(resultsList)
      }
      return
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (results.length > 0) {
        selectedIndex = (selectedIndex - 1 + results.length) % results.length
        updateSelection(resultsList)
      }
      return
    }

    if (e.key === 'Enter') {
      e.preventDefault()
      if (results[selectedIndex]) {
        activateResult(results[selectedIndex])
      }
      return
    }
  }

  function activateResult(result: SearchResultItem) {
    if (result.isOpen && result.tab.id) {
      chrome.runtime.sendMessage({
        action: 'SWITCH_TAB',
        payload: { tabId: result.tab.id },
      })
    } else {
      chrome.runtime.sendMessage({
        action: 'OPEN_URL',
        payload: { url: result.tab.url },
      })
    }
    hide()
  }

  function highlightText(text: string, query: string): string {
    if (!query || !text) return escapeHtml(text)
    const terms = query.split(/\s+/).filter(Boolean)
    let result = escapeHtml(text)
    for (const term of terms) {
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const regex = new RegExp(`(${escaped})`, 'gi')
      result = result.replace(regex, '<span class="atm-highlight">$1</span>')
    }
    return result
  }

  function escapeHtml(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }

  function formatUrl(url: string): string {
    try {
      const parsed = new URL(url)
      return parsed.hostname + (parsed.pathname !== '/' ? parsed.pathname : '')
    } catch {
      return url
    }
  }

  function formatTime(ts: number | undefined): string {
    if (!ts) return ''
    const diff = Date.now() - ts
    const minutes = Math.floor(diff / 60000)
    if (minutes < 1) return 'just now'
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }

  // Expose toggle function globally so background can call it via executeScript
  ;(window as unknown as Record<string, () => void>).__ATM_TOGGLE_SEARCH__ = toggle

  // Also listen for messages (for tabs.sendMessage from background)
  chrome.runtime.onMessage.addListener((message) => {
    if (message?.action === 'TOGGLE_SEARCH_OVERLAY') {
      toggle()
    }
  })
}
