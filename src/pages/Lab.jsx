import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MemoryStick, Cpu, BarChart3, Server,
  ArrowRight, CheckCircle2, AlertCircle
} from 'lucide-react';
import GlowCard from '../components/GlowCard.jsx';
import Badge from '../components/Badge.jsx';

// ================= KV Cache Calculator =================

function KVCacheTool() {
  const [params, setParams] = useState({
    hiddenSize: 4096,
    numLayers: 32,
    numHeads: 32,
    numKvHeads: 8,
    contextLen: 4096,
    batchSize: 1,
    precision: 2,
  });

  const headDim = Math.floor(params.hiddenSize / params.numHeads);
  const bytesPerParam = params.precision;

  const kvCacheBytes = 2 * params.numLayers * params.numKvHeads * params.contextLen * headDim * bytesPerParam * params.batchSize;
  const kvCacheGB = (kvCacheBytes / 1024 / 1024 / 1024).toFixed(2);

  const sliders = [
    { key: 'hiddenSize', label: 'Hidden Size', min: 512, max: 8192, step: 512 },
    { key: 'numLayers', label: 'Layers', min: 1, max: 128, step: 1 },
    { key: 'numHeads', label: 'Attention Heads', min: 1, max: 64, step: 1 },
    { key: 'numKvHeads', label: 'KV Heads', min: 1, max: 64, step: 1 },
    { key: 'contextLen', label: 'Context Length', min: 128, max: 131072, step: 128 },
    { key: 'batchSize', label: 'Batch Size', min: 1, max: 64, step: 1 },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GlowCard accent="emerald">
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-space-100 flex items-center gap-2">
              <Cpu className="w-5 h-5 text-emerald-400" />
              模型参数
            </h3>
            {sliders.map((s) => (
              <div key={s.key} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-space-300">{s.label}</span>
                  <span className="text-emerald-400 font-mono">{params[s.key]}</span>
                </div>
                <input
                  type="range"
                  min={s.min}
                  max={s.max}
                  step={s.step}
                  value={params[s.key]}
                  onChange={(e) => setParams(p => ({ ...p, [s.key]: Number(e.target.value) }))}
                  className="w-full accent-emerald-500"
                />
              </div>
            ))}
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-space-300">精度</span>
                <span className="text-emerald-400 font-mono">{params.precision === 2 ? 'FP16/BF16' : 'FP32'}</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setParams(p => ({ ...p, precision: 2 }))}
                  className={`px-3 py-1 rounded text-sm ${params.precision === 2 ? 'bg-emerald-500 text-white' : 'bg-space-700 text-space-300'}`}
                >
                  FP16/BF16
                </button>
                <button
                  onClick={() => setParams(p => ({ ...p, precision: 4 }))}
                  className={`px-3 py-1 rounded text-sm ${params.precision === 4 ? 'bg-emerald-500 text-white' : 'bg-space-700 text-space-300'}`}
                >
                  FP32
                </button>
              </div>
            </div>
          </div>
        </GlowCard>

        <div className="space-y-4">
          <GlowCard accent="emerald">
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-space-100 flex items-center gap-2">
                <MemoryStick className="w-5 h-5 text-emerald-400" />
                KV Cache 显存
              </h3>
              <div className="text-center py-4">
                <div className="text-4xl font-bold text-emerald-400">{kvCacheGB} <span className="text-lg text-space-400">GB</span></div>
                <div className="text-sm text-space-400 mt-1">公式: 2 x layers x kv_heads x seq_len x head_dim x bytes x batch</div>
              </div>
              <div className="bg-space-800 rounded p-3 font-mono text-xs text-space-300 space-y-1">
                <div>head_dim = hiddenSize / numHeads = {params.hiddenSize} / {params.numHeads} = {headDim}</div>
                <div>= 2 x {params.numLayers} x {params.numKvHeads} x {params.contextLen} x {headDim} x {bytesPerParam} x {params.batchSize}</div>
                <div>= {kvCacheBytes.toLocaleString()} bytes</div>
                <div>= {kvCacheGB} GB</div>
              </div>
            </div>
          </GlowCard>

          <GlowCard accent="emerald">
            <div className="space-y-3">
              <h3 className="text-lg font-bold text-space-100">参考值</h3>
              <div className="grid grid-cols-1 gap-2">
                <div className="bg-space-800 rounded p-2 text-sm">
                  <div className="text-space-300">Llama-3-8B @ 8K context, FP16</div>
                  <div className="text-emerald-400 font-bold">~1.0 GB</div>
                </div>
                <div className="bg-space-800 rounded p-2 text-sm">
                  <div className="text-space-300">Llama-3-70B @ 8K context, FP16</div>
                  <div className="text-emerald-400 font-bold">~1.3 GB</div>
                </div>
              </div>
              <p className="text-xs text-space-500">数据来源: Meta Llama 3 技术报告</p>
            </div>
          </GlowCard>
        </div>
      </div>
    </div>
  );
}

// ================= Attention Comparison =================

const ARCHS = [
  {
    key: 'mha',
    name: 'MHA',
    fullName: 'Multi-Head Attention',
    desc: '每个 Query head 对应独立的 Key/Value head',
    kvHeadsText: 'numHeads',
    memoryRatio: 1.0,
    example: '原始 Transformer',
    source: 'Vaswani et al. 2017',
  },
  {
    key: 'gqa',
    name: 'GQA',
    fullName: 'Grouped-Query Attention',
    desc: '多个 Query head 共享一组 Key/Value head',
    kvHeadsText: 'numKvHeads < numHeads',
    memoryRatio: 0.25,
    example: 'Llama-2-70B、Llama-3-8B (8/32)',
    source: 'Ainslie et al. 2023',
  },
  {
    key: 'mqa',
    name: 'MQA',
    fullName: 'Multi-Query Attention',
    desc: '所有 Query head 共享 1 个 Key/Value head',
    kvHeadsText: '1',
    memoryRatio: 0.03125,
    example: 'PaLM、Falcon',
    source: 'Shazeer 2019',
  },
  {
    key: 'mla',
    name: 'MLA',
    fullName: 'Multi-head Latent Attention',
    desc: 'DeepSeek 提出的低秩压缩 KV 表示',
    kvHeadsText: '低秩压缩',
    memoryRatio: 0.05,
    example: 'DeepSeek-V2/V3',
    source: 'DeepSeek-AI 2024',
  },
];

function AttentionTool() {
  const [selected, setSelected] = useState('gqa');
  const selectedArch = ARCHS.find(a => a.key === selected);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-3">
          {ARCHS.map((arch) => (
            <motion.div
              key={arch.key}
              onClick={() => setSelected(arch.key)}
              className={`cursor-pointer rounded-xl p-4 border transition-colors ${
                selected === arch.key
                  ? 'border-emerald-400 bg-emerald-400/10'
                  : 'border-space-700 bg-space-800/50 hover:border-space-600'
              }`}
              whileHover={{ scale: 1.01 }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Badge variant="emerald">{arch.name}</Badge>
                  <span className="text-space-300 text-sm">{arch.fullName}</span>
                </div>
                {selected === arch.key && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
              </div>
              <p className="text-space-400 text-sm mt-2">{arch.desc}</p>
            </motion.div>
          ))}
        </div>

        <GlowCard accent="emerald">
          <AnimatePresence mode="wait">
            {selectedArch && (
              <motion.div
                key={selectedArch.key}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <div className="flex items-center gap-3">
                  <Badge variant="emerald" className="text-sm px-3 py-1">{selectedArch.name}</Badge>
                  <h3 className="text-xl font-bold text-space-100">{selectedArch.fullName}</h3>
                </div>

                <div className="bg-space-800 rounded-lg p-4">
                  <div className="flex items-center justify-center gap-4">
                    <div className="text-center">
                      <div className="bg-cyan-500/20 border border-cyan-400 rounded p-2 text-cyan-300 text-xs font-bold">Query Heads</div>
                      <div className="text-space-400 text-xs mt-1">x32</div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-space-500" />
                    <div className="text-center">
                      <div className="bg-emerald-500/20 border border-emerald-400 rounded p-2 text-emerald-300 text-xs font-bold">
                        KV Heads
                      </div>
                      <div className="text-space-400 text-xs mt-1">
                        {selectedArch.key === 'mha' ? 'x32 (1:1)' :
                         selectedArch.key === 'gqa' ? 'x8 (1:4)' :
                         selectedArch.key === 'mqa' ? 'x1 (1:32)' :
                         '低秩向量'}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-space-300">KV Cache 相对大小</span>
                      <span className="text-emerald-400 font-mono">{(selectedArch.memoryRatio * 100).toFixed(1)}%</span>
                    </div>
                    <div className="h-3 bg-space-700 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-emerald-400 rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(selectedArch.memoryRatio * 100, 100)}%` }}
                        transition={{ duration: 0.5 }}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="bg-space-800 rounded p-3">
                    <div className="text-xs text-space-500 mb-1">代表模型</div>
                    <div className="text-sm text-space-300">{selectedArch.example}</div>
                  </div>
                  <div className="bg-space-800 rounded p-3">
                    <div className="text-xs text-space-500 mb-1">来源</div>
                    <div className="text-sm text-space-300">{selectedArch.source}</div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </GlowCard>
      </div>
    </div>
  );
}

// ================= Parallelism Demo =================

const PARALLEL_MODES = [
  {
    key: 'tp',
    name: 'Tensor Parallelism (TP)',
    desc: '将单层权重矩阵切分到多个 GPU',
    pros: ['适合单 layer 权重超过单卡显存', 'AllReduce 通信量相对可控'],
    cons: ['需要 NVLink/高速互联', '扩展性受限于单层大小'],
  },
  {
    key: 'pp',
    name: 'Pipeline Parallelism (PP)',
    desc: '将模型按层分组，分配到不同 GPU，形成流水线',
    pros: ['适合超深模型', '层间通信量小'],
    cons: ['Pipeline bubble 开销', '负载均衡需要精细调度'],
  },
  {
    key: 'dp',
    name: 'Data Parallelism (DP)',
    desc: '每张卡保存完整模型，处理不同数据子集',
    pros: ['实现最简单', '扩展性最好'],
    cons: ['显存冗余', '小 batch 时效率低'],
  },
  {
    key: 'ep',
    name: 'Expert Parallelism (EP)',
    desc: 'MoE 模型中，不同 Expert 分布在不同 GPU',
    pros: ['MoE 专属优化', '激活参数量与总参数量解耦'],
    cons: ['需要 All-to-All 通信', 'Expert 负载可能不均衡'],
  },
];

function ParallelTool() {
  const [mode, setMode] = useState('tp');
  const selected = PARALLEL_MODES.find(m => m.key === mode);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {PARALLEL_MODES.map((m) => (
          <button
            key={m.key}
            onClick={() => setMode(m.key)}
            className={`p-3 rounded-xl border text-left transition-colors ${
              mode === m.key
                ? 'border-emerald-400 bg-emerald-400/10'
                : 'border-space-700 bg-space-800/50 hover:border-space-600'
            }`}
          >
            <div className="text-sm font-bold text-space-100">{m.name.split(' ')[0]}</div>
            <div className="text-xs text-space-400 mt-1">{m.name.split(' ')[1]?.replace(/[()]/g, '')}</div>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {selected && (
          <motion.div
            key={selected.key}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <GlowCard accent="emerald">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Server className="w-5 h-5 text-emerald-400" />
                  <h3 className="text-lg font-bold text-space-100">{selected.name}</h3>
                </div>
                <p className="text-space-300">{selected.desc}</p>

                <div className="bg-space-800 rounded-lg p-4">
                  <div className="flex items-center justify-center gap-2">
                    {[0,1,2,3].map(i => (
                      <motion.div
                        key={i}
                        className="w-20 h-24 rounded border-2 flex items-center justify-center bg-space-800"
                        style={{
                          borderColor: mode === 'tp' ? '#34d399' :
                                       mode === 'pp' ? ['#34d399','#fbbf24','#22d3ee','#a78bfa'][i] :
                                       mode === 'dp' ? '#34d399' :
                                       '#fbbf24'
                        }}
                        animate={mode === 'pp' ? {
                          scale: [1, 1.05, 1],
                        } : {}}
                        transition={mode === 'pp' ? {
                          duration: 0.5, delay: i * 0.1, repeat: Infinity, repeatDelay: 2
                        } : {}}
                      >
                        <div className="text-center">
                          <div className="text-xs text-space-400">GPU {i+1}</div>
                          <div className="text-xs font-bold text-space-200 mt-1">
                            {mode === 'tp' && '部分权重'}
                            {mode === 'pp' && `Layers ${i*8+1}-${(i+1)*8}`}
                            {mode === 'dp' && '完整模型'}
                            {mode === 'ep' && (i < 3 ? `Expert ${i+1}` : 'Gate')}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-space-800/50 rounded-lg p-3">
                    <h4 className="text-sm font-bold text-emerald-400 mb-2">优势</h4>
                    <ul className="space-y-1">
                      {selected.pros.map((p, i) => (
                        <li key={i} className="text-sm text-space-300 flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                          {p}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="bg-space-800/50 rounded-lg p-3">
                    <h4 className="text-sm font-bold text-red-400 mb-2">劣势</h4>
                    <ul className="space-y-1">
                      {selected.cons.map((c, i) => (
                        <li key={i} className="text-sm text-space-300 flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                          {c}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </GlowCard>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ================= Main Lab Component =================

export default function Lab() {
  const [tab, setTab] = useState('kv');

  const tabs = [
    { key: 'kv', label: 'KV Cache 计算器', icon: MemoryStick },
    { key: 'attention', label: 'Attention 对比', icon: BarChart3 },
    { key: 'parallel', label: '并行策略', icon: Server },
  ];

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-space-100">参数实验室</h1>
          <p className="text-space-400">拖动参数，实时观察显存、延迟、吞吐与 Attention 结构变化</p>
        </div>

        <div className="flex justify-center gap-2">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === t.key
                  ? 'bg-emerald-500 text-white'
                  : 'bg-space-800 text-space-300 hover:bg-space-700'
              }`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {tab === 'kv' && <KVCacheTool />}
            {tab === 'attention' && <AttentionTool />}
            {tab === 'parallel' && <ParallelTool />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}