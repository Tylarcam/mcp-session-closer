# MCP Session Closer

A Model Context Protocol (MCP) server for Cursor that gracefully closes work sessions, syncs context files, updates Agent OS files, and commits changes to git.

## Features

* **end_session**: Close Cursor sessions with automatic context sync, Notion entry creation, and git commit
* **sync_context_files**: Sync context files across `claude.md`, `gemini.md`, `agents.md`, and `.cursor/context.md`
* **update_session_summary**: Update session summaries without closing the session
* **create_notion_entry**: Create Notion entries from markdown content (append to page or create in database)
* **Notion Integration**: Automatically creates Notion entries via MCP tools (with Python script fallback)

## Quick Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Build the Server

```bash
npm run build
```

### 3. Configure Cursor

Add to your Cursor MCP settings (`~/.cursor/mcp.json` or `%APPDATA%\Cursor\mcp.json` on Windows):

```json
{
  "mcpServers": {
    "session-closer": {
      "command": "node",
      "args": [
        "/path/to/mcp-session-closer/dist/index.js"
      ],
      "env": {
        "CURSOR_WORKSPACE": "${workspaceFolder}"
      }
    }
  }
}
```

**Note**: Replace `/path/to/mcp-session-closer` with your actual path. On Windows, use forward slashes or double backslashes.

### 4. Restart Cursor

Restart Cursor to load the MCP server.

## Usage

### End Session

In Cursor chat, simply ask:

```
Close this session and sync everything
```

Or use the tool directly:

```
Use end_session with conversationSummary: "Implemented user auth, fixed login bugs"
```

The server will:
1. Extract session details (accomplishments, decisions, blockers, next steps)
2. Update `.agent-os/session-summary.md`
3. Create Notion entry via MCP (or fallback to Python script)
4. Update Agent OS roadmap and decisions (if present)
5. Sync all context files (`claude.md`, `gemini.md`, `agents.md`, `.cursor/context.md`)
6. Commit all changes to git with descriptive message

### Sync Context Files Only

```
Sync context files
```

Or:

```
Use sync_context_files
```

### Update Session Summary Only

```
Use update_session_summary with summary: "Made progress on feature X"
```

### Create Notion Entry from Markdown

Create a Notion entry directly from markdown content. This is useful for adding completion reports, documentation, or any structured content to Notion.

**Append to existing page:**
```
Use create_notion_entry with markdownContent: "# My Report\n\nContent here..." and pageId: "your-page-id"
```

**Create new page in database:**
```
Use create_notion_entry with markdownContent: "# My Report\n\nContent here..." and databaseId: "your-database-id"
```

**With custom title and date:**
```
Use create_notion_entry with markdownContent: "# My Report\n\nContent here...", databaseId: "your-database-id", title: "Custom Title", date: "2026-02-08", project: "Development"
```

**Features:**
- Automatically converts markdown to Notion blocks
- Handles large content by chunking (Notion limit: 100 blocks per request)
- Extracts title from first H1 if not provided
- Extracts date from markdown if present
- Falls back to direct Notion API if MCP tools unavailable

## How It Works

### Session Closing Flow

When you call `end_session`, the server automatically:

1. **Gathers Session Info**
   - Extracts accomplishments from conversation
   - Identifies decisions made
   - Notes any blockers
   - Lists next steps
   - Tracks changed files

2. **Updates Session Summary**
   - Creates/updates `.agent-os/session-summary.md`
   - Appends session details with timestamp
   - Formats as structured markdown

3. **Updates Agent OS** (if present)
   - Marks completed items in `.agent-os/product/roadmap.md`
   - Adds new decisions to `.agent-os/product/decisions.md`
   - Maintains proper markdown structure

4. **Syncs Context Files**
   - Reads content from all context files
   - Merges and deduplicates content
   - Updates all files with unified context:
     - `claude.md`
     - `gemini.md`
     - `agents.md`
     - `.cursor/context.md`

5. **Commits to Git**
   - Stages all modified files
   - Creates descriptive commit message
   - Commits with timestamp

## Configuration

### Required Environment Variables

* `CURSOR_WORKSPACE` - Set automatically by Cursor to the current workspace folder

### Notion Integration

The server can automatically create Notion entries when closing sessions, and you can also create entries manually using the `create_notion_entry` tool. Configure via environment variables:

**Required:**
* `NOTION_API_TOKEN` or `NOTION_API_KEY` or `NOTION_TOKEN` - Your Notion integration token (get from https://www.notion.so/my-integrations)

**Choose one (for automatic session entries):**
* `NOTION_PAGE_ID` - Append blocks to existing page (recommended, avoids serialization issues)
* `NOTION_DATABASE_ID` - Create new page in database

**Optional:**
* `NOTION_PROJECT` - Default project name for database entries (default: "Development")

**Example:**
```bash
export NOTION_API_TOKEN="ntn_your_token_here"
export NOTION_DATABASE_ID="2ba968fc-73c0-8045-b1c7-c89951ece547"
export NOTION_PROJECT="Development"
```

**How it works:**
1. **Primary**: Uses Notion MCP tools via Docker (`mcp/notion:latest`)
2. **Fallback**: If MCP fails, falls back to direct Notion API calls
3. **Chunking**: Automatically handles large content by splitting into chunks of 100 blocks (Notion API limit)

**Note**: When using `create_notion_entry` tool, you can override environment variables by passing `pageId`, `databaseId`, `title`, `date`, or `project` as parameters.

**MCP Integration:**
- Connects to Notion MCP server via Docker stdio transport
- Uses `append-blocks` tool (preferred) or `create-page` tool
- Handles parameter serialization correctly
- Non-blocking: errors don't fail session close

### Optional Files

The server works with or without these files:

* `.agent-os/session-summary.md` - Session history (created if missing)
* `.agent-os/product/roadmap.md` - Product roadmap (updated if present)
* `.agent-os/product/decisions.md` - Decision log (updated if present)
* `claude.md`, `gemini.md`, `agents.md`, `.cursor/context.md` - Context files

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

### MCP Server Not Found

* Verify the path in Cursor MCP config is correct
* Use forward slashes or escaped backslashes on Windows
* Check that `dist/index.js` exists after building

### Git Commit Fails

* Ensure git is initialized: `git init`
* Configure git user:
  ```bash
  git config user.name "Your Name"
  git config user.email "your.email@example.com"
  ```
* Check you have write permissions

### Context Files Not Syncing

* Verify write permissions in the workspace directory
* Check that no other processes are locking the files
* Ensure the workspace path is correct

### Session Summary Not Updating

* Check that `.agent-os` directory exists (created automatically)
* Verify write permissions in the workspace
* Look for errors in Cursor's MCP logs

### Notion Entry Not Creating

* Verify `NOTION_API_TOKEN` is set correctly
* Check that `NOTION_PAGE_ID` or `NOTION_DATABASE_ID` is configured
* Ensure Docker can run `mcp/notion:latest` container
* Check Docker logs: `docker logs mcp-notion` (if running as container)
* Verify Notion integration has access to the target page/database
* If MCP fails, check if Python fallback script exists and is executable

## Project Structure

```
mcp-session-closer/
├── src/
│   ├── index.ts          # MCP server implementation
│   ├── session-closer.ts # Core session closing logic
│   ├── notion-client.ts  # Notion MCP client wrapper
│   └── types.ts          # TypeScript type definitions
├── dist/                 # Compiled JavaScript (generated)
├── package.json          # Node.js dependencies
├── tsconfig.json         # TypeScript configuration
├── Dockerfile            # Docker build configuration
├── docker-compose.yml    # Docker Compose configuration
└── README.md            # This file
```

## Why Use This?

### Automated Workflow

* **No Manual Steps**: Automatically syncs, updates, and commits
* **Consistent Format**: Standardized session summaries and git commits
* **Time Saver**: Closes sessions in seconds, not minutes

### Context Continuity

* **Unified Context**: All AI assistants see the same project context
* **Cross-Session Memory**: Session summaries persist across restarts
* **Decision Tracking**: Maintains history of why decisions were made

### Git Integration

* **Automatic Commits**: Never forget to commit your work
* **Descriptive Messages**: Auto-generated commit messages with context
* **Clean History**: Organized commits at natural breakpoints

## License

MIT

## Contributing

This is a personal tool, but feel free to fork and adapt it for your needs!
