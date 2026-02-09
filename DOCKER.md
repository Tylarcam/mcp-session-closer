# Docker Build and Usage

This document explains how to build and run the MCP Session Closer using Docker.

## Quick Start

### Build the Docker Image

```bash
docker build -t mcp-session-closer:latest .
```

### Run with Docker Compose

```bash
# Set your workspace path
export CURSOR_WORKSPACE=/path/to/your/workspace

# Run with docker-compose
docker-compose up -d
```

### Run with Docker Run

```bash
docker run -it \
  -v /path/to/your/workspace:/workspace:rw \
  -e CURSOR_WORKSPACE=/workspace \
  mcp-session-closer:latest
```

## Dockerfile Details

The Dockerfile uses a multi-stage build:

1. **Builder Stage**: Installs all dependencies (including dev dependencies) and compiles TypeScript
2. **Production Stage**: Only includes production dependencies and compiled code

This results in a smaller final image (~150MB vs ~500MB).

## Configuration

### Environment Variables

- `CURSOR_WORKSPACE`: Path to the workspace directory (default: `/workspace`)
- `NODE_ENV`: Set to `production` in the container

### Volume Mounts

Mount your workspace directory to `/workspace` in the container:

```bash
-v /path/to/your/workspace:/workspace:rw
```

## Integration with Cursor

To use the Dockerized MCP server with Cursor, you'll need to configure Cursor to run the Docker container. Update your Cursor MCP settings:

```json
{
  "mcpServers": {
    "session-closer": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "-v", "${workspaceFolder}:/workspace:rw",
        "-e", "CURSOR_WORKSPACE=/workspace",
        "mcp-session-closer:latest"
      ]
    }
  }
}
```

**Note**: Replace `${workspaceFolder}` with the actual path or ensure Cursor expands it correctly.

## Building for Different Platforms

### Build for Linux (default)

```bash
docker build -t mcp-session-closer:latest .
```

### Build for ARM64 (Apple Silicon, Raspberry Pi)

```bash
docker build --platform linux/arm64 -t mcp-session-closer:latest .
```

### Build for Multiple Platforms

```bash
docker buildx build --platform linux/amd64,linux/arm64 -t mcp-session-closer:latest .
```

## Troubleshooting

### Container Exits Immediately

MCP servers communicate via stdio. Make sure you're running with:
- `-i` flag for interactive mode
- `stdin_open: true` in docker-compose

### Permission Issues

If you encounter permission issues with mounted volumes:

```bash
# On Linux/Mac, ensure the user in container can write
docker run -it --user $(id -u):$(id -g) \
  -v /path/to/workspace:/workspace:rw \
  mcp-session-closer:latest
```

### Git Commits Fail

Ensure git is configured in your workspace or mount your git config:

```bash
docker run -it \
  -v /path/to/workspace:/workspace:rw \
  -v ~/.gitconfig:/home/mcpuser/.gitconfig:ro \
  mcp-session-closer:latest
```

## Development

### Build and Test Locally

```bash
# Build
docker build -t mcp-session-closer:latest .

# Test run
docker run -it --rm \
  -v $(pwd):/workspace:rw \
  -e CURSOR_WORKSPACE=/workspace \
  mcp-session-closer:latest
```

### Debugging

To debug inside the container:

```bash
docker run -it --rm --entrypoint /bin/sh \
  -v /path/to/workspace:/workspace:rw \
  mcp-session-closer:latest
```

## Production Considerations

1. **Security**: The container runs as a non-root user (`mcpuser`)
2. **Size**: Multi-stage build keeps the image small
3. **Dependencies**: Only production dependencies are included
4. **Restart Policy**: Use `restart: unless-stopped` in docker-compose for production

