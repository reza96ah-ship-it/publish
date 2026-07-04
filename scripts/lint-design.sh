#!/usr/bin/env bash
# lint-design.sh — consolidated design-system gate
#
# Checks enforced:
#   1. No raw palette / hex color classes outside documented exceptions
#   2. No physical direction classes in RTL-first components
#   3. No arbitrary text-size or font-weight values (use semantic scale)
#
# Exit 0 = all clean. Exit 1 = violations found (CI-blocking).

set -euo pipefail

FAIL=0

# ── 1. Raw palette and hex color leaks ────────────────────────────────────
# Exceptions:
#   platform-preview-tabs.tsx — simulates platform UI chrome (intentional LTR colors)
#   settings-view.tsx         — user-configurable brand color picker defaults
#   globals.css               — token definitions (the allowed source of truth)
#   toast.tsx                 — shadcn destructive variant (text-red-300 etc.)

echo "→ Checking for raw palette / hex color classes…"
HITS=$(grep -rEo \
  '\b(text|bg|border|ring)-(rose|pink|sky|emerald|amber|yellow|orange|red|purple|violet|indigo|slate|gray|zinc|lime|teal|cyan|fuchsia|blue|green)-[0-9]{2,3}\b|#[0-9a-fA-F]{4,8}' \
  src/components/ src/app/ \
  --include='*.tsx' --include='*.ts' --include='*.css' \
  | grep -v 'platform-preview-tabs\|settings-view\|globals\.css\|toast\.tsx' \
  | head -20 || true)

if [ -n "$HITS" ]; then
  echo "✗ Raw palette class or hex literal found."
  echo "  Use n-* semantic tokens (text-danger, bg-success-tint, etc.) instead."
  echo "  Exceptions: platform-preview-tabs.tsx, settings-view.tsx"
  echo "$HITS"
  FAIL=1
else
  echo "✓ No raw palette or hex color leaks"
fi

# ── 2. Physical direction classes (RTL logical properties) ─────────────────
# Check custom components only — exclude src/components/ui/ (shadcn primitives)
# Exceptions:
#   settings-view.tsx       — text-left on dir="ltr" inputs (phone, email, hex)
#   platform-preview-tabs   — simulates LTR platform UI chrome
#   mobile-bottom-nav.tsx   — left-1/2 centering idiom (direction-neutral)

echo ""
echo "→ Checking for physical direction classes…"
HITS=$(grep -rEo \
  '\btext-right\b|\brounded-r-\w+|\brounded-l-\w+' \
  src/components/views/ src/components/shell/ src/components/dashboard/ \
  src/components/ai/ src/components/editor/ src/components/approval/ \
  src/app/ \
  --include='*.tsx' --include='*.ts' \
  | grep -v 'settings-view\|platform-preview-tabs\|mobile-bottom-nav' \
  | head -20 || true)

if [ -n "$HITS" ]; then
  echo "✗ Physical direction class found in RTL-first app."
  echo "  Use logical equivalents: text-start/text-end, rounded-s-*/rounded-e-*"
  echo "$HITS"
  FAIL=1
else
  echo "✓ No physical direction class violations"
fi

# ── 3. Arbitrary text-size and font-weight classes ─────────────────────────
# Use the semantic scale: text-2xs…text-2xl, font-medium/semibold/bold/extrabold

echo ""
echo "→ Checking for arbitrary text-size / font-weight classes…"
HITS=$(grep -rEo \
  'text-\[[0-9]+(\.[0-9]+)?(px|rem|em)\]|font-\[[0-9]+\]' \
  src/ \
  --include='*.tsx' --include='*.ts' --include='*.css' \
  2>/dev/null | head -20 || true)

if [ -n "$HITS" ]; then
  echo "✗ Arbitrary text-size or font-weight class found."
  echo "  Use the semantic scale (text-2xs…text-2xl, font-medium/semibold/bold)."
  echo "$HITS"
  FAIL=1
else
  echo "✓ No arbitrary text-size or font-weight classes"
fi

# ── Result ─────────────────────────────────────────────────────────────────
echo ""
if [ "$FAIL" -eq 1 ]; then
  echo "Design lint FAILED — fix the violations above before merging."
  exit 1
else
  echo "Design lint passed ✓"
fi
