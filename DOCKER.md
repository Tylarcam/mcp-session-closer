# Docker Setup for MCP Session Closer

This guide explains how to build and use the MCP Session Closer server with Docker and Docker MCP Toolkit.

## Prerequisites

- Docker Desktop installed and running
- Docker MCP Toolkit installed (part of Docker Desktop)

## Building the Docker Image

### Option 1: Build Locally

```bash
cd C:\Users\tylar\code\mcp-session-closer
docker build -t mcp-session-closer:latest .
```

### Option 2: Build with Docker Compose

```bash
docker-compose build
```

## Using with Docker MCP Gateway

### Step 1: Enable the Server

If you've published to Docker Hub:

```bash
docker mcp server enable mcp-session-closer
```

Or use a local image:

```bash
# Tag your local image
docker tag mcp-session-closer:latest your-dockerhub-username/mcp-session-closer:latest

# Push to Docker Hub (optional, for sharing)
docker push your-dockerhub-username/mcp-session-closer:latest

# Then enable
docker mcp server enable your-dockerhub-username/mcp-session-closer
```

### Step 2: Connect Cursor Client

```bash
docker mcp client connect cursor
```

### Step 3: Run the Gateway

```bash
docker mcp gateway run
```

## Local Development with Docker

### Run Container Directly

```bash
docker run -it --rm \
  -v C:\Users\tylar\code:/workspace/code:ro \
  mcp-session-closer:latest
```

### Using Docker Compose

```bash
docker-compose up
```

## Publishing to Docker Hub

1. **Login to Docker Hub:**
   ```bash
   docker login
   ```

2. **Tag the image:**
   ```bash
   docker tag mcp-session-closer:latest your-username/mcp-session-closer:latest
   ```

3. **Push to Docker Hub:**
   ```bash
   docker push your-username/mcp-session-closer:latest
   ```

4. **Enable via Docker MCP:**
   ```bash
   docker mcp server enable your-username/mcp-session-closer
   ```

## Configuration for Docker MCP

When using Docker MCP Gateway, the server configuration is managed by Docker. You don't need to manually edit `mcp.json` - the gateway handles it.

However, you may need to configure volume mounts for workspace access:

```yaml
# In docker-compose.yml or Docker run command
volumes:
  - C:\Users\tylar\code:/workspace/code:ro
```

## Environment Variables

The Docker container supports these environment variables:

- `CURSOR_WORKSPACE` - Workspace directory (default: `/workspace`)
- `NODE_ENV` - Node environment (default: `production`)

## Security Notes

- The Docker image runs as a non-root user (`nodejs`)
- Source files are removed after build to reduce image size
- Only production dependencies are included in the final image
- Workspace directories are mounted read-only where possible

## Troubleshooting

### Container Can't Access Files

Ensure volumes are mounted correctly:
```bash
docker run -it --rm \
  -v C:\Users\tylar\code:/workspace/code \
  mcp-session-closer:latest
```

### Git Commits Fail

Mount your git config:
```bash
docker run -it --rm \
  -v C:\Users\tylar\code:/workspace/code \
  -v C:\Users\tylar\.gitconfig:/home/nodejs/.gitconfig:ro \
  mcp-session-closer:latest
```

### Permission Issues

The container runs as user `nodejs` (UID 1001). Ensure mounted directories have appropriate permissions.

## Building for Production

```bash
# Build optimized image
docker build --platform linux/amd64 -t mcp-session-closer:latest .

# Test locally
docker run -it --rm mcp-session-closer:latest

# Push to registry
docker push mcp-session-closer:latest
```

