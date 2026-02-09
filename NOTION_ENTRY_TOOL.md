# Notion Entry Tool - Usage Guide

## Overview

The `create_notion_entry` tool allows Cursor agents to create Notion entries directly from markdown content. This is perfect for adding completion reports, documentation, session summaries, or any structured content to your Notion workspace.

## Features

- ✅ Convert markdown to Notion blocks automatically
- ✅ Append to existing pages or create new pages in databases
- ✅ Handle large content with automatic chunking (100 blocks per request)
- ✅ Extract metadata (title, date) from markdown
- ✅ Fallback to direct Notion API if MCP tools unavailable
- ✅ Flexible configuration via parameters or environment variables

## Usage Examples

### Basic Usage - Append to Existing Page

```javascript
// In Cursor chat or agent code
Use create_notion_entry with markdownContent: "# My Report\n\nThis is the content..." and pageId: "your-page-id"
```

### Create New Page in Database

```javascript
Use create_notion_entry with markdownContent: "# Completion Report\n\n**Date**: 2026-02-08\n\nContent here...", databaseId: "your-database-id"
```

### With Custom Metadata

```javascript
Use create_notion_entry with markdownContent: "# Report", databaseId: "your-database-id", title: "Custom Title", date: "2026-02-08", project: "Development"
```

### Using Environment Variables

If you have `NOTION_DATABASE_ID` set in your environment:

```javascript
Use create_notion_entry with markdownContent: "# My Report\n\nContent..."
```

## Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `markdownContent` | string | ✅ Yes | The markdown content to add to Notion |
| `pageId` | string | ❌ No* | Notion page ID to append blocks to |
| `databaseId` | string | ❌ No* | Notion database ID to create new page in |
| `title` | string | ❌ No | Title for new page (extracted from H1 if not provided) |
| `date` | string | ❌ No | Date in YYYY-MM-DD format (extracted from markdown if not provided) |
| `project` | string | ❌ No | Project name (uses NOTION_PROJECT env var or "Development" by default) |

\* Either `pageId` or `databaseId` must be provided (via parameter or environment variable)

## Environment Variables

The tool uses these environment variables if parameters are not provided:

- `NOTION_API_TOKEN` or `NOTION_API_KEY` or `NOTION_TOKEN` - Required
- `NOTION_PAGE_ID` - For appending to existing page
- `NOTION_DATABASE_ID` - For creating new page in database
- `NOTION_PROJECT` - Default project name (default: "Development")

## How It Works

1. **Markdown Conversion**: The markdown content is converted to Notion blocks using the `NotionMCPClient.markdownToBlocks()` method
2. **Chunking**: If content exceeds 100 blocks, it's automatically split into chunks
3. **Page Creation** (if using database):
   - Creates a new page with properties (title, date, project, etc.)
   - Extracts page ID from the response
4. **Block Appending**: Appends all content blocks to the page (in chunks if needed)
5. **Fallback**: If MCP tools fail, falls back to direct Notion API calls

## Markdown Support

The tool supports standard markdown:

- Headers (`#`, `##`, `###`)
- Bullet lists (`-`, `*`)
- Paragraphs
- Code blocks (converted to paragraph blocks)
- Bold/italic (preserved in rich text)

## Example: Completion Report

```markdown
# PowerShell Command Syntax Fix - Completion Report

**Date**: 2026-02-08
**Session**: PowerShell Command Syntax Error Resolution
**Status**: ✅ Complete

## Problem Statement

Commands using bash syntax (`&&` for command chaining) were failing in PowerShell...

## Solution Implemented

Implemented **Approach 3: Defense in Depth**...

## Results

- ✅ Commands with `&&` are automatically normalized on Windows
- ✅ No more PowerShell syntax errors
```

This will be converted to properly formatted Notion blocks with headers, paragraphs, and lists.

## Error Handling

The tool returns a structured response:

**Success:**
```json
{
  "success": true,
  "pageId": "302968fc-73c0-81d2-b3b6-c2c5f1d4281b",
  "message": "Notion entry created/updated successfully! Page ID: 302968fc-73c0-81d2-b3b6-c2c5f1d4281b"
}
```

**Error:**
```json
{
  "success": false,
  "error": "Notion API key not found. Set NOTION_API_TOKEN, NOTION_API_KEY, or NOTION_TOKEN environment variable."
}
```

## Troubleshooting

### Error: "Notion API key not found"
- Set `NOTION_API_TOKEN`, `NOTION_API_KEY`, or `NOTION_TOKEN` environment variable
- Make sure the token starts with `ntn_`

### Error: "Either pageId or databaseId must be provided"
- Provide either `pageId` or `databaseId` as a parameter
- Or set `NOTION_PAGE_ID` or `NOTION_DATABASE_ID` environment variable

### Error: "Failed to append blocks"
- Check that your Notion API token has access to the page/database
- Verify the page/database ID is correct
- Ensure the integration has been granted access in Notion

### Large Content Issues
- The tool automatically handles chunking, but very large content (>1000 blocks) may take time
- Consider splitting very large reports into multiple entries

## Integration with Cursor Agents

Cursor agents can use this tool to:

1. **Create completion reports** after finishing tasks
2. **Document decisions** made during development
3. **Log session summaries** with structured content
4. **Add documentation** to Notion from markdown files
5. **Create structured entries** from any markdown content

Example agent workflow:
```
1. Agent completes a task
2. Agent generates markdown completion report
3. Agent calls create_notion_entry with the report
4. Entry is automatically added to Notion database
```

## Best Practices

1. **Use databases** for structured entries (better organization)
2. **Use pages** for appending to existing documentation
3. **Include metadata** in markdown (Date, Status, etc.) for better extraction
4. **Use H1 headers** for titles (automatically extracted)
5. **Format dates** as `**Date**: YYYY-MM-DD` for automatic extraction

