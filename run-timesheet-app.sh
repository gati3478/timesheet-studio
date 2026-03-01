#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

HOST="${HOST:-127.0.0.1}"
PORT="${PORT:-5173}"
APP_URL="http://${HOST}:${PORT}"
LOG_FILE="/tmp/timesheet-generator-dev.log"

if [ ! -d node_modules ]; then
  echo "Installing dependencies..."
  npm install
fi

if [ ! -f "static/templates/timesheet_template.docx" ]; then
  echo "Preparing DOCX template..."
  npm run prepare:template
fi

echo "Starting app on ${APP_URL} ..."
npm run dev -- --host "$HOST" --port "$PORT" >"$LOG_FILE" 2>&1 &
APP_PID=$!

cleanup() {
  if kill -0 "$APP_PID" 2>/dev/null; then
    kill "$APP_PID" >/dev/null 2>&1 || true
    wait "$APP_PID" 2>/dev/null || true
  fi
}
trap cleanup INT TERM EXIT

for _ in {1..120}; do
  if curl -fsS "$APP_URL" >/dev/null 2>&1; then
    break
  fi

  if ! kill -0 "$APP_PID" 2>/dev/null; then
    echo "Dev server terminated unexpectedly. Check: $LOG_FILE"
    exit 1
  fi

  sleep 0.25
done

if command -v open >/dev/null 2>&1; then
  open "$APP_URL"
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$APP_URL" >/dev/null 2>&1 || true
fi

echo "App is running (PID ${APP_PID})."
echo "Press Ctrl+C in this terminal to stop it."
wait "$APP_PID"
