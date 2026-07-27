// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — Release Management Index                   │
// │ EPIC-PLATFORM-005: Release Management Runtime                  │
// │ Reusable platform capability — NOT Concierge-specific       │
// └─────────────────────────────────────────────────────────────┘

export type {
  ReleaseRecord,
  ReleaseMetadata,
  DeploymentMetadata,
  EnvironmentResolution,
  PreviewDeploymentResult,
  ProductionDeploymentResult,
  RollbackMetadata,
  DeploymentHistoryEntry,
} from "./release-runtime.js";

export {
  InMemoryReleaseRegistry,
  releaseRegistry,
} from "./release-runtime.js";

export { EnvironmentResolver } from "./release-runtime.js";

export { PreviewDeploymentService } from "./release-runtime.js";

export { ProductionDeploymentService } from "./release-runtime.js";

export { DeploymentHistory, deploymentHistory } from "./release-runtime.js";