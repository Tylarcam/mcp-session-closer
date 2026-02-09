# Cursor MCP Configuration for Docker

Since Node.js is not installed, configure Cursor to use the Docker container instead.

## Configuration Steps

1. **Open Cursor Settings**
   - Press `Ctrl+,` to open Settings
   - Search for "MCP" or "Model Context Protocol"

2. **Update MCP Server Configuration**

   Find your MCP configuration file (usually in one of these locations):
   - `%APPDATA%\Cursor\User\settings.json` (in the `mcpServers` section)
   - Or check Cursor's MCP settings UI

3. **Replace the Node.js configuration with Docker**

   Change from:
   ```json
   {
     "mcpServers": {
       "session-closer": {
         "command": "node",
         "args": [
           "C:\\Users\\tylar\\code\\mcp-session-closer\\dist\\index.js"
         ],
         "env": {
           "CURSOR_WORKSPACE": "${workspaceFolder}"
         }
       }
     }
   }
   ```

   To:
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

## Alternative: Install Node.js

If you prefer to use Node.js directly instead of Docker:

1. **Install Node.js**
   ```powershell
   winget install OpenJS.NodeJS.LTS
   ```

2. **Build the project**
   ```powershell
   cd mcp-session-closer
   npm install
   npm run build
   ```

3. **Keep the original Node.js configuration**

## Verify Docker Image Exists

Before configuring, verify the Docker image is built:

```powershell
docker images mcp-session-closer
```

If it's not there, build it:

```powershell
cd mcp-session-closer
docker build -t mcp-session-closer:latest .
```

## Restart Cursor

After updating the configuration, restart Cursor completely for the changes to take effect.

