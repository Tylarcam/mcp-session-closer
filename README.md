# Session Closer MCP Server

A personal Model Context Protocol (MCP) server for Cursor that automatically closes work sessions, syncs context files, updates Agent OS files, and commits changes to git.

## Features

- ✅ **Automatic Session Closing** - Close Cursor sessions with a single command
- ✅ **Context File Sync** - Keeps `claude.md`, `gemini.md`, `agents.md`, and `.cursor/context.md` in sync
- ✅ **Agent OS Integration** - Updates roadmap, decisions, and session summaries
- ✅ **Git Integration** - Automatically commits changes with descriptive messages
- ✅ **Cross-Repo** - Works across all your repositories in Cursor

## Installation

### 1. Install Dependencies

```bash
cd C:\Users\tylar\code\mcp-session-closer
npm install
```

### 2. Build the Server

```bash
npm run build
```

### 3. Configure Cursor

Add to your Cursor MCP settings. Open Cursor Settings → Features → MCP, and add:

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

Or edit the MCP config file directly at `~/.cursor/mcp.json` (or `%APPDATA%\Cursor\mcp.json` on Windows).

## Usage

### End Session

In Cursor chat, simply say:

```
Use the end_session tool to close this session
```

Or be more specific:

```
Use end_session with conversationSummary: "Implemented user authentication, created login page, added password hashing"
```

### Sync Context Files (Without Closing)

```
Use sync_context_files tool
```

### Update Session Summary Only

```
Use update_session_summary with summary: "Made progress on feature X"
```

## What It Does

When you call `end_session`, the server:

1. **Gathers Session Summary**
   - Extracts accomplishments, decisions, blockers, and next steps
   - Identifies changed files

2. **Updates Session Summary**
   - Appends to `.agent-os/session-summary.md`
   - Creates file if it doesn't exist

3. **Updates Agent OS Files** (if present)
   - Updates `.agent-os/product/roadmap.md` (marks completed items)
   - Updates `.agent-os/product/decisions.md` (adds new decisions)

4. **Syncs Context Files**
   - Updates `claude.md`, `gemini.md`, `agents.md`, `.cursor/context.md`
   - Keeps all files identical with unified project context

5. **Commits to Git**
   - Stages all changes
   - Creates descriptive commit message
   - Commits with proper format

## Development

### Run in Development Mode

```bash
npm run dev
```

### Build

```bash
npm run build
```

### Start Production Server

```bash
npm start
```

## Troubleshooting

### Server Not Found

Make sure the path in Cursor MCP config is correct and uses forward slashes or escaped backslashes on Windows.

### Git Commit Fails

Ensure:
- Git is initialized in your project (`git init`)
- Git user name and email are configured
- You have write permissions

### Context Files Not Syncing

Check that:
- You have write permissions in the project directory
- The project directory path is correct
- No other processes are locking the files

## Project Structure

```
mcp-session-closer/
├── src/
│   ├── index.ts          # Main MCP server
│   ├── session-closer.ts # Session closer logic
│   └── types.ts          # Type definitions
├── dist/                 # Compiled output
├── package.json
├── tsconfig.json
└── README.md
```

## License

MIT

