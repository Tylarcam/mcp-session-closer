export interface SessionSummary {
  timestamp: string;
  accomplishments: string[];
  decisions: Decision[];
  blockers: string[];
  nextSteps: string[];
  filesChanged: string[];
}

export interface Decision {
  date: string;
  status: string;
  details: string;
  context: string;
  alternatives?: string[];
  rationale: string;
  consequences: string[];
}

export interface ProjectContext {
  projectName: string;
  overview: string;
  currentStatus: {
    phase: string;
    progress: string;
    lastSession: string;
  };
  recentWork: string;
  technologyStack: string;
  keyDecisions: Decision[];
  projectStructure: string;
  nextSteps: string[];
  relatedDocuments: string[];
}

export interface AgentOSFiles {
  mission?: string;
  roadmap?: string;
  decisions?: Decision[];
  techStack?: string;
  sessionSummary?: SessionSummary[];
}

