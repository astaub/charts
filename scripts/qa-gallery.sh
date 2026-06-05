#!/usr/bin/env bash
# Dual-background visual QA gallery.
#
# Renders every paneled chart kind + the dashboard TWICE — once on a dark
# terminal background and once on a light one — and writes the PNGs to
# docs/screenshots/<kind>.{dark,light}.png. One command regenerates the whole
# both-backgrounds gallery so a reviewer (or an agent) can read the light and
# dark shots side by side and catch any theme regression.
#
# This is the permanent counterpart to the equal-visible-width regression test:
# the test guards geometry (text columns); this guards the actual rendered
# pixels (color, contrast, glyph alignment) on both backgrounds.
#
# Requires `freeze` (https://github.com/charmbracelet/freeze). Block/box glyphs
# (█ ░ │) MUST be rendered with a uniform-advance font or they drift and the
# panel border looks ragged — so we pin --font.family Menlo. (freeze cannot set
# a default foreground, so charts colors all primary text explicitly in light
# mode; the background flag is all freeze needs from us here.)
#
# Usage:  scripts/qa-gallery.sh            # regenerate the whole gallery
#         scripts/qa-gallery.sh bar line   # just these kinds
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLI="$ROOT/dist/cli.js"
OUT="$ROOT/docs/screenshots"
FIXTURES="$ROOT/fixtures"

command -v freeze >/dev/null || { echo "error: 'freeze' not found (brew install charmbracelet/tap/freeze)"; exit 1; }
[ -f "$CLI" ] || { echo "building charts…"; (cd "$ROOT" && npm run build >/dev/null); }
mkdir -p "$OUT"

FONT=(--font.family "Menlo" --font.size 14 --padding 20 --window=false)
DARK_BG="#0d0f17"
LIGHT_BG="#ffffff"

# kind|fixture|width — one representative fixture per kind.
CASES=(
  "bar|bar-browser-share.json|76"
  "bignumber|bignumber-signups.json|76"
  "funnel|funnel-activation.json|76"
  "grouped|grouped-engagement.json|76"
  "line|line-weekly-active.json|84"
  "retention|retention-weekly.json|84"
  "scatter|scatter-quadrant.json|76"
  "stacked|stacked-plan-mix.json|76"
  "waterfall|waterfall-mrr-bridge.json|80"
  "dashboard|dashboard-growth.json|120"
)

WANT=("$@")
want() { [ ${#WANT[@]} -eq 0 ] && return 0; for w in "${WANT[@]}"; do [ "$w" = "$1" ] && return 0; done; return 1; }

shoot() { # kind appearance bg width txt
  local kind="$1" appearance="$2" bg="$3" width="$4" txt="$5"
  local png="$OUT/$kind.$appearance.png"
  FORCE_COLOR=1 node "$CLI" "$kind" "$txt" --appearance "$appearance" --width "$width" > "/tmp/qa-$kind.ans"
  # --language ansi: render the captured ANSI. --font.family (a MONOSPACE font
  # with box/block glyph coverage) is REQUIRED — freeze's default font has
  # non-uniform glyph advance, so the panel's right border drifts (the left,
  # being at column 0, stays put). charts pads every row to one identical
  # visible width (asserted in the test suite); a uniform-advance font renders
  # that as one clean column.
  freeze "/tmp/qa-$kind.ans" --language ansi -o "$png" --background "$bg" "${FONT[@]}"
}

for case in "${CASES[@]}"; do
  IFS='|' read -r kind fixture width <<< "$case"
  want "$kind" || continue
  txt="$FIXTURES/$fixture"
  [ -f "$txt" ] || { echo "skip $kind: missing fixture $fixture"; continue; }
  shoot "$kind" dark  "$DARK_BG"  "$width" "$txt"
  shoot "$kind" light "$LIGHT_BG" "$width" "$txt"
  echo "✓ $kind → $OUT/$kind.{dark,light}.png"
done

echo "Gallery written to docs/screenshots/ — read the .dark.png / .light.png pairs side by side."
