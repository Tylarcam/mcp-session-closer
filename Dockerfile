# Dockerfile for Session Closer MCP Server
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy source files
COPY src/ ./src/

# Build TypeScript
RUN npm run build

# Expose MCP stdio (MCP uses stdio, no port needed)
# But we'll keep this for documentation
EXPOSE 8080

# Set environment variables
ENV NODE_ENV=production
ENV CURSOR_WORKSPACE=/workspace

# Run the MCP server
CMD ["node", "dist/index.js"]
