#!/bin/bash
# Build script for Docker image

set -e

IMAGE_NAME="mcp-session-closer"
IMAGE_TAG="${1:-latest}"

echo "Building Docker image: ${IMAGE_NAME}:${IMAGE_TAG}"

# Build the image
docker build -t "${IMAGE_NAME}:${IMAGE_TAG}" .

echo ""
echo "Build complete!"
echo ""
echo "To run the container:"
echo "  docker run -it -v /path/to/workspace:/workspace:rw ${IMAGE_NAME}:${IMAGE_TAG}"
echo ""
echo "Or use docker-compose:"
echo "  docker-compose up"

