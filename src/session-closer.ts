import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { SessionSummary, ProjectContext, Decision, AgentOSFiles } from './types.js';

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
}

