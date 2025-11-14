#!/bin/bash
# Package script for Docker MCP Session Closer

set -e

VERSION=${1:-latest}
IMAGE_NAME="mcp-session-closer"
REGISTRY=${DOCKER_REGISTRY:-""}

echo "🐳 Building Docker image for MCP Session Closer..."
echo "Version: $VERSION"

# Build the image
docker build -t ${IMAGE_NAME}:${VERSION} .

# Tag as latest if not already
if [ "$VERSION" != "latest" ]; then
    docker tag ${IMAGE_NAME}:${VERSION} ${IMAGE_NAME}:latest
fi

# If registry is specified, tag and prepare for push
if [ -n "$REGISTRY" ]; then
    FULL_IMAGE_NAME="${REGISTRY}/${IMAGE_NAME}:${VERSION}"
    docker tag ${IMAGE_NAME}:${VERSION} ${FULL_IMAGE_NAME}
    echo "✅ Tagged as ${FULL_IMAGE_NAME}"
    echo "📤 Push with: docker push ${FULL_IMAGE_NAME}"
fi

echo "✅ Build complete!"
echo ""
echo "📦 Image: ${IMAGE_NAME}:${VERSION}"
echo ""
echo "🚀 Next steps:"
echo "   1. Test: docker run -it --rm ${IMAGE_NAME}:${VERSION}"
echo "   2. Enable: docker mcp server enable ${IMAGE_NAME}"
echo "   3. Connect: docker mcp client connect cursor"
echo "   4. Run: docker mcp gateway run"

