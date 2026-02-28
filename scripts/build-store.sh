#!/bin/bash
# Build and package the extension for Chrome Web Store submission

set -e

echo "🔨 Building extension..."
pnpm build

echo "📦 Packaging for Chrome Web Store..."
cd dist
zip -r ../tabpilot.zip . -x "*.DS_Store" ".vite/*"
cd ..

SIZE=$(du -h tabpilot.zip | cut -f1)
echo "✅ Package created: tabpilot.zip ($SIZE)"
echo ""
echo "Next steps:"
echo "  1. Go to https://chrome.google.com/webstore/devconsole"
echo "  2. Click 'New Item' → Upload tabpilot.zip"
echo "  3. Fill in listing details from docs/STORE_LISTING.md"
echo "  4. Upload screenshots and promotional images"
echo "  5. Submit for review"
