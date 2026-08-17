import { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MemoryStick, Network, BarChart3 } from 'lucide-react';
import Badge from '../components/Badge.jsx';
import ProductHeader from '../components/ProductHeader.jsx';
import {
  TABS, ARCHITECTURES, PRECISIONS,
  calcKVCache, calcModelWeight, getArchitectureKVHeads
} from '../modules/lab/common.jsx';
import KVCachePanel from '../modules/lab/KVCachePanel.jsx';
import AttentionPanel from '../modules/lab/AttentionPanel.jsx';
import ParallelPanel from '../modules/lab/ParallelPanel.jsx';

const ICON_MAP = { MemoryStick, Network, BarChart3 };

export default function Lab() {
  const location = useLocation();
  const navigate = useNavigate();
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
    attentionKernel: 'standard',
    gpuCount: 1,
    gpuMemory: 80,
    modelSize: 8,
    parameterCountB: null,
    referenceName: null,
    kvLatentDim: 512,
    ropeHeadDim: 64,
  });

  useEffect(() => {
    const requestedTab = location.state?.tab;
    if (requestedTab && TABS.some(tab => tab.key === requestedTab)) {
      setActiveTab(requestedTab);
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.pathname, location.state, navigate]);

  useEffect(() => {
    // 参考配置自带权威 K/V 头数（如 Llama 3 70B 为 8），不被 numHeads/4 通用推导覆盖
    if (params.referenceName) return;
    const arch = ARCHITECTURES[params.architecture];
    if (!arch || arch.kvMode === 'latent') return;
    const newKVHeads = getArchitectureKVHeads(params.architecture, params.numHeads);
    if (newKVHeads !== params.numKVHeads) {
      setParams(p => ({ ...p, numKVHeads: newKVHeads }));
    }
  }, [params.architecture, params.numHeads, params.numKVHeads, params.referenceName]);

  const calcResult = useMemo(() => calcKVCache(params), [params]);
  const modelWeight = useMemo(() => calcModelWeight(params), [params]);
  const baselineCalc = useMemo(() => calcKVCache({ ...params, architecture: 'MHA', numKVHeads: params.numHeads }), [params]);

  const alerts = useMemo(() => {
    const list = [];
    const totalMem = calcResult.kvCacheGB + modelWeight;
    if (totalMem > params.gpuMemory) {
      const suggestedTP = Math.ceil(totalMem / params.gpuMemory);
      list.push({
        msg: `估算容量超出单卡输入值（${totalMem.toFixed(1)} GiB > ${params.gpuMemory} GiB）。仅按容量下界至少需要 ${suggestedTP} 个分片；实际部署还需预留运行时空间。`,
        type: 'warning',
      });
    }
    if (params.hiddenSize % params.numHeads !== 0) {
      list.push({
        msg: '当前 hidden_size 不能被注意力头数整除，得到的 Head 维度不是整数；该组合仅能作为数学输入，不对应常见 Transformer 配置。',
        type: 'warning',
      });
    }
    if (params.seqLen > 32768 && params.architecture === 'MHA') {
      list.push({
        msg: '在相同输入长度、批次和缓存精度下，MHA 的持久 KV Cache 容量通常高于采用较少 K/V 头的 GQA，或采用潜变量缓存的 MLA；实际配置应以目标模型为准。',
        type: 'warning',
      });
    }
    if (params.batchSize > 8 && params.precision === 'fp16') {
      list.push({
        msg: '批次增大会线性增加本页 KV Cache 容量估算；可单独评估权重量化或缓存精度方案，但真实精度、元数据和运行时开销由模型与推理引擎配置决定。',
        type: 'warning',
      });
    }
    if (list.length === 0) {
      list.push({ msg: '当前“权重载荷 + KV Cache”估算未超过单卡输入值；仍需预留激活值、临时张量、通信缓冲区和框架开销。', type: 'success' });
    }
    return list;
  }, [calcResult.kvCacheGB, modelWeight, params.gpuMemory, params.seqLen, params.architecture, params.batchSize, params.precision, params.hiddenSize, params.numHeads]);

  const kvHeadsLabel = ARCHITECTURES[params.architecture]?.kvMode === 'latent'
    ? 'Latent'
    : params.numKVHeads;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <ProductHeader
        title="参数实验室工作台"
        subtitle="调整模型结构、上下文长度、精度与并行配置，复算 KV Cache 容量和权重容量；页面不把未经压测的性能倍率当作结论。"
        accent="emerald"
      />

      <div className="flex justify-center overflow-x-auto pb-1">
        <div className="inline-flex min-w-max rounded-xl border border-space-700/60 bg-space-900/60 p-1">
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

      <div className="flex flex-wrap items-center justify-center gap-2 rounded-xl border border-space-700/40 bg-space-900/35 px-3 py-2 text-xs">
        <Badge variant="slate">Hidden={params.hiddenSize}</Badge>
        <Badge variant="slate">Layers={params.numLayers}</Badge>
        <Badge variant="slate">Heads={params.numHeads}</Badge>
        <Badge variant="slate">KV={kvHeadsLabel}</Badge>
        <Badge variant="slate">Seq={params.seqLen}</Badge>
        <Badge variant="slate">Batch={params.batchSize}</Badge>
        <Badge variant={params.precision === 'fp16' ? 'cyan' : params.precision === 'int8' ? 'violet' : 'amber'}>
          {PRECISIONS[params.precision].label}
        </Badge>
        <Badge variant="emerald">{params.architecture}</Badge>
        {activeTab === 'attn' && <Badge variant="cyan">{params.attentionKernel === 'flash' ? 'FlashAttention' : '标准算子'}</Badge>}
        <Badge variant="slate">GPUx{params.gpuCount}</Badge>
      </div>

      <div key={activeTab}>
        {activeTab === 'kv' && (
          <KVCachePanel params={params} setParams={setParams} calcResult={calcResult} modelWeight={modelWeight} alerts={alerts} />
        )}
        {activeTab === 'attn' && (
          <AttentionPanel params={params} setParams={setParams} calcResult={calcResult} baselineCalc={baselineCalc} />
        )}
        {activeTab === 'parallel' && (
          <ParallelPanel params={params} setParams={setParams} />
        )}
      </div>
    </div>
  );
}
