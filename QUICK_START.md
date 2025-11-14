# Quick Start Guide

## ✅ Installation Complete!

Your MCP Session Closer server has been created at:
```
C:\Users\tylar\code\mcp-session-closer
```

## Next Steps

### 1. Configure Cursor

**Option A: Copy Config to Cursor**

The config file `cursor-mcp-config.json` contains the exact configuration you need. 

1. Open Cursor Settings → Features → MCP
2. Add a new server with these settings:
   - **Name**: `session-closer`
   - **Command**: `node`
   - **Args**: `C:\Users\tylar\code\mcp-session-closer\dist\index.js`
   - **Env**: `CURSOR_WORKSPACE` = `${workspaceFolder}`

**Option B: Edit Config File**

Edit `%APPDATA%\Cursor\mcp.json` and add:

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

### 2. Restart Cursor

Close and reopen Cursor to load the MCP server.

### 3. Test It

In any Cursor project, open chat and say:

```
Use the end_session tool to close this session
```

## Usage Examples

### Basic Session Close
```
Use end_session with conversationSummary: "Implemented user authentication feature"
```

### With Details
```
Use end_session with:
- conversationSummary: "Completed auth system"
- accomplishments: ["User model created", "Login page built", "Password hashing implemented"]
- nextSteps: ["Add password reset", "Implement 2FA"]
```

### Just Sync Context Files
```
Use sync_context_files tool
```

## What It Does

When you call `end_session`:

1. ✅ Summarizes your session
2. ✅ Updates `.agent-os/session-summary.md`
3. ✅ Updates Agent OS roadmap and decisions (if present)
4. ✅ Syncs `claude.md`, `gemini.md`, `agents.md`, `.cursor/context.md`
5. ✅ Commits everything to git with descriptive message

## Troubleshooting

**Server not found?**
- Verify: `C:\Users\tylar\code\mcp-session-closer\dist\index.js` exists
- Run: `npm run build` again

**Git commit fails?**
- Make sure git is initialized: `git init`
- Configure git user: `git config user.name "Your Name"`

**Context files not syncing?**
- Check write permissions
- Ensure you're in a project folder

## Need Help?

See `SETUP.md` for detailed setup instructions.
See `README.md` for full documentation.

