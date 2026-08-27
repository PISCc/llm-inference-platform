import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  ScanSearch, Timer, Activity, MemoryStick, Gauge, ServerCog, ArrowRight,
  ArrowUpRight, CheckCircle2, CircleGauge, Copy, Workflow, Database,
  Network, ListChecks, ChevronRight, RotateCcw, Search,
  ShieldAlert, MinusCircle, ClipboardCheck
} from 'lucide-react';
import Badge from '../components/Badge.jsx';
import ProductHeader from '../components/ProductHeader.jsx';
import { DIAGNOSIS_SCENARIOS } from '../data/diagnosisScenarios.js';
import { usePageContextRegistration } from '../context/PageContext.jsx';

const STAGES = [
  { id: 'entry', label: '请求入口', icon: Workflow },
  { id: 'queue', label: '排队调度', icon: ListChecks },
  { id: 'startup', label: '加载与预热', icon: ServerCog },
  { id: 'prefill', label: 'Prefill', icon: Database },
  { id: 'cache', label: 'KV Cache', icon: MemoryStick },
  { id: 'decode', label: 'Decode', icon: Activity },
  { id: 'communication', label: '通信与硬件', icon: Network },
];

// 图标保持在视图层，诊断内容本身放在独立数据文件中，便于逐条审计。
const ICON_MAP = {
  timer: Timer,
  activity: Activity,
  memory: MemoryStick,
  gauge: Gauge,
  server: ServerCog,
};

const SCENARIOS = DIAGNOSIS_SCENARIOS;


function accentClasses(accent, active = false) {
  const map = {
    cyan: active ? 'border-cyan-500/45 bg-cyan-500/10 text-cyan-200' : 'border-cyan-500/20 hover:border-cyan-500/35',
    violet: active ? 'border-violet-500/45 bg-violet-500/10 text-violet-200' : 'border-violet-500/20 hover:border-violet-500/35',
    amber: active ? 'border-amber-500/45 bg-amber-500/10 text-amber-200' : 'border-amber-500/20 hover:border-amber-500/35',
    emerald: active ? 'border-emerald-500/45 bg-emerald-500/10 text-emerald-200' : 'border-emerald-500/20 hover:border-emerald-500/35',
    rose: active ? 'border-rose-500/45 bg-rose-500/10 text-rose-200' : 'border-rose-500/20 hover:border-rose-500/35',
  };
  return map[accent] || map.cyan;
}
function evidenceWeight(evidence) {
  return evidence?.tier === 'direct' ? 3 : 1;
}

function priorityLabel(cause, hasSelection = true) {
  if (!hasSelection) return { label: '待选择观察', variant: 'slate' };
  if (cause.contradicted.length > 0 && cause.matchedDirect.length > 0) return { label: '观察冲突', variant: 'amber' };
  if (cause.contradicted.length > 0 && cause.matched.length === 0) return { label: '匹配较弱', variant: 'slate' };
  if (cause.matchedDirect.length > 0 && cause.weightedScore >= 4) return { label: '优先检查', variant: 'amber' };
  if (cause.matched.length > 0) return { label: '存在匹配', variant: 'cyan' };
  return { label: '待补充观察', variant: 'slate' };
}

function diagnosisStatusDetails(cause, evidenceCount) {
  if (!evidenceCount) return { tone: 'pending', text: '选择观察项后更新原因顺序。' };
  if (cause.contradicted.length > 0 && cause.matchedDirect.length > 0) return { tone: 'conflict', text: '匹配项与冲突项并存。' };
  if (cause.contradicted.length > 0 && cause.matched.length === 0) return { tone: 'weakened', text: '当前观察与该原因匹配较弱。' };
  if (cause.matchedDirect.length > 0 && cause.weightedScore >= 4) return { tone: 'validate', text: '建议优先检查该原因。' };
  if (cause.matched.length > 0) return { tone: 'supporting', text: '当前观察与该原因存在匹配。' };
  return { tone: 'pending', text: '继续补充观察项。' };
}

export default function Diagnosis() {
  const navigate = useNavigate();
  const [scenarioId, setScenarioId] = useState('ttft');
  const [selectedEvidence, setSelectedEvidence] = useState([]);
  const [selectedStage, setSelectedStage] = useState(null);
  const [causeId, setCauseId] = useState('ttft-queue');
  const [copied, setCopied] = useState(false);

  const scenario = SCENARIOS.find(item => item.id === scenarioId) || SCENARIOS[0];

  const rankedCauses = useMemo(() => scenario.causes.map((cause, index) => {
    const matched = cause.signals.filter(signal => selectedEvidence.includes(signal));
    const contradicted = (cause.counterSignals || []).filter(signal => selectedEvidence.includes(signal));
    const matchedDirect = (cause.directSignals || []).filter(signal => selectedEvidence.includes(signal));
    const missingDirect = (cause.directSignals || []).filter(signal => !selectedEvidence.includes(signal));
    const supportScore = matched.reduce((sum, signal) => sum + evidenceWeight(scenario.evidence.find(item => item.id === signal)), 0);
    const contradictionScore = contradicted.reduce((sum, signal) => sum + evidenceWeight(scenario.evidence.find(item => item.id === signal)), 0);
    return {
      ...cause,
      matched,
      contradicted,
      matchedDirect,
      missingDirect,
      weightedScore: Math.max(0, supportScore - contradictionScore),
      originalIndex: index,
    };
  }).sort((a, b) => {
    if (selectedEvidence.length === 0) return a.originalIndex - b.originalIndex;
    return Number(b.matchedDirect.length > 0) - Number(a.matchedDirect.length > 0)
      || b.weightedScore - a.weightedScore
      || a.contradicted.length - b.contradicted.length
      || a.originalIndex - b.originalIndex;
  }), [scenario, selectedEvidence]);

  const visibleCauses = selectedStage ? rankedCauses.filter(cause => cause.stage === selectedStage) : rankedCauses;
  const selectedCause = visibleCauses.find(cause => cause.id === causeId) || visibleCauses[0] || rankedCauses[0];
  const selectedEvidenceDetails = useMemo(() => scenario.evidence
    .filter((evidence) => selectedEvidence.includes(evidence.id))
    .map(({ id, label, hint }) => ({ id, label, hint })), [scenario, selectedEvidence]);
  const unselectedEvidenceDetails = useMemo(() => scenario.evidence
    .filter((evidence) => !selectedEvidence.includes(evidence.id))
    .map(({ id, label, hint }) => ({ id, label, hint })), [scenario, selectedEvidence]);
  const selectedStageLabel = STAGES.find((stageItem) => stageItem.id === selectedStage)?.label || null;
  const diagnosisStatus = priorityLabel(selectedCause, selectedEvidence.length > 0);
  const diagnosisStatusDetail = diagnosisStatusDetails(selectedCause, selectedEvidence.length);
  const pageContext = useMemo(() => ({
    pageId: 'diagnosis',
    pageTitle: '推理链路诊断台',
    pageType: 'diagnosis',
    activeSection: selectedStage || 'all-stages',
    selection: {
      scenario: {
        id: scenario.id,
        title: scenario.title,
        short: scenario.short,
        metric: scenario.metric,
        symptom: scenario.symptom,
      },
      selectedStage,
      selectedStageLabel,
      selectedEvidence: selectedEvidenceDetails,
      selectedCauseId: selectedCause.id,
    },
    result: {
      selectedCause: {
        id: selectedCause.id,
        title: selectedCause.title,
        stage: selectedCause.stage,
        stageLabel: STAGES.find((stageItem) => stageItem.id === selectedCause.stage)?.label || selectedCause.stage,
        reason: selectedCause.reason,
        matchedEvidenceIds: selectedCause.matched,
        matchedEvidence: scenario.evidence
          .filter((evidence) => selectedCause.matched.includes(evidence.id))
          .map((evidence) => evidence.label),
        contradictedEvidenceIds: selectedCause.contradicted,
        contradictedEvidence: scenario.evidence
          .filter((evidence) => selectedCause.contradicted.includes(evidence.id))
          .map((evidence) => evidence.label),
        missingDirectEvidenceIds: selectedCause.missingDirect,
        missingDirectEvidence: scenario.evidence
          .filter((evidence) => selectedCause.missingDirect.includes(evidence.id))
          .map((evidence) => evidence.label),
        rankingStatus: priorityLabel(selectedCause, selectedEvidence.length > 0).label,
        weakens: selectedCause.weakens,
        verify: selectedCause.verify,
        direction: selectedCause.direction,
        knowledgeId: selectedCause.knowledgeId,
        panoramaId: selectedCause.panoramaId,
        labTab: selectedCause.labTab || null,
        compareTab: selectedCause.compareTab || null,
        linkLabel: selectedCause.linkLabel,
      },
      unselectedEvidence: unselectedEvidenceDetails,
      rankedCauses: rankedCauses.map((cause) => ({
        id: cause.id,
        title: cause.title,
        stage: cause.stage,
        stageLabel: STAGES.find((stageItem) => stageItem.id === cause.stage)?.label || cause.stage,
        reason: cause.reason,
        matchedEvidenceCount: cause.matched.length,
        matchedDirectEvidenceCount: cause.matchedDirect.length,
        contradictedEvidenceCount: cause.contradicted.length,
        rankingStatus: priorityLabel(cause, selectedEvidence.length > 0).label,
        matchedEvidenceIds: cause.matched,
        matchedEvidence: scenario.evidence
          .filter((evidence) => cause.matched.includes(evidence.id))
          .map((evidence) => evidence.label),
      })),
    },
    visibleSummary: `正在查看“${scenario.title}”；已选择 ${selectedEvidence.length} 项观察，当前原因“${selectedCause.title}”。`,
    suggestedQuestions: selectedEvidence.length === 0 ? [
      `检查“${selectedCause.title}”应先看什么？`,
      '当前还缺少什么观察？',
      '下一步应该检查什么？',
    ] : [
      `为什么“${selectedCause.title}”是当前候选原因？`,
      '当前还缺少什么观察？',
      selectedStageLabel ? `排除${selectedStageLabel}阶段后检查哪里？` : '下一步应该检查什么？',
    ],
    boundaries: [],
  }), [rankedCauses, scenario, selectedCause, selectedEvidence.length, selectedEvidenceDetails, selectedStage, selectedStageLabel, unselectedEvidenceDetails]);

  usePageContextRegistration('diagnosis-page', pageContext);

  const changeScenario = (id) => {
    const next = SCENARIOS.find(item => item.id === id);
    setScenarioId(id);
    setSelectedEvidence([]);
    setSelectedStage(null);
    setCauseId(next.causes[0].id);
  };

  const toggleEvidence = (id) => {
    setSelectedEvidence(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  };

  const selectStage = (stageId) => {
    const nextStage = selectedStage === stageId ? null : stageId;
    setSelectedStage(nextStage);
    const first = rankedCauses.find(cause => !nextStage || cause.stage === nextStage);
    if (first) setCauseId(first.id);
  };

  const handleCopySummary = async () => {
    const matched = selectedCause.matched
      .map(signal => scenario.evidence.find(e => e.id === signal)?.label)
      .filter(Boolean);
    const contradicted = selectedCause.contradicted
      .map(signal => scenario.evidence.find(e => e.id === signal)?.label)
      .filter(Boolean);
    const missing = selectedCause.missingDirect
      .map(signal => scenario.evidence.find(e => e.id === signal)?.label)
      .filter(Boolean);
    const lines = [
      `场景：${scenario.title}（${scenario.metric}）`,
      `候选原因：${selectedCause.title}`,
      `状态：${priorityLabel(selectedCause, selectedEvidence.length > 0).label}`,
      `相关观察：${matched.length ? matched.join('；') : '无'}`,
      `冲突项：${contradicted.length ? contradicted.join('；') : '无'}`,
      `待补观察：${missing.length ? missing.join('；') : '无'}`,
      `排除条件：${selectedCause.weakens.join('；')}`,
      `检查步骤：${selectedCause.verify.map((step, i) => `${i + 1}. ${step}`).join('；')}`,
      `处理方向：${selectedCause.direction.join('；')}`,
    ].join('\n');
    const fallback = () => {
      const ta = document.createElement('textarea');
      ta.value = lines;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch (err) { /* 忽略 */ }
      document.body.removeChild(ta);
    };
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(lines);
      else fallback();
    } catch (err) { fallback(); }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="diagnosis-workbench mx-auto max-w-7xl space-y-5">
      <ProductHeader
        title="推理链路诊断台"
        subtitle="从 TTFT、TPOT、OOM、吞吐和启动现象定位阶段、原因与处理方向。"
        accent="cyan"
        badges={[{ label: '5 类场景', variant: 'cyan' }, { label: '分阶段定位' }]}
      />

      <div className="diagnosis-scenarios">
        {SCENARIOS.map((item) => {
          const Icon = ICON_MAP[item.icon] || ScanSearch;
          const active = item.id === scenarioId;
          return (
            <button key={item.id} type="button" aria-pressed={active} onClick={() => changeScenario(item.id)} className={`rounded-xl border bg-space-900/55 p-3 text-left transition-all ${accentClasses(item.accent, active)}`}>
              <div className="flex items-center justify-between"><Icon size={18} className={active ? '' : 'text-space-500'} />{active && <CheckCircle2 size={14} />}</div>
              <div className="mt-3 text-sm font-semibold">{item.short}</div>
              <div className="mt-1 text-[11px] text-space-500">{item.metric}</div>
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={scenario.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="diagnosis-task-workspace">
          <section className="diagnosis-symptom">
            <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
              <div><div className="flex flex-wrap items-center gap-2"><Badge variant={scenario.accent === 'rose' ? 'amber' : scenario.accent}>{scenario.short}</Badge><span className="font-mono text-xs text-space-500">{scenario.metric}</span></div><h2 className="mt-3 text-xl font-bold text-space-100">现象：{scenario.title}</h2><p className="mt-2 max-w-4xl text-sm leading-relaxed text-space-400">{scenario.symptom}</p></div>
              <button type="button" onClick={() => { setSelectedEvidence([]); setSelectedStage(null); setCauseId(scenario.causes[0].id); }} className="inline-flex items-center justify-center gap-2 rounded-lg border border-space-700/60 bg-space-950/35 px-3 py-2 text-xs text-space-400 transition hover:text-space-200"><RotateCcw size={13} />重置本场景</button>
            </div>
            <div className="diagnosis-baseline-grid">
              <div className="diagnosis-baseline-title"><ClipboardCheck size={16} />检查范围</div>
              {scenario.baseline.map((item, index) => <div key={item} className="diagnosis-baseline-item"><span>{index + 1}</span>{item}</div>)}
            </div>
          </section>

          <section className={`diagnosis-status-banner is-${diagnosisStatusDetail.tone}`} aria-live="polite">
            <div className="diagnosis-status-banner__main"><CircleGauge size={18} /><span>当前状态</span><Badge variant={diagnosisStatus.variant}>{diagnosisStatus.label}</Badge></div>
            <p>{diagnosisStatusDetail.text}</p>
            <div className="diagnosis-status-banner__counts"><span>已选观察 <b>{selectedEvidence.length}</b></span><span>匹配 <b>{selectedCause.matched.length}</b></span><span>冲突 <b>{selectedCause.contradicted.length}</b></span><span>待补 <b>{selectedCause.missingDirect.length}</b></span></div>
          </section>

          <section className="diagnosis-stage-map">
            <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between"><div><h2 className="flex items-center gap-2 text-base font-semibold text-space-100"><CircleGauge size={17} className="text-cyan-400" />推理链路定位</h2><p className="mt-1 text-xs text-space-500">点击阶段筛选原因，再次点击取消。</p></div>{selectedStage && <Badge variant="cyan">当前筛选：{STAGES.find(stage => stage.id === selectedStage)?.label}</Badge>}</div>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-7">
              {STAGES.map((stage, index) => {
                const Icon = stage.icon;
                const hasCause = scenario.causes.some(cause => cause.stage === stage.id);
                const active = selectedStage === stage.id;
                return (
                   <button key={stage.id} type="button" aria-pressed={active} disabled={!hasCause} onClick={() => hasCause && selectStage(stage.id)} className={`relative rounded-xl border p-3 text-left transition-all ${active ? 'border-cyan-500/45 bg-cyan-500/10' : hasCause ? 'border-space-700/55 bg-space-950/35 hover:border-cyan-500/25' : 'cursor-not-allowed border-space-800/60 bg-space-950/20 opacity-45'}`}>
                    <div className="flex items-center justify-between"><Icon size={16} className={active ? 'text-cyan-300' : hasCause ? 'text-space-400' : 'text-space-700'} /><span className="font-mono text-[9px] text-space-700">0{index + 1}</span></div><div className={`mt-2 text-xs font-medium ${active ? 'text-cyan-200' : 'text-space-400'}`}>{stage.label}</div>{hasCause && <span className="absolute bottom-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-cyan-400/70" />}
                  </button>
                );
              })}
            </div>
          </section>

          <div className="diagnosis-evidence-workspace">
            <section className="space-y-3 rounded-2xl border border-space-700/50 bg-space-900/55 p-4">
              <div><h2 className="flex items-center gap-2 text-base font-semibold text-space-100"><Search size={17} className="text-violet-400" />选择观察项</h2></div>
              {scenario.evidence.map((evidence) => {
                const active = selectedEvidence.includes(evidence.id);
                return (
                   <button key={evidence.id} type="button" aria-pressed={active} onClick={() => toggleEvidence(evidence.id)} className={`w-full rounded-xl border p-3 text-left transition-all ${active ? 'border-violet-500/40 bg-violet-500/10' : 'border-space-700/45 bg-space-950/30 hover:border-space-600'}`}>
                    <div className="flex items-start gap-2.5"><span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${active ? 'border-violet-400 bg-violet-400 text-space-950' : 'border-space-600'}`}>{active && <CheckCircle2 size={11} />}</span><span className={`min-w-0 flex-1 text-xs font-medium ${active ? 'text-violet-200' : 'text-space-300'}`}>{evidence.label}</span></div>
                  </button>
                );
              })}
              <div className="rounded-xl border border-space-700/45 bg-space-950/35 p-3 text-xs text-space-500">已选择 <span className="font-mono font-bold text-violet-300">{selectedEvidence.length}</span> 项观察。</div>
            </section>

            <section className="space-y-3">
              <div className="flex items-end justify-between"><h2 className="text-base font-semibold text-space-100">可能原因</h2><Badge variant="slate">{visibleCauses.length} 项</Badge></div>
              <div className="grid gap-3 md:grid-cols-2">
                {visibleCauses.map((cause) => {
                  const active = selectedCause.id === cause.id;
                  const priority = priorityLabel(cause, selectedEvidence.length > 0);
                  const stage = STAGES.find(item => item.id === cause.stage);
                  return (
                     <button key={cause.id} type="button" aria-pressed={active} onClick={() => setCauseId(cause.id)} className={`rounded-xl border p-4 text-left transition-all ${active ? 'border-cyan-500/45 bg-cyan-500/[0.08] shadow-[0_0_20px_rgba(34,211,238,0.08)]' : 'border-space-700/50 bg-space-900/50 hover:border-space-600'}`}>
                      <div className="flex items-center justify-between gap-2"><Badge variant={priority.variant}>{priority.label}</Badge><span className="text-[10px] text-space-600">{stage?.label}</span></div>
                      <h3 className="mt-3 text-sm font-semibold text-space-200">{cause.title}</h3>
                      <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-space-500">{cause.reason}</p>
                      <div className="mt-3 flex items-center justify-between gap-2 text-[11px]"><span className="text-space-600">匹配 {cause.matched.length} · 冲突 {cause.contradicted.length}</span><ChevronRight size={13} className={active ? 'text-cyan-300' : 'text-space-600'} /></div>
                    </button>
                  );
                })}
              </div>
              {visibleCauses.length === 0 && <div className="rounded-xl border border-space-700/50 bg-space-900/40 p-6 text-center text-sm text-space-500">当前阶段没有匹配原因。</div>}
            </section>
          </div>

          <section className="overflow-hidden rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-space-900/80 to-space-950/65">
            <div className="border-b border-space-700/50 p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between"><div><div className="flex flex-wrap items-center gap-2"><Badge variant="cyan">当前原因</Badge><Badge variant={priorityLabel(selectedCause, selectedEvidence.length > 0).variant}>{priorityLabel(selectedCause, selectedEvidence.length > 0).label}</Badge></div><h2 className="mt-3 text-xl font-bold text-space-100">{selectedCause.title}</h2><p className="mt-2 max-w-4xl text-sm leading-relaxed text-space-400">{selectedCause.reason}</p></div><button type="button" onClick={() => navigate('/panorama', { state: { moduleId: selectedCause.panoramaId } })} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-300 transition hover:bg-cyan-500/20">打开“{selectedCause.linkLabel}” <ArrowUpRight size={14} /></button></div>
            </div>

            <div className="diagnosis-reasoning-grid">
              <div className="diagnosis-reasoning-panel is-support"><div className="flex items-center gap-2 text-sm font-semibold text-space-200"><CheckCircle2 size={16} className="text-violet-400" />相关观察</div>{selectedCause.matched.length > 0 ? <ul className="mt-3 space-y-2">{selectedCause.matched.map(signal => { const item = scenario.evidence.find(evidence => evidence.id === signal); return <li key={signal} className="flex gap-2 text-xs leading-relaxed text-space-400"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400" /><span>{item?.label}</span></li>; })}</ul> : <p className="mt-3 text-xs leading-relaxed text-space-500">暂无相关观察。</p>}</div>
              <div className="diagnosis-reasoning-panel is-missing"><div className="flex items-center gap-2 text-sm font-semibold text-space-200"><ShieldAlert size={16} className="text-amber-400" />待确认</div>{selectedCause.missingDirect.length > 0 ? <div className="mt-3"><div className="text-[11px] font-semibold text-space-500">建议补充</div><ul className="mt-2 space-y-2">{selectedCause.missingDirect.map(signal => { const item = scenario.evidence.find(evidence => evidence.id === signal); return <li key={signal} className="flex gap-2 text-xs leading-relaxed text-space-400"><MinusCircle size={13} className="mt-0.5 shrink-0 text-amber-400" />{item?.label}</li>; })}</ul></div> : <p className="mt-3 text-xs leading-relaxed text-space-500">关键观察已覆盖。</p>}{selectedCause.contradicted.length > 0 && <div className="mt-4 border-t border-space-700/40 pt-3"><div className="text-[11px] font-semibold text-rose-400">冲突项</div><ul className="mt-2 space-y-2">{selectedCause.contradicted.map(signal => { const item = scenario.evidence.find(evidence => evidence.id === signal); return <li key={signal} className="text-xs leading-relaxed text-space-400">{item?.label}</li>; })}</ul></div>}<div className="mt-4 border-t border-space-700/40 pt-3"><div className="text-[11px] font-semibold text-space-500">排除条件</div><ul className="mt-2 space-y-2">{selectedCause.weakens.map(item => <li key={item} className="text-xs leading-relaxed text-space-400">{item}</li>)}</ul></div></div>
              <div className="diagnosis-reasoning-panel is-verify"><div className="flex items-center gap-2 text-sm font-semibold text-space-200"><ListChecks size={16} className="text-cyan-400" />检查步骤</div><ol className="mt-3 space-y-2.5">{selectedCause.verify.map((step, index) => <li key={step} className="flex gap-2.5 text-xs leading-relaxed text-space-400"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-cyan-500/25 bg-cyan-500/10 font-mono text-[10px] text-cyan-300">{index + 1}</span>{step}</li>)}</ol></div>
              <div className="diagnosis-reasoning-panel is-direction"><div className="flex items-center gap-2 text-sm font-semibold text-space-200"><ArrowRight size={16} className="text-emerald-400" />处理方向</div><ul className="mt-3 space-y-2.5">{selectedCause.direction.map(step => <li key={step} className="flex gap-2.5 text-xs leading-relaxed text-space-400"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />{step}</li>)}</ul></div>
            </div>

            <div className="flex flex-wrap justify-end gap-2 border-t border-space-700/50 bg-space-900/55 p-4">
              <button type="button" onClick={handleCopySummary} className="inline-flex items-center gap-1.5 rounded-lg border border-space-700/60 bg-space-950/35 px-3 py-2 text-xs text-space-300 transition hover:border-cyan-500/30 hover:text-cyan-300">{copied ? <CheckCircle2 size={13} /> : <Copy size={13} />}{copied ? '已复制' : '复制诊断摘要'}</button><button type="button" onClick={() => navigate('/pipeline')} className="rounded-lg border border-space-700/60 bg-space-950/35 px-3 py-2 text-xs text-space-300 transition hover:border-violet-500/30 hover:text-violet-300">查看推理流水线</button>{selectedCause.labTab && <button type="button" onClick={() => navigate('/lab', { state: { tab: selectedCause.labTab } })} className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">进入参数实验室</button>}{selectedCause.compareTab && <button type="button" onClick={() => navigate('/compare', { state: { tab: selectedCause.compareTab } })} className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">进入方案对比台</button>}
            </div>
          </section>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
