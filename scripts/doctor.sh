#!/usr/bin/env bash
set -euo pipefail

pass=0
warn=0
fail=0

check_pass() { echo "  ✓ $1"; ((pass++)) || true; }
check_warn() { echo "  ⚠ $1"; ((warn++)) || true; }
check_fail() { echo "  ✗ $1"; ((fail++)) || true; }

echo ""
echo "  Timesheet Studio — Environment Check"
echo "  ─────────────────────────────────────"
echo ""

# Node.js
if command -v node &>/dev/null; then
  node_ver=$(node -v | tr -d 'v')
  major=$(echo "$node_ver" | cut -d. -f1)
  if [ "$major" -ge 18 ]; then
    check_pass "Node.js $node_ver"
  else
    check_fail "Node.js $node_ver (need ≥18)"
  fi
else
  check_fail "Node.js not found"
fi

# npm
if command -v npm &>/dev/null; then
  check_pass "npm $(npm -v)"
else
  check_fail "npm not found"
fi

# node_modules
if [ -d "node_modules" ]; then
  check_pass "Dependencies installed"
else
  check_warn "Dependencies not installed (run: npm install)"
fi

# DOCX template
if [ -f "static/templates/timesheet_template.docx" ]; then
  check_pass "DOCX template ready"
else
  check_warn "DOCX template not prepared (run: npm run prepare:template)"
fi

# Source .doc template
if [ -f "timesheet_template.doc" ]; then
  check_pass "Source template (.doc) present"
else
  check_fail "Source template (timesheet_template.doc) missing"
fi

# LibreOffice (optional — needed for .doc export and template prep)
if command -v soffice &>/dev/null; then
  check_pass "LibreOffice available (DOC export + template prep supported)"
else
  check_warn "LibreOffice not found (DOC export unavailable, DOCX still works)"
fi

# Port 5173
if command -v lsof &>/dev/null; then
  if ! lsof -iTCP:5173 -sTCP:LISTEN &>/dev/null 2>&1; then
    check_pass "Port 5173 available"
  else
    check_warn "Port 5173 in use (set PORT=<number> to override)"
  fi
elif command -v ss &>/dev/null; then
  if ! ss -tlnp | grep -q ':5173 ' 2>/dev/null; then
    check_pass "Port 5173 available"
  else
    check_warn "Port 5173 in use (set PORT=<number> to override)"
  fi
else
  check_warn "Cannot check port availability (lsof/ss not found)"
fi

echo ""
echo "  ─────────────────────────────────────"
echo "  Results: $pass passed, $warn warnings, $fail failed"
echo ""

[ "$fail" -eq 0 ]
