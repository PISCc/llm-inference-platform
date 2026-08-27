export const HARDWARE_PRESETS = [
  { id: 'gb10', name: 'GB10', capacityGB: 128, usableRatio: 0.9, storageOptionsTB: [1, 2, 4], note: '128GB 统一内存，保留约 10% 硬件余量' },
  { id: 't5000', name: 'T5000', capacityGB: 128, usableRatio: 0.9, storageOptionsTB: [1, 2, 4], note: '128GB 统一内存，保留约 10% 硬件余量' },
  { id: 'rtx6000d', name: 'RTX6000D', capacityGB: 84, usableRatio: 0.9, storageOptionsTB: [1, 2, 4, 8, 16], note: '84GB GDDR7 显存，保留约 10% 硬件余量' },
];

export const BIG_MODEL_PRESETS = [
  { id: 'deepseek-v4-flash-mixed', name: 'DeepSeek V4 Flash 0731 · FP4+FP8 Mixed', weightGB: 160, note: '按官方混合权重文件体量估算，可编辑' },
  { id: 'deepseek-v4-flash-quant', name: 'DeepSeek V4 Flash 0731 · 量化版', weightGB: 90, note: '量化版 MVP 估算值，可编辑' },
  { id: 'qwen38-27b-bf16', name: 'Qwen3.8-27B · BF16', weightGB: 55.6, note: '27B 密集视觉语言模型' },
  { id: 'qwen38-27b-fp8', name: 'Qwen3.8-27B · FP8', weightGB: 30.9, note: 'FP8 权重估算值' },
  { id: 'qwen38-27b-quant', name: 'Qwen3.8-27B · 量化版', weightGB: 15.5, note: '4-bit 量化 MVP 估算值，可编辑' },
];

export const SMALL_MODEL_PRESETS = [
  { id: 'none', name: '不使用小模型' },
  { id: 'qwen3-8b-instruct', name: 'Qwen3-8B Instruct' },
  { id: 'qwen3-8b-instruct-quant', name: 'Qwen3-8B Instruct · 量化版' },
];

export const DEFAULT_CALCULATOR_INPUTS = {
  bigModelId: 'deepseek-v4-flash-mixed',
  bigModelWeightGB: 160,
  smallModelId: 'qwen3-8b-instruct',
  smallModelCount: 1,
  smallModelBudgetGB: 1,
  agentCount: 1,
  agentBudgetGB: 20,
  cacheGB: 8,
  kvCacheGB: 8,
  peakLoadFactor: 1.3,
  runtimeReservePercent: 10,
  imageCountPerDay: 1000,
  imageRetentionDays: 30,
  imageSizeMB: 0.5,
  imageOverheadPercent: 15,
  systemStorageGB: 20,
  modelStagingMultiplier: 1.5,
  storageUsageTargetPercent: 70,
};

const numberOrZero = (value) => {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
};

const round = (value, digits = 2) => Number(value.toFixed(digits));

function makeHardwareCombination(counts) {
  const items = HARDWARE_PRESETS.filter((item) => counts[item.id] > 0);
  const deviceCount = Object.values(counts).reduce((sum, count) => sum + count, 0);
  const rawCapacityGB = items.reduce((sum, item) => sum + item.capacityGB * counts[item.id], 0);
  const conservativeUsableGB = items.reduce((sum, item) => sum + item.capacityGB * item.usableRatio * counts[item.id], 0);
  const heterogeneous = items.length > 1;
  const label = items.map((item) => `${item.name} × ${counts[item.id]}`).join(' + ');
  return { counts, label, deviceCount, rawCapacityGB, conservativeUsableGB, heterogeneous };
}

function enumerateHardwareCombinations() {
  const combinations = [];
  for (let gb10 = 0; gb10 <= 4; gb10 += 1) {
    for (let t5000 = 0; t5000 <= 4; t5000 += 1) {
      for (let rtx6000d = 0; rtx6000d <= 4; rtx6000d += 1) {
        if (gb10 + t5000 + rtx6000d === 0 || gb10 + t5000 + rtx6000d > 4) continue;
        combinations.push(makeHardwareCombination({ gb10, t5000, rtx6000d }));
      }
    }
  }
  return combinations;
}

const ALL_HARDWARE_COMBINATIONS = enumerateHardwareCombinations();

export function calculateHardwarePlan(rawInputs = {}) {
  const inputs = { ...DEFAULT_CALCULATOR_INPUTS, ...rawInputs };
  const bigModelWeightGB = numberOrZero(inputs.bigModelWeightGB);
  const smallModelCount = numberOrZero(inputs.smallModelCount);
  const smallModelBudgetGB = numberOrZero(inputs.smallModelBudgetGB);
  const agentCount = numberOrZero(inputs.agentCount);
  const agentBudgetGB = numberOrZero(inputs.agentBudgetGB);
  const cacheGB = numberOrZero(inputs.cacheGB);
  const kvCacheGB = numberOrZero(inputs.kvCacheGB);
  const peakLoadFactor = Math.max(1, numberOrZero(inputs.peakLoadFactor));
  const runtimeReservePercent = numberOrZero(inputs.runtimeReservePercent);
  const imageCountPerDay = numberOrZero(inputs.imageCountPerDay);
  const imageRetentionDays = numberOrZero(inputs.imageRetentionDays);
  const imageSizeMB = numberOrZero(inputs.imageSizeMB);
  const imageOverheadPercent = numberOrZero(inputs.imageOverheadPercent);
  const systemStorageGB = numberOrZero(inputs.systemStorageGB);
  const modelStagingMultiplier = Math.max(1, numberOrZero(inputs.modelStagingMultiplier));
  const storageUsageTargetPercent = Math.min(90, Math.max(50, numberOrZero(inputs.storageUsageTargetPercent) || 70));
  const smallModelMemoryGB = smallModelCount * smallModelBudgetGB;
  const agentMemoryGB = agentCount * agentBudgetGB;
  const imageRawStorageGB = imageCountPerDay * imageRetentionDays * imageSizeMB / 1000;
  const imageWithOverheadGB = imageRawStorageGB * (1 + imageOverheadPercent / 100);
  const dynamicMemoryGB = smallModelMemoryGB + agentMemoryGB + cacheGB + kvCacheGB;
  const peakDynamicMemoryGB = dynamicMemoryGB * peakLoadFactor;
  const memoryBaseGB = bigModelWeightGB + peakDynamicMemoryGB;
  const runtimeReserveGB = memoryBaseGB * runtimeReservePercent / 100;
  const memoryRequiredGB = memoryBaseGB + runtimeReserveGB;
  const modelStorageGB = (bigModelWeightGB + smallModelMemoryGB) * modelStagingMultiplier;
  const storageBaseGB = modelStorageGB + systemStorageGB + imageWithOverheadGB;
  const imageRecommendedStorageGB = imageWithOverheadGB / (storageUsageTargetPercent / 100);
  const storageRecommendedGB = storageBaseGB / (storageUsageTargetPercent / 100);
  const minimumStorageTB = Math.max(1, Math.ceil(storageRecommendedGB / 1000));
  const allHardwareRecommendations = ALL_HARDWARE_COMBINATIONS
    .filter((combination) => combination.rawCapacityGB >= memoryRequiredGB)
    .map((combination) => {
      const conservativeFeasible = combination.conservativeUsableGB >= memoryRequiredGB;
      const status = conservativeFeasible ? 'recommended' : 'boundary';
      const score = (conservativeFeasible ? 0 : 100000) + combination.deviceCount * 1000 + (combination.heterogeneous ? 100 : 0) + combination.rawCapacityGB;
      const supportsBuiltInStorage = combination.counts.gb10 > 0 || combination.counts.t5000 > 0;
      return {
        ...combination,
        status,
        score,
        rawCapacityGB: round(combination.rawCapacityGB),
        conservativeUsableGB: round(combination.conservativeUsableGB),
        headroomGB: round(combination.rawCapacityGB - memoryRequiredGB),
        storageTB: minimumStorageTB,
        storageNote: supportsBuiltInStorage ? '建议 1/2/4TB 中不小于该值' : 'RTX6000D 存储容量可自定义',
        reason: combination.heterogeneous ? '异构搭配：需模型并行或按角色分工，不能默认视作统一内存池' : '同构搭配：部署和通信路径更简单',
      };
    })
    .sort((a, b) => a.score - b.score || a.label.localeCompare(b.label, 'zh-CN'));
  const hardwareRecommendations = [
    ...allHardwareRecommendations.filter((item) => item.status === 'recommended').slice(0, 4),
    ...allHardwareRecommendations.filter((item) => item.status === 'boundary').slice(0, 2),
  ];
  const recommendedHardware = hardwareRecommendations.filter((item) => item.status === 'recommended');
  const feasible = recommendedHardware.length > 0;

  return {
    inputs,
    breakdown: {
      bigModelWeightGB: round(bigModelWeightGB),
      smallModelMemoryGB: round(smallModelMemoryGB),
      agentMemoryGB: round(agentMemoryGB),
      cacheGB: round(cacheGB),
      kvCacheGB: round(kvCacheGB),
      peakLoadFactor: round(peakLoadFactor),
      dynamicMemoryGB: round(dynamicMemoryGB),
      peakDynamicMemoryGB: round(peakDynamicMemoryGB),
      memoryBaseGB: round(memoryBaseGB),
      runtimeReservePercent: round(runtimeReservePercent),
      runtimeReserveGB: round(runtimeReserveGB),
      imageRawStorageGB: round(imageRawStorageGB),
      imageOverheadPercent: round(imageOverheadPercent),
      imageWithOverheadGB: round(imageWithOverheadGB),
      imageRecommendedStorageGB: round(imageRecommendedStorageGB),
      modelStagingMultiplier: round(modelStagingMultiplier),
      modelStorageGB: round(modelStorageGB),
      storageUsageTargetPercent: round(storageUsageTargetPercent),
      storageBaseGB: round(storageBaseGB),
    },
    memoryRequiredGB: round(memoryRequiredGB),
    storageRecommendedGB: round(storageRecommendedGB),
    hardware: {
      recommendedStorageTB: minimumStorageTB,
      feasible,
    },
    hardwareRecommendations,
    recommendedHardware,
    feasible,
  };
}
