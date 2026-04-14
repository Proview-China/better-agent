import type { CmpDbAdapterLike, CmpDbLiveExecutor } from "../cmp-db/index.js";
import type { CmpGitBackend } from "../cmp-git/index.js";
import type { CmpRedisMqAdapter } from "../cmp-mq/index.js";

export interface CmpInfraBackends {
  git?: CmpGitBackend;
  db?: CmpDbAdapterLike;
  dbExecutor?: CmpDbLiveExecutor;
  mq?: CmpRedisMqAdapter;
}

export function createCmpInfraBackends(input: CmpInfraBackends = {}): CmpInfraBackends {
  return {
    git: input.git,
    db: input.db,
    dbExecutor: input.dbExecutor,
    mq: input.mq,
  };
}
