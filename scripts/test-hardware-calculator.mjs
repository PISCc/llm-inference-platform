import assert from 'node:assert/strict';
import { calculateHardwarePlan } from '../src/data/hardwareCalculator.js';

const defaultPlan = calculateHardwarePlan();
assert.equal(defaultPlan.memoryRequiredGB, 228.91, 'default memory formula should include peak load and 10% runtime reserve');
assert.equal(defaultPlan.breakdown.smallModelMemoryGB, 1, 'small model default should be 1GB');
assert.equal(defaultPlan.breakdown.agentMemoryGB, 20, 'agent default should be 20GB');
assert.equal(defaultPlan.breakdown.imageRawStorageGB, 15, '1000 images/day x 30 days x 0.5MB should be 15GB');
assert.equal(defaultPlan.storageRecommendedGB, 398.21, 'storage should include model staging and leave 30% free space');
assert.equal(defaultPlan.hardwareRecommendations.find((item) => item.label === 'GB10 × 2')?.status, 'recommended', 'default recommendation should include two GB10 devices');
assert.equal(defaultPlan.hardwareRecommendations.find((item) => item.label === 'T5000 × 2')?.status, 'recommended', 'default recommendation should include two T5000 devices');

const twoHundredGBPlan = calculateHardwarePlan({ bigModelWeightGB: 200, smallModelCount: 0, agentCount: 0, cacheGB: 0, kvCacheGB: 0, runtimeReservePercent: 0 });
assert.equal(twoHundredGBPlan.hardwareRecommendations.find((item) => item.label === 'GB10 × 2')?.status, 'recommended', '200GB result should recommend two GB10 devices');
assert.equal(twoHundredGBPlan.hardwareRecommendations.find((item) => item.label === 'GB10 × 1 + RTX6000D × 1')?.status, 'boundary', '200GB result should expose a boundary heterogeneous option');

const editedPlan = calculateHardwarePlan({ smallModelBudgetGB: 2, agentCount: 2, imageCountPerDay: 2000 });
assert.equal(editedPlan.memoryRequiredGB, 258.94, 'editable small model and agent values should update memory');
assert.equal(editedPlan.breakdown.imageRawStorageGB, 30, 'editable image count should update raw storage');
assert.equal(editedPlan.breakdown.imageWithOverheadGB, 34.5, 'image overhead should cover derived files');

const noSmallModelPlan = calculateHardwarePlan({ smallModelCount: 0, agentCount: 0 });
assert.equal(noSmallModelPlan.breakdown.smallModelMemoryGB, 0, 'zero small models should consume zero memory');
assert.equal(noSmallModelPlan.breakdown.agentMemoryGB, 0, 'zero agents should consume zero memory');

const feasiblePlan = calculateHardwarePlan({
  bigModelWeightGB: 15.5,
  smallModelBudgetGB: 1,
  agentCount: 1,
  agentBudgetGB: 20,
  cacheGB: 4,
  kvCacheGB: 4,
  runtimeReserveGB: 4,
  deviceCount: 1,
  hardwareId: 'rtx6000d',
  storageTB: 1,
});
assert.equal(feasiblePlan.memoryRequiredGB, 58.52, 'edited Qwen-like scenario should calculate correctly');
assert.equal(feasiblePlan.recommendedHardware.some((item) => item.label === 'RTX6000D × 1'), true, 'a small workload should fit one RTX6000D');

console.log('hardware calculator tests passed');
