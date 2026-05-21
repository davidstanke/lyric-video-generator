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

# Construct clickable terminal hyperlinks
FRONTEND_URL="http://localhost:5173"
BACKEND_URL="http://localhost:3001"

if [ -t 1 ]; then
  # Use OSC 8 escape sequences for nice terminal-native clickable hyperlinks with blue underline color
  FRONTEND_LINK=$(printf "\033[4;34m\033]8;;%s\033\\\\%s\033]8;;\033\\\\\033[0m" "$FRONTEND_URL" "$FRONTEND_URL")
  BACKEND_LINK=$(printf "\033[4;34m\033]8;;%s\033\\\\%s\033]8;;\033\\\\\033[0m" "$BACKEND_URL" "$BACKEND_URL")
  
  echo -e "\033[1;36m========================================================\033[0m"
  echo -e "\033[1;32m🚀 Lyric Video Generator Services are now running!\033[0m"
  echo -e "\033[36m--------------------------------------------------------\033[0m"
  echo -e "\033[1mFrontend URL:\033[0m $FRONTEND_LINK  \033[90m(PID: $FRONTEND_PID, Log: logs/frontend.log)\033[0m"
  echo -e "\033[1mBackend URL:\033[0m  $BACKEND_LINK   \033[90m(PID: $BACKEND_PID, Log: logs/backend.log)\033[0m"
  echo -e "\033[36m--------------------------------------------------------\033[0m"
  echo -e "\033[1;33m👉 Press Ctrl+C to stop both services.\033[0m"
  echo -e "\033[1;36m========================================================\033[0m"
else
  echo "========================================================"
  echo "Lyric Video Generator Services are now running!"
  echo "--------------------------------------------------------"
  echo "Frontend URL: $FRONTEND_URL  (PID: $FRONTEND_PID, Log: logs/frontend.log)"
  echo "Backend URL:  $BACKEND_URL   (PID: $BACKEND_PID, Log: logs/backend.log)"
  echo "--------------------------------------------------------"
  echo "Press Ctrl+C to stop both services."
  echo "========================================================"
fi

# Wait for background processes to keep the script running
wait $BACKEND_PID $FRONTEND_PID

