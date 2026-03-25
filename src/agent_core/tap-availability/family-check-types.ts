import type { TapAvailabilityFamilyKey, TapCapabilityAvailabilityRow } from "./availability-types.js";

export const TAP_FAMILY_CHECK_STATUSES = [
  "ready",
  "review_required",
  "blocked",
] as const;
export type TapFamilyCheckStatus = (typeof TAP_FAMILY_CHECK_STATUSES)[number];

export const TAP_FAMILY_CHECK_SEVERITIES = [
  "info",
  "warning",
  "blocking",
] as const;
export type TapFamilyCheckSeverity = (typeof TAP_FAMILY_CHECK_SEVERITIES)[number];

export interface TapFamilyCapabilityFinding {
  capabilityKey: string;
  severity: TapFamilyCheckSeverity;
  code: string;
  summary: string;
  metadata?: Record<string, unknown>;
}

export interface TapFamilyCheckReport {
  familyKey: TapAvailabilityFamilyKey;
  status: TapFamilyCheckStatus;
  productionLikeReady: boolean;
  summary: string;
  capabilityKeys: string[];
  checkedAt: string;
  blockers: string[];
  warnings: string[];
  findings: TapFamilyCapabilityFinding[];
  rows: TapCapabilityAvailabilityRow[];
  metadata?: Record<string, unknown>;
}
