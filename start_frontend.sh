#!/usr/bin/env bash
# Start the Next.js frontend dev server

cd "$(dirname "$0")/frontend"

echo "Installing dependencies..."
npm install

echo "Starting Next.js frontend on http://localhost:3000"
npm run dev
