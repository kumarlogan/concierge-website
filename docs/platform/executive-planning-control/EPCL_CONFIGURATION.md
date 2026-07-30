# EPCL — Configuration Guide

> **AI Platform Capability — Configuration**
> Reusable, deterministic, platform-level strategic planning layer.
>
> **Version:** 1.0.0 — Configuration
> **Status:** Complete
> **Last Updated:** 2026-07-30

## Governance Header

```
Company:        AGS
Platform:       AI Platform
Product:        <consumer> (first: Concierge)
Public Brand:   AG Synergy
Repository:     concierge-website
Document:       EPCL Configuration Guide
Capability:     Executive Planning & Control Layer
Capability #:   14
Phase:          Phase E — Executive Planning & Control (Delivery)
Framework:      WEF v1.1 (AGS Enterprise Execution Framework)
ADR:            ADR-018
```

---

## 1. Quick Start

```typescript
import { ExecutivePlanningWorkflow } from "./executive-workflow.js";
import { setFlags, isEnabled } from "./feature-flags.js";
import { FeatureFlag } from "./types.js";

// 1. Enable required flags
setFlags({
  [FeatureFlag.ENABLE_EXECUTIVE_WORKFLOW]: true,
  [FeatureFlag.ENABLE_ROADMAP_INGESTION]: true,
  [FeatureFlag.ENABLE_BATCH_GENERATION]: true,
  [FeatureFlag.ENABLE_EXECUTIVE_REPORTING]: true,
});

// 2. Register capabilities (optional — needed for batch approval)
import { CapabilitySelector } from "./capability-selector.js";
CapabilitySelector.getInstance().register({
  id: "code.generate",
  name: "Code Generation",
  provider: "hermes",
  keywords: ["codegen", "generate", "scaffold"],
  disciplines: ["engineering_quality"],
  estimatedCost: 500,
  requiresApproval: false,
});

// 3. Run the workflow
const workflow = ExecutivePlanningWorkflow.getInstance();
const result = await workflow.execute(roadmapMarkdown, "operator");

// 4. Check the result
if (result.ok) {
  console.log(`Plan created: ${result.plan!.id} with ${result.plan!.batches.length} batches`);
} else {
  console.error(`Workflow failed: ${result.error}`);
}
```

---

## 2. Feature Flags

All flags are **disabled by default**. Enable them explicitly.

### 2.1 Flag Reference

| Flag | Default | Purpose | Required For |
|------|---------|---------|-------------|
| `ENABLE_EXECUTIVE_WORKFLOW` | `false` | Enables the 12-stage ExecutivePlanningWorkflow | Workflow execution |
| `ENABLE_ROADMAP_INGESTION` | `false` | Enables markdown parsing and roadmap analysis | Stage 1 (ROADMAP_ANALYSIS) |
| `ENABLE_BATCH_GENERATION` | `false` | Enables execution plan and batch creation | Stage 3 (EXECUTION_PLAN), Stage 6 (BATCH_GENERATION) |
| `ENABLE_CONTEXT_BUDGETING` | `false` | Enables context window budget tracking | ContextBudgetManager |
| `ENABLE_TOKEN_BUDGETING` | `false` | Enables token consumption tracking | TokenBudgetManager |
| `ENABLE_EXECUTIVE_REPORTING` | `false` | Enables executive report generation | Stage 12 (EXECUTIVE_REPORT) |
| `ENABLE_KNOWLEDGE_CAPTURE` | `false` | Enables knowledge capture from planning | Stage 11 (KNOWLEDGE_CAPTURE) |
| `ENABLE_RECOVERY_SNAPSHOTS` | `false` | Enables checkpoint and recovery snapshots | RecoveryManager |
| `ENABLE_APPROVAL_WORKFLOW` | `false` | Enables approval evaluation | Stage 7 (APPROVAL_CHECK) |
| `ENABLE_SIMPLIFIED_PLANNING` | `false` | Enables simplified planning mode | Planning optimization |

### 2.2 Minimum Set for Full Workflow

```typescript
setFlags({
  [FeatureFlag.ENABLE_EXECUTIVE_WORKFLOW]: true,
  [FeatureFlag.ENABLE_ROADMAP_INGESTION]: true,
  [FeatureFlag.ENABLE_BATCH_GENERATION]: true,
  [FeatureFlag.ENABLE_EXECUTIVE_REPORTING]: true,
  [FeatureFlag.ENABLE_KNOWLEDGE_CAPTURE]: true,
  [FeatureFlag.ENABLE_RECOVERY_SNAPSHOTS]: true,
  [FeatureFlag.ENABLE_APPROVAL_WORKFLOW]: true,
});
```

### 2.3 Querying Flags

```typescript
import { isEnabled, getConfig } from "./feature-flags.js";
import { FeatureFlag } from "./types.js";

if (isEnabled(FeatureFlag.ENABLE_BATCH_GENERATION)) {
  // Batch generation is active
}

const config = getConfig();
console.log(config.maxBatchesPerPhase); // 10
console.log(config.maxTasksPerBatch);   // 12
```

---

## 3. EPCL Config

The `EPCLConfig` object controls workflow parameters, limits, and thresholds.

### 3.1 Default Configuration

```typescript
const DEFAULT_EPCL_CONFIG: EPCLConfig = {
  // Batch limits
  maxBatchesPerPhase: 10,
  maxTasksPerBatch: 12,

  // Budget limits
  maxContextBudget: 50000,
  maxTokenBudget: 100000,

  // Approval thresholds
  approvalThreshold: 0.8,

  // Workflow stages to skip
  skipStages: [],

  // Provider override
  provider: undefined,
};
```

### 3.2 Custom Configuration

```typescript
const result = await workflow.execute(roadmapMarkdown, "operator", {
  maxBatchesPerPhase: 5,
  maxTasksPerBatch: 8,
  maxContextBudget: 25000,
  skipStages: [WorkflowStage.WEF_DELEGATION, WorkflowStage.VERIFICATION],
});
```

---

## 4. Roadmap Markdown Format

The `RoadmapEngine` parses a structured markdown format.

### 4.1 Template

```markdown
# <Plan Title>

## Phase: <Phase Name>
- order: <N>

### Epic: <Epic Name>
- description: <Short description>
- capability: <capability-id>
- discipline: <discipline-name>
- deliverable: <deliverable description>
- acceptance: <acceptance criteria>

### Epic: <Epic Name>
- dependency: <previous-epic-name>
- capability: <capability-id>
- discipline: <discipline-name>
- deliverable: <deliverable description>
- acceptance: <acceptance criteria>

## Phase: <Next Phase Name>
- order: <N>

...
```

### 4.2 Example

```markdown
# Phase 2 — Foundation

## Phase: Foundation
- order: 0

### Epic: Linting
- description: Configure ESLint and Prettier
- capability: test.run
- discipline: engineering_quality
- deliverable: ESLint config (.eslintrc)
- acceptance: All files pass lint
- deliverable: Prettier config (.prettierrc)
- acceptance: All files auto-format

## Phase: Growth
- order: 1

### Epic: Dashboard
- description: Build main dashboard page
- capability: ui
- discipline: experience_design
- deliverable: Dashboard component
- acceptance: Dashboard renders correctly
```

### 4.3 Parsing Rules

| Rule | Description |
|------|-------------|
| `# Title` | Sets the roadmap title |
| `## Phase: Name` | Creates a phase with `id` derived from name |
| `- order: <N>` | Sets the phase order (defaults to iteration index) |
| `### Epic: Name` | Creates an epic within the current phase |
| `- description:` | Epic description |
| `- capability:` | Capability ID (maps to `CapabilitySelector` registry) |
| `- discipline:` | Discipline name (maps to `Discipline` enum) |
| `- deliverable:` | Creates a milestone/deliverable |
| `- acceptance:` | Acceptance criteria for the preceding deliverable |
| `- dependency:` | Creates a dependency on another epic in the same phase |

---

## 5. Capability Registration

Capabilities must be registered with the `CapabilitySelector` before they can be matched to epics.

### 5.1 Registering a Capability

```typescript
import { CapabilitySelector } from "./capability-selector.js";

CapabilitySelector.getInstance().register({
  id: "code.review",
  name: "Code Review",
  provider: "hermes",
  keywords: ["review", "audit", "inspect"],
  disciplines: ["engineering_quality"],
  estimatedCost: 300,         // estimated tokens to execute
  requiresApproval: false,     // whether this capability triggers approval
  fallbackCapabilities: [],    // fallback if this capability is unavailable
});
```

### 5.2 Capability Matching

When `selectForEpic(epic)` is called, it matches epics to capabilities using three strategies, in order:

1. **Exact ID match** — `registry.get(epic.requiredCapability)` — fastest, most reliable
2. **Keyword match** — checks if capability keywords overlap with the requirement string
3. **Discipline match** — checks if the capability's disciplines match the epic's assigned disciplines

### 5.3 Listing Capabilities

```typescript
const allCaps = CapabilitySelector.getInstance().list();
// Returns: CapabilityEntry[]

const stats = CapabilitySelector.getInstance().getUtilizationSummary();
// Returns: { discipline: string; count: number; capabilities: string[] }[]
```

---

## 6. Approval Rules

The `ApprovalManager` evaluates batches and plans against approval rules. Understanding these rules is critical for configuring capabilities correctly.

### 6.1 Batch Approval Rules

| Condition | Approval Required | Escalation |
|-----------|------------------|------------|
| Batch has 0 tasks | Yes (empty) | `tech-lead` |
| Capabilities contain "deploy", "publish", or "release" | Yes (deployment) | `ops-owner` |
| Capabilities contain "db.", "database", or "migrate" | Yes (database) | `dba-owner` |
| Capabilities contain "security", "auth", or "permission" | Yes (security) | `security-owner` |
| Batch has empty capabilities OR all capabilities contain "new"/"unknown" | Yes (product) | `product-owner` |
| More than 10 tasks | Yes (constitutional) | `tech-lead` |
| None of the above | No | — |

### 6.2 Plan Approval Rules

| Condition | Approval Required |
|-----------|------------------|
| More than 20 batches | Yes |

### 6.3 Avoiding Approval for Test

Capabilities that do NOT trigger approval:
- `code.generate`, `code.review`, `ui`, `test.run`, `test.verify`, `refactor`
- Any capability ID that doesn't contain "deploy", "publish", "release", "db.", "database", "migrate", "security", "auth", "permission", "new", or "unknown"

---

## 7. Workflow Stages

The `ExecutivePlanningWorkflow` executes 12 stages in order.

### 7.1 Stage Order

| # | Stage | Service | Description | Required Flag |
|---|-------|---------|-------------|---------------|
| 1 | `ROADMAP_ANALYSIS` | `RoadmapEngine` | Parse markdown roadmap, extract phases/epics/dependencies | `ENABLE_ROADMAP_INGESTION` |
| 2 | `DEPENDENCY_RESOLUTION` | `RoadmapEngine` | Analyze dependency graph, check for cycles | `ENABLE_ROADMAP_INGESTION` |
| 3 | `EXECUTION_PLAN` | `ExecutionPlanner` | Create execution plan, select capabilities/disciplines | `ENABLE_BATCH_GENERATION` |
| 4 | `CAPABILITY_SELECTION` | `CapabilitySelector` | Report registered capabilities | — |
| 5 | `DISCIPLINE_SELECTION` | `DisciplineSelector` | Report discipline utilization | — |
| 6 | `BATCH_GENERATION` | `RecoveryManager` | Create recovery snapshot for batches | `ENABLE_RECOVERY_SNAPSHOTS` |
| 7 | `APPROVAL_CHECK` | `ApprovalManager` | Evaluate plan and batch approval | `ENABLE_APPROVAL_WORKFLOW` |
| 8 | `WEF_DELEGATION` | — | Reserved for WEF integration | — |
| 9 | `EXECUTION_MONITORING` | — | Reserved for execution monitoring | — |
| 10 | `VERIFICATION` | — | Reserved for verification | — |
| 11 | `KNOWLEDGE_CAPTURE` | `KnowledgeCapturer` | Capture planning knowledge | `ENABLE_KNOWLEDGE_CAPTURE` |
| 12 | `EXECUTIVE_REPORT` | `ExecutiveReporter` | Generate executive report | `ENABLE_EXECUTIVE_REPORTING` |

### 7.2 Fail-Closed Behavior

If any stage throws an error, the workflow catches it and returns:
```typescript
{
  ok: false,
  error: "<error message>",
  stages: [ /* stages completed before the failure */ ]
}
```

The `ApprovalManager` is fail-closed by design: if a batch or plan matches any approval rule, it is **rejected** (not approved).

---

## 8. Testing

### 8.1 Test Setup

```typescript
import { ExecutivePlanningWorkflow } from "../executive-workflow.js";
import { setFlags, resetForTest } from "../feature-flags.js";
import { FeatureFlag } from "../types.js";
import { CapabilitySelector } from "../capability-selector.js";

function enableAllFlags() {
  setFlags({
    [FeatureFlag.ENABLE_EXECUTIVE_WORKFLOW]: true,
    [FeatureFlag.ENABLE_ROADMAP_INGESTION]: true,
    [FeatureFlag.ENABLE_BATCH_GENERATION]: true,
    [FeatureFlag.ENABLE_EXECUTIVE_REPORTING]: true,
    [FeatureFlag.ENABLE_KNOWLEDGE_CAPTURE]: true,
    [FeatureFlag.ENABLE_RECOVERY_SNAPSHOTS]: true,
    [FeatureFlag.ENABLE_APPROVAL_WORKFLOW]: true,
  });
}

function registerTestCapabilities() {
  const selector = CapabilitySelector.getInstance();
  selector.register({
    id: "code.generate", name: "Code Generation", provider: "hermes",
    keywords: ["codegen", "generate"], disciplines: ["engineering_quality"],
    estimatedCost: 500, requiresApproval: false,
  });
  selector.register({
    id: "test.run", name: "Test Runner", provider: "hermes",
    keywords: ["test", "lint", "check"], disciplines: ["engineering_quality"],
    estimatedCost: 300, requiresApproval: false,
  });
  selector.register({
    id: "ui", name: "UI Component", provider: "hermes",
    keywords: ["ui", "component", "page"], disciplines: ["experience_design"],
    estimatedCost: 800, requiresApproval: false,
  });
}

const VALID_ROADMAP = `# Test Plan
## Phase: Foundation\n- order: 0\n\n### Epic: Linting\n- description: Configure linting\n- capability: test.run\n- discipline: engineering_quality\n- deliverable: ESLint config\n- acceptance: Files pass lint\n\n## Phase: Growth\n- order: 1\n\n### Epic: Dashboard\n- description: Build dashboard\n- capability: ui\n- discipline: experience_design\n- deliverable: Dashboard component\n- acceptance: Renders correctly\n`;

beforeEach(() => {
  enableAllFlags();
  ExecutivePlanningWorkflow.getInstance().reset();
  registerTestCapabilities();
  workflow = ExecutivePlanningWorkflow.getInstance();
});

afterEach(() => {
  ExecutivePlanningWorkflow.getInstance().reset();
});
```

### 8.2 Key Testing Patterns

| Pattern | Purpose |
|---------|---------|
| `workflow.reset()` before each test | Clears all singletons for isolation |
| `registerTestCapabilities()` after reset | Capabilities are cleared by reset |
| `enableAllFlags()` before reset | Flags are NOT cleared by reset |
| `setFlags({})` on isolate | Disable specific flags to test feature gating |
| `result.ok === false` for error cases | Assert on `result.error` string |
| `result.stages` for stage-by-stage verification | Verify each stage completed |

---

## 9. Error Handling

### 9.1 Error Types

| Error | Source | Cause |
|-------|--------|-------|
| `ExecutionPlannerError` | `ExecutionPlanner` | Batch generation disabled, invalid roadmap |
| `ApprovalError` | `ApprovalManager` | Plan or batch requires approval |
| Generic `Error` | Any stage | Stage failure (e.g., empty roadmap, missing capabilities) |

### 9.2 Recovery

The `RecoveryManager` creates snapshots at batch generation time:

```typescript
const checkpoint = RecoveryManager.getInstance().getCheckpoint(planId);
if (checkpoint) {
  // Resume from checkpoint
}
```

---

## 10. Extension Points

### 10.1 Adding New Capabilities

```typescript
CapabilitySelector.getInstance().register({
  id: "my.new.capability",
  name: "My New Capability",
  provider: "hermes",
  keywords: ["my", "new", "cap"],
  disciplines: ["engineering_quality"],
  estimatedCost: 1000,
  requiresApproval: true,
  fallbackCapabilities: ["code.generate"], // fallback
});
```

### 10.2 Adding New Disciplines

The `Discipline` enum and `DisciplineSelector` use a fixed set. To add a new discipline:
1. Add a value to the `Discipline` enum in `types.ts`
2. Add a mapping entry in `DISCIPLINE_CAPABILITY_MAP` in `discipline-selector.ts`
3. Add a label in `DISCIPLINE_LABELS` in `types.ts`

### 10.3 Adding New Feature Flags

1. Add a value to the `FeatureFlag` enum in `types.ts`
2. Add a default value in `DEFAULT_FLAG_STATE` in `types.ts`
3. Use `isEnabled(FeatureFlag.MY_FLAG)` to check in code
4. Use `setFlags({ [FeatureFlag.MY_FLAG]: true })` to enable

---

## 11. Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-07-30 | Initial configuration guide documenting the implemented 12-stage workflow |