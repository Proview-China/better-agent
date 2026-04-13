export type GoalId = string;

export interface GoalConstraint {
  key: string;
  value: unknown;
  description?: string;
}

export interface GoalCriterion {
  id: string;
  description: string;
  required?: boolean;
}

export interface GoalFrameSource {
  goalId: GoalId;
  sessionId?: string;
  runId?: string;
  userInput: string;
  inputRefs?: string[];
  constraints?: GoalConstraint[];
  metadata?: Record<string, unknown>;
}

export interface GoalFrameNormalized {
  goalId: GoalId;
  taskStatement: string;
  successCriteria: GoalCriterion[];
  failureCriteria: GoalCriterion[];
  constraints: GoalConstraint[];
  inputRefs: string[];
  metadata?: Record<string, unknown>;
}

export interface GoalPromptBlock {
  key: string;
  title?: string;
  lines: string[];
  metadata?: Record<string, unknown>;
}

export interface GoalFrameCompiled {
  goalId: GoalId;
  instructionText: string;
  promptBlocks?: GoalPromptBlock[];
  successCriteria: GoalCriterion[];
  failureCriteria: GoalCriterion[];
  constraints: GoalConstraint[];
  inputRefs: string[];
  cacheKey: string;
  metadata?: Record<string, unknown>;
}
