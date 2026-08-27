import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';

export const TABS = [
  { key: 'kv', label: 'KV Cache 计算器', iconName: 'MemoryStick', accent: 'emerald' },
  { key: 'attn', label: 'Attention 架构对比', iconName: 'Network', accent: 'cyan' },
  { key: 'parallel', label: '并行容量规划', iconName: 'BarChart3', accent: 'violet' },
];

export const ARCHITECTURES = {
  MHA: {
    name: 'MHA',
    label: 'Multi-Head Attention',
    desc: 'Query 头与 K/V 头数量相同。',
    kvMode: 'heads',
    defaultKVRatio: 1,
    color: '#46728a',
    evidence: 'KV 容量由 K/V 头数直接计算。',
  },
  GQA: {
    name: 'GQA',
    label: 'Grouped-Query Attention',
    desc: '多组 Query 头共享较少的 K/V 头；具体组数由模型配置决定。',
    kvMode: 'heads',
    defaultKVRatio: 0.25,
    color: '#7a5f8d',
    evidence: '工作台默认用 Q 头数的 1/4 作为可调整示例。',
  },
  MQA: {
    name: 'MQA',
    label: 'Multi-Query Attention',
    desc: '所有 Query 头共享一组 K/V 头。',
    kvMode: 'heads',
    defaultKVRatio: null,
    color: '#a26c2b',
    evidence: '按 1 个 K/V 头计算。',
  },
  MLA: {
    name: 'MLA',
    label: 'Multi-head Latent Attention',
    desc: '缓存低秩潜变量与解耦 RoPE 分量，容量取决于模型公开的潜变量维度。',
    kvMode: 'latent',
    defaultKVRatio: null,
    color: '#5c7f65',
    evidence: '默认维度采用 DeepSeek-V2 配置：kv_lora_rank=512、qk_rope_head_dim=64。',
  },
};

export const ATTENTION_KERNELS = {
  standard: {
    name: '标准实现',
    desc: '以完整 Attention 计算流程作为实现基线。',
    persistentKVEffect: '不改变',
    workingMemory: '依赖具体算子实现',
  },
  flash: {
    name: 'FlashAttention',
    desc: '通过分块和在线 Softmax 减少 HBM 读写与中间矩阵存储；它实现数学上的精确 Attention，不采用稀疏近似，但浮点运算顺序不同可能产生微小舍入差异。',
    persistentKVEffect: '不改变',
    workingMemory: '通常更低，实际幅度依赖实现与形状',
  },
};

export const PRECISIONS = {
  fp16: { label: 'FP16', bytes: 2, desc: '理论载荷 2 字节/元素' },
  int8: { label: 'INT8', bytes: 1, desc: '理论载荷 1 字节/元素' },
  int4: { label: 'INT4', bytes: 0.5, desc: '理论载荷 0.5 字节/元素' },
};

export const REFERENCE_CONFIGS = [
  {
    name: 'Llama 3 8B', hiddenSize: 4096, numLayers: 32, numHeads: 32, numKVHeads: 8,
    seqLen: 8192, batchSize: 1, precision: 'fp16', architecture: 'GQA', parameterCountB: 8,
    source: 'Meta Llama 3 官方模型卡与模型配置',
    scenarioNote: '按官方 8B 档位与 8,192 Token 上下文上限计算；参数量为档位标称值',
  },
  {
    name: 'Llama 3 70B', hiddenSize: 8192, numLayers: 80, numHeads: 64, numKVHeads: 8,
    seqLen: 8192, batchSize: 1, precision: 'fp16', architecture: 'GQA', parameterCountB: 70,
    source: 'Meta Llama 3 官方模型卡与模型配置',
    scenarioNote: '按官方 70B 档位与 8,192 Token 上下文上限计算；参数量为档位标称值',
  },
  {
    name: 'DeepSeek-V2', hiddenSize: 5120, numLayers: 60, numHeads: 128, numKVHeads: 1,
    kvLatentDim: 512, qkNopeHeadDim: 128, ropeHeadDim: 64, valueHeadDim: 128,
    seqLen: 128000, batchSize: 1, precision: 'fp16',
    architecture: 'MLA', parameterCountB: 236, source: 'DeepSeek-V2 官方论文、仓库与公开配置',
    scenarioNote: '按 128,000 Token 场景计算；公开配置的 max_position_embeddings 为 163,840',
  },
];

export function getArchitectureKVHeads(architecture, numHeads) {
  if (architecture === 'MLA') return null;
  if (architecture === 'MQA') return 1;
  if (architecture === 'GQA') return Math.max(1, Math.round(numHeads / 4));
  return numHeads;
}

// GQA 的 K/V 头数统一从这里解析：优先保留当前模型的权威参考头数（gqaKVHeads，
// 如 Llama 3 70B 官方 8 头），没有参考时按 Q 头数的 1/4 推导。该值不随架构切换
// 被覆盖，保证对比图切换选中项时只高亮、不跳变。
export function resolveKVHeads(architecture, numHeads, gqaKVHeads) {
  if (architecture === 'MLA') return null;
  if (architecture === 'MQA') return 1;
  if (architecture === 'GQA') return gqaKVHeads ?? getArchitectureKVHeads('GQA', numHeads);
  return numHeads;
}

export function calcKVCache({
  hiddenSize, numLayers, numHeads, numKVHeads, seqLen, batchSize, precision,
  architecture = 'MHA', kvLatentDim = 512, qkNopeHeadDim = 128, ropeHeadDim = 64, valueHeadDim = 128,
}) {
  const headDim = hiddenSize / numHeads;
  const bytes = PRECISIONS[precision]?.bytes || 2;
  const arch = ARCHITECTURES[architecture] || ARCHITECTURES.MHA;
  const mhaElements = 2 * numLayers * numHeads * headDim * seqLen * batchSize;
  const effectiveKVHeads = arch.kvMode === 'latent'
    ? null
    : Math.max(1, numKVHeads ?? getArchitectureKVHeads(architecture, numHeads));
  const cacheElements = arch.kvMode === 'latent'
    ? numLayers * seqLen * batchSize * (kvLatentDim + ropeHeadDim)
    : 2 * numLayers * effectiveKVHeads * headDim * seqLen * batchSize;
  const kvCacheBytes = cacheElements * bytes;
  const mhaBytes = mhaElements * bytes;

  return {
    kvCacheBytes,
    kvCacheGB: kvCacheBytes / (1024 ** 3),
    perLayerBytes: kvCacheBytes / numLayers,
    headDim,
    bytes,
    effectiveKVHeads,
    cacheElements,
    kvMemoryRatio: mhaBytes > 0 ? kvCacheBytes / mhaBytes : 0,
    isLatent: arch.kvMode === 'latent',
    latentWidth: arch.kvMode === 'latent' ? kvLatentDim + ropeHeadDim : null,
    attentionHeadDim: arch.kvMode === 'latent' ? qkNopeHeadDim + ropeHeadDim : headDim,
    valueHeadDim: arch.kvMode === 'latent' ? valueHeadDim : headDim,
  };
}

export function calcModelWeight({
  hiddenSize, numLayers, numHeads, numKVHeads, precision, architecture = 'MHA',
  parameterCountB, vocabSize = 128000, intermediateSize, kvLatentDim = 512,
}) {
  const bytes = PRECISIONS[precision]?.bytes || 2;
  if (parameterCountB) return parameterCountB * 1e9 * bytes / (1024 ** 3);

  const headDim = hiddenSize / numHeads;
  const effectiveKVHeads = getArchitectureKVHeads(architecture, numHeads) ?? numHeads;
  const ffnSize = intermediateSize || Math.round((hiddenSize * 3.5) / 256) * 256;
  const qProjection = hiddenSize * hiddenSize;
  const isLatent = ARCHITECTURES[architecture]?.kvMode === 'latent';
  const kvProjectionDim = isLatent ? kvLatentDim : effectiveKVHeads * headDim;
  const kvProjections = 2 * hiddenSize * kvProjectionDim;
  const outputProjection = hiddenSize * hiddenSize;
  const attentionParamsPerLayer = qProjection + kvProjections + outputProjection;
  const ffnParamsPerLayer = 3 * hiddenSize * ffnSize;
  const embeddingParams = vocabSize * hiddenSize;
  const totalParams = numLayers * (attentionParamsPerLayer + ffnParamsPerLayer) + embeddingParams;
  return totalParams * bytes / (1024 ** 3);
}

export function useCountUp(target, duration = 500) {
  const [value, setValue] = useState(0);
  const startRef = useRef(0);
  const startTimeRef = useRef(null);

  useEffect(() => {
    startRef.current = value;
    startTimeRef.current = null;
    let raf;
    const animate = (timestamp) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const progress = Math.min((timestamp - startTimeRef.current) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(startRef.current + (target - startRef.current) * eased);
      if (progress < 1) raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return value;
}

export function SliderControl({ label, value, min, max, step, onChange, unit, tooltip, accent = 'cyan' }) {
  const accentClass = accent === 'emerald' ? 'accent-emerald-400' : accent === 'violet' ? 'accent-violet-400' : 'accent-cyan-400';
  return (
    <div className="space-y-2.5 rounded-xl border border-space-700/40 bg-space-950/30 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-space-200">{label}</span>
          {tooltip && (
            <span title={tooltip} className="cursor-help text-space-500 transition-colors hover:text-space-300">
              <Info size={13} />
            </span>
          )}
        </div>
        <span className="rounded-md border border-space-700/60 bg-space-900/80 px-2 py-0.5 font-mono text-xs text-space-200">{value}{unit}</span>
      </div>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`h-1.5 w-full cursor-pointer appearance-none rounded-full bg-space-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current focus-visible:ring-offset-2 ${accentClass}`}
      />
      <div className="flex justify-between font-mono text-[9px] text-space-600"><span>{min}{unit}</span><span>{max}{unit}</span></div>
    </div>
  );
}

export function MetricCard({ label, value, unit, prevValue, accent = 'cyan', tip, digits = 2, lowerIsBetter = null }) {
  const diff = typeof value === 'number' && prevValue !== undefined && prevValue !== 0
    ? ((value - prevValue) / prevValue * 100).toFixed(1)
    : null;
  const preferLower = lowerIsBetter ?? (label.includes('显存') || label.includes('容量'));
  const isBetter = diff !== null && (preferLower ? diff < 0 : diff > 0);
  const colorClass = accent === 'emerald' ? 'text-emerald-400' : accent === 'rose' ? 'text-rose-400' : accent === 'violet' ? 'text-violet-400' : accent === 'amber' ? 'text-amber-400' : accent === 'slate' ? 'text-space-200' : 'text-cyan-400';
  return (
    <div className="rounded-xl border border-space-700/50 bg-gradient-to-br from-space-900/80 to-space-950/60 p-3.5 shadow-inner shadow-white/[0.015]">
      <div className="mb-1.5 flex items-center gap-1.5">
        <span className="text-[11px] font-medium uppercase tracking-wide text-space-500">{label}</span>
        {tip && <span title={tip} className="cursor-help text-space-600"><Info size={11} /></span>}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className={`font-mono text-xl font-bold tracking-tight ${colorClass}`}>
          {typeof value === 'number' ? value.toFixed(digits) : value}
        </span>
        {unit && <span className="text-xs text-space-500">{unit}</span>}
      </div>
      {diff !== null && (
        <span className={`mt-1 inline-block text-[11px] ${isBetter ? 'text-emerald-400' : 'text-rose-400'}`}>
          相对基线 {Number(diff) > 0 ? '+' : ''}{diff}%
        </span>
      )}
    </div>
  );
}

export function SmartAlert({ message, type = 'warning' }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex items-start gap-2 rounded-xl border px-3.5 py-3 text-sm leading-relaxed ${
        type === 'warning'
          ? 'border-amber-500/30 bg-amber-500/10 text-amber-200'
          : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
      }`}
    >
      {type === 'warning' ? <AlertTriangle size={15} className="mt-0.5 shrink-0" /> : <CheckCircle2 size={15} className="mt-0.5 shrink-0" />}
      <span>{message}</span>
    </motion.div>
  );
}
