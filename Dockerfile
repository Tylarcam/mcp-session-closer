# Multi-stage build for mcp-session-closer
FROM node:20-slim AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci

# Copy source files
COPY src/ ./src/

# Build TypeScript
RUN npm run build

# Production stage
FROM node:20-slim

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production && npm cache clean --force

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Create a non-root user for security (check if user exists first)
RUN if ! id -u 1000 >/dev/null 2>&1; then \
      useradd -m -u 1000 mcpuser; \
    else \
      usermod -d /home/mcpuser -m -s /bin/bash $(getent passwd 1000 | cut -d: -f1) 2>/dev/null || true; \
    fi && \
    chown -R 1000:1000 /app

USER 1000

# The MCP server communicates via stdio, so no port exposure needed
# Set environment variable for workspace (can be overridden)
ENV CURSOR_WORKSPACE=/workspace
ENV NODE_ENV=production

# Run the MCP server
CMD ["node", "dist/index.js"]

