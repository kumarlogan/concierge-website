import { ExecutivePlanningWorkflow } from "./src/platform/epcl/executive-workflow.js";
import { setFlags } from "./src/platform/epcl/feature-flags.js";
import { initializeWASFlags } from "./src/platform/was/was-feature-flags.ts";
import { FeatureFlag } from "./src/platform/epcl/types.js";
import { WASFeatureFlag } from "./src/platform/was/types.js";
import { readFileSync } from "fs";

async function run() {
  // ── Enable ALL EPCL feature flags ──
  setFlags({
    [FeatureFlag.ENABLE_EXECUTIVE_WORKFLOW]: true,
    [FeatureFlag.ENABLE_ROADMAP_INGESTION]: true,
    [FeatureFlag.ENABLE_BATCH_GENERATION]: true,
    [FeatureFlag.ENABLE_EXECUTIVE_REPORTING]: true,
    [FeatureFlag.ENABLE_AUTONOMOUS_EXECUTION]: true,
    [FeatureFlag.ENABLE_AUTOMATIC_KNOWLEDGE_CAPTURE]: true,
    [FeatureFlag.ENABLE_KNOWLEDGE_CAPTURE]: true,
  });

  // ── Enable ALL WAS feature flags ──
  initializeWASFlags({
    [WASFeatureFlag.ENABLE_AUTONOMOUS_EXECUTION]: true,
    [WASFeatureFlag.ENABLE_EXECUTIVE_WORKFLOW]: true,
    [WASFeatureFlag.ENABLE_BATCH_GENERATION]: true,
    [WASFeatureFlag.ENABLE_EXECUTIVE_REPORTING]: true,
    [WASFeatureFlag.ENABLE_CONSTITUTIONAL_VALIDATION]: true,
    [WASFeatureFlag.ENABLE_AUTO_RECOVERY]: true,
    [WASFeatureFlag.ENABLE_PARALLEL_BATCH_DELEGATION]: true,
  });

  // ── Read Wave 3 roadmap ──
  const roadmapContent = readFileSync(
    "/home/ubuntu/concierge-website/docs/roadmaps/wave-3-phase3-clinic-collaboration.md",
    "utf-8"
  );

  console.log("=== Wave 3 Pipeline Execution ===");
  console.log("EPCL flags enabled: all");
  console.log("WAS flags enabled: all");
  console.log("Roadmap source: Wave 3 Phase 3 - Clinic Collaboration\n");

  // ── Execute through certified pipeline ──
  const workflow = ExecutivePlanningWorkflow.getInstance();
  const result = await workflow.execute(roadmapContent, "wave-3-phase3-clinic");

  console.log("=== Execution Result ===");
  console.log(JSON.stringify(result, null, 2));
}

run().catch(console.error);
