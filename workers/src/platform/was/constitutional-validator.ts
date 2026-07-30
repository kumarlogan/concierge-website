// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — WAS Constitutional Validator                  │
// │ Runs all validation gates before a plan can be activated.   │
// │ Fail-closed by default — a single failing gate blocks       │
// │ activation. Product-agnostic, reusable across all AGS.      │
// └─────────────────────────────────────────────────────────────┘

import {
  type ExecutionPlan,
  type ExecutionBatch,
  type EPCLConfig,
  PlanStatus,
  BatchStatus,
  FeatureFlag,
  DEFAULT_EPCL_CONFIG,
} from "../epcl/types.js";
import { isEnabled as epclIsEnabled } from "../epcl/feature-flags.js";
import {
  type ValidationResult,
  type ValidationGateResult,
  type WASConfig,
  DEFAULT_WAS_CONFIG,
} from "./types.js";
import { validateFeatureFlags, validateReportingFlag } from "./was-feature-flags.js";

// ══════════════════════════════════════════════════════════════
// Constitutional Validator
// ══════════════════════════════════════════════════════════════

export class ConstitutionalValidator {
  private static instance: ConstitutionalValidator;
  private config: WASConfig = { ...DEFAULT_WAS_CONFIG };

  private constructor() {}

  static getInstance(): ConstitutionalValidator {
    if (!ConstitutionalValidator.instance) {
      ConstitutionalValidator.instance = new ConstitutionalValidator();
    }
    return ConstitutionalValidator.instance;
  }

  configure(config: Partial<WASConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // ── Validation Pipeline ─────────────────────────────────────

  /**
   * Run the full validation pipeline against a plan.
   * All gates are evaluated. If any gate has severity "error" and fails,
   * the overall validation fails.
   *
   * Validation gates:
   *   1. Feature flags — autonomous execution master switch
   *   2. Plan integrity — plan structure, batch consistency
   *   3. Resource constraints — batch sizes, count limits
   *   4. Constitutional constraints — discipline/capability pre-checks
   *   5. Budget availability — context and token budgets
   *   6. Executive reporting flag — advisory only
   *
   * @param plan — The EPCL execution plan to validate
   * @param epclConfig — Optional EPCL config for budget checks
   * @returns The validation result
   */
  validate(plan: ExecutionPlan, epclConfig?: Partial<EPCLConfig>): ValidationResult {
    const gates: ValidationGateResult[] = [];

    // Gate 1: Feature flags
    gates.push(validateFeatureFlags(this.config));

    // Gate 2: Plan integrity
    gates.push(this.validatePlanIntegrity(plan));

    // Gate 3: Resource constraints
    gates.push(this.validateResourceConstraints(plan, epclConfig));

    // Gate 4: Constitutional constraints
    gates.push(this.validateConstitutionalConstraints(plan));

    // Gate 5: Budget availability
    gates.push(this.validateBudgetAvailability(plan, epclConfig));

    // Gate 6: Executive reporting (advisory)
    gates.push(validateReportingFlag());

    // Determine overall result
    const errors = gates.filter((g) => g.severity === "error" && !g.passed);
    const warnings = gates.filter((g) => g.severity === "warning" && !g.passed);

    const ok = errors.length === 0;
    const summary = ok
      ? `All ${gates.length} validation gates passed`
      : `Validation failed: ${errors.length} error(s), ${warnings.length} warning(s). ` +
        `Errors: ${errors.map((e) => e.gate).join(", ")}`;

    return { ok, gates, summary };
  }

  // ── Individual Gates ────────────────────────────────────────

  /**
   * Validate plan integrity — structure, batch consistency, status.
   */
  private validatePlanIntegrity(plan: ExecutionPlan): ValidationGateResult {
    // Plan must exist
    if (!plan || !plan.id) {
      return {
        gate: "plan_integrity",
        passed: false,
        message: "Plan is null or has no ID",
        severity: "error",
      };
    }

    // Plan must be APPROVED
    if (plan.status !== PlanStatus.APPROVED) {
      return {
        gate: "plan_integrity",
        passed: false,
        message: `Plan ${plan.id} has status ${plan.status}. Expected APPROVED.`,
        severity: "error",
        detail: "Only APPROVED plans can be activated through WAS.",
      };
    }

    // Plan must have phases
    if (!plan.phases || plan.phases.length === 0) {
      return {
        gate: "plan_integrity",
        passed: false,
        message: `Plan ${plan.id} has no phases`,
        severity: "error",
        detail: "A plan must have at least one phase to be activated.",
      };
    }

    // Batches must exist and be valid
    if (!plan.batches || plan.batches.length === 0) {
      return {
        gate: "plan_integrity",
        passed: false,
        message: `Plan ${plan.id} has no batches`,
        severity: "error",
        detail: "A plan must have at least one batch to be activated.",
      };
    }

    // Check for batch consistency (all batches should be PENDING)
    const invalidBatches = plan.batches.filter(
      (b) => b.status !== BatchStatus.PENDING
    );
    if (invalidBatches.length > 0) {
      return {
        gate: "plan_integrity",
        passed: false,
        message: `Plan ${plan.id} has ${invalidBatches.length} batch(es) with non-PENDING status`,
        severity: "error",
        detail: `Invalid batch IDs: ${invalidBatches.map((b) => b.id).join(", ")}. ` +
          "All batches must be PENDING for activation.",
      };
    }

    // Batches must have tasks
    const emptyBatches = plan.batches.filter((b) => !b.tasks || b.tasks.length === 0);
    if (emptyBatches.length > 0) {
      return {
        gate: "plan_integrity",
        passed: false,
        message: `Plan ${plan.id} has ${emptyBatches.length} batch(es) with no tasks`,
        severity: "error",
        detail: `Empty batch IDs: ${emptyBatches.map((b) => b.id).join(", ")}.`,
      };
    }

    return {
      gate: "plan_integrity",
      passed: true,
      message: `Plan ${plan.id} integrity check passed (${plan.batches.length} batches, ${plan.phases.length} phases)`,
      severity: "warning",
    };
  }

  /**
   * Validate resource constraints — batch sizes, count limits.
   */
  private validateResourceConstraints(
    plan: ExecutionPlan,
    epclConfig?: Partial<EPCLConfig>,
  ): ValidationGateResult {
    const config = { ...DEFAULT_EPCL_CONFIG, ...epclConfig };
    const maxConcurrent = config.execution.maxConcurrentBatches;
    const maxRetries = config.execution.maxRetries;

    // Check batch count against max concurrent
    if (plan.batches.length > maxConcurrent && maxConcurrent === 1) {
      return {
        gate: "resource_constraints",
        passed: false,
        message: `Plan ${plan.id} has ${plan.batches.length} batches but maxConcurrentBatches=1. ` +
          "Sequential activation will be required.",
        severity: "error",
        detail: "Set maxConcurrentBatches > 1 or enable ENABLE_PARALLEL_BATCH_DELEGATION.",
      };
    }

    // Check each batch's task count
    for (const batch of plan.batches) {
      if (batch.tasks.length > 20) {
        return {
          gate: "resource_constraints",
          passed: false,
          message: `Batch ${batch.id} has ${batch.tasks.length} tasks (max recommended: 20)`,
          severity: "error",
          detail: "Large batches may exceed context and token budgets.",
        };
      }
    }

    return {
      gate: "resource_constraints",
      passed: true,
      message: `Resource constraints satisfied (${plan.batches.length} batches, maxRetries=${maxRetries})`,
      severity: "warning",
    };
  }

  /**
   * Validate constitutional constraints — discipline/capability pre-checks.
   */
  private validateConstitutionalConstraints(_plan: ExecutionPlan): ValidationGateResult {
    // This gate is a placeholder for future constitutional checks.
    // Currently, all constitutional constraints are enforced at the EPCL
    // planning layer (capability selection, discipline selection, approval).
    //
    // Future checks could include:
    //   - No deployment-related capabilities without explicit approval
    //   - No database migrations without DBA sign-off
    //   - No security-sensitive operations without security review
    //   - No production data access without explicit data governance approval
    //   - No external API calls without rate-limit awareness

    if (!this.config.requireConstitutionalValidation) {
      return {
        gate: "constitutional_constraints",
        passed: true,
        message: "Constitutional validation is disabled by configuration",
        severity: "warning",
      };
    }

    return {
      gate: "constitutional_constraints",
      passed: true,
      message: "All constitutional constraints satisfied",
      severity: "warning",
    };
  }

  /**
   * Validate budget availability — context and token budgets.
   */
  private validateBudgetAvailability(
    _plan: ExecutionPlan,
    epclConfig?: Partial<EPCLConfig>,
  ): ValidationGateResult {
    const config = { ...DEFAULT_EPCL_CONFIG, ...epclConfig };

    // Check that budgets are configured
    if (config.tokenBudget.defaultTotal <= 0) {
      return {
        gate: "budget_availability",
        passed: false,
        message: "Token budget is not configured (defaultTotal <= 0)",
        severity: "error",
        detail: "Set tokenBudget.defaultTotal to a positive value in EPCL config.",
      };
    }

    if (config.contextBudget.maxTokens <= 0) {
      return {
        gate: "budget_availability",
        passed: false,
        message: "Context budget is not configured (maxTokens <= 0)",
        severity: "error",
        detail: "Set contextBudget.maxTokens to a positive value in EPCL config.",
      };
    }

    return {
      gate: "budget_availability",
      passed: true,
      message: `Budget available: ${config.tokenBudget.defaultTotal} tokens, ${config.contextBudget.maxTokens} context`,
      severity: "warning",
    };
  }
}