import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useCallback, useRef, useMemo, forwardRef, useImperativeHandle } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play, RotateCcw, Zap, Database, Gauge,
  ChevronRight, Sparkles, AlertCircle, CheckCircle2, ArrowRight,
  Type, Hash, BookOpen, Pause, SkipForward, Layers2
} from 'lucide-react';
import GlowCard from '../components/GlowCard.jsx';
import Badge from '../components/Badge.jsx';
import ProductHeader from '../components/ProductHeader.jsx';
import knowledgeData from '../data/knowledge.json';

const KNOWLEDGE_CASE_IDS = ['kv-cache', 'attention-机制', 'pagedattention', 'moe', 'speculative-decoding', 'flashattention'];
const KNOWLEDGE_ENTRIES = knowledgeData.entries || [];

function splitForAnimation(text) {
  return text
    .split(/([，。；：、（）()\s]|Attention|Token|KV Cache|PagedAttention|FlashAttention|Speculative Decoding|MoE)/)
    .filter(Boolean)
    .filter((part) => !/^\s+$/.test(part));
}

const CASES = KNOWLEDGE_CASE_IDS.map((id) => {
  const entry = KNOWLEDGE_ENTRIES.find((item) => item.id === id);
  if (!entry) return null;
  return {
    id,
    label: entry.title,
    question: `什么是${entry.title}？`,
    answer: entry.definition,
    reply: splitForAnimation(entry.definition),
  };
}).filter(Boolean);
const STAGES = [
  { key: 'idle', label: '输入', desc: '选择问题与Batch模式', panoramaId: null },
  { key: 'tokenizing', label: '分词', desc: '将句子拆分为Token', panoramaId: 'token' },
  { key: 'prefill', label: 'Prefill', desc: '计算每个Token的Key和Value', panoramaId: 'prefill_decode' },
  { key: 'branch', label: 'KV Cache', desc: '选择是否启用缓存', panoramaId: 'kv' },
  { key: 'decoding', label: 'Decode', desc: '逐Token生成答案', panoramaId: 'prefill_decode' },
  { key: 'finished', label: '完成', desc: '推理完成', panoramaId: null },
];

const BATCH_CONFIG = [
  { key: 1, label: '单请求', desc: '1个请求独立计算' },
  { key: 2, label: 'Batch-2', desc: '2个请求并行计算' },
  { key: 4, label: 'Batch-4', desc: '4个请求并行计算' },
];

function getDemoTokenId(token, index) {
  const hash = Array.from(token).reduce((value, char) => ((value * 131) + char.codePointAt(0)) >>> 0, 2166136261);
  return 1000 + ((hash + index * 97) % 9000);
}

function tokenizeForDemo(text) {
  const segments = text.match(/[A-Za-z]+(?:[-'][A-Za-z]+)*|\d+(?:\.\d+)?|[\u3400-\u9fff]|[^\s]/g);
  return segments?.length ? segments : [text];
}

function calcStructuralCounts(inputLen, outputLen, useCache, batchSize) {
  const decodeHistoryWork = Array.from({ length: outputLen }, (_, index) => inputLen + index + 1)
    .reduce((total, length) => total + length, 0);
  const decodeWork = useCache ? outputLen : decodeHistoryWork;
  const cachedVectors = useCache ? (inputLen + outputLen) * batchSize * 2 : 0;
  return {
    prefillTokens: inputLen * batchSize,
    decodeSteps: outputLen * batchSize,
    relativeDecodeWork: decodeWork * batchSize,
    cachedVectors,
  };
}
function StageNode({ index, label, active, done, panoramaId, navigate }) {
  const canClick = !!panoramaId;
  return (
    <div className="flex flex-1 flex-col items-center gap-1.5">
      <button onClick={() => canClick && navigate('/panorama', { state: { moduleId: panoramaId } })} disabled={!canClick}
        className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs font-bold transition-all duration-300 ${active ? 'border-cyan-400/60 bg-cyan-500/20 text-cyan-300 shadow-[0_0_16px_rgba(34,211,238,0.25)]' : done ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' : 'border-space-700 bg-space-800/60 text-space-500'} ${canClick ? 'cursor-pointer hover:scale-110' : 'cursor-default'}`}
        title={canClick ? `点击查看全景图：${label}` : label}>
        {done ? <CheckCircle2 size={14} /> : index + 1}
      </button>
      <button onClick={() => canClick && navigate('/panorama', { state: { moduleId: panoramaId } })} disabled={!canClick}
        className={`text-xs font-medium transition-colors ${active ? 'text-cyan-300' : done ? 'text-emerald-300/80' : 'text-space-600'} ${canClick ? 'cursor-pointer hover:text-cyan-300' : 'cursor-default'}`}>
        {label}
      </button>
    </div>
  );
}

function TokenizingView({ tokens }) {
  const [visibleCount, setVisibleCount] = useState(0);
  useEffect(() => { if (visibleCount < tokens.length) { const t = setTimeout(() => setVisibleCount(c=>c+1), 450); return () => clearTimeout(t); } }, [visibleCount, tokens.length]);
  useEffect(() => { setVisibleCount(0); }, [tokens]);
  return (
    <div className="flex h-full flex-col items-center justify-center gap-5 px-2">
      <div className="text-center"><Badge variant="cyan">分词中</Badge><p className="mt-2 text-xs text-space-500">按字符与术语拆分输入文本，依次展示 Token 与 TokenID 的形成过程</p></div>
      <div className="w-full max-w-lg space-y-2">
        {tokens.map((tok,i) => {
          const isVisible = i < visibleCount;
          return (
            <motion.div key={i} initial={{ opacity: 0, x: -20 }} animate={isVisible ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }} transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 rounded-md border border-space-600 bg-space-800/60 px-3 py-1.5 min-w-[80px]"><Type size={11} className="text-space-500" /><span className="text-sm text-space-300">{tok}</span></div>
              <ArrowRight size={14} className="text-space-600" />
              <div className="flex items-center gap-1.5 rounded-md border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5"><span className="text-xs text-cyan-400 font-mono">{tok.length > 1 ? tok : `「${tok}」`}</span></div>
              <ArrowRight size={14} className="text-space-600" />
              <motion.div initial={{ scale: 0.8 }} animate={isVisible ? { scale: 1 } : { scale: 0.8 }} transition={{ delay: 0.1 }}
                className="flex items-center gap-1.5 rounded-md border border-violet-500/30 bg-violet-500/10 px-3 py-1.5">
                <Hash size={11} className="text-violet-400" /><span className="text-xs text-violet-300 font-mono">{getDemoTokenId(tok, i)}</span>
              </motion.div>
            </motion.div>
          );
        })}
      </div>
      {visibleCount >= tokens.length && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs text-emerald-300">
          当前输入被拆分为 {tokens.length} 个 Token；不同模型的 Tokenizer 可能得到不同结果。
        </motion.div>
      )}
    </div>
  );
}

const PREfill_SHOTS = [
  { key: 'embedding', label: 'Embedding', desc: 'Token 嵌入与示意位置信息组合为输入向量' },
  { key: 'qkv',     label: 'Q/K/V 投影',  desc: '矩阵乘法：X·Wq=Q，X·Wk=K，X·Wv=V' },
  { key: 'attention', label: '因果自注意力',  desc: 'softmax(mask(Q·Kᵀ/√d))·V' },
  { key: 'ffn',     label: '残差+FFN', desc: '归一化、前馈变换与残差连接；具体结构取决于模型' },
];

function generateRealData(tokens) {
  const d = 4;
  const n = Math.min(tokens.length, 4);
  const used = tokens.slice(0, n);
  
  // Embedding：由确定性规则生成的小型教学向量
  const embed = used.map((t, i) => ({
    token: t,
    vec: Array.from({length: d}, (_, j) => {
      const h = (t.charCodeAt(0) * 31 + j * 17 + i * 13) % 100;
      return Math.round(((h / 100) * 2 - 1) * 10) / 10;
    })
  }));
  
  // 位置编码
  const pe = used.map((_, pos) => 
    Array.from({length: d}, (_, j) => {
      const angle = pos / Math.pow(10000, j / d);
      return Math.round((j % 2 === 0 ? Math.sin(angle) : Math.cos(angle)) * 10) / 10;
    })
  );
  
  const input = embed.map((e, i) => ({
    token: e.token,
    embed: e.vec,
    pe: pe[i],
    final: e.vec.map((v, j) => Math.round((v + pe[i][j]) * 10) / 10)
  }));
  
  // 权重
  const mkW = (s1, s2) => Array.from({length: d}, (_, i) => 
    Array.from({length: d}, (_, j) => Math.round((((i * s1 + j * s2) % 10) / 5 - 1) * 10) / 10));
  
  const Wq = mkW(7, 3), Wk = mkW(5, 11), Wv = mkW(3, 7);
  const matMul = (v, W) => W[0].map((_, col) => Math.round(v.reduce((sum, value, row) => sum + value * W[row][col], 0) * 10) / 10);
  const Q = input.map(x => matMul(x.final, Wq));
  const K = input.map(x => matMul(x.final, Wk));
  const V = input.map(x => matMul(x.final, Wv));
  
  // Attention 分数：Decoder-only 自回归模型需要屏蔽未来位置。
  const scores = Q.map((q, i) =>
    K.map((k, j) => {
      if (j > i) return Number.NEGATIVE_INFINITY;
      const dot = q.reduce((s, qv, idx) => s + qv * k[idx], 0);
      return Math.round((dot / Math.sqrt(d)) * 100) / 100;
    })
  );

  const softmax = (row) => {
    const finiteValues = row.filter(Number.isFinite);
    const max = Math.max(...finiteValues);
    const exps = row.map((value) => Number.isFinite(value) ? Math.exp(value - max) : 0);
    const sum = exps.reduce((a, b) => a + b, 0);
    return exps.map((value) => Math.round((value / sum) * 100) / 100);
  };
  const attn = scores.map(softmax);
  const KT = Array.from({ length: d }, (_, row) => K.map((vector) => vector[row]));

  return { input, Wq, Wk, Wv, Q, K, KT, V, scores, attn };
}

function usePlaybackSteps(length, ms, playing) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (!playing || step >= length) return;
    const t = setTimeout(() => setStep((s) => s + 1), ms);
    return () => clearTimeout(t);
  }, [playing, step, length, ms]);
  return step;
}

// ========== 子镜头1: Embedding 教学矩阵 ==========
function EmbeddingShot({ tokens, playing }) {
  const data = useMemo(() => generateRealData(tokens), [tokens]);
  const step = usePlaybackSteps(data.input.length * 3 + 1, 380, playing);
  
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6">
      <div className="flex flex-wrap items-start justify-center gap-4">
        {data.input.map((item, i) => {
          const s1 = step >= i * 3 + 1;
          const s2 = step >= i * 3 + 2;
          const s3 = step >= i * 3 + 3;
          return (
            <div key={i} className="flex flex-col items-center gap-1.5">
              <div className={`rounded-lg border px-4 py-2 text-base font-bold transition-all duration-500 ${s1 ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300' : 'border-space-700 bg-space-800/30 text-space-600'}`}>
                {item.token}
              </div>
              <div className={`flex gap-1 transition-all duration-500 ${s1 ? 'opacity-100' : 'opacity-30'}`}>
                {item.embed.map((v, j) => (
                  <div key={j} className="flex h-8 w-8 items-center justify-center rounded border border-cyan-500/30 bg-cyan-500/10 text-[10px] font-mono text-cyan-300">{v.toFixed(1)}</div>
                ))}
              </div>
              <span className={`text-[10px] transition-all ${s1 ? 'text-cyan-400' : 'text-space-700'}`}>Embedding</span>
              <span className={`text-sm font-bold transition-all ${s2 ? 'text-space-400' : 'text-space-800'}`}>+</span>
              <div className={`flex gap-1 transition-all duration-500 ${s2 ? 'opacity-100' : 'opacity-30'}`}>
                {item.pe.map((v, j) => (
                  <div key={j} className="flex h-8 w-8 items-center justify-center rounded border border-violet-500/30 bg-violet-500/10 text-[10px] font-mono text-violet-300">{v.toFixed(1)}</div>
                ))}
              </div>
              <span className={`text-[10px] transition-all ${s2 ? 'text-violet-400' : 'text-space-700'}`}>示意位置信息</span>
              <span className={`text-sm font-bold transition-all ${s3 ? 'text-space-400' : 'text-space-800'}`}>=</span>
              <div className={`flex gap-1 transition-all duration-500 ${s3 ? 'opacity-100 scale-100' : 'opacity-30 scale-95'}`}>
                {item.final.map((v, j) => (
                  <div key={j} className="flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-500/40 bg-emerald-500/15 text-xs font-bold font-mono text-emerald-300 shadow-[0_0_8px_rgba(52,211,153,0.15)]">{v.toFixed(1)}</div>
                ))}
              </div>
              <span className={`text-[10px] transition-all ${s3 ? 'text-emerald-400' : 'text-space-700'}`}>输入向量</span>
            </div>
          );
        })}
      </div>
      <p className="text-center text-[11px] leading-relaxed text-space-500">此处使用小型确定性向量展示数据流；真实模型可能使用 RoPE 等位置机制。</p>
      {step >= data.input.length * 3 && (
        <div className="text-sm font-semibold text-emerald-400">✓ 全部 Token 完成嵌入</div>
      )}
    </div>
  );
}

// ========== 子镜头2: Q/K/V 固定演示权重 ==========
function QKVShot({ tokens, playing }) {
  const data = useMemo(() => generateRealData(tokens), [tokens]);
  const n = data.input.length;
  const d = 4;
  const step = usePlaybackSteps(n * 3 + 2, 350, playing);
  
  const showQ = (idx) => step >= idx * 3 + 1;
  const showK = (idx) => step >= idx * 3 + 2;
  const showV = (idx) => step >= idx * 3 + 3;
  const allDone = step >= n * 3;
  
  return (
    <div className="flex h-full flex-col items-center justify-center gap-5">
      <div className="flex items-end gap-6">
        {/* 输入 X */}
        <div className="flex flex-col items-center gap-2">
          <span className="text-xs font-semibold text-space-500">输入 X (4维)</span>
          <div className="flex flex-col gap-1">
            {data.input.map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-6 text-[10px] text-space-500">{item.token}</span>
                <div className="flex gap-1">
                  {item.final.map((v, j) => (
                    <div key={j} className={`flex h-7 w-8 items-center justify-center rounded border text-[10px] font-mono transition-all duration-500 ${step >= 1 ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300' : 'border-space-700 bg-space-800/30 text-space-600'}`}>{v.toFixed(1)}</div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* 权重 W */}
        <div className="flex flex-col items-center gap-2">
          <span className="text-xs font-semibold text-space-500">Wq / Wk / Wv</span>
          <div className="grid gap-0.5" style={{gridTemplateColumns:'repeat(4, 32px)'}}>
            {data.Wq.flat().map((v, i) => (
              <div key={i} className="flex h-7 items-center justify-center rounded border border-violet-500/30 bg-violet-500/10 text-[9px] font-mono text-violet-300">{v.toFixed(1)}</div>
            ))}
          </div>
          <span className="text-[9px] text-space-600">4×4 权重</span>
        </div>
        
        <span className="text-xl text-space-500 mb-6">=</span>
        
        {/* Q K V 输出 */}
        <div className="flex flex-col items-center gap-2">
          <span className="text-xs font-semibold text-space-500">Q / K / V</span>
          <div className="flex flex-col gap-2">
            {['Q', 'K', 'V'].map((label, li) => {
              const mat = label === 'Q' ? data.Q : label === 'K' ? data.K : data.V;
              return (
                <div key={label} className="flex items-center gap-2">
                  <span className={`w-4 text-sm font-bold ${allDone ? (label === 'Q' ? 'text-cyan-300' : label === 'K' ? 'text-emerald-300' : 'text-amber-300') : 'text-space-600'}`}>{label}</span>
                  <div className="flex flex-col gap-0.5">
                    {mat.map((row, ri) => (
                      <div key={ri} className="flex gap-0.5">
                        {row.map((v, ci) => (
                          <div key={ci} className={`flex h-6 w-7 items-center justify-center rounded border text-[9px] font-mono transition-all duration-500 ${
                            (li === 0 && showQ(ri)) || (li === 1 && showK(ri)) || (li === 2 && showV(ri))
                              ? (label === 'Q' ? 'border-cyan-500/40 bg-cyan-500/15 text-cyan-300' : label === 'K' ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300' : 'border-amber-500/40 bg-amber-500/15 text-amber-300')
                              : 'border-space-700 bg-space-800/30 text-space-700'
                          }`}>{v.toFixed(1)}</div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="text-sm text-space-400">
        <span className="font-mono text-cyan-300">X·Wq = Q</span>
        <span className="mx-2 text-space-600">|</span>
        <span className="font-mono text-emerald-300">X·Wk = K</span>
        <span className="mx-2 text-space-600">|</span>
        <span className="font-mono text-amber-300">X·Wv = V</span>
      </div>
      {allDone && <div className="text-sm font-semibold text-emerald-400">✓ Q/K/V 投影完成</div>}
    </div>
  );
}

// ========== 子镜头3: Attention 演示矩阵结果 ==========
function AttentionShot({ tokens, playing }) {
  const data = useMemo(() => generateRealData(tokens), [tokens]);
  const step = usePlaybackSteps(data.attn.length * data.attn.length + data.attn.length + 1, 230, playing);
  const n = data.attn.length;
  const finiteScores = data.scores.flat().filter(Number.isFinite);
  const minScore = Math.min(...finiteScores);
  const maxScore = Math.max(...finiteScores);

  const showScore = (i, j) => step >= i * n + j + 1;
  const showWeight = (i) => step >= n * n + i + 1;
  const allDone = step >= n * n + n;
  const scoreTone = (score) => {
    if (!Number.isFinite(score)) return 'border-space-700 bg-space-950/70 text-space-600';
    const ratio = maxScore === minScore ? 1 : (score - minScore) / (maxScore - minScore);
    if (ratio >= 0.66) return 'border-violet-400/60 bg-violet-500/20 text-violet-200';
    if (ratio >= 0.33) return 'border-cyan-500/45 bg-cyan-500/12 text-cyan-200';
    return 'border-space-600/50 bg-space-800/60 text-space-400';
  };
  const weightTone = (weight) => {
    if (weight >= 0.6) return 'border-emerald-400/60 bg-emerald-500/20 text-emerald-300 shadow-[0_0_12px_rgba(52,211,153,0.2)]';
    if (weight >= 0.25) return 'border-cyan-400/50 bg-cyan-500/15 text-cyan-200';
    if (weight > 0) return 'border-space-500/40 bg-space-800/60 text-space-300';
    return 'border-space-700 bg-space-950/70 text-space-600';
  };

  return (
    <div className="flex h-full flex-col items-center justify-center gap-5">
      <div className="flex flex-wrap items-center justify-center gap-4">
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs font-semibold text-cyan-300">Q</span>
          <div className="flex flex-col gap-0.5">
            {data.Q.map((row, i) => (
              <div key={i} className="flex gap-0.5">
                {row.map((value, j) => <div key={j} className="flex h-7 w-7 items-center justify-center rounded border border-cyan-500/30 bg-cyan-500/10 text-[9px] font-mono text-cyan-300">{value.toFixed(1)}</div>)}
              </div>
            ))}
          </div>
        </div>

        <span className="text-lg text-space-500">×</span>

        <div className="flex flex-col items-center gap-1">
          <span className="text-xs font-semibold text-emerald-300">Kᵀ</span>
          <div className="flex flex-col gap-0.5">
            {data.KT.map((row, i) => (
              <div key={i} className="flex gap-0.5">
                {row.map((value, j) => <div key={j} className="flex h-7 w-7 items-center justify-center rounded border border-emerald-500/30 bg-emerald-500/10 text-[9px] font-mono text-emerald-300">{value.toFixed(1)}</div>)}
              </div>
            ))}
          </div>
        </div>

        <span className="text-lg text-space-500">=</span>

        <div className="flex flex-col items-center gap-1">
          <span className="text-xs font-semibold text-space-400">Score = mask(Q·Kᵀ/√4)</span>
          <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${n}, 44px)` }}>
            {data.scores.flat().map((score, idx) => {
              const i = Math.floor(idx / n);
              const j = idx % n;
              const visible = showScore(i, j);
              const masked = !Number.isFinite(score);
              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0.2, scale: 0.85 }}
                  animate={visible ? { opacity: 1, scale: 1 } : {}}
                  className={`flex h-10 items-center justify-center rounded-lg border text-xs font-bold font-mono transition-all ${scoreTone(score)} ${visible ? 'opacity-100 scale-100' : 'opacity-25 scale-90'}`}
                  title={masked ? '因果遮罩：当前位置不能读取未来 Token' : `Attention score: ${score.toFixed(2)}`}
                >
                  {visible ? (masked ? 'MASK' : score.toFixed(2)) : '?'}
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      <div className={`flex flex-col items-center gap-1 transition-all duration-500 ${step >= n * n ? 'opacity-100' : 'opacity-30'}`}>
        <span className="text-xs font-semibold text-space-400">Softmax → Attention Weights</span>
        <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${n}, 44px)` }}>
          {data.attn.flat().map((weight, idx) => {
            const i = Math.floor(idx / n);
            const visible = showWeight(i);
            return (
              <div key={idx} className={`flex h-10 items-center justify-center rounded-lg border text-sm font-bold font-mono transition-all duration-500 ${visible ? weightTone(weight) : 'border-space-700 bg-space-800/30 text-space-700'}`}>
                {visible ? weight.toFixed(2) : '?'}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
        <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-emerald-300">权重 ≥ 0.60</span>
        <span className="rounded-full border border-cyan-500/25 bg-cyan-500/10 px-3 py-1 text-cyan-300">权重 0.25–0.59</span>
        <span className="rounded-full border border-space-600 bg-space-800/60 px-3 py-1 text-space-400">低权重</span>
        <span className="rounded-full border border-space-700 bg-space-950/70 px-3 py-1 text-space-500">MASK：禁止读取未来 Token</span>
      </div>
      {allDone && <div className="text-center text-sm font-semibold text-emerald-300">✓ 因果 Attention 权重计算完成，每行和 ≈ 1</div>}
    </div>
  );
}

// ========== 子镜头4: 残差+FFN ==========
function ResidualFFNShot({ tokens, playing }) {
  const data = useMemo(() => generateRealData(tokens), [tokens]);
  const n = data.input.length;
  const steps = ['残差路径', '归一化', '前馈升维', '非线性/门控', '投影回 d', '残差合并'];
  const step = usePlaybackSteps(steps.length + 1, 700, playing);
  const showStep = (i) => step >= i + 1;
  const allDone = step >= steps.length;
  
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6">
      {/* Attention 输出 */}
      <div className={`flex items-center gap-3 transition-all duration-500 ${showStep(0) ? 'opacity-100' : 'opacity-30'}`}>
        <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-2">
          <span className="text-xs font-semibold text-cyan-300">Attention 输出</span>
          <div className="mt-1 flex gap-1">
            {data.attn[0].map((_, idx) => (
              <div key={idx} className="flex h-7 w-8 items-center justify-center rounded border border-cyan-500/20 bg-cyan-500/5 text-[9px] font-mono text-cyan-400">{Math.round((data.attn[0][idx] * data.V[idx][0]) * 10) / 10}</div>
            ))}
          </div>
        </div>
        <span className="text-sm text-space-500">+</span>
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2">
          <span className="text-xs font-semibold text-emerald-300">原始输入 (残差)</span>
          <div className="mt-1 flex gap-1">
            {data.input[0].final.map((v, idx) => (
              <div key={idx} className="flex h-7 w-8 items-center justify-center rounded border border-emerald-500/20 bg-emerald-500/5 text-[9px] font-mono text-emerald-400">{v.toFixed(1)}</div>
            ))}
          </div>
        </div>
      </div>
      
      {/* 处理流程 */}
      <div className="flex items-center gap-2">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <motion.div initial={{opacity:0.3, scale:0.92}} animate={showStep(i) ? {opacity:1, scale:1} : {}} transition={{type:'spring', stiffness:200, damping:20}}
              className={`flex flex-col items-center justify-center rounded-xl border px-5 py-3 text-center min-w-[84px] text-sm font-bold transition-all ${
                showStep(i)
                  ? (i === 0 ? 'border-amber-400/50 bg-amber-500/12 text-amber-300' :
                     i === 1 ? 'border-violet-400/50 bg-violet-500/12 text-violet-300' :
                     i === 2 ? 'border-cyan-400/50 bg-cyan-500/12 text-cyan-300' :
                     i === 3 ? 'border-rose-400/50 bg-rose-500/12 text-rose-300' :
                     i === 4 ? 'border-emerald-400/50 bg-emerald-500/12 text-emerald-300' :
                               'border-amber-400/50 bg-amber-500/12 text-amber-300')
                  : 'border-space-700 bg-space-800/40 text-space-600'}`}>
              {s}
            </motion.div>
            {i < steps.length - 1 && <span className="text-space-600 text-lg">→</span>}
          </div>
        ))}
      </div>
      
      <p className="max-w-3xl text-center text-[11px] leading-relaxed text-space-500">这是简化 Transformer 层示意；实际模型可能采用 RMSNorm、SwiGLU，以及不同的 Pre-Norm 或 Post-Norm 顺序。</p>
      <div className={`flex items-center gap-3 text-sm transition-all duration-500 ${allDone ? 'opacity-100' : 'opacity-30'}`}>
        <span className="rounded-md border border-space-700 bg-space-800/50 px-3 py-1.5">Attention 输出 + 原始输入</span>
        <span className="text-space-600">→</span>
        <span className="rounded-md border border-emerald-400/40 bg-emerald-500/10 px-3 py-1.5 text-emerald-300 font-semibold">本层输出（进入下一层）</span>
      </div>
      {allDone && <div className="text-sm font-semibold text-emerald-300">✓ 本层 K、V 已写入 KV Cache；层输出继续传递到下一层</div>}
    </div>
  );
}

const PrefillView = forwardRef(function PrefillView({ tokens, isPlaying, onComplete }, ref) {
  const [shot, setShot] = useState(0);
  useEffect(() => { setShot(0); }, [tokens]);

  useEffect(() => {
    if (!isPlaying) return;
    const t = setTimeout(() => {
      if (shot < PREfill_SHOTS.length - 1) setShot((s) => s + 1);
      else onComplete();
    }, 5000);
    return () => clearTimeout(t);
  }, [shot, isPlaying, onComplete]);

  useImperativeHandle(ref, () => ({
    next() {
      if (shot < PREfill_SHOTS.length - 1) { setShot((s) => s + 1); return true; }
      return false;
    },
  }), [shot]);

  const ShotComp = [EmbeddingShot, QKVShot, AttentionShot, ResidualFFNShot][shot];
  const active = PREfill_SHOTS[shot];

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="text-center">
        <Badge variant="violet">Prefill 阶段 · 可复算教学矩阵</Badge>
        <p className="mt-2 text-sm text-space-400">并行处理输入序列，计算各层的 Q/K/V、Attention 与 FFN；各层 K/V 加入缓存，层输出继续向后传递。</p>
      </div>

      <div className="flex items-center justify-center gap-2">
        {PREfill_SHOTS.map((s, i) => (
          <button key={s.key} onClick={() => setShot(i)} title={s.label}
            className={`h-2 w-7 rounded-full transition-all ${i === shot ? 'bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.5)]' : i < shot ? 'bg-emerald-500/60' : 'bg-space-700'}`} />
        ))}
        <span className="ml-2 text-xs text-space-500">每镜头 5 秒 · 总 20 秒</span>
      </div>

      <div className="grid flex-1 gap-4 lg:grid-cols-[100px_1fr]">
        <div className="flex flex-row gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
          {PREfill_SHOTS.map((s, i) => (
            <button key={s.key} onClick={() => setShot(i)}
              className={`flex min-w-max items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition-all ${i === shot ? 'border-violet-500/40 bg-violet-500/10' : 'border-space-700/50 bg-space-800/40 hover:border-space-600'}`}>
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${i === shot ? 'bg-violet-500/25 text-violet-300' : i < shot ? 'bg-emerald-500/20 text-emerald-300' : 'bg-space-800 text-space-600'}`}>
                {i < shot ? <CheckCircle2 size={13} /> : i + 1}
              </span>
              <span className={`text-sm font-medium ${i === shot ? 'text-violet-300' : 'text-space-400'}`}>{s.label}</span>
            </button>
          ))}
        </div>

        <div className="relative min-h-[360px] overflow-hidden rounded-2xl border border-space-700/50 bg-space-950/40 p-5">
          <AnimatePresence mode="wait">
            <motion.div key={active.key} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.3 }} className="h-full">
              <ShotComp tokens={tokens} playing={isPlaying} />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <p className="text-center text-xs text-space-500">{active.desc}</p>
    </div>
  );
});
function DecodeView({ tokens, outputTokens, revealedCount, useCache, stage }) {
  return (
    <div className="flex h-full flex-col justify-between gap-4">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Badge variant={useCache ? 'emerald' : 'rose'}>{useCache ? 'KV Cache 已启用' : 'KV Cache 已禁用'}</Badge>
          {stage === 'decoding' && <span className="flex items-center gap-1 text-xs text-cyan-400"><span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-400" />生成中...</span>}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {tokens.map((tok,i) => <span key={i} className="rounded border border-space-700/60 bg-space-800/60 px-1.5 py-0.5 text-xs text-space-500">{tok}</span>)}
          {useCache && <span className="flex items-center gap-1 rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-400"><Database size={10} /> KV 已缓存</span>}
        </div>
      </div>
      <div className="flex flex-1 items-center gap-4">
        <div className="flex flex-col items-center gap-1">
          <motion.div animate={stage === 'decoding' ? { scale: [1,1.05,1] } : {}} transition={{ duration: 0.6, repeat: stage === 'decoding' ? Infinity : 0 }}
            className={`flex h-12 w-12 items-center justify-center rounded-xl border shadow-lg ${useCache ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 shadow-emerald-500/10' : 'border-rose-500/30 bg-rose-500/10 text-rose-400 shadow-rose-500/10'}`}>
            <Sparkles size={22} />
          </motion.div>
          <span className="text-[10px] text-space-600">LLM</span>
        </div>
        <div className="flex-1">
          <div className="flex min-h-[80px] flex-wrap items-center gap-1.5 rounded-lg border border-space-700/50 bg-space-950/40 p-3">
            {outputTokens.slice(0, revealedCount).map((tok,i) => (
              <motion.span key={i} initial={{ opacity: 0, x: -8, scale: 0.9 }} animate={{ opacity: 1, x: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                className={`rounded-md px-2 py-1 text-sm font-medium ${useCache ? 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-300' : 'border border-rose-500/20 bg-rose-500/10 text-rose-300'}`}>{tok}</motion.span>
            ))}
            {stage === 'decoding' && <motion.span animate={{ opacity: [0.4,1,0.4] }} transition={{ duration: 0.8, repeat: Infinity }} className="inline-block h-5 w-0.5 rounded bg-cyan-400" />}
          </div>
        </div>
      </div>
      <div className="rounded-lg border border-space-700/40 bg-space-800/40 p-3 text-xs text-space-400">
        {useCache ? (
          <div className="flex items-start gap-2"><CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-400" /><span>每个新 Token 只需计算自身的 Attention，历史 KV 直接从缓存读取。</span></div>
        ) : (
          <div className="flex items-start gap-2"><AlertCircle size={14} className="mt-0.5 shrink-0 text-rose-400" /><span>每个新 Token 都需重新计算所有历史 Token 的 Attention，计算量逐步增大。</span></div>
        )}
      </div>
    </div>
  );
}

export default function Pipeline() {
  const navigate = useNavigate();
  const [stage, setStage] = useState('idle');
  const [selectedCase, setSelectedCase] = useState(null);
  const [batchSize, setBatchSize] = useState(1);
  const [tokens, setTokens] = useState([]);
  const [outputTokens, setOutputTokens] = useState([]);
  const [useCache, setUseCache] = useState(null);
  const [revealedCount, setRevealedCount] = useState(0);
  const [stats, setStats] = useState(null);
  const [altStats, setAltStats] = useState(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const prefillRef = useRef(null);
  const stageIndex = STAGES.findIndex((s) => s.key === stage);

  const handlePrefillComplete = useCallback(() => setStage('branch'), []);

  const handleSelectCase = useCallback((caseItem) => { setSelectedCase(caseItem); }, []);

  const handleStart = useCallback(() => {
    if (!selectedCase) return;
    setTokens(tokenizeForDemo(selectedCase.question));
    setOutputTokens([]);
    setRevealedCount(0);
    setUseCache(null);
    setStats(null);
    setAltStats(null);
    setIsPlaying(true);
    setStage('tokenizing');
  }, [selectedCase]);

  useEffect(() => {
    if (stage !== 'tokenizing' || !isPlaying) return;
    const t = setTimeout(() => setStage('prefill'), tokens.length * 500 + 800);
    return () => clearTimeout(t);
  }, [stage, tokens, isPlaying]);

  const handleBranch = useCallback((cache) => {
    setUseCache(cache);
    const reply = [...selectedCase.reply];
    setOutputTokens(reply);
    setRevealedCount(0);
    setStage('decoding');
  }, [selectedCase, batchSize]);

  useEffect(() => {
    if (stage !== 'decoding' || !isPlaying) return;
    if (revealedCount >= outputTokens.length) {
      const t = setTimeout(() => setStage('finished'), 500);
      return () => clearTimeout(t);
    }
    // 动画节奏固定，仅用于观察生成步骤，不表示两种分支的真实性能比例。
    const delay = 320;
    const t = setTimeout(() => setRevealedCount((c) => c + 1), delay);
    return () => clearTimeout(t);
  }, [stage, revealedCount, outputTokens.length, useCache, isPlaying]);

  useEffect(() => {
    if (stage !== 'finished') return;
    const s = calcStructuralCounts(tokens.length, outputTokens.length, useCache, batchSize);
    const alt = calcStructuralCounts(tokens.length, outputTokens.length, !useCache, batchSize);
    setStats(s);
    setAltStats(alt);
  }, [stage, tokens.length, outputTokens.length, useCache, batchSize]);

  const handleReset = useCallback(() => {
    setStage('idle'); setSelectedCase(null); setTokens([]); setOutputTokens([]); setUseCache(null);
    setRevealedCount(0); setStats(null); setAltStats(null); setIsPlaying(true);
  }, []);

  const handleNext = useCallback(() => {
    if (stage === 'tokenizing') setStage('prefill');
    else if (stage === 'prefill') {
      const advanced = prefillRef.current?.next();
      if (advanced === false) setStage('branch');
    }
    else if (stage === 'decoding') {
      if (revealedCount >= outputTokens.length) setStage('finished');
      else setRevealedCount((c) => c + 1);
    }
  }, [stage, revealedCount, outputTokens.length]);

  const isRunning = stage !== 'idle' && stage !== 'finished';

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <ProductHeader
        title="推理流水线模拟器"
        subtitle="从文本分词开始，逐步观察 Prefill、KV Cache 分支与 Decode，理解一次大模型推理请求的完整执行过程。"
        accent="cyan"
        badges={[{ label: '6 个精选案例' }, { label: '可暂停与逐步推进' }]}
      />
      {/* Stage Bar */}
      <div className="panel-shell rounded-xl border border-space-700/50 bg-space-900/50 p-4 backdrop-blur-md">
        <div className="overflow-x-auto pb-1">
          <div className="flex min-w-[620px] items-center justify-between gap-2">
            {STAGES.map((s,i) => <StageNode key={s.key} index={i} label={s.label} active={i===stageIndex} done={i<stageIndex} panoramaId={s.panoramaId} navigate={navigate} />)}
          </div>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-space-800">
          <motion.div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-violet-500" animate={{ width: `${(stageIndex / (STAGES.length - 1)) * 100}%` }} transition={{ type: 'spring', stiffness: 120, damping: 18 }} />
        </div>
        <p className="mt-2 text-center text-xs text-space-500">{STAGES[stageIndex]?.desc}</p>
        <div className="mt-2 flex items-center justify-center gap-1.5 text-[11px] text-cyan-400/80">
          <span className="inline-block h-1 w-1 rounded-full bg-cyan-400/60 animate-pulse" />
          提示：点击上方「分词」「Prefill」「KV Cache」「Decode」节点可跳转全景图查看对应模块
        </div>

        {/* 全局播放控制 */}
        {isRunning && (
          <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="mt-3 flex items-center justify-center gap-2">
            <button onClick={() => setIsPlaying(!isPlaying)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition-all ${isPlaying ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-[0_0_16px_rgba(251,191,36,0.2)]' : 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 shadow-[0_0_16px_rgba(34,211,238,0.2)]'}`}>
              {isPlaying ? <><Pause size={16} /> 暂停</> : <><Play size={16} /> 继续</>}
            </button>
            <button onClick={handleNext}
              className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold bg-violet-500/15 text-violet-300 border border-violet-500/40 shadow-[0_0_16px_rgba(167,139,250,0.2)] transition-all hover:bg-violet-500/25">
              <SkipForward size={16} /> 下一步
            </button>
            <span className="text-xs text-space-500 ml-1">{isPlaying ? '自动推进中' : '已暂停'}</span>
          </motion.div>
        )}
      </div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <GlowCard accent="cyan" className="panel-shell min-h-[460px] p-5">
          <AnimatePresence mode="wait">
            {stage === 'idle' && (
              <motion.div key="idle" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-5">
                <div><h3 className="text-sm font-semibold text-space-200 mb-1">选择问题</h3><p className="text-xs text-space-500">选择一个技术问题，观察它从输入到生成答案的完整过程</p></div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {CASES.map((c) => {
                    const isSelected = selectedCase?.id === c.id;
                    return (
                      <GlowCard key={c.id} accent={isSelected ? 'cyan' : 'slate'} interactive onClick={() => handleSelectCase(c)} className={`module-card p-3.5 ${isSelected ? 'ring-1 ring-cyan-400/40' : ''}`}>
                        <div className="flex items-center gap-2 mb-2"><BookOpen size={14} className={isSelected ? 'text-cyan-400' : 'text-space-500'} /><span className={`text-sm font-semibold ${isSelected ? 'text-cyan-300' : 'text-space-300'}`}>{c.label}</span></div>
                        <p className="line-clamp-2 text-xs leading-relaxed text-space-500">{c.question}</p>
                      </GlowCard>
                    );
                  })}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-space-200 mb-2">Batch 模式</h3>
                  <div className="flex gap-2">
                    {BATCH_CONFIG.map((b) => {
                      const isActive = batchSize === b.key;
                      return (
                        <button key={b.key} onClick={() => setBatchSize(b.key)}
                          className={`flex flex-1 items-center gap-2 rounded-lg border px-3 py-2 text-left transition-all ${isActive ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300' : 'border-space-700/50 bg-space-800/40 text-space-400 hover:text-space-300'}`}>
                          <Layers2 size={16} />
                          <div><div className="text-xs font-semibold">{b.label}</div><div className="text-[10px] text-space-500">{b.desc}</div></div>
                        </button>
                      );
                    })}
                  </div>
                </div>
                {selectedCase && (
                  <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="rounded-lg border border-space-700/50 bg-space-950/40 p-3">
                    <span className="text-[11px] text-space-500 uppercase tracking-wider">已选问题</span>
                    <p className="mt-1 text-sm text-space-200">{selectedCase.question}</p>
                    {batchSize > 1 && <p className="mt-1 text-[11px] text-cyan-400">Batch 模式：复制该请求以展示批处理资源规模，不代表生成多个不同答案。</p>}
                  </motion.div>
                )}
                <button onClick={handleStart} disabled={!selectedCase} className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-cyan-600 to-cyan-500 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_0_20px_rgba(34,211,238,0.25)] transition-all hover:shadow-[0_0_30px_rgba(34,211,238,0.4)] disabled:opacity-40 disabled:shadow-none">
                  <Play size={16} /> 开始推理
                </button>
              </motion.div>
            )}
            {stage === 'tokenizing' && <TokenizingView tokens={tokens} />}
            {stage === 'prefill' && <PrefillView ref={prefillRef} tokens={tokens} isPlaying={isPlaying} onComplete={handlePrefillComplete} />}
            {stage === 'branch' && (
              <motion.div key="branch" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="flex h-full flex-col items-center justify-center gap-5">
                <div className="text-center space-y-2"><Badge variant="amber">决策点</Badge><h3 className="text-base font-semibold text-space-200">是否启用 KV Cache？</h3><p className="text-xs text-space-500">KV Cache 复用历史 Token 的 K/V 表示，减少对历史部分的重复计算，但会增加持久缓存容量。</p></div>
                <div className="grid w-full max-w-md gap-3 sm:grid-cols-2">
                  <GlowCard accent="emerald" interactive onClick={() => handleBranch(true)} className="flex flex-col items-center gap-2 p-5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400"><Zap size={18} /></div>
                    <span className="text-sm font-semibold text-space-200">启用 KV Cache</span><span className="text-xs text-space-500">复用历史 K/V，增加缓存容量</span>
                  </GlowCard>
                  <GlowCard accent="rose" interactive onClick={() => handleBranch(false)} className="flex flex-col items-center gap-2 p-5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full border border-rose-500/30 bg-rose-500/10 text-rose-400"><AlertCircle size={18} /></div>
                    <span className="text-sm font-semibold text-space-200">禁用 KV Cache</span><span className="text-xs text-space-500">重算历史状态，不保留持久 K/V</span>
                  </GlowCard>
                </div>
              </motion.div>
            )}
            {(stage === 'decoding' || stage === 'finished') && (
              <DecodeView key="decode" tokens={tokens} outputTokens={outputTokens} revealedCount={revealedCount} useCache={useCache} stage={stage} />
            )}
          </AnimatePresence>
        </GlowCard>
        <div className="space-y-4">
          {(stage === 'decoding' || stage === 'finished') && stats && (
            <div className="space-y-3">
              <GlowCard accent={useCache ? 'emerald' : 'rose'} className="panel-shell p-4">
                <div className="flex items-start justify-between gap-3">
                  <div><h3 className="flex items-center gap-2 text-sm font-semibold text-space-200"><Gauge size={16} className={useCache ? 'text-emerald-400' : 'text-rose-400'} />结构计数</h3><p className="mt-1 text-[10px] text-space-600">不是硬件实测性能</p></div>
                  <Badge variant={useCache ? 'emerald' : 'slate'}>{useCache ? '复用历史 K/V' : '重算历史状态'}</Badge>
                </div>
                <div className="mt-3 space-y-2.5">
                  <StatRow icon={Layers2} label="Prefill 输入片段" value={`${stats.prefillTokens}`} />
                  <StatRow icon={ChevronRight} label="Decode 生成步数" value={`${stats.decodeSteps}`} />
                  <StatRow icon={Gauge} label="相对历史处理量" value={`${stats.relativeDecodeWork}`} />
                  <StatRow icon={Database} label="缓存 K/V 向量组" value={`${stats.cachedVectors}`} />
                </div>
              </GlowCard>
              {altStats && stage === 'finished' && (
                <GlowCard accent="slate" className="panel-shell p-4">
                  <h3 className="text-xs font-semibold text-space-300">同一序列的结构对照</h3>
                  <div className="mt-3 space-y-2">
                    <div className="flex justify-between text-xs"><span className="text-space-500">当前历史处理量</span><span className="font-mono text-space-300">{stats.relativeDecodeWork}</span></div>
                    <div className="flex justify-between text-xs"><span className="text-space-500">另一分支处理量</span><span className="font-mono text-space-300">{altStats.relativeDecodeWork}</span></div>
                    <div className="flex justify-between text-xs"><span className="text-space-500">当前缓存向量组</span><span className="font-mono text-space-300">{stats.cachedVectors}</span></div>
                  </div>
                  <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/8 p-2.5 text-[11px] leading-relaxed text-amber-200">
                    本页只展示结构计数；两条分支采用相同动画节奏，不转换为毫秒、吞吐或显存。真实性能需在指定模型、Tokenizer、硬件和推理引擎上测量。
                  </div>
                </GlowCard>
              )}
            </div>
          )}
          {stage === 'finished' && (
            <button onClick={handleReset} className="flex w-full items-center justify-center gap-2 rounded-xl border border-space-600 bg-space-800/60 px-4 py-2.5 text-sm text-space-300 transition-all hover:border-cyan-500/30 hover:text-cyan-300">
              <RotateCcw size={14} /> 重新开始
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function StatRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center justify-between rounded-md bg-space-950/40 px-3 py-2">
      <div className="flex items-center gap-1.5 text-xs text-space-400"><Icon size={12} />{label}</div>
      <span className="font-mono text-xs font-semibold text-cyan-300">{value}</span>
    </div>
  );
}
