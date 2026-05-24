# Stage 1: Build the React Frontend
FROM node:20 AS frontend-builder
WORKDIR /app/frontend

# Copy dependency manifests and install dependencies
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

# Copy frontend source and build static bundle
COPY frontend/ ./
RUN npm run build

# Stage 2: Create the Production Runtime Image with FFmpeg
FROM node:20-slim AS production-server
WORKDIR /app

# Install system dependencies (FFmpeg and ffprobe are critical for video processing)
RUN apt-get update && \
    apt-get install -y ffmpeg && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Copy backend manifests and install production dependencies
COPY backend/package.json backend/package-lock.json ./backend/
RUN npm ci --prefix backend --omit=dev

# Copy backend source code
COPY backend/ ./backend/

# Copy required fonts/resources referenced by video renderer
COPY resources/ ./resources/

# Copy the pre-built frontend static assets from Stage 1
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Expose the standard Cloud Run port
ENV PORT=8080
ENV NODE_ENV=production
EXPOSE 8080

# Start the application
CMD ["node", "backend/server.js"]
