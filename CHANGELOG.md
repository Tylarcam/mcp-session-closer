# Changelog

## [1.1.0] - 2026-02-08

### Added
- **Notion MCP Integration**: Direct integration with Notion MCP server via Docker
- **New File**: `src/notion-client.ts` - Notion MCP client wrapper
- **Configuration**: Support for `NOTION_PAGE_ID` and `NOTION_DATABASE_ID` environment variables
- **Fallback Support**: Automatic fallback to Python script if MCP fails

### Changed
- **Session Closer**: Replaced Python script execution with MCP tool calls
- **Notion Entry Creation**: Now uses `append-blocks` MCP tool (avoids serialization issues)
- **Error Handling**: Improved error handling with graceful fallbacks

### Fixed
- **Serialization Issue**: Fixed `parent` parameter serialization by using `append-blocks` instead of `create-page`
- **Type Safety**: Fixed TypeScript type errors in notion-client

### Documentation
- Updated README.md with Notion integration details
- Added troubleshooting section for Notion entry creation
- Created NOTION_MCP_INTEGRATION.md with implementation details

## [1.0.0] - Initial Release

### Features
- `end_session` tool for closing Cursor sessions
- `sync_context_files` tool for syncing context files
- `update_session_summary` tool for updating summaries
- Git integration with automatic commits
- Agent OS file updates

