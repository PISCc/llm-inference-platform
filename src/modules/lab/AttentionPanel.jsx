import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip,
  ResponsiveContainer, Cell,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend
} from 'recharts';
import { Network, ChevronRight } from 'lucide-react';
import GlowCard from '../../components/GlowCard.jsx';
import Badge from '../../components/Badge.jsx';
import {
  SliderControl, MetricCard,
  calcKVCache, ARCHITECTURES
} from './common.jsx';

export default function AttentionPanel({ params, setParams, calcResult, baselineCalc }) {
  const archList = Object.entries(ARCHITECTURES);

  const radarData = useMemo(() => {
    return archList.map(([key, arch]) => ({
      subject: arch.name,
      显存效率: Math.min(100, Math.round((1 / arch.memoryFactor) * 25)),
      推理速度: Math.min(100, Math.round(arch.speedFactor * 65)),
      生成质量: Math.min(100, Math.round(arch.qualityFactor * 95)),
      fullMark: 100,
    }));
  }, []);

  const compareData = useMemo(() => {
    return archList.map(([key, arch]) => {
      const archCalc = calcKVCache({ ...params, numKVHeads: Math.max(1, Math.round(params.numHeads * arch.kvHeadRatio)) });
      return {
        name: arch.name,
        label: arch.label,
        kvGB: archCalc.kvCacheGB,
        memoryFactor: arch.memoryFactor,
        speedFactor: arch.speedFactor,
        qualityFactor: arch.qualityFactor,
        color: arch.color,
        desc: arch.desc,
      };
    });
  }, [params]);

  const arch = ARCHITECTURES[params.architecture];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      <div className="lg:col-span-3 space-y-3">
        <GlowCard accent="cyan" className="p-4">
          <h3 className="text-sm font-semibold text-space-200 mb-3 flex items-center gap-2">
            <Network size={14} className="text-cyan-400" /> 选择架构
          </h3>
          <div className="space-y-2">
            {archList.map(([key, archInfo]) => (
              <button
                key={key}
                onClick={() => {
                  const newKVHeads = key === 'FlashAttention' ? params.numHeads : Math.max(1, Math.round(params.numHeads * archInfo.kvHeadRatio));
                  setParams(p => ({ ...p, architecture: key, numKVHeads: newKVHeads }));
                }}
                className={`w-full text-left rounded-lg border px-3 py-2 transition-all ${
                  params.architecture === key
                    ? 'border-cyan-400/50 bg-cyan-500/10'
                    : 'border-space-700/50 bg-space-900/30 hover:border-space-600'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-space-200">{archInfo.name}</span>
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: archInfo.color }} />
                </div>
                <div className="text-[11px] text-space-500 mt-0.5">{archInfo.desc}</div>
              </button>
            ))}
          </div>
        </GlowCard>
        <GlowCard accent="cyan" className="p-4">
          <h3 className="text-sm font-semibold text-space-200 mb-3">模型参数</h3>
          <div className="space-y-3">
            <SliderControl label="隐藏维度" value={params.hiddenSize} min={512} max={16384} step={512} unit="" onChange={(v) => setParams(p => ({ ...p, hiddenSize: v }))} accent="cyan" />
            <SliderControl label="注意力头数" value={params.numHeads} min={8} max={128} step={8} unit="头" onChange={(v) => setParams(p => ({ ...p, numHeads: v }))} accent="cyan" />
            <SliderControl label="层数" value={params.numLayers} min={4} max={128} step={2} unit="层" onChange={(v) => setParams(p => ({ ...p, numLayers: v }))} accent="cyan" />
            <SliderControl label="序列长度" value={params.seqLen} min={128} max={131072} step={128} unit="" onChange={(v) => setParams(p => ({ ...p, seqLen: v }))} accent="cyan" />
          </div>
        </GlowCard>
      </div>

      <div className="lg:col-span-6 space-y-4">
        <GlowCard accent="cyan" className="p-4 h-80">
          <h3 className="text-sm font-semibold text-space-200 mb-2">各架构 KV Cache 对比</h3>
          <ResponsiveContainer width="100%" height="90%">
            <BarChart data={compareData} layout="vertical" margin={{ top: 8, right: 24, bottom: 8, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
              <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 10 }} label={{ value: 'GB', position: 'insideBottom', fill: '#64748b', fontSize: 10, offset: -2 }} />
              <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} width={60} />
              <ReTooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="kvGB" radius={[0, 4, 4, 0]}>
                {compareData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </GlowCard>
        <GlowCard accent="cyan" className="p-4 h-64">
          <h3 className="text-sm font-semibold text-space-200 mb-2">能力雷达图</h3>
          <ResponsiveContainer width="100%" height="90%">
            <RadarChart data={radarData}>
              <PolarGrid stroke="#334155" />
              <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 9 }} />
              <Radar name="显存效率" dataKey="显存效率" stroke="#10b981" fill="#10b981" fillOpacity={0.15} />
              <Radar name="推理速度" dataKey="推理速度" stroke="#22d3ee" fill="#22d3ee" fillOpacity={0.15} />
              <Radar name="生成质量" dataKey="生成质量" stroke="#a78bfa" fill="#a78bfa" fillOpacity={0.15} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </RadarChart>
          </ResponsiveContainer>
        </GlowCard>
      </div>

      <div className="lg:col-span-3 space-y-3">
        <GlowCard accent="cyan" className="p-4">
          <h3 className="text-sm font-semibold text-space-200 mb-3">当前架构详情</h3>
          <div className="space-y-3">
            <div>
              <Badge variant="cyan">{arch.name}</Badge>
              <div className="text-xs text-space-400 mt-1">{arch.label}</div>
              <div className="text-[11px] text-space-500 mt-0.5">{arch.desc}</div>
            </div>
            <MetricCard label="KV Cache" value={calcResult.kvCacheGB} unit="GB" prevValue={baselineCalc.kvCacheGB} accent="cyan" />
            <MetricCard label="相对 MHA 显存" value={arch.memoryFactor} unit="x" accent={arch.memoryFactor < 1 ? 'emerald' : 'rose'} />
            <MetricCard label="速度提升" value={arch.speedFactor} unit="x" accent="emerald" />
            <MetricCard label="质量保留" value={arch.qualityFactor} unit="x" accent="violet" />
          </div>
        </GlowCard>
        <GlowCard accent="slate" className="p-3">
          <h4 className="text-xs font-semibold text-space-300 mb-2">架构选型建议</h4>
          <div className="text-[11px] text-space-500 space-y-1.5">
            <div className="flex items-start gap-1.5">
              <ChevronRight size={11} className="mt-0.5 text-cyan-400 shrink-0" />
              <span><strong className="text-space-400">长文本场景</strong>：优先 MLA 或 GQA，显存随序列线性增长，KV 压缩比高</span>
            </div>
            <div className="flex items-start gap-1.5">
              <ChevronRight size={11} className="mt-0.5 text-cyan-400 shrink-0" />
              <span><strong className="text-space-400">极致速度</strong>：FlashAttention + GQA 组合，IO 与 KV 双优化</span>
            </div>
            <div className="flex items-start gap-1.5">
              <ChevronRight size={11} className="mt-0.5 text-cyan-400 shrink-0" />
              <span><strong className="text-space-400">质量优先</strong>：MHA 或 MLA，避免 MQA 的信息损失</span>
            </div>
          </div>
        </GlowCard>
      </div>
    </div>
  );
}