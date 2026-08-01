import { ExecutivePlanningWorkflow } from "./src/platform/epcl/executive-workflow.js";
import { setFlags } from "./src/platform/epcl/feature-flags.js";
import { initializeWASFlags } from "./src/platform/was/was-feature-flags.ts";
import { FeatureFlag } from "./src/platform/epcl/types.js";
import { WASFeatureFlag } from "./src/platform/was/types.js";

async function run() {
  setFlags({
    [FeatureFlag.ENABLE_EXECUTIVE_WORKFLOW]: true,
    [FeatureFlag.ENABLE_ROADMAP_INGESTION]: true,
    [FeatureFlag.ENABLE_BATCH_GENERATION]: true,
    [FeatureFlag.ENABLE_EXECUTIVE_REPORTING]: true,
    [FeatureFlag.ENABLE_AUTONOMOUS_EXECUTION]: true,
    [FeatureFlag.ENABLE_AUTOMATIC_KNOWLEDGE_CAPTURE]: true,
    [FeatureFlag.ENABLE_KNOWLEDGE_CAPTURE]: true,
  });
  initializeWASFlags({
    [WASFeatureFlag.ENABLE_AUTONOMOUS_EXECUTION]: true,
    [WASFeatureFlag.ENABLE_EXECUTIVE_WORKFLOW]: true,
    [WASFeatureFlag.ENABLE_BATCH_GENERATION]: true,
    [WASFeatureFlag.ENABLE_EXECUTIVE_REPORTING]: true,
    [WASFeatureFlag.ENABLE_CONSTITUTIONAL_VALIDATION]: true,
    [WASFeatureFlag.ENABLE_AUTO_RECOVERY]: false,
    [WASFeatureFlag.ENABLE_PARALLEL_BATCH_DELEGATION]: false,
  });
  const workflow = ExecutivePlanningWorkflow.getInstance();
  const result = await workflow.execute(`# Test Roadmap\n\n## Phase: Test\n- description: Test\n`, "test");
  console.log("Result:", JSON.stringify(result, null, 2));
}
run().catch(console.error);
