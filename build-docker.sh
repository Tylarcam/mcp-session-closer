#!/bin/bash
# Build script for Docker MCP Session Closer

set -e

echo "🐳 Building Docker MCP Session Closer..."

# Build the Docker image
docker build -t session-closer-mcp:latest .

echo "✅ Build complete!"
echo ""
echo "Next steps:"
echo "1. Enable in Docker MCP: docker mcp server enable session-closer-mcp:latest"
echo "2. Connect Cursor: docker mcp client connect cursor"
echo "3. Run gateway: docker mcp gateway run"

