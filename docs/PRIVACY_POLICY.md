# Privacy Policy for TabPilot

**Last Updated:** 2026-02-26

## Overview

TabPilot is a Chrome browser extension that helps users organize and search their browser tabs using rule-based and AI-powered classification. We are committed to protecting your privacy.

## Data Collection

### What We Collect
- **Tab metadata only:** Tab titles and URLs are processed locally on your device for classification and search purposes.
- **Tab visit history:** Stored locally in `chrome.storage.local` (up to 500 recent entries) to enable searching recently closed tabs.

### What We Do NOT Collect
- We do **not** collect, store, or transmit any personal information.
- We do **not** track browsing behavior beyond what is needed for tab management.
- We do **not** use analytics, tracking pixels, or any third-party tracking services.
- We do **not** sell, share, or monetize any user data.

## AI Feature (Optional)

If you choose to enable the optional AI-enhanced classification:
- Your API key is stored locally in `chrome.storage.local` on your device.
- Tab titles and URLs are sent to the AI provider you configure (OpenAI, Anthropic, or custom endpoint) **only when you explicitly trigger classification**.
- We do **not** proxy or intercept these requests. They go directly from your browser to the AI provider.
- You are responsible for your relationship with the AI provider and their privacy policy.

## Data Storage

- All data is stored locally on your device using Chrome's `chrome.storage.local` API.
- No data is stored on external servers.
- Uninstalling the extension removes all stored data.

## Permissions

| Permission | Purpose |
|-----------|---------|
| `tabs` | Read tab titles and URLs for classification and search |
| `tabGroups` | Create and manage Chrome Tab Groups |
| `storage` | Store settings and tab history locally |
| `sidePanel` | Display the search interface in Chrome's side panel |

## Third-Party Services

This extension does not use any third-party services by default. If you enable the optional AI feature, data is sent to the AI provider of your choice (OpenAI, Anthropic, or a custom endpoint).

## Children's Privacy

This extension is not directed at children under the age of 13 and does not knowingly collect information from children.

## Changes to This Policy

We may update this privacy policy from time to time. Changes will be noted in the extension's changelog.

## Contact

If you have questions about this privacy policy, please open an issue on our GitHub repository.

---

*This privacy policy applies to TabPilot version 1.0.0 and later.*
