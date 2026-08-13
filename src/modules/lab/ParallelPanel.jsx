import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Cpu, Zap, Layers, Network, ArrowRightLeft } from 'lucide-react';
import GlowCard from '../../components/GlowCard.jsx';
import Badge from '../../components/Badge.jsx';
import {
  SliderControl, MetricCard, SmartAlert,
  calcParallelThroughput
} from './common.jsx';

export default function ParallelPanel({ params, setParams }) {
  const { gpuCount, gpuMemory, modelSize } = params;

  const recommended = useMemo(() => {
    const tp = modelSize > 40 ? 4 : modelSize > 13 ? 2 : 1;
    const pp = gpuCount > tp ? Math.min(4, Math.floor(gpuCount / tp)) : 1;
    const dp = Math.max(1, Math.floor(gpuCount / (tp * pp)));
    return { tp, pp, dp, ep: 1 };
  }, [gpuCount, modelSize]);

  const throughput = useMemo(() => {
    return calcParallelThroughput({ gpuCount, ...recommended, modelSize, bandwidth: 900 });
  }, [gpuCount, recommended, modelSize]);

  const topoData = useMemo(() => {
    const nodes = [];
    const cols = recommended.tp;
    const rows = recommended.pp;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        nodes.push({ id: r * cols + c, row: r, col: c, label: `GPU-${r * cols + c + 1}` });
      }
    }
    return { nodes, cols, rows };
  }, [recommended]);

  const memEnough = gpuCount * gpuMemory >= modelSize * 2;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      <div className="lg:col-span-3 space-y-4">
        <GlowCard accent="violet" className="p-4">
          <h3 className="text-sm font-semibold text-space-200 mb-3 flex items-center gap-2">
            <Cpu size={14} className="text-violet-400" /> 硬件参数
          </h3>
          <div className="space-y-4">
            <SliderControl label="GPU 数量" value={params.gpuCount} min={1} max={16} step={1} unit="张" onChange={(v) => setParams(p => ({ ...p, gpuCount: v }))} accent="violet" />
            <SliderControl label="单卡显存" value={params.gpuMemory} min={8} max={192} step={8} unit="GB" onChange={(v) => setParams(p => ({ ...p, gpuMemory: v }))} accent="violet" />
            <SliderControl label="模型规模" value={params.modelSize} min={1} max={200} step={1} unit="B" onChange={(v) => setParams(p => ({ ...p, modelSize: v }))} tooltip="参数量（十亿）" accent="violet" />
          </div>
        </GlowCard>
        <GlowCard accent="violet" className="p-4">
          <h3 className="text-sm font-semibold text-space-200 mb-3">推荐配置</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-space-400">张量并行 (TP)</span>
              <Badge variant="violet">TP={recommended.tp}</Badge>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-space-400">流水线并行 (PP)</span>
              <Badge variant="violet">PP={recommended.pp}</Badge>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-space-400">数据并行 (DP)</span>
              <Badge variant="violet">DP={recommended.dp}</Badge>
            </div>
          </div>
          <div className="mt-3 text-[11px] text-space-500">
            总显存: {gpuCount * gpuMemory} GB · 模型需 ~{(params.modelSize * 2).toFixed(0)} GB (FP16)
          </div>
        </GlowCard>
      </div>

      <div className="lg:col-span-6 space-y-4">
        <GlowCard accent="violet" className="p-4 h-80">
          <h3 className="text-sm font-semibold text-space-200 mb-2">GPU 拓扑示意</h3>
          <div className="flex items-center justify-center h-full">
            <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${topoData.cols}, minmax(0, 1fr))` }}>
              {topoData.nodes.map((node) => (
                <motion.div
                  key={node.id}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: node.id * 0.05 }}
                  className="relative flex flex-col items-center justify-center rounded-xl border border-violet-500/30 bg-violet-500/10 p-4 w-24 h-24"
                >
                  <Cpu size={20} className="text-violet-400 mb-1" />
                  <span className="text-[10px] text-space-300">{node.label}</span>
                  <span className="text-[9px] text-space-500">{node.row === 0 ? 'Layer 0-N' : `Layer ${node.row * 10}-${(node.row + 1) * 10}`}</span>
                  {node.col < topoData.cols - 1 && (
                    <div className="absolute right-0 top-1/2 w-3 h-0.5 bg-violet-500/40 translate-x-full" />
                  )}
                  {node.row < topoData.rows - 1 && (
                    <div className="absolute bottom-0 left-1/2 w-0.5 h-3 bg-violet-500/40 translate-y-full" />
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        </GlowCard>
        <GlowCard accent="violet" className="p-4">
          <h3 className="text-sm font-semibold text-space-200 mb-3">并行策略说明</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-space-700/50 bg-space-900/30 p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Zap size={12} className="text-violet-400" />
                <span className="text-xs font-semibold text-space-300">TP 张量并行</span>
              </div>
              <div className="text-[11px] text-space-500">切分 Attention/FFN 权重，适合单节点多卡，通信量大</div>
            </div>
            <div className="rounded-lg border border-space-700/50 bg-space-900/30 p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Layers size={12} className="text-violet-400" />
                <span className="text-xs font-semibold text-space-300">PP 流水线并行</span>
              </div>
              <div className="text-[11px] text-space-500">切分层到不同设备，适合超长模型，有气泡开销</div>
            </div>
            <div className="rounded-lg border border-space-700/50 bg-space-900/30 p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <ArrowRightLeft size={12} className="text-violet-400" />
                <span className="text-xs font-semibold text-space-300">DP 数据并行</span>
              </div>
              <div className="text-[11px] text-space-500">复制模型处理不同批次，扩展吞吐，显存复制多份</div>
            </div>
            <div className="rounded-lg border border-space-700/50 bg-space-900/30 p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Network size={12} className="text-violet-400" />
                <span className="text-xs font-semibold text-space-300">EP 专家并行</span>
              </div>
              <div className="text-[11px] text-space-500">MoE 专用，不同专家放不同 GPU，需 All-to-All 通信</div>
            </div>
          </div>
        </GlowCard>
      </div>

      <div className="lg:col-span-3 space-y-3">
        <GlowCard accent="violet" className="p-4">
          <h3 className="text-sm font-semibold text-space-200 mb-3">吞吐估算</h3>
          <div className="space-y-2">
            <MetricCard label="理论加速比" value={throughput.throughput} unit="x" accent="violet" />
            <MetricCard label="TP 通信开销" value={throughput.commOverhead * 100} unit="%" accent="rose" />
            <MetricCard label="PP 气泡开销" value={throughput.bubbleOverhead * 100} unit="%" accent="amber" />
          </div>
        </GlowCard>
        {!memEnough && (
          <SmartAlert
            message={`单卡显存不足：模型需 ~${(params.modelSize * 2).toFixed(0)}GB，总显存仅 ${gpuCount * gpuMemory}GB。建议开启 TP=${Math.ceil(params.modelSize * 2 / (gpuCount * gpuMemory))} 或启用 Offload`}
            type="warning"
          />
        )}
        {memEnough && (
          <SmartAlert message="当前配置显存充足，可以正常加载模型" type="success" />
        )}
        <GlowCard accent="slate" className="p-3">
          <h4 className="text-xs font-semibold text-space-300 mb-2">配置速查</h4>
          <div className="text-[11px] text-space-500 space-y-1">
            <div>Llama-3-8B: 1×A100 80G 单卡可跑</div>
            <div>Llama-3-70B: 需 TP=8 (8×A100)</div>
            <div>DeepSeek-V2: 需 TP=8 + PP=2</div>
          </div>
        </GlowCard>
      </div>
    </div>
  );
}