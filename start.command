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

open "http://127.0.0.1:3000/" >/dev/null 2>&1
exec npm start
