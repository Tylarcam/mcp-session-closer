# Docker MCP Server for Session Closer

This package contains everything needed to run the Session Closer MCP server as a Docker container, compatible with Docker MCP Gateway.

## Quick Start

### Option 1: Using Docker MCP Gateway (Recommended)

1. **Build the Docker image:**
   ```bash
   docker build -t session-closer-mcp:latest .
   ```

2. **Enable the server in Docker MCP:**
   ```bash
   docker mcp server enable session-closer-mcp:latest
   ```

3. **Connect Cursor to the gateway:**
   ```bash
   docker mcp client connect cursor
   ```

4. **Run the gateway:**
   ```bash
   docker mcp gateway run
   ```

### Option 2: Using Docker Compose

1. **Set your workspace directory:**
   ```bash
   export CURSOR_WORKSPACE=/path/to/your/project
   ```

2. **Start the container:**
   ```bash
   docker-compose up -d
   ```

3. **Configure Cursor to use the container:**
   Edit `~/.cursor/mcp.json`:
   ```json
   {
     "mcpServers": {
       "session-closer": {
         "command": "docker",
         "args": [
           "exec",
           "-i",
           "session-closer-mcp",
           "node",
           "dist/index.js"
         ],
         "env": {
           "CURSOR_WORKSPACE": "${workspaceFolder}"
         }
       }
     }
   }
   ```

### Option 3: Direct Docker Run

```bash
docker run -it \
  -v /path/to/your/project:/workspace:rw \
  -e CURSOR_WORKSPACE=/workspace \
  session-closer-mcp:latest
```

## Building the Image

```bash
# Build the image
docker build -t session-closer-mcp:latest .

# Tag for Docker Hub (optional)
docker tag session-closer-mcp:latest yourusername/session-closer-mcp:latest

# Push to Docker Hub (optional)
docker push yourusername/session-closer-mcp:latest
```

## Configuration

### Environment Variables

- `CURSOR_WORKSPACE`: Path to the workspace directory (default: `/workspace`)
- `NODE_ENV`: Node environment (default: `production`)

### Volume Mounts

The container expects a workspace directory mounted at `/workspace` containing:
- Your project files
- `.agent-os/` directory (if using Agent OS)
- `.git/` directory (for git operations)

## Docker MCP Gateway Integration

To use with Docker MCP Gateway:

1. **Build and tag the image:**
   ```bash
   docker build -t session-closer-mcp:latest .
   ```

2. **Enable in Docker MCP:**
   ```bash
   docker mcp server enable session-closer-mcp:latest
   ```

3. **Verify it's enabled:**
   ```bash
   docker mcp server list
   ```

4. **Run the gateway:**
   ```bash
   docker mcp gateway run
   ```

The gateway will automatically discover and expose the session-closer tools to connected clients like Cursor.

## Troubleshooting

### Container can't access workspace files

Make sure you're mounting the workspace directory:
```bash
docker run -v /path/to/project:/workspace:rw session-closer-mcp:latest
```

### Git operations fail

Ensure git is configured in the container or mount your git config:
```bash
docker run -v ~/.gitconfig:/root/.gitconfig:ro session-closer-mcp:latest
```

### Permission errors

Run with appropriate user permissions:
```bash
docker run --user $(id -u):$(id -g) session-closer-mcp:latest
```

## Files Included

- `Dockerfile` - Docker image definition
- `docker-compose.yml` - Docker Compose configuration
- `.dockerignore` - Files to exclude from Docker build
- `DOCKER_README.md` - This file

## Notes

- The MCP server uses stdio for communication, so no ports are exposed
- The container runs in the foreground to maintain stdio connection
- Workspace directory must be mounted as a volume
- Git operations require git to be available in the container (included in base image)

