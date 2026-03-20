import {
  createCmpGitLineageNode,
  type CmpGitLineageNode,
  type CreateCmpGitLineageNodeInput,
} from "./cmp-git-types.js";

export class CmpGitLineageRegistry {
  readonly #nodesByAgentId = new Map<string, CmpGitLineageNode>();

  register(input: CreateCmpGitLineageNodeInput): CmpGitLineageNode {
    const candidate = createCmpGitLineageNode(input);
    if (this.#nodesByAgentId.has(candidate.agentId)) {
      throw new Error(`CMP git lineage already exists for agent ${candidate.agentId}.`);
    }

    if (candidate.parentAgentId) {
      const parent = this.#nodesByAgentId.get(candidate.parentAgentId);
      if (!parent) {
        throw new Error(`CMP git parent lineage ${candidate.parentAgentId} was not found.`);
      }
      if (candidate.depth !== parent.depth + 1) {
        throw new Error(
          `CMP git lineage depth mismatch for ${candidate.agentId}: expected ${parent.depth + 1}, received ${candidate.depth}.`,
        );
      }
      parent.childAgentIds = [...new Set([...parent.childAgentIds, candidate.agentId])];
      this.#nodesByAgentId.set(parent.agentId, parent);
    }

    this.#nodesByAgentId.set(candidate.agentId, candidate);
    return candidate;
  }

  get(agentId: string): CmpGitLineageNode | undefined {
    return this.#nodesByAgentId.get(agentId);
  }

  list(): readonly CmpGitLineageNode[] {
    return [...this.#nodesByAgentId.values()];
  }

  listChildren(parentAgentId: string): readonly CmpGitLineageNode[] {
    return this.list().filter((node) => node.parentAgentId === parentAgentId);
  }

  listPeers(agentId: string): readonly CmpGitLineageNode[] {
    const node = this.#nodesByAgentId.get(agentId);
    if (!node) {
      return [];
    }

    return this.list().filter((entry) => {
      return entry.agentId !== agentId && entry.parentAgentId === node.parentAgentId;
    });
  }
}
