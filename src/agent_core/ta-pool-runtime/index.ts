export type {
  ActivationAdapterFactory,
  ActivationAdapterFactoryContext,
  ActivationFactoryResolverLike,
} from "./activation-factory-resolver.js";
export {
  ActivationFactoryResolver,
  createActivationFactoryResolver,
} from "./activation-factory-resolver.js";

export type {
  ActivationDriverFailureResult,
  ActivationDriverInput,
  ActivationDriverResult,
  ActivationDriverSuccessResult,
} from "./activation-driver.js";
export {
  activateProvisionAsset,
  runActivationDriver,
} from "./activation-driver.js";

export type {
  ActivationMaterializedRegistration,
  MaterializeActivationRegistrationInput,
  MaterializeProvisionAssetActivationInput,
  MaterializedActivationRegistration,
  MaterializedActivationRegistrationInput,
} from "./activation-materializer.js";
export {
  materializeActivationRegistration,
  materializeCapabilityManifestFromActivation,
  materializeProvisionAssetActivation,
} from "./activation-materializer.js";

export type {
  CreateTaActivationAttemptRecordInput,
  CreateTaActivationFailureInput,
  CreateTaActivationReceiptInput,
  TaActivationAttemptRecord,
  TaActivationAttemptStatus,
  TaActivationFailure,
  TaActivationReceipt,
} from "./activation-types.js";
export {
  createTaActivationAttemptRecord,
  createTaActivationFailure,
  createTaActivationReceipt,
  TA_ACTIVATION_ATTEMPT_STATUSES,
} from "./activation-types.js";

export type {
  BaselineGrantedResolution,
  ControlPlaneOutcomeKind,
  ExecutionBridgeRequestPlaceholder,
  PendingExecutionAuthorization,
  ResolveCapabilityAccessInput,
  ResolveCapabilityAccessResult,
  ReviewDecisionConsumedResult,
  ReviewRequiredResolution,
  TaControlPlaneAuthorizationInput,
  TaControlPlaneGatewayLike,
  TaControlPlaneGatewayOptions,
  TaControlPlaneRouterOptions,
} from "./control-plane-gateway.js";
export {
  createTaControlPlaneGateway,
  DefaultTaControlPlaneGateway,
  TaControlPlaneGateway,
} from "./control-plane-gateway.js";

export type {
  GrantExecutionRequest,
  GrantToInvocationPlanInput,
  TaPoolExecutionRequest,
} from "./execution-plane-bridge.js";
export {
  canGrantExecuteRequest,
  createExecutionRequest,
  createInvocationPlanFromGrant,
} from "./execution-plane-bridge.js";

export type {
  TaExecutionBridgeInput,
  TaExecutionBridgeRequest,
} from "./execution-bridge.js";
export {
  createTaExecutionBridgeRequest,
  lowerGrantToCapabilityPlan,
} from "./execution-bridge.js";

export type {
  CreateTaHumanGateEventInput,
  CreateTaHumanGateStateInput,
  TaHumanGateEvent,
  TaHumanGateEventType,
  TaHumanGateState,
  TaHumanGateStatus,
} from "./human-gate.js";
export {
  applyTaHumanGateEvent,
  createTaHumanGateEvent,
  createTaHumanGateState,
  createTaHumanGateStateFromReviewDecision,
  TA_HUMAN_GATE_EVENT_TYPES,
  TA_HUMAN_GATE_STATUSES,
} from "./human-gate.js";

export type {
  CreateTaPendingReplayInput,
  TaPendingReplay,
  TaReplayNextAction,
  TaReplayStatus,
} from "./replay-policy.js";
export {
  createTaPendingReplay,
  describeReplayPolicy,
  replayPolicyToNextAction,
  TA_REPLAY_NEXT_ACTIONS,
  TA_REPLAY_STATUSES,
} from "./replay-policy.js";

export type {
  CreateTaResumeEnvelopeInput,
  PoolRuntimeSnapshots,
  TapPoolRuntimeSnapshot,
  TaResumeEnvelope,
} from "./runtime-snapshot.js";
export {
  createPoolRuntimeSnapshots,
  createTapPoolRuntimeSnapshot,
  createTaResumeEnvelope,
} from "./runtime-snapshot.js";

export type {
  TapCapabilityGovernanceSnapshot,
  TapGovernanceCapabilityStage,
  TapGovernanceCounts,
  TapGovernanceSnapshot,
} from "./governance-snapshot.js";
export {
  createTapGovernanceSnapshot,
  hasPendingTapGovernanceWork,
  TAP_GOVERNANCE_CAPABILITY_STAGES,
} from "./governance-snapshot.js";

export type {
  TapRuntimeHydratedState,
} from "./runtime-recovery.js";
export {
  hydratePoolRuntimeSnapshots,
  hydrateTapRuntimeSnapshot,
  serializePoolRuntimeSnapshots,
  serializeTapRuntimeSnapshot,
} from "./runtime-recovery.js";

export type {
  CreateTapAgentRecordInput,
  TapAgentRecord,
  TapAgentRecordActor,
  TapThreeAgentUsageReport,
} from "./three-agent-record.js";
export {
  cloneTapAgentRecords,
  createTapAgentRecord,
  createTapThreeAgentUsageReport,
  TAP_AGENT_RECORD_ACTORS,
} from "./three-agent-record.js";

export type {
  TapRuntimeSnapshotStateInput,
} from "./runtime-checkpoint.js";
export {
  createTapRuntimeSnapshotFromState,
  mergeTapRuntimeSnapshotIntoCheckpoint,
  readPoolRuntimeSnapshotsFromCheckpoint,
  readTapRuntimeSnapshotFromCheckpoint,
} from "./runtime-checkpoint.js";
