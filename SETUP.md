# Setup Instructions for Cursor

## Step 1: Build the Server

```powershell
cd C:\Users\tylar\code\mcp-session-closer
npm run build
```

## Step 2: Configure Cursor

### Option A: Via Cursor Settings UI

1. Open Cursor
2. Go to **Settings** → **Features** → **MCP**
3. Click **+ Add New MCP Server**
4. Fill in:
   - **Name**: `session-closer`
   - **Type**: `stdio`
   - **Command**: `node`
   - **Args**: `C:\Users\tylar\code\mcp-session-closer\dist\index.js`
   - **Environment Variables**: 
     - Key: `CURSOR_WORKSPACE`
     - Value: `${workspaceFolder}`

### Option B: Edit Config File Directly

1. Find your Cursor MCP config file:
   - Windows: `%APPDATA%\Cursor\mcp.json`
   - Or: `C:\Users\tylar\AppData\Roaming\Cursor\mcp.json`

2. Add this to the `mcpServers` section:

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

**Note**: If the file doesn't exist, create it with the above structure.

## Step 3: Restart Cursor

Restart Cursor to load the new MCP server.

## Step 4: Test It

In any Cursor project, open the chat and say:

```
Use the end_session tool to close this session
```

Or:

```
Use end_session with conversationSummary: "Test session - verifying MCP server works"
```

## Troubleshooting

### Server Not Found

- Verify the path is correct: `C:\Users\tylar\code\mcp-session-closer\dist\index.js`
- Make sure you've run `npm run build`
- Check that `dist/index.js` exists

### Permission Errors

- Make sure Node.js is in your PATH
- Try using the full path to node: `C:\Program Files\nodejs\node.exe`

### Workspace Not Detected

- The server uses `process.cwd()` as fallback
- Make sure you're opening projects as folders in Cursor
- Check that `${workspaceFolder}` is being expanded correctly

