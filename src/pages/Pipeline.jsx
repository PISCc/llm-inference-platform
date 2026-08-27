import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useCallback, useRef, useMemo, forwardRef, useImperativeHandle } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play, RotateCcw, Zap, Database, Gauge,
  ChevronRight, Sparkles, AlertCircle, CheckCircle2, ArrowRight,
  Type, Hash, BookOpen, Pause, SkipForward, Layers2, Map, PlayCircle
} from 'lucide-react';
import GlowCard from '../components/GlowCard.jsx';
import Badge from '../components/Badge.jsx';
import ProductHeader from '../components/ProductHeader.jsx';
import knowledgeData from '../data/knowledge.json';
import { usePageContextRegistration } from '../context/PageContext.jsx';

const KNOWLEDGE_CASE_IDS = ['kv-cache', 'attention-机制', 'pagedattention', 'moe', 'speculative-decoding', 'flashattention'];
const KNOWLEDGE_ENTRIES = knowledgeData.entries || [];

// 题目可以是技术问题，也可以是确定性更强的生活/常识问题。
// 每个演示案例都显式提供答案，后续 Token 化、Prefill、Decode 使用同一份答案数据。
const CASE_OVERRIDES = {
  'kv-cache': { label: '3 + 6 = ？', question: '3 + 6 = ？', answer: '9。' },
  'attention-机制': { label: '太阳从哪边升起？', question: '太阳从哪边升起？', answer: '太阳通常从东方升起。' },
  pagedattention: { label: '一年有多少个月？', question: '一年有多少个月？', answer: '一年有 12 个月。' },
};

const CASES = KNOWLEDGE_CASE_IDS.map((id) => {
  const entry = KNOWLEDGE_ENTRIES.find((item) => item.id === id);
  if (!entry) return null;
  const override = CASE_OVERRIDES[id] || {};
  const answer = override.answer || entry.definition;
  return {
    id,
    label: override.label || entry.title,
    question: override.question || `什么是${entry.title}？`,
    definition: entry.definition,
    answer,
    reply: tokenizeForDemo(answer),
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

// 分词节奏按输入长度自适应：长问题不再线性拖长，整个分词阶段控制在约 3–4 秒。
function tokenRevealDelay(tokenCount) {
  const count = Math.max(1, tokenCount || 1);
  return Math.min(450, Math.max(120, 2400 / count));
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
function StageNode({ index, label, active, done, stageKey, menuOpen, onOpenMenu }) {
  return (
    <div className="pipeline-stage-node flex flex-1 flex-col items-center gap-1.5">
      <button type="button" onClick={() => onOpenMenu(stageKey)} aria-current={active ? 'step' : undefined} aria-haspopup="menu" aria-expanded={menuOpen}
        className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs font-bold transition-all duration-300 ${active ? 'border-cyan-400/60 bg-cyan-500/20 text-cyan-300 shadow-[0_0_16px_rgba(34,211,238,0.25)]' : done ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' : 'border-space-700 bg-space-800/60 text-space-500'} cursor-pointer hover:scale-110 ${menuOpen ? 'ring-2 ring-cyan-300/30' : ''}`}
        title={`打开${label}阶段操作`}>
        {done ? <CheckCircle2 size={14} /> : index + 1}
      </button>
      <button type="button" onClick={() => onOpenMenu(stageKey)} aria-current={active ? 'step' : undefined} aria-haspopup="menu" aria-expanded={menuOpen}
        className={`text-xs font-medium transition-colors ${active ? 'text-cyan-300' : done ? 'text-emerald-300/80' : 'text-space-600'} cursor-pointer hover:text-cyan-300`}>
        {label}
      </button>
    </div>
  );
}

function TokenizingView({ tokens, isPlaying }) {
  const [visibleCount, setVisibleCount] = useState(0);
  useEffect(() => {
    if (!isPlaying || visibleCount >= tokens.length) return;
    const t = setTimeout(() => setVisibleCount(c => c + 1), tokenRevealDelay(tokens.length));
    return () => clearTimeout(t);
  }, [isPlaying, visibleCount, tokens.length]);
  useEffect(() => { setVisibleCount(0); }, [tokens]);
  return (
    <div className="flex h-full flex-col items-center justify-center gap-5 px-2">
      <div className="text-center"><Badge variant="cyan">分词中</Badge><p className="mt-2 text-xs text-space-500">用演示分词规则拆分输入，展示 Token 与稳定的教学用 Token ID；真实模型会使用各自的词表</p></div>
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
          当前输入被拆分为 {tokens.length} 个 Token；这里的 Token ID 是稳定的教学编号，真实模型会按自身 Tokenizer 和词表编码。
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
  const step = usePlaybackSteps(data.input.length * 3 + 1, 210, playing);
  
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
      <p className="text-center text-[11px] leading-relaxed text-space-500">小型向量用于展示数据流。</p>
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
  const step = usePlaybackSteps(n * 3 + 2, 200, playing);
  
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
  const step = usePlaybackSteps(data.attn.length * data.attn.length + data.attn.length + 1, 130, playing);
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
  const step = usePlaybackSteps(steps.length + 1, 400, playing);
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
      
      <p className="max-w-3xl text-center text-[11px] leading-relaxed text-space-500">简化 Transformer 层示意。</p>
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
    }, 3000);
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
        <span className="ml-2 text-xs text-space-500">每镜头约 3 秒 · 总约 12 秒</span>
      </div>

      <div className="pipeline-prefill-layout grid flex-1 gap-4 lg:grid-cols-[170px_minmax(0,1fr)]">
        <div className="pipeline-prefill-nav flex flex-row gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
          {PREfill_SHOTS.map((s, i) => (
            <button key={s.key} onClick={() => setShot(i)}
              className={`pipeline-prefill-step flex min-w-0 items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition-all ${i === shot ? 'border-violet-500/40 bg-violet-500/10' : 'border-space-700/50 bg-space-800/40 hover:border-space-600'}`}>
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${i === shot ? 'bg-violet-500/25 text-violet-300' : i < shot ? 'bg-emerald-500/20 text-emerald-300' : 'bg-space-800 text-space-600'}`}>
                {i < shot ? <CheckCircle2 size={13} /> : i + 1}
              </span>
              <span className={`pipeline-prefill-step-label min-w-0 flex-1 text-sm font-medium ${i === shot ? 'text-violet-300' : 'text-space-400'}`}>{s.label}</span>
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
  const [isPlaying, setIsPlaying] = useState(false);
  const [stageMenuKey, setStageMenuKey] = useState(null);
  const prefillRef = useRef(null);
  const stageIndex = STAGES.findIndex((s) => s.key === stage);

  const handlePrefillComplete = useCallback(() => setStage('branch'), []);

  const handleSelectCase = useCallback((caseItem) => { setSelectedCase(caseItem); }, []);

  const handleStart = useCallback(() => {
    if (!selectedCase) return;
    setStageMenuKey(null);
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
    const t = setTimeout(() => setStage('prefill'), Math.round(tokens.length * tokenRevealDelay(tokens.length)) + 800);
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
    setRevealedCount(0); setStats(null); setAltStats(null); setIsPlaying(false); setStageMenuKey(null);
  }, []);

  const handleJumpToStage = useCallback((targetKey) => {
    const target = STAGES.find((item) => item.key === targetKey);
    if (!target) return;
    setIsPlaying(false);
    if (targetKey === 'idle') {
      setStage('idle');
      return;
    }
    if (!selectedCase) return;
    const nextTokens = tokens.length ? tokens : tokenizeForDemo(selectedCase.question);
    const nextOutput = outputTokens.length ? outputTokens : [...selectedCase.reply];
    setTokens(nextTokens);
    if (targetKey === 'tokenizing' || targetKey === 'prefill') {
      setOutputTokens([]);
      setRevealedCount(0);
      setUseCache(null);
      setStats(null);
      setAltStats(null);
    } else if (targetKey === 'branch') {
      setOutputTokens([]);
      setRevealedCount(0);
      setUseCache(null);
      setStats(null);
      setAltStats(null);
    } else if (targetKey === 'decoding') {
      const selectedCache = useCache ?? true;
      setOutputTokens(nextOutput);
      setRevealedCount(0);
      setUseCache(selectedCache);
      setStats(null);
      setAltStats(null);
    } else if (targetKey === 'finished') {
      const selectedCache = useCache ?? true;
      setOutputTokens(nextOutput);
      setRevealedCount(nextOutput.length);
      setUseCache(selectedCache);
      setStats(calcStructuralCounts(nextTokens.length, nextOutput.length, selectedCache, batchSize));
      setAltStats(calcStructuralCounts(nextTokens.length, nextOutput.length, !selectedCache, batchSize));
    }
    setStage(targetKey);
  }, [batchSize, outputTokens, selectedCase, tokens, useCache]);

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

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && stage !== 'idle' && stage !== 'finished') {
        event.preventDefault();
        setIsPlaying(false);
      }
      if (event.key === 'ArrowRight' && stage !== 'idle' && stage !== 'finished') {
        event.preventDefault();
        setIsPlaying(false);
        handleNext();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNext, stage]);

  const isRunning = stage !== 'idle' && stage !== 'finished';
  const activeStage = STAGES[stageIndex] || STAGES[0];
  const selectedStageAction = STAGES.find((item) => item.key === stageMenuKey);
  const pageContext = useMemo(() => ({
    pageId: 'pipeline',
    pageTitle: '推理流水线模拟器',
    pageType: 'simulation',
    activeSection: stage,
    selection: {
      caseId: selectedCase?.id || null,
      caseLabel: selectedCase?.label || null,
      question: selectedCase?.question || null,
      caseDefinition: selectedCase?.definition || null,
      caseAnswer: selectedCase?.answer || null,
      stageLabel: activeStage.label,
      stageDescription: activeStage.desc,
      panoramaModuleId: activeStage.panoramaId,
      cacheBranch: useCache == null ? 'not-selected' : useCache ? 'with-kv-cache' : 'without-kv-cache',
    },
    parameters: {
      batchSize,
      isPlaying,
      stageIndex,
      stageCount: STAGES.length,
      inputTokenCount: tokens.length,
      plannedOutputTokenCount: outputTokens.length,
      revealedOutputTokenCount: revealedCount,
    },
    result: {
      tokens: tokens.map((token, index) => ({ token, tokenId: getDemoTokenId(token, index) })),
      revealedOutput: outputTokens.slice(0, revealedCount),
      structuralStats: stats,
      comparisonStats: altStats,
    },
    visibleSummary: selectedCase
      ? `案例“${selectedCase.label}”当前处于${activeStage.label}阶段：${activeStage.desc}。`
      : '尚未选择演示案例，当前处于输入准备阶段。',
    suggestedQuestions: [
      '为什么 AI 答一句话要想那么久？',
      '为什么 AI 出字时快时慢？',
      '为什么 AI 会越聊越慢？',
    ],
    boundaries: [],
  }), [activeStage, altStats, batchSize, isPlaying, outputTokens, revealedCount, selectedCase, stage, stageIndex, stats, tokens, useCache]);

  usePageContextRegistration('pipeline-page', pageContext);

  return (
    <div className="pipeline-workbench wb-page">
      <ProductHeader title="推理流水线模拟器" subtitle="从文本分词开始，逐步观察 Prefill、KV Cache 分支与 Decode，理解一次大模型推理请求的完整执行过程。" accent="cyan" badges={[{ label: '6 个精选案例' }, { label: '可暂停与逐步推进' }]} />
      <section className="pipeline-stagebar panel-shell">
        <div className="pipeline-stagebar-scroll"><div className="pipeline-stagebar-track">{STAGES.map((s, i) => <StageNode key={s.key} index={i} label={s.label} stageKey={s.key} active={i === stageIndex} done={i < stageIndex} menuOpen={stageMenuKey === s.key} onOpenMenu={(key) => setStageMenuKey((current) => current === key ? null : key)} />)}</div></div>
        <div className="pipeline-progress"><motion.div animate={{ width: `${(stageIndex / (STAGES.length - 1)) * 100}%` }} /></div>
        <div className="pipeline-stage-caption"><span>{STAGES[stageIndex]?.desc}</span><span className="pipeline-stage-hint">点击阶段节点选择跳转方式</span></div>
        {selectedStageAction && <div className="pipeline-stage-actions" role="menu" aria-label={`${selectedStageAction.label}阶段操作`}><div className="pipeline-stage-actions-head"><span>阶段操作</span><strong>{selectedStageAction.label}</strong><button onClick={() => setStageMenuKey(null)} aria-label="关闭阶段操作">×</button></div><div className="pipeline-stage-actions-grid"><button className="pipeline-stage-action" onClick={() => { if (selectedStageAction.panoramaId) { navigate('/panorama', { state: { moduleId: selectedStageAction.panoramaId } }); setStageMenuKey(null); } }} disabled={!selectedStageAction.panoramaId}><Map size={16} /><span><b>跳转全景图知识点</b><small>{selectedStageAction.panoramaId ? '打开对应模块详情' : '该阶段暂无单一知识点'}</small></span><ArrowRight size={14} /></button><button className="pipeline-stage-action is-primary" onClick={() => { handleJumpToStage(selectedStageAction.key); setStageMenuKey(null); }} disabled={!selectedCase && selectedStageAction.key !== 'idle'}><PlayCircle size={16} /><span><b>动画跳转到对应节点</b><small>{selectedCase ? '定位到该阶段并保持暂停' : '请先选择一个案例'}</small></span><ArrowRight size={14} /></button></div></div>}
        {isRunning && <div className="pipeline-playbar"><button className={isPlaying ? 'pipeline-control is-pause' : 'pipeline-control'} onClick={() => setIsPlaying(!isPlaying)}>{isPlaying ? <><Pause size={15} />暂停</> : <><Play size={15} />继续</>}</button><button className="pipeline-control is-step" onClick={handleNext}><SkipForward size={15} />单步推进</button><span>{isPlaying ? '自动推进中' : '已暂停'} · Esc 暂停 · ArrowRight 单步</span></div>}
      </section>
      <div className="pipeline-workspace">
        <main className="pipeline-main-stage panel-shell">
          <div className="pipeline-main-head"><div><div className="wb-pane-label">OBSERVABLE EXECUTION</div><strong>阶段主工作区</strong></div><Badge variant={stage === 'finished' ? 'emerald' : isRunning ? 'cyan' : 'slate'}>{STAGES[stageIndex]?.label}</Badge></div>
          <div className={`pipeline-inline-requestbar ${stage === 'idle' ? 'is-idle' : ''}`}>
            {stage !== 'idle' && <div className="pipeline-inline-request">
              <BookOpen size={15} />
              <span><small>当前请求</small><strong>{selectedCase?.label || '尚未选择案例'}</strong></span>
              <p>{selectedCase?.question || '请从下方精选案例中选择要观察的问题。'}</p>
            </div>}
            <div className="pipeline-inline-batch">
              <div><Layers2 size={14} /><span>Batch 模式</span></div>
              <div className="pipeline-inline-batch-options">{BATCH_CONFIG.map((item) => <button key={item.key} type="button" className={batchSize === item.key ? 'is-active' : ''} onClick={() => setBatchSize(item.key)} title={item.desc}><b>{item.label}</b><small>{item.desc}</small></button>)}</div>
            </div>
          </div>
          <div className="pipeline-animation-surface"><AnimatePresence mode="wait">
            {stage === 'idle' && (
              <motion.div key="idle" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="pipeline-idle-state">
                <div className="pipeline-idle-guide">
                  <div className="pipeline-idle-mark"><Sparkles size={28} /></div>
                  <div>
                    <div className="wb-pane-label">开始一次可观察推理</div>
                    <h2>{selectedCase ? '请求已就绪' : '先选择一个案例'}</h2>
                    <p>{selectedCase ? '确认问题与 Batch 配置后开始。动画会从“分词”阶段自动播放，也可以随时暂停或单步推进。' : '从一个生活化问题开始，平台会带你观察它背后的分词、Prefill、KV Cache 决策与 Decode 技术机制。'}</p>
                  </div>
                </div>
                <div className="pipeline-idle-steps" aria-label="开始推理的三个步骤">
                  <div className={selectedCase ? 'is-done' : 'is-current'}><span>01</span><b>选择案例</b><small>{selectedCase ? selectedCase.label : '选择要观察的问题'}</small></div>
                  <div className="is-current"><span>02</span><b>确认 Batch</b><small>当前 Batch-{batchSize}</small></div>
                  <div><span>03</span><b>开始并观察</b><small>自动播放，可随时暂停</small></div>
                </div>
                {!selectedCase ? (
                  <div className="pipeline-idle-case-grid">
                    {CASES.map((item) => <button key={item.id} type="button" onClick={() => handleSelectCase(item)}><BookOpen size={15} /><span><b>{item.label}</b><small>{item.question}</small></span><ArrowRight size={13} /></button>)}
                  </div>
                ) : (
                  <div className="pipeline-idle-selection">
                    <div><span>当前请求确认</span><strong>{selectedCase.label}</strong><p>{selectedCase.question}</p><button type="button" className="pipeline-idle-change-case" onClick={() => setSelectedCase(null)}>更换案例</button></div>
                    <div className="pipeline-idle-selection-meta"><Layers2 size={15} /><span>Batch-{batchSize}</span><small>{BATCH_CONFIG.find((item) => item.key === batchSize)?.desc}</small></div>
                  </div>
                )}
                <button type="button" onClick={handleStart} disabled={!selectedCase} className="pipeline-idle-start"><Play size={16} />{selectedCase ? '开始推理' : '选择案例后即可开始'}</button>
                <div className="pipeline-idle-sequence">{STAGES.map((item) => <span key={item.key}>{item.label}</span>)}</div>
              </motion.div>
            )}
            {stage === 'tokenizing' && <TokenizingView tokens={tokens} isPlaying={isPlaying} />}
            {stage === 'prefill' && <PrefillView ref={prefillRef} tokens={tokens} isPlaying={isPlaying} onComplete={handlePrefillComplete} />}
            {stage === 'branch' && <motion.div key="branch" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="pipeline-branch-state"><Badge variant="amber">决策点</Badge><h2>是否启用 KV Cache？</h2><p>KV Cache 复用历史 Token 的 K/V 表示，减少对历史部分的重复计算，但会增加持久缓存容量。</p><div className="pipeline-branch-actions"><button onClick={() => handleBranch(true)}><Zap size={18} /><b>启用 KV Cache</b><span>复用历史 K/V，增加缓存容量</span></button><button onClick={() => handleBranch(false)}><AlertCircle size={18} /><b>禁用 KV Cache</b><span>重算历史状态，不保留持久 K/V</span></button></div></motion.div>}
            {(stage === 'decoding' || stage === 'finished') && <DecodeView key="decode" tokens={tokens} outputTokens={outputTokens} revealedCount={revealedCount} useCache={useCache} stage={stage} />}
          </AnimatePresence></div>
        </main>
        <aside className="pipeline-inspector panel-shell">
          <div className="pipeline-inspector-head"><div><div className="wb-pane-label">STAGE INSPECTOR</div><strong>结构状态</strong></div><Gauge size={17} /></div>
          <div className="pipeline-inspector-body"><div className="pipeline-state-row"><span>当前阶段</span><b>{STAGES[stageIndex]?.label}</b></div><div className="pipeline-state-row"><span>输入 Token 数</span><b>{tokens.length || '—'}</b></div><div className="pipeline-state-row"><span>Batch</span><b>{batchSize}</b></div>{selectedCase && <div className="pipeline-inspector-note"><div className="wb-pane-label">当前问题</div><p>{selectedCase.question}</p></div>}{stats && (stage === 'decoding' || stage === 'finished') && <><div className="pipeline-inspector-divider" /><div className="wb-pane-label">结构计数</div><StatRow icon={Layers2} label="Prefill 输入片段" value={`${stats.prefillTokens}`} /><StatRow icon={ChevronRight} label="Decode 生成步数" value={`${stats.decodeSteps}`} /><StatRow icon={Gauge} label="相对历史处理量" value={`${stats.relativeDecodeWork}`} /><StatRow icon={Database} label="缓存 K/V 向量组" value={`${stats.cachedVectors}`} /><Badge variant={useCache ? 'emerald' : 'slate'}>{useCache ? '复用历史 K/V' : '重算历史状态'}</Badge></>}{altStats && stage === 'finished' && <div className="pipeline-compare-note"><div>另一分支处理量 <b>{altStats.relativeDecodeWork}</b></div><div>另一分支缓存向量组 <b>{altStats.cachedVectors}</b></div></div>}{stage === 'finished' && <button onClick={handleReset} className="pipeline-reset-button"><RotateCcw size={14} />重新开始</button>}</div>
        </aside>
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
