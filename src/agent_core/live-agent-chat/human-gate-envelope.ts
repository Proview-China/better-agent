export interface HumanGateDecisionEnvelope {
  type: "human_gate_decision";
  gateId: string;
  action: "approve" | "approve_always" | "reject";
  note?: string;
}

export function formatHumanGateDecisionEnvelope(
  payload: Omit<HumanGateDecisionEnvelope, "type">,
): string {
  return JSON.stringify({
    type: "human_gate_decision",
    ...payload,
  });
}

export function parseHumanGateDecisionEnvelope(
  raw: string,
): HumanGateDecisionEnvelope | undefined {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("{")) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    if (parsed.type !== "human_gate_decision") {
      return undefined;
    }
    const gateId = typeof parsed.gateId === "string" ? parsed.gateId.trim() : "";
    const action = parsed.action;
    if (
      !gateId
      || (action !== "approve" && action !== "approve_always" && action !== "reject")
    ) {
      return undefined;
    }
    return {
      type: "human_gate_decision",
      gateId,
      action,
      note: typeof parsed.note === "string" && parsed.note.trim().length > 0
        ? parsed.note.trim()
        : undefined,
    };
  } catch {
    return undefined;
  }
}
