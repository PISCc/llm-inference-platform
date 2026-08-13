import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip,
  ResponsiveContainer
} from 'recharts';
import { Layers, SlidersHorizontal } from 'lucide-react';
import GlowCard from '../../components/GlowCard.jsx';
import Badge from '../../components/Badge.jsx';
import {
  SliderControl, MetricCard, SmartAlert, useCountUp,
  calcKVCache, calcModelWeight, PRECISIONS, REFERENCE_CONFIGS
} from './common.jsx';

export default function KVCachePanel({ params, setParams, calcResult, modelWeight, alerts }) {
  const kvGB = useCountUp(calcResult.kvCacheGB);
  const totalGB = useCountUp(calcResult.kvCacheGB + modelWeight);

  const layerData = useMemo(() => {
    const arr = [];
    const step = Math.max(1, Math.floor(params.numLayers / 16));
    for (let i = 0; i < params.numLayers; i += step) {
      arr.push({
        layer: `L${i + 1}`,
        kv: (calcResult.perLayerBytes / (1024 ** 3)),
        model: modelWeight / params.numLayers,
      });
    }
    return arr;
  }, [params.numLayers, calcResult.perLayerBytes, modelWeight]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      <div className="lg:col-span-3 space-y-4">
        <GlowCard accent="emerald" className="p-4">
          <h3 className="text-sm font-semibold text-space-200 mb-3 flex items-center gap-2">
            <SlidersHorizontal size={14} className="text-emerald-400" /> 模型参数
          </h3>
          <div className="space-y-4">
            <SliderControl label="隐藏维度" value={params.hiddenSize} min={512} max={16384} step={512} unit="" onChange={(v) => setParams(p => ({ ...p, hiddenSize: v }))} tooltip="Transformer 隐藏层维度" accent="emerald" />
            <SliderControl label="层数" value={params.numLayers} min={4} max={128} step={2} unit="层" onChange={(v) => setParams(p => ({ ...p, numLayers: v }))} tooltip="Transformer 层数" accent="emerald" />
            <SliderControl label="注意力头数" value={params.numHeads} min={8} max={128} step={8} unit="头" onChange={(v) => setParams(p => ({ ...p, numHeads: v }))} tooltip="每层的注意力头数量" accent="emerald" />
            <SliderControl label="序列长度" value={params.seqLen} min={128} max={131072} step={128} unit="" onChange={(v) => setParams(p => ({ ...p, seqLen: v }))} tooltip="输入 Token 序列长度" accent="emerald" />
            <SliderControl label="批次大小" value={params.batchSize} min={1} max={64} step={1} unit="" onChange={(v) => setParams(p => ({ ...p, batchSize: v }))} tooltip="同时处理的请求数" accent="emerald" />
          </div>
        </GlowCard>
        <GlowCard accent="emerald" className="p-4">
          <h3 className="text-sm font-semibold text-space-200 mb-3">精度选择</h3>
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(PRECISIONS).map(([key, info]) => (
              <button
                key={key}
                onClick={() => setParams(p => ({ ...p, precision: key }))}
                className={`rounded-lg border px-2 py-1.5 text-xs transition-all ${
                  params.precision === key
                    ? 'border-emerald-400/50 bg-emerald-500/15 text-emerald-300'
                    : 'border-space-700 bg-space-900/40 text-space-400 hover:border-space-600'
                }`}
              >
                <div className="font-semibold">{info.label}</div>
                <div className="text-[10px] opacity-70 mt-0.5">{info.desc}</div>
              </button>
            ))}
          </div>
        </GlowCard>
      </div>

      <div className="lg:col-span-6 space-y-4">
        <GlowCard accent="emerald" className="p-4 h-80">
          <h3 className="text-sm font-semibold text-space-200 mb-2 flex items-center gap-2">
            <Layers size={14} className="text-emerald-400" /> 显存占用堆叠图
          </h3>
          <ResponsiveContainer width="100%" height="90%">
            <BarChart data={layerData} margin={{ top: 8, right: 8, bottom: 8, left: -8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="layer" tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} label={{ value: 'GB', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 10 }} />
              <ReTooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="kv" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} name="KV Cache" />
              <Bar dataKey="model" stackId="a" fill="#3b82f6" radius={[4, 4, 0, 0]} name="模型权重" />
            </BarChart>
          </ResponsiveContainer>
        </GlowCard>
        <div className="grid grid-cols-2 gap-3">
          {REFERENCE_CONFIGS.map(cfg => {
            const refCalc = calcKVCache({ ...cfg, numKVHeads: cfg.numKVHeads });
            const refWeight = calcModelWeight(cfg);
            const isMatch = params.hiddenSize === cfg.hiddenSize && params.numLayers === cfg.numLayers;
            return (
              <button
                key={cfg.name}
                onClick={() => setParams(p => ({ ...p, hiddenSize: cfg.hiddenSize, numLayers: cfg.numLayers, numHeads: cfg.numHeads, numKVHeads: cfg.numKVHeads, seqLen: cfg.seqLen, batchSize: cfg.batchSize, precision: cfg.precision, architecture: cfg.architecture }))}
                className={`text-left rounded-lg border px-3 py-2 transition-all ${
                  isMatch ? 'border-emerald-400/40 bg-emerald-500/10' : 'border-space-700/50 bg-space-900/30 hover:border-space-600'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-space-200">{cfg.name}</span>
                  {isMatch && <Badge variant="emerald">当前</Badge>}
                </div>
                <div className="text-[10px] text-space-500 mt-1">KV {(refCalc.kvCacheGB).toFixed(2)}GB · 权重 {refWeight.toFixed(1)}GB</div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="lg:col-span-3 space-y-3">
        <GlowCard accent="emerald" className="p-4">
          <h3 className="text-sm font-semibold text-space-200 mb-3">实时计算</h3>
          <div className="space-y-2">
            <MetricCard label="KV Cache 显存" value={kvGB} unit="GB" accent="emerald" tip="2 × 层数 × KV头数 × head_dim × 序列长度 × 批次 × 精度字节" />
            <MetricCard label="模型权重" value={modelWeight} unit="GB" accent="cyan" tip="估算值，含 Attention + FFN" />
            <MetricCard label="总显存占用" value={totalGB} unit="GB" accent={totalGB > params.gpuMemory ? 'rose' : 'violet'} tip="KV Cache + 模型权重" />
            <MetricCard label="Head 维度" value={calcResult.headDim} unit="" accent="slate" tip="hidden_size / num_heads" />
          </div>
        </GlowCard>
        {alerts.length > 0 && (
          <div className="space-y-2">
            {alerts.map((a, i) => <SmartAlert key={i} message={a.msg} type={a.type} />)}
          </div>
        )}
        <GlowCard accent="slate" className="p-3">
          <h4 className="text-xs font-semibold text-space-300 mb-2">公式说明</h4>
          <div className="text-[11px] text-space-500 space-y-1 font-mono">
            <div>KV = 2 × L × H_kv × d_h × S × B × bytes</div>
            <div className="text-space-600">L=层数 H_kv=KV头数 d_h=head_dim S=序列长度 B=批次</div>
          </div>
        </GlowCard>
      </div>
    </div>
  );
}