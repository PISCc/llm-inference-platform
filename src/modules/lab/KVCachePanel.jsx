import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip,
  ResponsiveContainer
} from 'recharts';
import { Database, Gauge, Layers, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import GlowCard from '../../components/GlowCard.jsx';
import Badge from '../../components/Badge.jsx';
import {
  SliderControl, MetricCard, SmartAlert, useCountUp,
  calcKVCache, calcModelWeight, PRECISIONS, REFERENCE_CONFIGS, ARCHITECTURES
} from './common.jsx';

export default function KVCachePanel({ params, setParams, calcResult, modelWeight, alerts }) {
  const kvGiB = useCountUp(calcResult.kvCacheGB);
  const totalTarget = calcResult.kvCacheGB + modelWeight;
  const totalGiB = useCountUp(totalTarget);
  const usingReference = Boolean(params.referenceName && params.parameterCountB);

  const layerData = useMemo(() => {
    const arr = [];
    const step = Math.max(1, Math.floor(params.numLayers / 16));
    for (let i = 0; i < params.numLayers; i += step) {
      arr.push({
        layer: `L${i + 1}`,
        kv: calcResult.perLayerBytes / (1024 ** 3),
        model: modelWeight / params.numLayers,
      });
    }
    return arr;
  }, [params.numLayers, calcResult.perLayerBytes, modelWeight]);

  const formula = calcResult.isLatent
    ? 'MLA = L × S × B × (d_latent + d_rope) × bytes'
    : 'KV = 2 × L × H_kv × d_h × S × B × bytes';

  const updateStructure = (patch) => {
    setParams((current) => ({
      ...current,
      ...patch,
      parameterCountB: null,
      referenceName: null,
    }));
  };

  const applyReference = (cfg) => {
    setParams((current) => ({
      ...current,
      hiddenSize: cfg.hiddenSize,
      numLayers: cfg.numLayers,
      numHeads: cfg.numHeads,
      numKVHeads: cfg.numKVHeads,
      seqLen: cfg.seqLen,
      batchSize: cfg.batchSize,
      precision: cfg.precision,
      architecture: cfg.architecture,
      parameterCountB: cfg.parameterCountB,
      referenceName: cfg.name,
      kvLatentDim: cfg.kvLatentDim ?? current.kvLatentDim,
      qkNopeHeadDim: cfg.qkNopeHeadDim ?? current.qkNopeHeadDim,
      ropeHeadDim: cfg.ropeHeadDim ?? current.ropeHeadDim,
      valueHeadDim: cfg.valueHeadDim ?? current.valueHeadDim,
    }));
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      <div className="space-y-4 lg:col-span-3">
        <GlowCard accent="emerald" className="panel-shell p-4">
          <div className="panel-title-row">
            <div className="panel-icon panel-icon-emerald"><SlidersHorizontal size={15} /></div>
            <div><h3 className="panel-title">模型参数</h3><p className="panel-kicker">STRUCTURE INPUTS</p></div>
          </div>
          <div className="mt-4 space-y-3">
            <SliderControl label="隐藏维度" value={params.hiddenSize} min={512} max={16384} step={512} unit="" onChange={(v) => updateStructure({ hiddenSize: v })} tooltip="Transformer 隐藏层维度；修改后切换为结构假设估算" accent="emerald" />
            <SliderControl label="层数" value={params.numLayers} min={4} max={128} step={2} unit="层" onChange={(v) => updateStructure({ numLayers: v })} tooltip="Transformer 层数；修改后切换为结构假设估算" accent="emerald" />
            <SliderControl label="注意力头数" value={params.numHeads} min={8} max={128} step={8} unit="头" onChange={(v) => updateStructure({ numHeads: v })} tooltip="Query 头数量；Head 维度按 hidden_size / num_heads 计算" accent="emerald" />
            <SliderControl label="序列长度" value={params.seqLen} min={128} max={131072} step={128} unit="" onChange={(v) => setParams(p => ({ ...p, seqLen: v }))} tooltip="本次容量场景中每个请求缓存的 Token 数量" accent="emerald" />
            <SliderControl label="批次大小" value={params.batchSize} min={1} max={64} step={1} unit="" onChange={(v) => setParams(p => ({ ...p, batchSize: v }))} tooltip="同时保留 KV Cache 的请求数" accent="emerald" />
          </div>
        </GlowCard>

        <GlowCard accent="emerald" className="panel-shell p-4">
          <div className="panel-title-row">
            <div className="panel-icon panel-icon-emerald"><ShieldCheck size={15} /></div>
            <div><h3 className="panel-title">容量精度假设</h3><p className="panel-kicker">THEORETICAL PAYLOAD</p></div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {Object.entries(PRECISIONS).map(([key, info]) => (
              <button
                key={key}
                onClick={() => setParams(p => ({ ...p, precision: key }))}
                className={`rounded-xl border px-2 py-2 text-xs transition-all ${
                  params.precision === key
                    ? 'border-emerald-400/50 bg-emerald-500/15 text-emerald-300 shadow-[inset_0_0_18px_rgba(52,211,153,.06)]'
                    : 'border-space-700 bg-space-950/35 text-space-400 hover:border-space-600'
                }`}
              >
                <div className="font-semibold">{info.label}</div>
                <div className="mt-0.5 text-[10px] opacity-70">{info.bytes} B/元素</div>
              </button>
            ))}
          </div>
          <p className="mt-3 text-[10px] leading-relaxed text-space-600">权重和 KV Cache 按所选字节数计算。</p>
        </GlowCard>
      </div>

      <div className="space-y-4 lg:col-span-6">
        <GlowCard accent="emerald" className="panel-shell h-[360px] p-5">
          <div className="flex h-full flex-col">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="panel-title-row">
                <div className="panel-icon panel-icon-emerald"><Layers size={15} /></div>
                <div><h3 className="panel-title">按层平均容量抽样</h3><p className="panel-kicker">GiB PER LAYER · VISUAL BREAKDOWN</p></div>
              </div>
              <Badge variant="emerald">{params.numLayers} 层</Badge>
            </div>
            <div className="mt-3 min-h-0 flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={layerData} margin={{ top: 8, right: 8, bottom: 8, left: 2 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ded7ca" vertical={false} />
                  <XAxis dataKey="layer" tick={{ fill: '#777066', fontSize: 10 }} />
                  <YAxis tick={{ fill: '#777066', fontSize: 10 }} width={48} label={{ value: 'GiB / 层', angle: -90, position: 'insideLeft', fill: '#777066', fontSize: 10 }} />
                  <ReTooltip contentStyle={{ background: '#fbf8f2', border: '1px solid #ded7ca', borderRadius: 10, color: '#2b2925', fontSize: 12 }} formatter={(value, name) => [`${Number(value).toFixed(3)} GiB`, name]} />
                  <Bar dataKey="kv" stackId="a" fill="#5c7f65" name="KV Cache / 层" />
                  <Bar dataKey="model" stackId="a" fill="#46728a" radius={[4, 4, 0, 0]} name="权重平均载荷 / 层" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-space-600">显示每层 KV Cache 与权重容量分布。</p>
          </div>
        </GlowCard>

        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-space-300"><Database size={13} className="text-emerald-400" />参考配置</div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {REFERENCE_CONFIGS.map(cfg => {
              const refCalc = calcKVCache(cfg);
              const refWeight = calcModelWeight(cfg);
              const isMatch = params.referenceName === cfg.name;
              return (
                <button
                  key={cfg.name}
                  onClick={() => applyReference(cfg)}
                  className={`module-card rounded-xl border px-3.5 py-3 text-left transition-all ${
                    isMatch ? 'border-emerald-400/45 bg-emerald-500/10 ring-1 ring-emerald-400/20' : 'border-space-700/50 bg-space-900/35 hover:border-space-600'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-space-100">{cfg.name}</span>
                    {isMatch && <Badge variant="emerald">当前</Badge>}
                  </div>
                  <div className="mt-2 font-mono text-[10px] text-space-400">KV {refCalc.kvCacheGB.toFixed(2)} GiB · 权重 {refWeight.toFixed(1)} GiB</div>
                  <p className="mt-2 text-[10px] leading-relaxed text-space-600">{cfg.scenarioNote}</p>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="space-y-3 lg:col-span-3">
        <GlowCard accent="emerald" className="panel-shell p-4">
          <div className="panel-title-row">
            <div className="panel-icon panel-icon-emerald"><Gauge size={15} /></div>
            <div><h3 className="panel-title">实时容量估算</h3><p className="panel-kicker">NOT A RUNTIME PROFILE</p></div>
          </div>
          <div className="mt-4 space-y-2">
            <MetricCard label="KV Cache" value={kvGiB} unit="GiB" accent="emerald" tip="按当前架构、层数、序列长度、批次和容量精度计算" />
            <MetricCard label="权重容量" value={modelWeight} unit="GiB" accent="cyan" tip={usingReference ? '参数量 × 每元素字节数' : '按当前结构参数计算'} />
            <MetricCard label="容量合计" value={totalGiB} unit="GiB" accent={totalTarget > params.gpuMemory ? 'rose' : 'violet'} tip="权重容量 + KV Cache" />
            <MetricCard
              label={calcResult.isLatent ? 'MLA Q/K Head 维度' : 'Head 维度'}
              value={calcResult.attentionHeadDim}
              unit=""
              accent="slate"
              digits={0}
              tip={calcResult.isLatent ? 'qk_nope_head_dim + qk_rope_head_dim；不使用 hidden_size / num_heads 代替 MLA 的公开配置' : 'hidden_size / num_heads；当前输入需能整除才对应常见模型配置'}
            />
          </div>
          <div className="mt-3 rounded-xl border border-space-700/50 bg-space-950/40 px-3 py-2.5 text-[10px] leading-relaxed text-space-500">
            <div>架构：{ARCHITECTURES[params.architecture].name} · {calcResult.isLatent ? `${calcResult.latentWidth} 维持久缓存/层/Token（${params.kvLatentDim}+${params.ropeHeadDim}）` : `${calcResult.effectiveKVHeads} 个 K/V 头`}</div>
            <div className="mt-1">权重参数：{usingReference ? `${params.referenceName} 公开参数量` : '按当前结构估算'}</div>
          </div>
        </GlowCard>

        {alerts.length > 0 && (
          <div className="space-y-2">
            {alerts.map((a, i) => <SmartAlert key={i} message={a.msg} type={a.type} />)}
          </div>
        )}

        <GlowCard accent="slate" className="panel-shell p-4">
          <h4 className="text-xs font-semibold text-space-300">公式与范围</h4>
          <div className="mt-3 space-y-2 text-[11px] leading-relaxed text-space-500">
            <div className="formula-chip font-mono">{formula}</div>
            <div>GiB 按 2³⁰ 字节换算；不计激活值、CUDA Context、内存碎片、通信缓冲区和框架预留。</div>
          </div>
        </GlowCard>
      </div>
    </div>
  );
}
