import * as fs from 'fs/promises';
import { existsSync } from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { SessionSummary, ProjectContext, Decision, AgentOSFiles } from './types.js';
import { NotionMCPClient, type NotionBlock } from './notion-client.js';

const execAsync = promisify(exec);

export class SessionCloser {
  private projectRoot: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
  }

  /**
   * Main entry point for closing a session
   */
  async closeSession(conversationSummary: string): Promise<{
    success: boolean;
    summary: SessionSummary;
    filesUpdated: string[];
    gitCommit?: string;
  }> {
    const timestamp = new Date().toISOString();
    const summary = await this.gatherSessionSummary(conversationSummary, timestamp);
    
    const filesUpdated: string[] = [];

    // 1. Update session summary file
    await this.updateSessionSummary(summary);
    filesUpdated.push('.agent-os/session-summary.md');

    // 1.5. Create Notion database entry (after summary is updated)
    await this.createNotionEntry(summary);

    // 2. Update Agent OS files if they exist
    const agentOSUpdates = await this.updateAgentOSFiles(summary);
    filesUpdated.push(...agentOSUpdates);

    // 3. Sync context files
    const contextFiles = await this.syncContextFiles(summary);
    filesUpdated.push(...contextFiles);

    // 4. Git commit
    let gitCommit: string | undefined;
    if (await this.isGitRepo()) {
      gitCommit = await this.commitChanges(summary, filesUpdated);
    }

    return {
      success: true,
      summary,
      filesUpdated,
      gitCommit
    };
  }

  /**
   * Gather session summary from conversation
   */
  private async gatherSessionSummary(
    conversationSummary: string,
    timestamp: string
  ): Promise<SessionSummary> {
    const accomplishments = this.extractAccomplishments(conversationSummary);
    const decisions = this.extractDecisions(conversationSummary);
    const blockers = this.extractBlockers(conversationSummary);
    const nextSteps = this.extractNextSteps(conversationSummary);
    const filesChanged = await this.getChangedFiles();

    return {
      timestamp,
      accomplishments,
      decisions,
      blockers,
      nextSteps,
      filesChanged
    };
  }

  /**
   * Update session summary file
   */
  private async updateSessionSummary(summary: SessionSummary): Promise<void> {
    const summaryPath = path.join(this.projectRoot, '.agent-os', 'session-summary.md');
    
    // Ensure directory exists
    await fs.mkdir(path.dirname(summaryPath), { recursive: true });

    let existingContent = '';
    try {
      existingContent = await fs.readFile(summaryPath, 'utf-8');
    } catch {
      // File doesn't exist, create it
      existingContent = '# Session Summary\n\n';
    }

    const sessionEntry = this.formatSessionEntry(summary);
    const updatedContent = existingContent + '\n' + sessionEntry;

    await fs.writeFile(summaryPath, updatedContent, 'utf-8');
  }

  /**
   * Update Agent OS product files
   */
  private async updateAgentOSFiles(summary: SessionSummary): Promise<string[]> {
    const updatedFiles: string[] = [];

    // Update roadmap if items were completed
    const roadmapPath = path.join(this.projectRoot, '.agent-os', 'product', 'roadmap.md');
    if (await this.fileExists(roadmapPath)) {
      await this.updateRoadmap(summary);
      updatedFiles.push('.agent-os/product/roadmap.md');
    }

    // Update decisions if new decisions were made
    if (summary.decisions.length > 0) {
      const decisionsPath = path.join(this.projectRoot, '.agent-os', 'product', 'decisions.md');
      if (await this.fileExists(decisionsPath)) {
        await this.updateDecisions(summary.decisions);
        updatedFiles.push('.agent-os/product/decisions.md');
      }
    }

    return updatedFiles;
  }

  /**
   * Sync all context files
   */
  private async syncContextFiles(summary: SessionSummary): Promise<string[]> {
    const contextFiles = ['claude.md', 'gemini.md', 'agents.md', '.cursor/context.md'];
    const updatedFiles: string[] = [];

    // Read Agent OS context if available
    const agentOSContext = await this.getAgentOSContext();

    // Generate unified context
    const unifiedContext = this.generateUnifiedContext(agentOSContext, summary);

    // Update each context file
    for (const file of contextFiles) {
      const filePath = path.join(this.projectRoot, file);
      
      // Skip if file doesn't exist and isn't required
      if (!await this.fileExists(filePath) && file !== '.cursor/context.md') {
        continue;
      }

      // Ensure directory exists
      await fs.mkdir(path.dirname(filePath), { recursive: true });

      await fs.writeFile(filePath, unifiedContext, 'utf-8');
      updatedFiles.push(file);
    }

    return updatedFiles;
  }

  /**
   * Generate unified context from Agent OS and session summary
   */
  private generateUnifiedContext(
    agentOS: AgentOSFiles,
    summary: SessionSummary
  ): string {
    const projectName = this.getProjectName();
    const recentWork = this.formatRecentWork(summary);
    const nextSteps = summary.nextSteps.length > 0 
      ? summary.nextSteps.map(s => `- [ ] ${s}`).join('\n')
      : agentOS.roadmap 
        ? 'See roadmap for next steps'
        : 'Continue development';

    return `# Project: ${projectName}

## Overview
${agentOS.mission || 'Development project'}

## Current Status
- Phase: ${this.getCurrentPhase(agentOS)}
- Progress: ${this.calculateProgress(agentOS)}
- Last session: ${new Date(summary.timestamp).toLocaleDateString()}

## Recent Work
${recentWork}

## Technology Stack
${agentOS.techStack || 'See tech-stack.md'}

## Key Decisions
${this.formatDecisions(agentOS.decisions || [])}

## Project Structure
\`\`\`
${this.getProjectStructure()}
\`\`\`

## Next Steps
${nextSteps}

## Related Documents
- \`.agent-os/product/mission.md\`: Product mission
- \`.agent-os/product/roadmap.md\`: Development roadmap
- \`.agent-os/product/decisions.md\`: Decision log
- \`.agent-os/session-summary.md\`: Session history
`;
  }

  /**
   * Commit changes to git
   */
  private async commitChanges(
    summary: SessionSummary,
    filesUpdated: string[]
  ): Promise<string> {
    try {
      // Stage all changes
      await execAsync('git add -A', { cwd: this.projectRoot });

      // Create commit message
      const commitType = this.determineCommitType(summary);
      const commitMessage = this.createCommitMessage(commitType, summary, filesUpdated);

      // Commit
      const { stdout } = await execAsync(
        `git commit -m "${commitMessage.replace(/"/g, '\\"')}"`,
        { cwd: this.projectRoot }
      );

      return commitMessage;
    } catch (error: any) {
      if (error.message.includes('nothing to commit')) {
        return 'No changes to commit';
      }
      throw error;
    }
  }

  // Helper methods

  private extractAccomplishments(text: string): string[] {
    const accomplishments: string[] = [];
    const lines = text.split('\n');
    
    for (const line of lines) {
      if (line.match(/✅|completed|finished|implemented|created|added/i)) {
        accomplishments.push(line.trim());
      }
    }

    return accomplishments.length > 0 ? accomplishments : ['Work completed'];
  }

  private extractDecisions(text: string): Decision[] {
    const decisions: Decision[] = [];
    // Extract decision patterns - simplified for now
    const decisionPatterns = text.match(/decision[:\s]+(.+?)(?:\n|$)/gi);
    if (decisionPatterns) {
      decisionPatterns.forEach(pattern => {
        const match = pattern.match(/decision[:\s]+(.+)/i);
        if (match) {
          decisions.push({
            date: new Date().toISOString().split('T')[0],
            status: 'accepted',
            details: match[1].trim(),
            context: 'Session discussion',
            rationale: 'Discussed during session',
            consequences: []
          });
        }
      });
    }
    return decisions;
  }

  private extractBlockers(text: string): string[] {
    const blockers: string[] = [];
    const lines = text.split('\n');
    
    for (const line of lines) {
      if (line.match(/blocked|blocker|issue|problem|error/i)) {
        blockers.push(line.trim());
      }
    }

    return blockers;
  }

  private extractNextSteps(text: string): string[] {
    const steps: string[] = [];
    const lines = text.split('\n');
    
    for (const line of lines) {
      if (line.match(/next|todo|TODO|FIXME|next step/i)) {
        steps.push(line.trim());
      }
    }

    return steps;
  }

  private async getChangedFiles(): Promise<string[]> {
    try {
      const { stdout } = await execAsync('git diff --name-only', { cwd: this.projectRoot });
      return stdout.split('\n').filter(f => f.trim());
    } catch {
      return [];
    }
  }

  private formatSessionEntry(summary: SessionSummary): string {
    return `## Session: ${new Date(summary.timestamp).toLocaleString()}

### Accomplishments
${summary.accomplishments.map(a => `- ${a}`).join('\n')}

### Decisions Made
${summary.decisions.length > 0 
  ? summary.decisions.map(d => `- ${d.details}`).join('\n')
  : '- None'}

### Blockers
${summary.blockers.length > 0 
  ? summary.blockers.map(b => `- ${b}`).join('\n')
  : '- None'}

### Next Steps
${summary.nextSteps.map(s => `- ${s}`).join('\n')}

### Files Changed
${summary.filesChanged.map(f => `- ${f}`).join('\n')}

---
`;
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private async isGitRepo(): Promise<boolean> {
    return this.fileExists(path.join(this.projectRoot, '.git'));
  }

  private async getAgentOSContext(): Promise<AgentOSFiles> {
    const missionPath = path.join(this.projectRoot, '.agent-os', 'product', 'mission.md');
    const roadmapPath = path.join(this.projectRoot, '.agent-os', 'product', 'roadmap.md');
    const decisionsPath = path.join(this.projectRoot, '.agent-os', 'product', 'decisions.md');
    const techStackPath = path.join(this.projectRoot, '.agent-os', 'product', 'tech-stack.md');

    const [mission, roadmap, decisions, techStack] = await Promise.all([
      this.readFileIfExists(missionPath),
      this.readFileIfExists(roadmapPath),
      this.readFileIfExists(decisionsPath),
      this.readFileIfExists(techStackPath)
    ]);

    return {
      mission: mission || undefined,
      roadmap: roadmap || undefined,
      techStack: techStack || undefined,
      decisions: decisions ? this.parseDecisions(decisions) : undefined
    };
  }

  private async readFileIfExists(filePath: string): Promise<string | null> {
    try {
      return await fs.readFile(filePath, 'utf-8');
    } catch {
      return null;
    }
  }

  private parseDecisions(content: string): Decision[] {
    // Simple parser - enhance as needed
    const decisions: Decision[] = [];
    const decisionBlocks = content.split(/## Decision:/);
    
    for (let i = 1; i < decisionBlocks.length; i++) {
      const block = decisionBlocks[i];
      const dateMatch = block.match(/\*\*Date:\*\*\s*(.+?)(?:\n|$)/i);
      const detailsMatch = block.match(/\*\*Decision:\*\*\s*(.+?)(?:\n|$)/i);
      const rationaleMatch = block.match(/\*\*Rationale:\*\*\s*(.+?)(?:\n|$)/i);
      
      if (detailsMatch) {
        decisions.push({
          date: dateMatch ? dateMatch[1].trim() : new Date().toISOString().split('T')[0],
          status: 'accepted',
          details: detailsMatch[1].trim(),
          context: 'From decisions.md',
          rationale: rationaleMatch ? rationaleMatch[1].trim() : '',
          consequences: []
        });
      }
    }
    
    return decisions;
  }

  private formatDecisions(decisions: Decision[]): string {
    if (decisions.length === 0) return 'None recorded';
    return decisions.map(d => `- **${d.details}** (${d.date}): ${d.rationale}`).join('\n');
  }

  private getProjectName(): string {
    return path.basename(this.projectRoot);
  }

  private getCurrentPhase(agentOS: AgentOSFiles): string {
    // Extract from roadmap if available
    if (agentOS.roadmap) {
      const phaseMatch = agentOS.roadmap.match(/## Phase \d+[:\s]+(.+?)(?:\n|$)/i);
      if (phaseMatch) {
        return phaseMatch[1].trim();
      }
    }
    return 'In Progress';
  }

  private calculateProgress(agentOS: AgentOSFiles): string {
    // Calculate from roadmap if available
    if (agentOS.roadmap) {
      const completedMatch = agentOS.roadmap.match(/\[x\]/gi);
      const totalMatch = agentOS.roadmap.match(/\[[x\s]\]/gi);
      if (completedMatch && totalMatch) {
        const percent = Math.round((completedMatch.length / totalMatch.length) * 100);
        return `${percent}%`;
      }
    }
    return 'Ongoing';
  }

  private formatRecentWork(summary: SessionSummary): string {
    if (summary.accomplishments.length === 0) {
      return 'Session work completed';
    }
    return summary.accomplishments.join('\n');
  }

  private getProjectStructure(): string {
    // Simplified - could use tree command or file system walk
    return 'project/\n├── .agent-os/\n│   ├── product/\n│   └── specs/\n└── [app structure]';
  }

  private determineCommitType(summary: SessionSummary): string {
    if (summary.accomplishments.some(a => a.match(/feat|feature|add/i))) return 'feat';
    if (summary.accomplishments.some(a => a.match(/fix|bug|error/i))) return 'fix';
    if (summary.accomplishments.some(a => a.match(/doc|readme/i))) return 'docs';
    return 'chore';
  }

  private createCommitMessage(
    type: string,
    summary: SessionSummary,
    filesUpdated: string[]
  ): string {
    const shortDesc = summary.accomplishments[0] || 'Session work';
    const details = summary.accomplishments.join('\n');
    const files = filesUpdated.map(f => `- ${f}`).join('\n');

    return `${type}: ${shortDesc}\n\n${details}\n\nFiles changed:\n${files}`;
  }

  private async updateRoadmap(summary: SessionSummary): Promise<void> {
    // Implementation to mark completed items in roadmap
    const roadmapPath = path.join(this.projectRoot, '.agent-os', 'product', 'roadmap.md');
    try {
      let content = await fs.readFile(roadmapPath, 'utf-8');
      // Simple implementation - mark items as complete if they match accomplishments
      // This could be enhanced with more sophisticated matching
      summary.accomplishments.forEach(acc => {
        // Look for matching roadmap items and mark them complete
        content = content.replace(
          new RegExp(`(\\[ \\]\\s*${acc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'),
          '[x] $1'
        );
      });
      await fs.writeFile(roadmapPath, content, 'utf-8');
    } catch (error) {
      // Silently fail if roadmap doesn't exist or can't be updated
    }
  }

  private async updateDecisions(decisions: Decision[]): Promise<void> {
    const decisionsPath = path.join(this.projectRoot, '.agent-os', 'product', 'decisions.md');
    try {
      let content = await fs.readFile(decisionsPath, 'utf-8');
      const newDecisions = decisions.map(d => `
## Decision: ${d.details}

**Date:** ${d.date}
**Status:** ${d.status}
**Context:** ${d.context}
**Rationale:** ${d.rationale}
**Consequences:** ${d.consequences.join(', ') || 'None'}
`).join('\n');
      content += '\n' + newDecisions;
      await fs.writeFile(decisionsPath, content, 'utf-8');
    } catch (error) {
      // Silently fail if decisions file doesn't exist or can't be updated
    }
  }

  /**
   * Create Notion entry from latest session summary using MCP
   * Non-blocking: logs errors but doesn't fail session close
   * Falls back to Python script if MCP fails
   */
  private async createNotionEntry(summary?: SessionSummary): Promise<void> {
    // Try MCP first, fallback to Python script
    try {
      await this.createNotionEntryViaMCP(summary);
    } catch (mcpError: any) {
      console.warn('⚠️ Notion MCP failed, falling back to Python script:', mcpError.message);
      await this.createNotionEntryViaPython();
    }
  }

  /**
   * Create Notion entry using MCP tools
   */
  private async createNotionEntryViaMCP(summary?: SessionSummary): Promise<void> {
    try {
      // Get configuration
      const pageId = process.env.NOTION_PAGE_ID;
      const databaseId = process.env.NOTION_DATABASE_ID;
      const notionKey = process.env.NOTION_API_KEY || 
                       process.env.NOTION_TOKEN ||
                       await this.getNotionKeyFromKeysFile(this.projectRoot);

      if (!notionKey) {
        throw new Error('Notion API key not found');
      }

      if (!pageId && !databaseId) {
        throw new Error('Neither NOTION_PAGE_ID nor NOTION_DATABASE_ID configured');
      }

      // Initialize Notion MCP client
      const notionClient = new NotionMCPClient();
      
      // Set API token in environment for Docker container
      process.env.NOTION_API_TOKEN = notionKey;

      await notionClient.connect();

      if (pageId) {
        // Append to existing page (preferred - avoids parent serialization)
        // Read latest session summary for blocks
        const summaryPath = path.join(this.projectRoot, '.agent-os', 'session-summary.md');
        const summaryContent = await this.readFileIfExists(summaryPath);
        
        if (summaryContent) {
          const blocks = this.formatSummaryAsNotionBlocks(summaryContent);
          await notionClient.appendBlocks(pageId, blocks);
          console.log('✅ Notion entry appended to page successfully');
        }
      } else if (databaseId) {
        // Create new page in database with proper properties
        const properties = summary 
          ? this.createPagePropertiesFromSummary(summary)
          : await this.createPagePropertiesFromSummaryFile();
        
        await notionClient.createPage(
          { type: 'database_id', database_id: databaseId },
          properties
        );
        console.log('✅ Notion entry created in database successfully');
      }

      await notionClient.close();
    } catch (error: any) {
      throw new Error(`MCP Notion entry creation failed: ${error.message}`);
    }
  }

  /**
   * Fallback: Create Notion entry using Python script
   */
  private async createNotionEntryViaPython(): Promise<void> {
    try {
      const workspace = process.env.CURSOR_WORKSPACE || this.projectRoot;
      const scriptPath = path.join(
        workspace,
        'Automation',
        'scripts',
        'create_daily_task_session_from_summary.py'
      );

      // Check if script exists
      if (!existsSync(scriptPath)) {
        console.log('Notion entry script not found, skipping...');
        return;
      }

      // Get Notion API key from environment or keys.txt
      const notionKey = process.env.NOTION_API_KEY || 
                       process.env.NOTION_TOKEN ||
                       await this.getNotionKeyFromKeysFile(workspace);

      if (!notionKey) {
        console.log('Notion API key not found, skipping entry creation...');
        return;
      }

      // Set environment variable for script
      const env = {
        ...process.env,
        NOTION_API_KEY: notionKey
      };

      // Determine Python command (python3 on Unix, python on Windows)
      const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';

      // Run Python script (non-blocking, with timeout)
      const result = await execAsync(
        `${pythonCmd} "${scriptPath}"`,
        { 
          cwd: workspace,
          env: env,
          timeout: 30000, // 30 second timeout
          maxBuffer: 10 * 1024 * 1024 // 10MB buffer
        }
      );

      if (result.stdout) {
        console.log('Notion entry creation output:', result.stdout);
      }
      if (result.stderr) {
        console.warn('Notion entry creation warnings:', result.stderr);
      }

      console.log('✅ Notion entry created successfully (via Python script)');
    } catch (error: any) {
      // Non-blocking: log error but don't fail session close
      console.warn('⚠️ Failed to create Notion entry (Python fallback):', error.message);
    }
  }

  /**
   * Format session summary markdown as Notion blocks
   */
  private formatSummaryAsNotionBlocks(summaryContent: string): NotionBlock[] {
    // Use the static method from NotionMCPClient
    return NotionMCPClient.markdownToBlocks(summaryContent);
  }

  /**
   * Create Notion page properties from SessionSummary object
   * Matches the exact format required by the Notion API for Daily Task Session Tracker database
   */
  private createPagePropertiesFromSummary(summary: SessionSummary): any {
    // Extract session title from accomplishments or use default
    const title = summary.accomplishments && summary.accomplishments.length > 0
      ? summary.accomplishments[0]
      : 'Session Summary';

    // Format date from timestamp (YYYY-MM-DD format)
    const dateStr = summary.timestamp 
      ? new Date(summary.timestamp).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];

    // Helper function to join array items into rich_text
    const joinAsRichText = (items: string[]): any => {
      if (!items || items.length === 0) {
        return [];
      }
      return [{
        text: {
          content: items.join('\n')
        }
      }];
    };

    // Build properties object matching exact Notion API format
    const properties: any = {
      'Session Title': {
        title: [{
          text: {
            content: title
          }
        }]
      },
      'Date': {
        date: {
          start: dateStr
        }
      },
      'Complete': {
        checkbox: false
      },
      'Follow-up Required': {
        checkbox: false
      }
    };

    // Add Accomplishments if present
    if (summary.accomplishments && summary.accomplishments.length > 0) {
      properties['Accomplishments'] = {
        rich_text: joinAsRichText(summary.accomplishments)
      };
    }

    // Add Next Steps if present
    if (summary.nextSteps && summary.nextSteps.length > 0) {
      properties['Next Steps'] = {
        rich_text: joinAsRichText(summary.nextSteps)
      };
    }

    // Add Blockers if present
    if (summary.blockers && summary.blockers.length > 0) {
      properties['Blockers'] = {
        rich_text: joinAsRichText(summary.blockers)
      };
    }

    // Add Decisions Made if present
    if (summary.decisions && summary.decisions.length > 0) {
      const decisionsText = summary.decisions.map(d => d.details).join('\n');
      properties['Decisions Made'] = {
        rich_text: [{
          text: {
            content: decisionsText
          }
        }]
      };
    }

    // Add Files Changed if present
    if (summary.filesChanged && summary.filesChanged.length > 0) {
      properties['Files Changed'] = {
        rich_text: joinAsRichText(summary.filesChanged)
      };
    }

    // Project can be set via environment variable or default to "Development"
    const project = process.env.NOTION_PROJECT || 'Development';
    // Validate project is one of the allowed values
    const validProjects = [
      'Dissertation', 'Research', 'Work', 'Personal', 'Instruction',
      'Side Project', 'Consulting', 'Administrative', 'Development', 'Planning'
    ];
    const validProject = validProjects.includes(project) ? project : 'Development';
    
    properties['Project'] = {
      select: {
        name: validProject
      }
    };

    return properties;
  }

  /**
   * Create Notion page properties from summary file (fallback when summary object not available)
   */
  private async createPagePropertiesFromSummaryFile(): Promise<any> {
    const summaryPath = path.join(this.projectRoot, '.agent-os', 'session-summary.md');
    const summaryContent = await this.readFileIfExists(summaryPath);
    
    if (!summaryContent) {
      throw new Error('No session summary found');
    }

    // Parse summary from markdown content
    const summary = this.parseSummaryFromContent(summaryContent);
    
    // Convert to SessionSummary format
    const sessionSummary: SessionSummary = {
      timestamp: summary.timestamp,
      accomplishments: summary.accomplishments,
      decisions: summary.decisions,
      blockers: summary.blockers,
      nextSteps: summary.nextSteps,
      filesChanged: summary.filesChanged
    };

    return this.createPagePropertiesFromSummary(sessionSummary);
  }

  /**
   * Parse session summary from markdown content
   * Extracts accomplishments, decisions, blockers, next steps, and files changed
   */
  private parseSummaryFromContent(content: string): {
    timestamp: string;
    accomplishments: string[];
    decisions: Decision[];
    blockers: string[];
    nextSteps: string[];
    filesChanged: string[];
  } {
    const lines = content.split('\n');
    const result = {
      timestamp: new Date().toISOString(),
      accomplishments: [] as string[],
      decisions: [] as Decision[],
      blockers: [] as string[],
      nextSteps: [] as string[],
      filesChanged: [] as string[]
    };

    let currentSection = '';
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      if (trimmed.startsWith('### Accomplishments')) {
        currentSection = 'accomplishments';
        continue;
      } else if (trimmed.startsWith('### Decisions Made') || trimmed.startsWith('### Key Decisions')) {
        currentSection = 'decisions';
        continue;
      } else if (trimmed.startsWith('### Blockers')) {
        currentSection = 'blockers';
        continue;
      } else if (trimmed.startsWith('### Next Steps') || trimmed.startsWith('### Next Steps')) {
        currentSection = 'nextSteps';
        continue;
      } else if (trimmed.startsWith('### Files Changed') || trimmed.startsWith('### Changed Files')) {
        currentSection = 'filesChanged';
        continue;
      } else if (trimmed.startsWith('##') || trimmed.startsWith('#')) {
        currentSection = '';
        continue;
      }

      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        const item = trimmed.substring(2).trim();
        if (currentSection === 'accomplishments' && item) {
          result.accomplishments.push(item);
        } else if (currentSection === 'blockers' && item) {
          result.blockers.push(item);
        } else if (currentSection === 'nextSteps' && item) {
          result.nextSteps.push(item);
        } else if (currentSection === 'filesChanged' && item) {
          result.filesChanged.push(item);
        }
      } else if (currentSection === 'decisions' && trimmed) {
        // Decisions might be formatted as "- Decision text" or just "Decision text"
        const decisionText = trimmed.startsWith('- ') ? trimmed.substring(2).trim() : trimmed;
        if (decisionText) {
          result.decisions.push({
            date: new Date().toISOString().split('T')[0],
            status: 'Active',
            details: decisionText,
            context: 'From session summary',
            rationale: '',
            consequences: []
          });
        }
      }
    }

    return result;
  }

  /**
   * Read Notion API key from keys.txt file in workspace root
   */
  private async getNotionKeyFromKeysFile(workspace: string): Promise<string | null> {
    try {
      const keysPath = path.join(workspace, 'keys.txt');
      if (!existsSync(keysPath)) {
        return null;
      }

      const content = await fs.readFile(keysPath, 'utf-8');
      const match = content.match(/NOTION_API_KEY\s*=\s*([^\n]+)/);
      if (match) {
        return match[1].trim().replace(/^["']|["']$/g, '');
      }
    } catch (error) {
      // Ignore errors silently
    }
    return null;
  }
}

