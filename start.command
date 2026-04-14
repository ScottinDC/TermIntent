#!/bin/bash

cd "$(dirname "$0")" || exit 1

if ! command -v node >/dev/null 2>&1; then
  osascript -e 'display alert "Node.js is required" message "Please install Node.js 20 or newer, then reopen IntentTerm." as critical'
  exit 1
fi

if [ ! -f ".env" ]; then
  osascript -e 'display alert ".env file missing" message "Create a .env file with your SEMRUSH_API_KEY before starting IntentTerm." as critical'
  exit 1
fi

npm start &
SERVER_PID=$!

cleanup() {
  if kill -0 "$SERVER_PID" >/dev/null 2>&1; then
    kill "$SERVER_PID" >/dev/null 2>&1
    wait "$SERVER_PID" >/dev/null 2>&1
  fi
}

trap cleanup INT TERM

for _ in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:3000/health" >/dev/null 2>&1; then
    open "http://127.0.0.1:3000/" >/dev/null 2>&1
    wait "$SERVER_PID"
    exit $?
  fi

  if ! kill -0 "$SERVER_PID" >/dev/null 2>&1; then
    wait "$SERVER_PID"
    exit $?
  fi

  sleep 1
done

cleanup
osascript -e 'display alert "IntentTerm did not start" message "The local server did not become available at http://127.0.0.1:3000." as critical'
exit 1
