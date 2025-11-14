# Building and Packaging Docker Image

## Quick Build

```powershell
# Build the image
docker build -t mcp-session-closer:latest .

# Or use the PowerShell script
.\package-docker.ps1
```

## Package for Distribution

### Option 1: Save as Tar Archive

```powershell
# Save image to tar file
docker save mcp-session-closer:latest -o mcp-session-closer.tar

# Compress it
Compress-Archive -Path mcp-session-closer.tar -DestinationPath mcp-session-closer-docker.zip
```

### Option 2: Export as Docker Image

```powershell
# Export image
docker save mcp-session-closer:latest | gzip > mcp-session-closer-docker.tar.gz
```

### Option 3: Push to Docker Hub

```powershell
# Tag for your Docker Hub account
docker tag mcp-session-closer:latest your-username/mcp-session-closer:latest

# Login to Docker Hub
docker login

# Push
docker push your-username/mcp-session-closer:latest
```

## Loading the Image

### From Tar File

```powershell
# Load from tar
docker load -i mcp-session-closer.tar
```

### From Docker Hub

```powershell
# Pull from Docker Hub
docker pull your-username/mcp-session-closer:latest
```

## Using with Docker MCP Gateway

Once the image is built or loaded:

```powershell
# Enable the server
docker mcp server enable mcp-session-closer

# Connect Cursor client
docker mcp client connect cursor

# Run the gateway
docker mcp gateway run
```

## Image Details

- **Base Image**: `node:20-alpine` (lightweight)
- **Size**: ~150MB (after optimization)
- **User**: Runs as non-root (`nodejs` user)
- **Ports**: None (uses stdio for MCP communication)
- **Volumes**: Mount workspace directories for file access

## Testing the Image

```powershell
# Test run
docker run -it --rm mcp-session-closer:latest

# Test with workspace mount
docker run -it --rm -v C:\Users\tylar\code:/workspace/code mcp-session-closer:latest
```

