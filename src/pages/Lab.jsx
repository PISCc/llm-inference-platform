import { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MemoryStick, Network, BarChart3 } from 'lucide-react';
import Badge from '../components/Badge.jsx';
import ProductHeader from '../components/ProductHeader.jsx';
import {
  TABS, ARCHITECTURES, PRECISIONS,
  calcKVCache, calcModelWeight, resolveKVHeads
} from '../modules/lab/common.jsx';
import KVCachePanel from '../modules/lab/KVCachePanel.jsx';
import AttentionPanel from '../modules/lab/AttentionPanel.jsx';
import ParallelPanel from '../modules/lab/ParallelPanel.jsx';
import { usePageContextRegistration } from '../context/PageContext.jsx';

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
    gqaKVHeads: null,
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
    qkNopeHeadDim: 128,
    ropeHeadDim: 64,
    valueHeadDim: 128,
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
    const newKVHeads = resolveKVHeads(params.architecture, params.numHeads, params.gqaKVHeads);
    if (newKVHeads !== params.numKVHeads) {
      setParams(p => ({ ...p, numKVHeads: newKVHeads }));
    }
  }, [params.architecture, params.numHeads, params.numKVHeads, params.referenceName, params.gqaKVHeads]);

  const calcResult = useMemo(() => calcKVCache(params), [params]);
  const modelWeight = useMemo(() => calcModelWeight(params), [params]);
  const baselineCalc = useMemo(() => calcKVCache({ ...params, architecture: 'MHA', numKVHeads: params.numHeads }), [params]);

  const alerts = useMemo(() => {
    const list = [];
    const totalMem = calcResult.kvCacheGB + modelWeight;
    if (totalMem > params.gpuMemory) {
      const suggestedTP = Math.ceil(totalMem / params.gpuMemory);
      list.push({
        msg: `当前容量超出单卡输入值（${totalMem.toFixed(1)} GiB > ${params.gpuMemory} GiB），至少需要 ${suggestedTP} 个分片并预留运行空间。`,
        type: 'warning',
      });
    }
    if (params.architecture !== 'MLA' && params.hiddenSize % params.numHeads !== 0) {
      list.push({
        msg: 'hidden_size 不能被注意力头数整除，请调整参数。',
        type: 'warning',
      });
    }
    if (params.seqLen > 32768 && params.architecture === 'MHA') {
      list.push({
        msg: '当前长序列使用 MHA，可对比 GQA 或 MLA 的 KV Cache 容量。',
        type: 'warning',
      });
    }
    if (params.batchSize > 8 && params.precision === 'fp16') {
      list.push({
        msg: '批次增大会线性增加 KV Cache 容量，可对比缓存精度和权重量化方案。',
        type: 'warning',
      });
    }
    if (list.length === 0) {
      list.push({ msg: '当前容量合计未超过单卡输入值。', type: 'success' });
    }
    return list;
  }, [calcResult.kvCacheGB, modelWeight, params.gpuMemory, params.seqLen, params.architecture, params.batchSize, params.precision, params.hiddenSize, params.numHeads]);

  const kvHeadsLabel = ARCHITECTURES[params.architecture]?.kvMode === 'latent'
    ? 'Latent'
    : params.numKVHeads;

  const activeTabMeta = TABS.find((tab) => tab.key === activeTab) || TABS[0];
  const pageContext = useMemo(() => ({
    pageId: 'lab',
    pageTitle: '参数实验室',
    pageType: 'parameter-lab',
    activeSection: activeTab,
    selection: {
      tab: activeTab,
      tabLabel: activeTabMeta.label,
      referenceName: params.referenceName,
      architectureLabel: ARCHITECTURES[params.architecture]?.label,
      attentionKernel: params.attentionKernel,
    },
    parameters: params,
    result: {
      kvCache: calcResult,
      modelWeight,
      mhaBaseline: baselineCalc,
      alerts,
      interpretation: {
        estimatedWeightAndKVGiB: modelWeight + calcResult.kvCacheGB,
        kvAsPercentOfMha: calcResult.kvMemoryRatio * 100,
        fitsEnteredSingleGpuCapacity: modelWeight + calcResult.kvCacheGB <= params.gpuMemory,
        formulaInputsOnly: true,
      },
    },
    visibleSummary: `正在“${activeTabMeta.label}”中调整参数；当前 Attention 架构为 ${params.architecture}，序列长度为 ${params.seqLen}。`,
    suggestedQuestions: activeTab === 'kv' ? [
      `为什么当前 KV Cache 是 ${calcResult.kvCacheGB.toFixed(2)} GiB？`,
      '哪些输入参数会线性放大当前 KV Cache？',
      '当前配置下权重和 KV Cache 各占多少？',
    ] : activeTab === 'attn' ? [
      `当前 ${params.architecture} 相比 MHA 减少了多少持久 KV Cache？`,
      `${params.attentionKernel === 'flash' ? 'FlashAttention' : '标准 Attention'}会改变持久 KV Cache 容量吗？`,
      '当前结构应如何选择？',
    ] : [
      `当前 ${params.gpuCount} 张 GPU 的容量规划应该如何理解？`,
      '容量分片与 TP、PP、DP 的作用有什么区别？',
      '当前配置如何继续优化？',
    ],
    boundaries: [],
  }), [activeTab, activeTabMeta.label, alerts, baselineCalc, calcResult, modelWeight, params]);

  usePageContextRegistration('lab-page', pageContext);

  return (
    <div className="lab-workbench mx-auto max-w-7xl space-y-5">
      <ProductHeader
        title="参数实验室工作台"
        subtitle="调整模型结构、上下文长度、精度与并行配置，计算 KV Cache、权重容量和并行分片。"
        accent="emerald"
      />

      <div className="lab-mode-toolbar">
        <div className="lab-mode-tabs inline-flex min-w-max rounded-xl border border-space-700/60 bg-space-900/60 p-1">
          {TABS.map((tab) => {
            const Icon = ICON_MAP[tab.iconName];
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                aria-pressed={isActive}
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

      <div className="lab-config-strip">
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

      <div className="lab-task-workspace" key={activeTab}>
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
