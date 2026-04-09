import type {
  TapCapabilityAvailabilityReport,
  TapCapabilityAvailabilityRow,
} from "./availability-types.js";
import type {
  TapFamilyCapabilityFinding,
  TapFamilyCheckReport,
  TapFamilyCheckSeverity,
} from "./family-check-types.js";

const MCP_READ_KEYS = new Set(["mcp.listTools", "mcp.listResources", "mcp.readResource"]);
const MCP_CALL_KEY = "mcp.call";
const MCP_NATIVE_EXECUTE_KEY = "mcp.native.execute";

function findMcpRows(report: TapCapabilityAvailabilityReport): TapCapabilityAvailabilityRow[] {
  return report.rows.filter((row) => row.familyKey === "mcp");
}

function hasSupportRoute(row: TapCapabilityAvailabilityRow, fragment: string): boolean {
  return row.evidence.some((entry) =>
    entry.source === "support_matrix" && entry.ref.includes(fragment)
  );
}

function pushFinding(
  findings: TapFamilyCapabilityFinding[],
  blockers: string[],
  warnings: string[],
  input: {
    capabilityKey: string;
    severity: TapFamilyCheckSeverity;
    code: string;
    summary: string;
    metadata?: Record<string, unknown>;
  },
): void {
  findings.push({
    capabilityKey: input.capabilityKey,
    severity: input.severity,
    code: input.code,
    summary: input.summary,
    metadata: input.metadata,
  });
  if (input.severity === "blocking") {
    blockers.push(input.summary);
  } else if (input.severity === "warning") {
    warnings.push(input.summary);
  }
}

function inspectReadRows(
  rows: TapCapabilityAvailabilityRow[],
  findings: TapFamilyCapabilityFinding[],
  blockers: string[],
  warnings: string[],
): void {
  for (const row of rows.filter((entry) => MCP_READ_KEYS.has(entry.capabilityKey))) {
    const hasExplicitSharedRuntime = hasSupportRoute(row, ":shared-runtime:");
    if (!hasExplicitSharedRuntime && row.supportRoutes > 0) {
      pushFinding(findings, blockers, warnings, {
        capabilityKey: row.capabilityKey,
        severity: "blocking",
        code: "mcp_read_missing_shared_runtime_route",
        summary: `${row.capabilityKey} 没有声明 shared-runtime 路由，read family 的 truthful 边界不成立。`,
      });
    } else if (!hasExplicitSharedRuntime && row.supportRoutes === 0) {
      pushFinding(findings, blockers, warnings, {
        capabilityKey: row.capabilityKey,
        severity: "info",
        code: "mcp_read_implicit_shared_runtime_boundary",
        summary: `${row.capabilityKey} 当前没有显式 support matrix，暂按 read-family 的隐式 shared-runtime 边界处理。`,
      });
    }
    if (row.gate.status !== "ready") {
      pushFinding(findings, blockers, warnings, {
        capabilityKey: row.capabilityKey,
        severity: row.gate.status === "blocked" ? "blocking" : "warning",
        code: `mcp_read_gate_${row.gate.status}`,
        summary: `${row.capabilityKey} 当前 gate=${row.gate.status}，说明 read family 还未稳定进入 production-like 面。`,
        metadata: {
          reasons: row.gate.reasons,
        },
      });
    }
  }
}

function inspectCallRow(
  row: TapCapabilityAvailabilityRow | undefined,
  findings: TapFamilyCapabilityFinding[],
  blockers: string[],
  warnings: string[],
): void {
  if (!row) {
    pushFinding(findings, blockers, warnings, {
      capabilityKey: MCP_CALL_KEY,
      severity: "blocking",
      code: "mcp_call_missing",
      summary: "mcp.call 没有进入当前 mcp family availability report。",
    });
    return;
  }

  if (!hasSupportRoute(row, ":shared-runtime:")) {
    pushFinding(findings, blockers, warnings, {
      capabilityKey: row.capabilityKey,
      severity: "blocking",
      code: "mcp_call_missing_shared_runtime_truthfulness",
      summary: "mcp.call 没有保留 shared-runtime truthful route，call 层口径不成立。",
    });
  }

  if (hasSupportRoute(row, ":provider-native-api:") || hasSupportRoute(row, ":provider-native-agent:")) {
    pushFinding(findings, blockers, warnings, {
      capabilityKey: row.capabilityKey,
      severity: "warning",
      code: "mcp_call_crossed_native_boundary",
      summary: "mcp.call 出现 provider-native 路由信号，需要确认 shared-runtime 与 native execute 边界没有被混淆。",
    });
  }

  if (row.gate.status !== "ready") {
    pushFinding(findings, blockers, warnings, {
      capabilityKey: row.capabilityKey,
      severity: row.gate.status === "blocked" ? "blocking" : "warning",
      code: `mcp_call_gate_${row.gate.status}`,
      summary: `mcp.call 当前 gate=${row.gate.status}，说明 call 层还未稳定进入 production-like 面。`,
      metadata: {
        reasons: row.gate.reasons,
      },
    });
  }
}

function inspectNativeExecuteRow(
  row: TapCapabilityAvailabilityRow | undefined,
  findings: TapFamilyCapabilityFinding[],
  blockers: string[],
  warnings: string[],
): void {
  if (!row) {
    pushFinding(findings, blockers, warnings, {
      capabilityKey: MCP_NATIVE_EXECUTE_KEY,
      severity: "blocking",
      code: "mcp_native_execute_missing",
      summary: "mcp.native.execute 没有进入当前 mcp family availability report。",
    });
    return;
  }

  const hasProviderNative =
    hasSupportRoute(row, ":provider-native-api:") || hasSupportRoute(row, ":provider-native-agent:");
  if (!hasProviderNative) {
    pushFinding(findings, blockers, warnings, {
      capabilityKey: row.capabilityKey,
      severity: "blocking",
      code: "mcp_native_execute_missing_provider_native_route",
      summary: "mcp.native.execute 没有 provider-native 路由声明，native execute 层边界不成立。",
    });
  }

  if (!row.contract.supportsRecovery) {
    pushFinding(findings, blockers, warnings, {
      capabilityKey: row.capabilityKey,
      severity: "blocking",
      code: "mcp_native_execute_missing_recovery_contract",
      summary: "mcp.native.execute 没有 recovery 合同，native execute 无法算 production-like。",
    });
  }

  if (row.gate.status !== "ready") {
    pushFinding(findings, blockers, warnings, {
      capabilityKey: row.capabilityKey,
      severity: row.gate.status === "blocked" ? "blocking" : "warning",
      code: `mcp_native_execute_gate_${row.gate.status}`,
      summary: `mcp.native.execute 当前 gate=${row.gate.status}，说明 native execute 层还未稳定进入 production-like 面。`,
      metadata: {
        reasons: row.gate.reasons,
      },
    });
  }
}

export function createMcpFamilyAvailabilityCheck(
  report: TapCapabilityAvailabilityReport,
): TapFamilyCheckReport {
  return createMcpFamilyCheckReport(report);
}

export function createMcpFamilyCheckReport(
  report: TapCapabilityAvailabilityReport,
  now: () => Date = () => new Date(),
): TapFamilyCheckReport {
  const rows = findMcpRows(report);
  const capabilityKeys = rows.map((row) => row.capabilityKey);
  const findings: TapFamilyCapabilityFinding[] = [];
  const blockers: string[] = [];
  const warnings: string[] = [];

  inspectReadRows(rows, findings, blockers, warnings);
  inspectCallRow(
    rows.find((row) => row.capabilityKey === MCP_CALL_KEY),
    findings,
    blockers,
    warnings,
  );
  inspectNativeExecuteRow(
    rows.find((row) => row.capabilityKey === MCP_NATIVE_EXECUTE_KEY),
    findings,
    blockers,
    warnings,
  );

  const status = blockers.length > 0
    ? "blocked"
    : warnings.length > 0
      ? "review_required"
      : "ready";

  const summary = status === "ready"
    ? "MCP family 的 read / call / native execute 三层边界、truthfulness 与 support matrix 当前都满足 production-like 检查。"
    : status === "review_required"
      ? "MCP family 已具备主要 production-like 条件，但仍有需要人工复核的边界告警。"
      : "MCP family 仍存在阻塞项，当前还不能视为 production-like。";

  return {
    familyKey: "mcp",
    status,
    productionLikeReady: status === "ready",
    summary,
    capabilityKeys,
    checkedAt: now().toISOString(),
    blockers,
    warnings,
    findings,
    rows,
    metadata: {
      layers: {
        read: rows.filter((row) => MCP_READ_KEYS.has(row.capabilityKey)).map((row) => row.capabilityKey),
        call: MCP_CALL_KEY,
        nativeExecute: MCP_NATIVE_EXECUTE_KEY,
      },
    },
  };
}
