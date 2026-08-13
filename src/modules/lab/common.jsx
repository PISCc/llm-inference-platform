import { useState, useEffect, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import Badge from '../../components/Badge.jsx';

export const TABS = [
  { key: 'kv', label: 'KV Cache 计算器', iconName: 'MemoryStick', accent: 'emerald' },
  { key: 'attn', label: 'Attention 架构对比', iconName: 'Network', accent: 'cyan' },
  { key: 'parallel', label: '并行方式演示', iconName: 'BarChart3', accent: 'violet' },
];

export const ARCHITECTURES = {
  MHA: {
    name: 'MHA',
    label: 'Multi-Head Attention',
    desc: '每个查询头对应独立的 K/V 头',
    kvHeadRatio: 1,
    memoryFactor: 1,
    speedFactor: 1,
    qualityFactor: 1,
    color: '#22d3ee',
  },
  GQA: {
    name: 'GQA',
    label: 'Grouped Query Attention',
    desc: '多个查询头共享一组 K/V 头',
    kvHeadRatio: 0.25,
    memoryFactor: 0.25,
    speedFactor: 1.12,
    qualityFactor: 0.96,
    color: '#a78bfa',
  },
  MQA: {
    name: 'MQA',
    label: 'Multi-Query Attention',
    desc: '所有查询头共享同一组 K/V',
    kvHeadRatio: 1 / 32,
    memoryFactor: 0.031,
    speedFactor: 1.25,
    qualityFactor: 0.9,
    color: '#fbbf24',
  },
  MLA: {
    name: 'MLA',
    label: 'Multi-head Latent Attention',
    desc: 'DeepSeek 提出的低秩 KV 压缩',
    kvHeadRatio: 0.125,
    memoryFactor: 0.18,
    speedFactor: 1.18,
    qualityFactor: 0.98,
    color: '#34d399',
  },
  FlashAttention: {
    name: 'FlashAttention',
    label: 'FlashAttention',
    desc: '分块计算减少显存 IO',
    kvHeadRatio: 1,
    memoryFactor: 0.35,
    speedFactor: 1.35,
    qualityFactor: 1,
    color: '#06b6d4',
  },
};

export const PRECISIONS = {
  fp16: { label: 'FP16', bytes: 2, desc: '半精度浮点，标准训练推理格式' },
  int8: { label: 'INT8', bytes: 1, desc: '8 位整数量化，精度损失可控' },
  int4: { label: 'INT4', bytes: 0.5, desc: '4 位整数量化，极限压缩' },
};

export const REFERENCE_CONFIGS = [
  { name: 'Llama-3-8B', hiddenSize: 4096, numLayers: 32, numHeads: 32, numKVHeads: 8, seqLen: 8192, batchSize: 1, precision: 'fp16', architecture: 'GQA' },
  { name: 'Llama-3-70B', hiddenSize: 8192, numLayers: 80, numHeads: 64, numKVHeads: 8, seqLen: 8192, batchSize: 1, precision: 'fp16', architecture: 'GQA' },
  { name: 'DeepSeek-V2', hiddenSize: 5120, numLayers: 60, numHeads: 128, numKVHeads: 1, seqLen: 128000, batchSize: 1, precision: 'fp16', architecture: 'MLA' },
];

export function calcKVCache({ hiddenSize, numLayers, numHeads, numKVHeads, seqLen, batchSize, precision }) {
  const headDim = hiddenSize / numHeads;
  const bytes = PRECISIONS[precision]?.bytes || 2;
  const kvCacheBytes = 2 * numLayers * numKVHeads * headDim * seqLen * batchSize * bytes;
  return {
    kvCacheBytes,
    kvCacheGB: kvCacheBytes / (1024 ** 3),
    perLayerBytes: 2 * numKVHeads * headDim * seqLen * batchSize * bytes,
    headDim,
    bytes,
  };
}

export function calcModelWeight({ hiddenSize, numLayers, precision }) {
  const bytes = PRECISIONS[precision]?.bytes || 2;
  const weightBytes = 2 * hiddenSize * hiddenSize * numLayers * 3 * bytes;
  return weightBytes / (1024 ** 3);
}

export function calcParallelThroughput({ gpuCount, tp, pp, dp, modelSize, bandwidth }) {
  const effectiveGpus = gpuCount;
  const commOverhead = tp > 1 ? 0.15 * (tp - 1) / tp : 0;
  const bubbleOverhead = pp > 1 ? 0.1 * (pp - 1) / pp : 0;
  const throughput = effectiveGpus * (1 - commOverhead - bubbleOverhead);
  return { throughput, commOverhead, bubbleOverhead };
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
  }, [target]);

  return value;
}

export function SliderControl({ label, value, min, max, step, onChange, unit, tooltip, accent = 'cyan' }) {
  const accentClass = accent === 'emerald' ? 'accent-emerald-400' : accent === 'violet' ? 'accent-violet-400' : 'accent-cyan-400';
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-space-200">{label}</span>
          {tooltip && (
            <span title={tooltip} className="cursor-help text-space-500 hover:text-space-300 transition-colors">
              <Info size={13} />
            </span>
          )}
        </div>
        <span className="text-sm font-mono text-space-300">{value}{unit}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`w-full h-1.5 rounded-full bg-space-800 appearance-none cursor-pointer ${accentClass}`}
      />
    </div>
  );
}

export function MetricCard({ label, value, unit, prevValue, accent = 'cyan', tip }) {
  const diff = prevValue !== undefined && prevValue !== 0 ? ((value - prevValue) / prevValue * 100).toFixed(1) : null;
  const isBetter = diff !== null && ((label.includes('显存') || label.includes('内存')) ? diff < 0 : diff > 0);
  const colorClass = accent === 'emerald' ? 'text-emerald-400' : accent === 'rose' ? 'text-rose-400' : accent === 'violet' ? 'text-violet-400' : accent === 'amber' ? 'text-amber-400' : 'text-cyan-400';
  return (
    <div className="rounded-lg border border-space-700/50 bg-space-900/50 p-3">
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-xs text-space-400">{label}</span>
        {tip && <span title={tip} className="cursor-help text-space-600"><Info size={11} /></span>}
      </div>
      <div className="flex items-baseline gap-1">
        <span className={`text-lg font-bold font-mono ${colorClass}`}>
          {typeof value === 'number' ? value.toFixed(2) : value}
        </span>
        <span className="text-xs text-space-500">{unit}</span>
      </div>
      {diff !== null && (
        <span className={`text-xs ${isBetter ? 'text-emerald-400' : 'text-rose-400'}`}>
          {isBetter ? '↓' : '↑'} {Math.abs(diff)}%
        </span>
      )}
    </div>
  );
}

export function SmartAlert({ message, type = 'warning' }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
        type === 'warning'
          ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
          : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
      }`}
    >
      {type === 'warning' ? <AlertTriangle size={15} className="mt-0.5 shrink-0" /> : <CheckCircle2 size={15} className="mt-0.5 shrink-0" />}
      <span>{message}</span>
    </motion.div>
  );
}