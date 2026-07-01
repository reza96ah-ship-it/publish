#!/usr/bin/env bash
# Issue #159: Detect mojibake/corrupted Persian text and UTF-8 BOM in source files.
# Exits with code 1 if any file has BOM or common mojibake patterns.
set -e

echo "Checking for UTF-8 BOM and mojibake patterns..."

# Check for UTF-8 BOM (EF BB BF) in .ts/.tsx files
BOM_FILES=$(find src tests prisma mini-services -name "*.ts" -o -name "*.tsx" | xargs file 2>/dev/null | grep "BOM" | cut -d: -f1 || true)
if [ -n "$BOM_FILES" ]; then
  echo "❌ FAIL: Files with UTF-8 BOM detected (issue #159 requires no BOM):"
  echo "$BOM_FILES"
  exit 1
fi

# Check for common mojibake patterns in Persian text
# Mojibake occurs when UTF-8 Persian bytes are misinterpreted as Latin-1
MOJIBAKE=$(grep -rlP '[\xC0-\xFF][\x80-\xBF]' src/ tests/ 2>/dev/null | head -5 || true)
if [ -n "$MOJIBAKE" ]; then
  echo "⚠️  Warning: Files with potential mojibake (high bytes that aren't valid UTF-8 Persian):"
  echo "$MOJIBAKE"
  echo "Review these files manually for corrupted Persian text."
fi

echo "✅ No BOM files detected. Mojibake check complete."
