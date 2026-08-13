import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MemoryStick, Network, BarChart3 } from 'lucide-react';
import Badge from '../components/Badge.jsx';
import {
  TABS, ARCHITECTURES, PRECISIONS,
  calcKVCache, calcModelWeight
} from '../modules/lab/common.jsx';
import KVCachePanel from '../modules/lab/KVCachePanel.jsx';
import AttentionPanel from '../modules/lab/AttentionPanel.jsx';
import ParallelPanel from '../modules/lab/ParallelPanel.jsx';

const ICON_MAP = { MemoryStick, Network, BarChart3 };

export default function Lab() {
  const [activeTab, setActiveTab] = useState('kv');
  const [params, setParams] = useState({
    hiddenSize: 4096,
    numLayers: 32,
    numHeads: 32,
    numKVHeads: 8,
    seqLen: 8192,
    batchSize: 1,
    precision: 'fp16',
    architecture: 'GQA',
    gpuCount: 1,
    gpuMemory: 80,
    modelSize: 8,
  });

  // 联动：架构改变时自动更新 numKVHeads
  useEffect(() => {
    const arch = ARCHITECTURES[params.architecture];
    if (!arch) return;
    const newKVHeads = params.architecture === 'FlashAttention'
      ? params.numHeads
      : Math.max(1, Math.round(params.numHeads * arch.kvHeadRatio));
    if (newKVHeads !== params.numKVHeads) {
      setParams(p => ({ ...p, numKVHeads: newKVHeads }));
    }
  }, [params.architecture, params.numHeads]);

  const calcResult = useMemo(() => calcKVCache(params), [params]);
  const modelWeight = useMemo(() => calcModelWeight(params), [params]);
  const baselineCalc = useMemo(() => calcKVCache({ ...params, numKVHeads: params.numHeads }), [params]);

  const alerts = useMemo(() => {
    const list = [];
    const totalMem = calcResult.kvCacheGB + modelWeight;
    if (totalMem > params.gpuMemory) {
      const suggestedTP = Math.ceil(totalMem / params.gpuMemory);
      list.push({
        msg: `显存超出单卡容量（需 ${totalMem.toFixed(1)}GB > ${params.gpuMemory}GB）。建议开启 TP=${suggestedTP} 张量并行，或启用 CPU Offload 卸载 KV Cache`,
        type: 'warning',
      });
    }
    if (params.seqLen > 32768 && params.architecture === 'MHA') {
      list.push({
        msg: '长文本场景下 MHA 的 KV Cache 显存占用极高，建议切换至 GQA 或 MLA 架构',
        type: 'warning',
      });
    }
    if (params.batchSize > 8 && params.precision === 'fp16') {
      list.push({
        msg: '大批量推理时 FP16 显存压力大，可考虑 INT8 量化降低 KV Cache 占用',
        type: 'warning',
      });
    }
    if (list.length === 0) {
      list.push({ msg: '当前配置在单卡范围内，显存充裕', type: 'success' });
    }
    return list;
  }, [calcResult.kvCacheGB, modelWeight, params.gpuMemory, params.seqLen, params.architecture, params.batchSize, params.precision]);

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold text-gradient">参数实验室工作台</h1>
        <p className="text-sm text-space-400">调整参数，实时观察显存、架构与并行策略对推理的影响</p>
      </div>

      <div className="flex justify-center">
        <div className="inline-flex rounded-xl border border-space-700/60 bg-space-900/50 p-1">
          {TABS.map((tab) => {
            const Icon = ICON_MAP[tab.iconName];
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`relative flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                  isActive ? 'text-space-100' : 'text-space-500 hover:text-space-300'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="lab-tab"
                    className={`absolute inset-0 rounded-lg border bg-space-800/80 ${
                      tab.accent === 'emerald' ? 'border-emerald-500/30' :
                      tab.accent === 'violet' ? 'border-violet-500/30' :
                      'border-cyan-500/30'
                    }`}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <Icon size={15} className={`relative z-10 ${
                  tab.accent === 'emerald' ? 'text-emerald-400' :
                  tab.accent === 'violet' ? 'text-violet-400' :
                  'text-cyan-400'
                }`} />
                <span className="relative z-10">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
        <Badge variant="slate">Hidden={params.hiddenSize}</Badge>
        <Badge variant="slate">Layers={params.numLayers}</Badge>
        <Badge variant="slate">Heads={params.numHeads}</Badge>
        <Badge variant="slate">KVHeads={params.numKVHeads}</Badge>
        <Badge variant="slate">Seq={params.seqLen}</Badge>
        <Badge variant="slate">Batch={params.batchSize}</Badge>
        <Badge variant={params.precision === 'fp16' ? 'cyan' : params.precision === 'int8' ? 'violet' : 'amber'}>
          {PRECISIONS[params.precision].label}
        </Badge>
        <Badge variant="emerald">{params.architecture}</Badge>
        <Badge variant="slate">GPUx{params.gpuCount}</Badge>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.25 }}
        >
          {activeTab === 'kv' && (
            <KVCachePanel params={params} setParams={setParams} calcResult={calcResult} modelWeight={modelWeight} alerts={alerts} />
          )}
          {activeTab === 'attn' && (
            <AttentionPanel params={params} setParams={setParams} calcResult={calcResult} baselineCalc={baselineCalc} />
          )}
          {activeTab === 'parallel' && (
            <ParallelPanel params={params} setParams={setParams} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}