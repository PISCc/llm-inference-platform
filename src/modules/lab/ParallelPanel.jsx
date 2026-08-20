import { useMemo } from 'react';
import { Cpu, Layers, Network, ArrowRightLeft, ShieldCheck, Info } from 'lucide-react';
import GlowCard from '../../components/GlowCard.jsx';
import Badge from '../../components/Badge.jsx';
import { SliderControl, MetricCard, SmartAlert } from './common.jsx';

const TP_CANDIDATES = [1, 2, 4, 8, 16];

function buildCapacityPlan(gpuCount, gpuMemory, modelSize) {
  const weightGiB = modelSize * 1e9 * 2 / (1024 ** 3);
  const minimumShards = Math.max(1, Math.ceil(weightGiB / gpuMemory));
  const validTP = TP_CANDIDATES.filter((value) => value <= gpuCount && gpuCount % value === 0);
  const tp = validTP.find((value) => value >= minimumShards) || validTP.at(-1) || 1;
  const minimumPP = Math.max(1, Math.ceil(minimumShards / tp));
  const maxPP = Math.max(1, Math.floor(gpuCount / tp));
  const pp = Math.min(minimumPP, maxPP);
  const replicaSize = tp * pp;
  const dp = Math.floor(gpuCount / replicaSize);
  const usedGpus = replicaSize * Math.max(dp, 1);
  const replicaCapacityGiB = replicaSize * gpuMemory;
  const fitsWeightsOnly = replicaCapacityGiB >= weightGiB;

  return {
    weightGiB,
    minimumShards,
    tp,
    pp,
    dp: fitsWeightsOnly ? Math.max(1, dp) : 0,
    replicaSize,
    usedGpus: Math.min(gpuCount, usedGpus),
    idleGpus: Math.max(0, gpuCount - Math.min(gpuCount, usedGpus)),
    replicaCapacityGiB,
    fitsWeightsOnly,
  };
}

export default function ParallelPanel({ params, setParams }) {
  const { gpuCount, gpuMemory, modelSize } = params;
  const plan = useMemo(() => buildCapacityPlan(gpuCount, gpuMemory, modelSize), [gpuCount, gpuMemory, modelSize]);

  const nodes = useMemo(() => {
    return Array.from({ length: Math.min(gpuCount, plan.replicaSize) }, (_, index) => ({
      id: index,
      stage: Math.floor(index / plan.tp) + 1,
      shard: index % plan.tp + 1,
    }));
  }, [gpuCount, plan.replicaSize, plan.tp]);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      <div className="space-y-4 lg:col-span-3">
        <GlowCard accent="violet" className="panel-shell p-4">
          <div className="panel-title-row">
            <div className="panel-icon panel-icon-violet"><Cpu size={15} /></div>
            <div><h3 className="panel-title">容量输入</h3><p className="panel-kicker">WEIGHTS-ONLY LOWER BOUND</p></div>
          </div>
          <div className="mt-4 space-y-3">
            <SliderControl label="GPU 数量" value={gpuCount} min={1} max={16} step={1} unit=" 张" onChange={(v) => setParams(p => ({ ...p, gpuCount: v }))} accent="violet" />
            <SliderControl label="单卡标称显存" value={gpuMemory} min={8} max={192} step={8} unit=" GiB" onChange={(v) => setParams(p => ({ ...p, gpuMemory: v }))} accent="violet" />
            <SliderControl label="模型参数量" value={modelSize} min={1} max={200} step={1} unit="B" onChange={(v) => setParams(p => ({ ...p, modelSize: v }))} tooltip="按 FP16/BF16 权重计算" accent="violet" />
          </div>
        </GlowCard>

        <GlowCard accent="violet" className="panel-shell p-4">
          <div className="panel-title-row">
            <div className="panel-icon panel-icon-violet"><ShieldCheck size={15} /></div>
            <div><h3 className="panel-title">容量可行组合</h3><p className="panel-kicker">NOT A PERFORMANCE RECOMMENDATION</p></div>
          </div>
          <div className="mt-4 space-y-2.5">
            <ConfigRow label="张量并行" value={`TP=${plan.tp}`} />
            <ConfigRow label="流水线并行" value={`PP=${plan.pp}`} />
            <ConfigRow label="完整副本数" value={plan.dp > 0 ? `DP=${plan.dp}` : '0'} />
          </div>
        </GlowCard>
      </div>

      <div className="space-y-4 lg:col-span-6">
        <GlowCard accent="violet" className="panel-shell p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="panel-title-row">
              <div className="panel-icon panel-icon-violet"><Network size={15} /></div>
              <div><h3 className="panel-title">单副本拓扑</h3><p className="panel-kicker">TP SHARDS × PP STAGES</p></div>
            </div>
            <Badge variant="violet">{plan.replicaSize} GPU / 副本</Badge>
          </div>

          <div className="mt-6 space-y-4">
            {Array.from({ length: plan.pp }, (_, stageIndex) => (
              <div key={stageIndex} className="rounded-2xl border border-space-700/50 bg-space-950/35 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-semibold text-violet-300"><Layers size={13} />PP Stage {stageIndex + 1}</div>
                  <span className="font-mono text-[10px] text-space-600">{plan.tp} TP shards</span>
                </div>
                <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(plan.tp, 4)}, minmax(0, 1fr))` }}>
                  {nodes.filter((node) => node.stage === stageIndex + 1).map((node) => (
                    <div key={node.id} className="relative overflow-hidden rounded-xl border border-violet-500/25 bg-violet-500/8 p-3 text-center">
                      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-400/70 to-transparent" />
                      <Cpu size={17} className="mx-auto text-violet-400" />
                      <div className="mt-2 text-xs font-semibold text-space-200">GPU {node.id + 1}</div>
                      <div className="mt-0.5 font-mono text-[9px] text-space-500">TP shard {node.shard}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <InfoTile icon={ArrowRightLeft} title="TP 通信" text="同一层的分片计算通常需要集合通信；开销取决于算子切分、互联带宽和消息规模。" />
            <InfoTile icon={Layers} title="PP 气泡" text="流水线阶段可能等待上游或下游；幅度取决于微批数、阶段均衡和调度策略。" />
          </div>
        </GlowCard>
      </div>

      <div className="space-y-3 lg:col-span-3">
        <GlowCard accent="violet" className="panel-shell p-4">
          <div className="panel-title-row">
            <div className="panel-icon panel-icon-violet"><Info size={15} /></div>
            <div><h3 className="panel-title">容量下界</h3><p className="panel-kicker">THEORETICAL PAYLOAD</p></div>
          </div>
          <div className="mt-4 space-y-2">
            <MetricCard label="FP16/BF16 权重" value={plan.weightGiB} unit="GiB" accent="violet" />
            <MetricCard label="最少分片数" value={plan.minimumShards} unit="张" accent="amber" digits={0} />
            <MetricCard label="单副本标称容量" value={plan.replicaCapacityGiB} unit="GiB" accent={plan.fitsWeightsOnly ? 'emerald' : 'rose'} digits={0} />
            <MetricCard label="未组成副本" value={plan.idleGpus} unit="张" accent="slate" digits={0} />
          </div>
        </GlowCard>

        <SmartAlert
          type={plan.fitsWeightsOnly ? 'success' : 'warning'}
          message={plan.fitsWeightsOnly
            ? '当前组合可容纳权重，请继续预留 KV Cache 与运行空间。'
            : '当前 GPU 总容量连 FP16/BF16 权重下界都无法满足，需要增加容量、增加 GPU 或降低权重精度。'}
        />

        <GlowCard accent="slate" className="panel-shell p-4">
          <h4 className="text-xs font-semibold text-space-300">计算公式</h4>
          <div className="mt-3 space-y-2 text-[11px] leading-relaxed text-space-500">
            <div className="formula-chip">权重 GiB = 参数量 × 10⁹ × 2 ÷ 2³⁰</div>
          </div>
        </GlowCard>
      </div>
    </div>
  );
}

function ConfigRow({ label, value }) {
  return <div className="flex items-center justify-between rounded-lg border border-space-700/40 bg-space-950/35 px-3 py-2 text-sm"><span className="text-space-400">{label}</span><Badge variant="violet">{value}</Badge></div>;
}

function InfoTile({ icon: Icon, title, text }) {
  return <div className="rounded-xl border border-space-700/50 bg-space-900/45 p-3"><div className="flex items-center gap-2 text-xs font-semibold text-space-200"><Icon size={13} className="text-violet-400" />{title}</div><p className="mt-2 text-[11px] leading-relaxed text-space-500">{text}</p></div>;
}
