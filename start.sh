#!/bin/bash

# Exit on error
set -e

echo "Starting Lyric Video Generator Services..."

# Create logs directory if it doesn't exist
mkdir -p logs

# Initialize PID trackers for cleanup
BACKEND_PID=""
FRONTEND_PID=""
CLEANED_UP=0

cleanup() {
  if [ "$CLEANED_UP" -eq 1 ]; then
    return
  fi
  CLEANED_UP=1
  echo -e "\nStopping services..."
  if [ -n "$BACKEND_PID" ]; then
    kill "$BACKEND_PID" 2>/dev/null || true
  fi
  if [ -n "$FRONTEND_PID" ]; then
    # Kill both the npm wrapper and its child process (e.g. Vite)
    CHILD_PIDS=$(pgrep -P "$FRONTEND_PID" 2>/dev/null) || true
    kill "$FRONTEND_PID" $CHILD_PIDS 2>/dev/null || true
  fi
}

# Trap EXIT, SIGINT, and SIGTERM to ensure robust cleanup under all exit conditions
trap cleanup EXIT SIGINT SIGTERM


# Start Backend
echo "--> Starting Backend on port 3001 (Logging to logs/backend.log)..."
cd backend
# Ensure dependencies are installed
if [ ! -d "node_modules" ]; then
  npm install
fi
# Start the backend server in the background and redirect output to logs/backend.log
node server.js > ../logs/backend.log 2>&1 &
BACKEND_PID=$!
cd ..

# Start Frontend
echo "--> Starting Frontend on port 5173 (Logging to logs/frontend.log)..."
cd frontend
# Ensure dependencies are installed
if [ ! -d "node_modules" ]; then
  npm install
fi
# Run Vite with --host to ensure it binds to 0.0.0.0, 
# and redirect output to logs/frontend.log
npm run dev -- --host > ../logs/frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..

echo "========================================================"
echo "Services are running in the background."
echo "Backend PID: $BACKEND_PID | Log: logs/backend.log"
echo "Frontend PID: $FRONTEND_PID | Log: logs/frontend.log"
echo "Press Ctrl+C to stop both services."
echo "========================================================"

# Wait for background processes to keep the script running
wait $BACKEND_PID $FRONTEND_PID

