#!/bin/bash

# Exit on error
set -e

echo "Starting Lyric Video Generator Services..."

# Create logs directory if it doesn't exist
mkdir -p logs

# Set Google Application Credentials if service-account-key.json exists in root
if [ -f "service-account-key.json" ]; then
  export GOOGLE_APPLICATION_CREDENTIALS="$(pwd)/service-account-key.json"
  echo "--> Found service-account-key.json. Setting GOOGLE_APPLICATION_CREDENTIALS..."
fi

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

# Trap SIGINT and SIGTERM signals so we can gracefully kill the background processes
trap "echo -e '\nStopping services...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" SIGINT SIGTERM

# Wait for background processes to keep the script running
wait $BACKEND_PID $FRONTEND_PID

