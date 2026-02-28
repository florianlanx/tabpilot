export function getMessage(key: string): string {
  return chrome.i18n.getMessage(key) || key
}

export function getUILanguage(): string {
  return chrome.i18n.getUILanguage()
}
