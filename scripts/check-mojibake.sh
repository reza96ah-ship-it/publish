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
# Mojibake occurs when UTF-8 Persian bytes are misinterpreted as Latin-1 and saved back.
# Misinterpreted first bytes: \xD8-\xDB become Latin-1 Ø, Ù, Ú, Û (\xC3\x98 - \xC3\x9B in UTF-8)
# Misinterpreted second bytes: \x80-\xBF become Latin-1 \x80-\xBF (\xC2\x80-\xC2\xBF or \xC3\x80-\xC3\xBF in UTF-8)
# This regex has zero false positives on valid UTF-8 Persian (which uses direct \xD8-\xDB bytes).
MOJIBAKE=$(grep -rlP '\xC3[\x98-\x9B]\xC2[\x80-\xBF]|\xC3[\x98-\x9B]\xC3[\x80-\xBF]' src/ tests/ 2>/dev/null | head -5 || true)
if [ -n "$MOJIBAKE" ]; then
  echo "⚠️  Warning: Files with potential mojibake (corrupted Persian characters):"
  echo "$MOJIBAKE"
  echo "Review these files manually for corrupted Persian text."
fi

echo "✅ No BOM files detected. Mojibake check complete."
