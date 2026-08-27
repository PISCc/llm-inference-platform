import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip,
  ResponsiveContainer, Cell
} from 'recharts';
import { Network, ChevronRight, Zap, Database, ShieldCheck } from 'lucide-react';
import GlowCard from '../../components/GlowCard.jsx';
import Badge from '../../components/Badge.jsx';
import {
  SliderControl, MetricCard,
  calcKVCache, ARCHITECTURES, ATTENTION_KERNELS, resolveKVHeads
} from './common.jsx';

export default function AttentionPanel({ params, setParams, calcResult, baselineCalc }) {
  const archList = Object.entries(ARCHITECTURES);
  const kernel = ATTENTION_KERNELS[params.attentionKernel];

  const compareData = useMemo(() => archList.map(([key, arch]) => {
    let kvHeads;
    if (ARCHITECTURES[key]?.kvMode === 'latent') {
      kvHeads = null;
    } else if (key === 'MHA') {
      kvHeads = params.numHeads;
    } else if (key === 'MQA') {
      kvHeads = 1;
    } else {
      // GQA：优先保留当前模型的权威参考头数，否则按 Q 头数的 1/4 推导。
      kvHeads = resolveKVHeads('GQA', params.numHeads, params.gqaKVHeads);
    }
    const archCalc = calcKVCache({
      ...params,
      architecture: key,
      numKVHeads: kvHeads,
    });
    return {
      key,
      name: arch.name,
      label: arch.label,
      kvGiB: archCalc.kvCacheGB,
      ratio: archCalc.kvMemoryRatio,
      color: arch.color,
      desc: arch.desc,
      structure: archCalc.isLatent ? `${archCalc.latentWidth} 维潜变量缓存` : `${archCalc.effectiveKVHeads} 个 K/V 头`,
    };
  }), [archList, params]);

  const arch = ARCHITECTURES[params.architecture];
  const currentStructure = calcResult.isLatent
    ? `${calcResult.latentWidth} 维/Token/层`
    : `${calcResult.effectiveKVHeads} 个 K/V 头`;

  const setArchitecture = (key) => {
    setParams((current) => ({
      ...current,
      architecture: key,
      numKVHeads: resolveKVHeads(key, current.numHeads, current.gqaKVHeads) ?? current.numKVHeads,
      parameterCountB: null,
      referenceName: null,
    }));
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      <div className="space-y-4 lg:col-span-3">
        <GlowCard accent="cyan" className="panel-shell p-4">
          <div className="panel-title-row">
            <div className="panel-icon panel-icon-cyan"><Network size={15} /></div>
            <div><h3 className="panel-title">Attention 架构</h3><p className="panel-kicker">PERSISTENT KV STRUCTURE</p></div>
          </div>
          <div className="mt-4 space-y-2">
            {archList.map(([key, info]) => (
              <button
                key={key}
                onClick={() => setArchitecture(key)}
                className={`w-full rounded-xl border px-3.5 py-3 text-left transition-all ${
                  params.architecture === key
                    ? 'border-cyan-400/45 bg-cyan-500/10 shadow-[inset_3px_0_0_rgba(34,211,238,.7)]'
                    : 'border-space-700/50 bg-space-950/30 hover:border-space-600 hover:bg-space-900/70'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div><span className="text-sm font-semibold text-space-100">{info.name}</span><span className="ml-2 text-[10px] text-space-600">{info.label}</span></div>
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: info.color }} />
                </div>
                <p className="mt-1.5 text-[11px] leading-relaxed text-space-500">{info.desc}</p>
              </button>
            ))}
          </div>
        </GlowCard>

        <GlowCard accent="cyan" className="panel-shell p-4">
          <div className="panel-title-row">
            <div className="panel-icon panel-icon-cyan"><Zap size={15} /></div>
            <div><h3 className="panel-title">计算实现</h3><p className="panel-kicker">KERNEL IS NOT AN ARCHITECTURE</p></div>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
            {Object.entries(ATTENTION_KERNELS).map(([key, item]) => (
              <button
                key={key}
                onClick={() => setParams(p => ({ ...p, attentionKernel: key }))}
                className={`rounded-xl border p-3 text-left transition-all ${
                  params.attentionKernel === key
                    ? 'border-violet-400/40 bg-violet-500/10'
                    : 'border-space-700/50 bg-space-950/30 hover:border-space-600'
                }`}
              >
                <div className="text-xs font-semibold text-space-200">{item.name}</div>
                <p className="mt-1.5 text-[10px] leading-relaxed text-space-500">{item.desc}</p>
              </button>
            ))}
          </div>
        </GlowCard>
      </div>

      <div className="space-y-4 lg:col-span-6">
        <GlowCard accent="cyan" className="panel-shell h-[360px] p-5">
          <div className="flex h-full flex-col">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="panel-title-row">
                <div className="panel-icon panel-icon-cyan"><Database size={15} /></div>
                <div><h3 className="panel-title">持久 KV Cache 容量</h3><p className="panel-kicker">SAME INPUT · SAME PRECISION</p></div>
              </div>
              <Badge variant="cyan">可复算公式</Badge>
            </div>
            <div className="mt-4 min-h-0 flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={compareData} layout="vertical" margin={{ top: 8, right: 28, bottom: 10, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ded7ca" horizontal={false} />
                  <XAxis type="number" tick={{ fill: '#777066', fontSize: 10 }} label={{ value: 'GiB', position: 'insideBottom', fill: '#777066', fontSize: 10, offset: -4 }} />
                  <YAxis type="category" dataKey="name" tick={{ fill: '#504b43', fontSize: 11 }} width={54} />
                  <ReTooltip contentStyle={{ background: '#fbf8f2', border: '1px solid #ded7ca', borderRadius: 12, color: '#2b2925', fontSize: 12 }} formatter={(value) => [`${Number(value).toFixed(3)} GiB`, 'KV Cache']} />
                  <Bar dataKey="kvGiB" radius={[0, 6, 6, 0]} barSize={24}>
                    {compareData.map((entry) => <Cell key={entry.key} fill={entry.color} fillOpacity={entry.key === params.architecture ? 1 : 0.58} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </GlowCard>

        <div className="grid gap-3 sm:grid-cols-2">
          {compareData.map((item) => (
            <button key={item.key} onClick={() => setArchitecture(item.key)} className={`rounded-2xl border p-4 text-left transition-all ${item.key === params.architecture ? 'border-cyan-400/35 bg-cyan-500/8' : 'border-space-700/50 bg-space-900/45 hover:border-space-600'}`}>
              <div className="flex items-center justify-between"><span className="text-sm font-semibold text-space-200">{item.name}</span><span className="font-mono text-xs" style={{ color: item.color }}>{item.ratio.toFixed(3)}× MHA</span></div>
              <div className="mt-2 text-[11px] text-space-500">{item.structure}</div>
              <div className="mt-1 font-mono text-xs text-space-300">{item.kvGiB.toFixed(3)} GiB</div>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4 lg:col-span-3">
        <GlowCard accent="cyan" className="panel-shell p-4">
          <div className="panel-title-row">
            <div className="panel-icon panel-icon-cyan"><ShieldCheck size={15} /></div>
            <div><h3 className="panel-title">当前组合</h3><p className="panel-kicker">STRUCTURE-LEVEL RESULT</p></div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2"><Badge variant="cyan">{arch.name}</Badge><Badge variant="violet">{kernel.name}</Badge></div>
          <p className="mt-3 text-xs leading-relaxed text-space-500">{arch.desc}</p>
          <div className="mt-4 space-y-2">
            <MetricCard label="KV Cache" value={calcResult.kvCacheGB} unit="GiB" prevValue={baselineCalc.kvCacheGB} accent="cyan" lowerIsBetter />
            <MetricCard label="相对 MHA 容量" value={calcResult.kvMemoryRatio} unit="×" accent={calcResult.kvMemoryRatio < 1 ? 'emerald' : 'slate'} digits={3} />
            <MetricCard label="缓存结构" value={currentStructure} unit="" accent="violet" />
          </div>
        </GlowCard>

        <GlowCard accent="slate" className="panel-shell p-4">
          <h4 className="text-xs font-semibold text-space-300">结构关系</h4>
          <div className="mt-3 space-y-2 text-[11px] leading-relaxed text-space-500">
            <div className="flex items-start gap-1.5"><ChevronRight size={11} className="mt-0.5 shrink-0 text-cyan-400" /><span>架构决定持久 K/V 的组织方式；FlashAttention 属于计算实现优化。</span></div>
            <div className="flex items-start gap-1.5"><ChevronRight size={11} className="mt-0.5 shrink-0 text-cyan-400" /><span>FlashAttention 不改变本页的持久 KV Cache 容量。</span></div>
          </div>
        </GlowCard>

        <GlowCard accent="slate" className="panel-shell p-4">
          <h4 className="text-xs font-semibold text-space-300">计算公式</h4>
          <div className="mt-3 space-y-2 text-[10px] leading-relaxed text-space-500">
            <div className="formula-chip">MHA/GQA/MQA = 2 × L × Hkv × dh × S × B × bytes</div>
            <div className="formula-chip">MLA = L × S × B × (dlatent + drope) × bytes</div>
            <div>MLA 默认维度对应 DeepSeek-V2 公开配置；其他 MLA 模型应替换为自身配置。</div>
          </div>
        </GlowCard>
      </div>
    </div>
  );
}
