import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useCallback, useRef, useMemo, forwardRef, useImperativeHandle } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play, RotateCcw, Zap, Database, Clock, MemoryStick, Gauge,
  ChevronRight, Sparkles, AlertCircle, CheckCircle2, ArrowRight,
  Type, Hash, BookOpen, Pause, SkipForward, Layers2
} from 'lucide-react';
import GlowCard from '../components/GlowCard.jsx';
import Badge from '../components/Badge.jsx';

const CASES = [
  { id: 'weather', label: '天气查询', question: '今天北京的天气怎么样？', reply: ['今天','北京','天气','晴朗','，','气温','25','°C','，','适合','出行','。'], batchReply: { 2: ['今天','上海','天气','多云','，','气温','22','°C','。'], 3: ['今天','广州','天气','小雨','，','气温','28','°C','。'], 4: ['今天','深圳','天气','阴天','，','气温','27','°C','。'] } },
  { id: 'math', label: '简单算术', question: '3加5等于多少？', reply: ['3','加','5','等于','8','。'], batchReply: { 2: ['7','减','2','等于','5','。'], 3: ['4','乘','6','等于','24','。'], 4: ['9','除','3','等于','3','。'] } },
  { id: 'geography', label: '地理常识', question: '中国的首都是哪里？', reply: ['中国','的','首都','是','北京','。'], batchReply: { 2: ['美国','的','首都','是','华盛顿','。'], 3: ['日本','的','首都','是','东京','。'], 4: ['英国','的','首都','是','伦敦','。'] } },
  { id: 'moe', label: 'MoE', question: 'MoE（混合专家）模型有什么特点？', reply: ['MoE','（','Mixture','of','Experts','，','混合','专家','）','拥有','很多','专家','参数','，','但','每个','Token','只','激活','少数','专家','，','实现','参数量','与','计算量','分离','。'] },
  { id: 'speculative-decoding', label: '推测解码', question: 'Speculative Decoding 如何加速生成？', reply: ['Speculative','Decoding','用','草稿','模型','快速','猜','一串','Token','，','大','模型','一次','并行','验证','，','接受','连续','正确','的','部分','。'] },
  { id: 'flashattention', label: 'FlashAttention', question: 'FlashAttention 为什么能节省显存？', reply: ['FlashAttention','通过','分块','计算','与','在线','更新','，','减少','Attention','的','显存','访问量','，','不','改变','数学','结果','。'] },
];

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

function getTokenId(token) {
  if (token.length === 1) {
    const code = token.charCodeAt(0);
    if (code > 127) return 'U+' + code.toString(16).toUpperCase().padStart(4,'0');
    return String(code);
  }
  const sum = token.split('').reduce((a,c) => a + c.charCodeAt(0), 0);
  return String(sum % 100000 + 1000);
}

function tokenize(text) {
  const tokens = [];
  for (let i = 0; i < text.length; ) {
    if (text[i].match(/[\u4e00-\u9fa5]/)) { tokens.push(text[i]); i++; }
    else if (text[i] === ' ') { i++; }
    else { let j = i; while (j < text.length && !text[j].match(/[\u4e00-\u9fa5\s]/)) j++; tokens.push(text.slice(i,j)); i = j; }
  }
  return tokens.length > 0 ? tokens : [text];
}

function calcStats(inputLen, outputLen, useCache, batchSize) {
  const ttft = Math.round(inputLen * 2.8);
  const tpot = useCache ? 16 : Math.round(inputLen * 2.8 + 16);
  const totalTime = Math.round(ttft + tpot * outputLen);
  const memoryMB = useCache ? Math.round((inputLen + outputLen) * 0.5 * batchSize) : 0;
  const tokensPerSec = Math.round((1000 / tpot) * batchSize * 10) / 10;
  return { ttft, tpot, totalTime, memoryMB, tokensPerSec };
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
      <div className="text-center"><Badge variant="cyan">分词中</Badge><p className="mt-2 text-xs text-space-500">将输入文本拆解为 Token，并为每个 Token 分配 Unicode 编码作为 ID</p></div>
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
                <Hash size={11} className="text-violet-400" /><span className="text-xs text-violet-300 font-mono">{getTokenId(tok)}</span>
              </motion.div>
            </motion.div>
          );
        })}
      </div>
      {visibleCount >= tokens.length && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs text-emerald-300">
          共 {tokens.length} 个 Token，准备进入 Prefill 阶段...
        </motion.div>
      )}
    </div>
  );
}

const PREfill_SHOTS = [
  { key: 'embedding', label: 'Embedding', desc: 'Token 嵌入 + 位置编码 = 输入向量 (真实计算)' },
  { key: 'qkv',     label: 'Q/K/V 投影',  desc: '矩阵乘法: X·Wq=Q, X·Wk=K, X·Wv=V (真实权重)' },
  { key: 'attention', label: '自注意力',  desc: 'softmax(Q·K^T/√d) · V (真实注意力分数)' },
  { key: 'ffn',     label: '残差+FFN', desc: '残差连接 → LayerNorm → 升维 → GELU → 降维' },
];

function generateRealData(tokens) {
  const d = 4;
  const n = Math.min(tokens.length, 4);
  const used = tokens.slice(0, n);
  
  // Embedding (哈希生成真实值)
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
  const matMul = (v, W) => W.map(r => Math.round(r.reduce((s, w, j) => s + w * v[j], 0) * 10) / 10);
  const Q = input.map(x => matMul(x.final, Wq));
  const K = input.map(x => matMul(x.final, Wk));
  const V = input.map(x => matMul(x.final, Wv));
  
  // Attention 分数
  const scores = Q.map((q, i) => 
    K.map((k, j) => {
      const dot = q.reduce((s, qv, idx) => s + qv * k[idx], 0);
      return Math.round((dot / Math.sqrt(d)) * 100) / 100;
    })
  );
  
  const softmax = (row) => {
    const max = Math.max(...row);
    const exps = row.map(v => Math.exp(v - max));
    const sum = exps.reduce((a, b) => a + b, 0);
    return exps.map(e => Math.round((e / sum) * 100) / 100);
  };
  const attn = scores.map(softmax);
  
  return { input, Wq, Wk, Wv, Q, K, V, scores, attn };
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

// ========== 子镜头1: Embedding (真实数据) ==========
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
              <span className={`text-[10px] transition-all ${s2 ? 'text-violet-400' : 'text-space-700'}`}>位置编码</span>
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
      {step >= data.input.length * 3 && (
        <div className="text-sm font-semibold text-emerald-400">✓ 全部 Token 完成嵌入</div>
      )}
    </div>
  );
}

// ========== 子镜头2: Q/K/V (真实权重和计算) ==========
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

// ========== 子镜头3: Attention (真实分数) ==========
function AttentionShot({ tokens, playing }) {
  const data = useMemo(() => generateRealData(tokens), [tokens]);
  const step = usePlaybackSteps(data.attn.length * data.attn.length + data.attn.length + 1, 230, playing);
  const n = data.attn.length;
  
  const showScore = (i, j) => step >= i * n + j + 1;
  const showWeight = (i) => step >= n * n + i + 1;
  const allDone = step >= n * n + n;
  
  return (
    <div className="flex h-full flex-col items-center justify-center gap-5">
      <div className="flex items-center gap-4">
        {/* Q 矩阵 */}
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs font-semibold text-cyan-300">Q</span>
          <div className="flex flex-col gap-0.5">
            {data.Q.map((row, i) => (
              <div key={i} className="flex gap-0.5">
                {row.map((v, j) => (
                  <div key={j} className="flex h-7 w-7 items-center justify-center rounded border border-cyan-500/30 bg-cyan-500/10 text-[9px] font-mono text-cyan-300">{v.toFixed(1)}</div>
                ))}
              </div>
            ))}
          </div>
        </div>
        
        <span className="text-space-500 text-lg">×</span>
        
        {/* K^T 矩阵 */}
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs font-semibold text-emerald-300">K^T</span>
          <div className="flex flex-col gap-0.5">
            {data.K.map((row, i) => (
              <div key={i} className="flex gap-0.5">
                {row.map((v, j) => (
                  <div key={j} className="flex h-7 w-7 items-center justify-center rounded border border-emerald-500/30 bg-emerald-500/10 text-[9px] font-mono text-emerald-300">{v.toFixed(1)}</div>
                ))}
              </div>
            ))}
          </div>
        </div>
        
        <span className="text-space-500 text-lg">=</span>
        
        {/* 注意力分数矩阵 */}
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs font-semibold text-space-400">Score = Q·K^T/√4</span>
          <div className="grid gap-1" style={{gridTemplateColumns:`repeat(${n}, 44px)`}}>
            {data.scores.flat().map((s, idx) => {
              const i = Math.floor(idx / n);
              const j = idx % n;
              const visible = showScore(i, j);
              const self = i === j;
              const near = Math.abs(i - j) === 1;
              return (
                <motion.div key={idx} initial={{opacity:0.2, scale:0.85}} animate={visible ? {opacity:1, scale:1} : {}}
                  className={`flex h-10 items-center justify-center rounded-lg border text-sm font-bold font-mono transition-all ${
                    self ? 'border-emerald-400/60 bg-emerald-500/20 text-emerald-300 shadow-[0_0_12px_rgba(52,211,153,0.2)]' :
                    near ? 'border-violet-400/50 bg-violet-500/18 text-violet-200' :
                    'border-space-500/40 bg-space-800/70 text-space-500'} ${visible ? 'opacity-100 scale-100' : 'opacity-25 scale-90'}`}>
                  {visible ? s.toFixed(2) : '?'}
                  {self && visible && <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5 rounded-full bg-emerald-400" />}
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
      
      {/* Softmax 结果 */}
      <div className={`flex flex-col items-center gap-1 transition-all duration-500 ${step >= n * n ? 'opacity-100' : 'opacity-30'}`}>
        <span className="text-xs font-semibold text-space-400">Softmax → Attention Weights</span>
        <div className="grid gap-1" style={{gridTemplateColumns:`repeat(${n}, 44px)`}}>
          {data.attn.flat().map((w, idx) => {
            const i = Math.floor(idx / n);
            const j = idx % n;
            const visible = showWeight(i);
            const self = i === j;
            const strong = w > 0.5;
            return (
              <div key={idx} className={`flex h-10 items-center justify-center rounded-lg border text-sm font-bold font-mono transition-all duration-500 ${
                visible ? (strong ? 'border-emerald-400/60 bg-emerald-500/20 text-emerald-300 shadow-[0_0_12px_rgba(52,211,153,0.2)]' : 'border-space-500/40 bg-space-800/60 text-space-300')
                : 'border-space-700 bg-space-800/30 text-space-700'}`}>
                {visible ? w.toFixed(2) : '?'}
              </div>
            );
          })}
        </div>
      </div>
      
      <div className="flex items-center gap-3 text-xs">
        <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-emerald-300"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-400" />对角线 - 自身关注 (高)</span>
        <span className="flex items-center gap-1.5 rounded-full border border-violet-500/25 bg-violet-500/10 px-3 py-1 text-violet-300"><span className="h-2.5 w-2.5 rounded-sm bg-violet-400" />邻近 - 上下文关联 (中)</span>
        <span className="flex items-center gap-1.5 rounded-full border border-space-500/25 bg-space-800/60 px-3 py-1 text-space-400"><span className="h-2.5 w-2.5 rounded-sm bg-space-500" />远端 - 弱关注 (低)</span>
      </div>
      {allDone && <div className="text-sm font-semibold text-emerald-300">✓ Attention 权重计算完成，每行和 ≈1</div>}
    </div>
  );
}

// ========== 子镜头4: 残差+FFN ==========
function ResidualFFNShot({ tokens, playing }) {
  const data = useMemo(() => generateRealData(tokens), [tokens]);
  const n = data.input.length;
  const steps = ['残差相加', 'LayerNorm', '升维 (4d)', 'GELU激活', '降维 (d)', '加残差'];
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
      
      <div className={`flex items-center gap-3 text-sm transition-all duration-500 ${allDone ? 'opacity-100' : 'opacity-30'}`}>
        <span className="rounded-md border border-space-700 bg-space-800/50 px-3 py-1.5">Attention 输出 + 原始输入</span>
        <span className="text-space-600">→</span>
        <span className="rounded-md border border-emerald-400/40 bg-emerald-500/10 px-3 py-1.5 text-emerald-300 font-semibold">Layer 输出 (写入 KV Cache)</span>
      </div>
      {allDone && <div className="text-sm font-semibold text-emerald-300">✓ 本层完成，K、V 已写入 KV Cache</div>}
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
        <Badge variant="violet">Prefill 阶段 · 子镜头轮播 (真实计算)</Badge>
        <p className="mt-2 text-sm text-space-400">一次性并行计算所有输入 Token 的 Embedding、Q/K/V、Attention 与 FFN，并写入 KV Cache</p>
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
    setTokens(tokenize(selectedCase.question));
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
    let reply = [...selectedCase.reply];
    if (batchSize > 1 && selectedCase.batchReply) {
      for (let b = 2; b <= batchSize; b++) {
        if (selectedCase.batchReply[b]) { reply.push(' | '); reply.push(...selectedCase.batchReply[b]); }
      }
    }
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
    const delay = useCache ? 220 : 500;
    const t = setTimeout(() => setRevealedCount((c) => c + 1), delay);
    return () => clearTimeout(t);
  }, [stage, revealedCount, outputTokens.length, useCache, isPlaying]);

  useEffect(() => {
    if (stage !== 'finished') return;
    const s = calcStats(tokens.length, outputTokens.length, useCache, batchSize);
    const alt = calcStats(tokens.length, outputTokens.length, !useCache, batchSize);
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
      <div className="text-center">
        <h1 className="text-headline text-gradient">推理流水线模拟器</h1>
        <p className="mx-auto mt-2 max-w-xl text-sm text-space-400">选择问题与 Batch 模式，观察从 Token 化到生成的完整推理链路。</p>
      </div>

      {/* Stage Bar */}
      <div className="rounded-xl border border-space-700/50 bg-space-900/50 p-4 backdrop-blur-md">
        <div className="flex items-center justify-between gap-2">
          {STAGES.map((s,i) => <StageNode key={s.key} index={i} label={s.label} active={i===stageIndex} done={i<stageIndex} panoramaId={s.panoramaId} navigate={navigate} />)}
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
        <GlowCard accent="cyan" className="min-h-[420px] p-5">
          <AnimatePresence mode="wait">
            {stage === 'idle' && (
              <motion.div key="idle" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-5">
                <div><h3 className="text-sm font-semibold text-space-200 mb-1">选择问题</h3><p className="text-xs text-space-500">前3个为生活常识，后3个为大模型推理概念</p></div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {CASES.map((c) => {
                    const isSelected = selectedCase?.id === c.id;
                    return (
                      <GlowCard key={c.id} accent={isSelected ? 'cyan' : 'slate'} interactive onClick={() => handleSelectCase(c)} className={`p-3.5 ${isSelected ? 'ring-1 ring-cyan-400/40' : ''}`}>
                        <div className="flex items-center gap-2 mb-2"><BookOpen size={14} className={isSelected ? 'text-cyan-400' : 'text-space-500'} /><span className={`text-sm font-semibold ${isSelected ? 'text-cyan-300' : 'text-space-300'}`}>{c.label}</span></div>
                        <p className="text-xs text-space-500 leading-relaxed line-clamp-2">{c.question}</p>
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
                    {batchSize > 1 && <p className="mt-1 text-[11px] text-cyan-400">Batch 模式：同时计算 {batchSize} 个请求</p>}
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
                <div className="text-center space-y-2"><Badge variant="amber">决策点</Badge><h3 className="text-base font-semibold text-space-200">是否启用 KV Cache？</h3><p className="text-xs text-space-500">KV Cache 可以避免 Decode 时重复计算，但会占用显存</p></div>
                <div className="grid w-full max-w-md gap-3 sm:grid-cols-2">
                  <GlowCard accent="emerald" interactive onClick={() => handleBranch(true)} className="flex flex-col items-center gap-2 p-5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400"><Zap size={18} /></div>
                    <span className="text-sm font-semibold text-space-200">启用 KV Cache</span><span className="text-xs text-space-500">快速生成，占用显存</span>
                  </GlowCard>
                  <GlowCard accent="rose" interactive onClick={() => handleBranch(false)} className="flex flex-col items-center gap-2 p-5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full border border-rose-500/30 bg-rose-500/10 text-rose-400"><AlertCircle size={18} /></div>
                    <span className="text-sm font-semibold text-space-200">禁用 KV Cache</span><span className="text-xs text-space-500">慢速生成，节省显存</span>
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
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-3">
              <GlowCard accent={useCache ? 'emerald' : 'rose'} className="p-4">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-space-200"><Gauge size={16} className={useCache ? 'text-emerald-400' : 'text-rose-400'} />本次推理统计</h3>
                <div className="mt-3 space-y-3">
                  <StatRow icon={Clock} label="TTFT (首Token时间)" value={`${stats.ttft} ms`} />
                  <StatRow icon={ChevronRight} label="TPOT (每Token时间)" value={`${stats.tpot} ms`} />
                  <StatRow icon={Gauge} label="生成速度" value={`${stats.tokensPerSec} tok/s`} />
                  <StatRow icon={MemoryStick} label="KV Cache 显存" value={`${stats.memoryMB} MB`} />
                  <StatRow icon={Database} label="总耗时" value={`${stats.totalTime} ms`} />
                  {batchSize > 1 && <StatRow icon={Layers2} label="Batch 大小" value={`${batchSize}`} />}
                </div>
              </GlowCard>
              {altStats && stage === 'finished' && (
                <GlowCard accent="slate" className="p-4">
                  <h3 className="text-xs font-semibold text-space-400">如果{useCache ? '禁用' : '启用'} KV Cache</h3>
                  <div className="mt-2 space-y-2">
                    <div className="flex justify-between text-xs"><span className="text-space-500">TPOT</span><span className="text-space-300">{altStats.tpot} ms</span></div>
                    <div className="flex justify-between text-xs"><span className="text-space-500">总耗时</span><span className="text-space-300">{altStats.totalTime} ms</span></div>
                    <div className="flex justify-between text-xs"><span className="text-space-500">显存占用</span><span className="text-space-300">{altStats.memoryMB} MB</span></div>
                  </div>
                  <div className="mt-3 rounded-md border border-amber-500/20 bg-amber-500/10 p-2 text-[11px] text-amber-300">
                    {useCache ? `禁用后总耗时增加约 ${Math.round((altStats.totalTime / stats.totalTime - 1) * 100)}%，但节省显存` : `启用后总耗时减少约 ${Math.round((1 - altStats.totalTime / stats.totalTime) * 100)}%，但需额外显存`}
                  </div>
                </GlowCard>
              )}
            </motion.div>
          )}
          {stage === 'finished' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <button onClick={handleReset} className="flex w-full items-center justify-center gap-2 rounded-lg border border-space-600 bg-space-800/60 px-4 py-2.5 text-sm text-space-300 transition-all hover:border-cyan-500/30 hover:text-cyan-300">
                <RotateCcw size={14} /> 重新开始
              </button>
            </motion.div>
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
