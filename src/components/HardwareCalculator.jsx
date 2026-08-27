import { useMemo, useState } from 'react';
import { Calculator, HardDrive, Image, Layers3, MemoryStick, RefreshCcw, Server, ShieldCheck, TriangleAlert } from 'lucide-react';
import { BIG_MODEL_PRESETS, DEFAULT_CALCULATOR_INPUTS, SMALL_MODEL_PRESETS, calculateHardwarePlan } from '../data/hardwareCalculator.js';
import { usePageContextRegistration } from '../context/PageContext.jsx';

const numberFields = new Set(['bigModelWeightGB', 'smallModelCount', 'smallModelBudgetGB', 'agentCount', 'agentBudgetGB', 'cacheGB', 'kvCacheGB', 'peakLoadFactor', 'runtimeReservePercent', 'imageCountPerDay', 'imageRetentionDays', 'imageSizeMB', 'imageOverheadPercent', 'systemStorageGB', 'modelStagingMultiplier', 'storageUsageTargetPercent']);
const formatGB = (value) => `${Number(value || 0).toFixed(2).replace(/\.00$/, '')} GB`;
const formatTB = (value) => `${Number(value || 0).toFixed(2).replace(/\.00$/, '')} TB`;
const clampPercent = (value, total) => total > 0 ? Math.min(100, Math.max(2, value / total * 100)) : 2;

function Field({ label, hint, children }) {
  return <label className="hardware-field"><span className="hardware-field__label">{label}</span>{children}{hint && <small className="hardware-field__hint">{hint}</small>}</label>;
}

function Metric({ icon: Icon, label, value, note, tone = 'cyan' }) {
  return <div className={`hardware-metric is-${tone}`}><div className="hardware-metric__top"><span className="hardware-metric__icon"><Icon size={14} /></span><span>{label}</span></div><strong>{value}</strong><small>{note}</small></div>;
}

function LedgerRow({ label, value, percent, tone }) {
  return <div className="hardware-ledger-row"><div className="hardware-ledger-row__meta"><span>{label}</span><b>{formatGB(value)}</b></div><div className="hardware-ledger-row__track"><i className={`is-${tone}`} style={{ width: `${percent}%` }} /></div></div>;
}

export default function HardwareCalculator() {
  const [inputs, setInputs] = useState(DEFAULT_CALCULATOR_INPUTS);
  const plan = useMemo(() => calculateHardwarePlan(inputs), [inputs]);
  const selectedBigModel = BIG_MODEL_PRESETS.find((item) => item.id === inputs.bigModelId) || BIG_MODEL_PRESETS[0];
  const recommendedCount = plan.recommendedHardware.length;
  const pageContext = useMemo(() => ({
    pageId: 'hardware-calculator', pageTitle: '硬件容量计算器', pageType: 'hardware-sizing', activeSection: 'calculator',
    selection: { bigModel: selectedBigModel.name, smallModel: inputs.smallModelId, recommendedCount }, parameters: inputs,
    result: { memoryRequiredGB: plan.memoryRequiredGB, storageRecommendedGB: plan.storageRecommendedGB, hardwareRecommendations: plan.hardwareRecommendations.map((item) => item.label) },
    visibleSummary: `当前工作负载需要 ${formatGB(plan.memoryRequiredGB)} 显存/统一内存，并建议准备 ${formatTB(plan.storageRecommendedGB / 1000)} 存储。`,
    suggestedQuestions: ['为什么这个方案需要多台设备？', 'KV Cache 增大时应该优先调整什么？', '边界搭配和推荐搭配有什么区别？'],
    boundaries: ['硬件推荐按 10% 设备余量筛选；异构组合需要模型并行或角色分工，不能默认合并为统一内存池。'],
  }), [inputs, plan, recommendedCount, selectedBigModel.name]);
  usePageContextRegistration('hardware-calculator-page', pageContext);

  function updateField(field, value) { setInputs((current) => ({ ...current, [field]: numberFields.has(field) ? value : value })); }
  function updateBigModel(value) { const preset = BIG_MODEL_PRESETS.find((item) => item.id === value) || BIG_MODEL_PRESETS[0]; setInputs((current) => ({ ...current, bigModelId: value, bigModelWeightGB: preset.weightGB })); }
  function updateSmallModel(value) { setInputs((current) => ({ ...current, smallModelId: value, smallModelCount: value === 'none' ? 0 : Math.max(1, Number(current.smallModelCount) || 0) })); }

  return <section className="hardware-calculator-module" aria-labelledby="hardware-calculator-title">
    <div className="hardware-calculator-module__head"><div><div className="hardware-module-kicker"><Calculator size={14} /> CAPACITY PLANNING / LIVE CALCULATION</div><h2 id="hardware-calculator-title">把工作负载翻译成可运行的硬件方案</h2><p>大模型按权重估算，小模型、智能体、缓存与图片归入同一张资源账本；结果会主动留下运行空间，不把设备容量算到满载。</p></div><button type="button" className="hardware-reset-button" onClick={() => setInputs(DEFAULT_CALCULATOR_INPUTS)}><RefreshCcw size={13} />恢复默认值</button></div>

    <div className="hardware-calculator-module__grid">
      <div className="hardware-calculator-panel hardware-input-panel">
        <div className="hardware-panel-heading"><div><span className="hardware-panel-index">01</span><div><b>输入工作负载</b><small>Model / Runtime / Storage</small></div></div><span className="hardware-panel-state">可编辑</span></div>
        <div className="hardware-input-section"><div className="hardware-section-label"><MemoryStick size={14} /><span>模型与运行时</span><em>显存 / 统一内存</em></div><div className="hardware-fields-grid">
          <Field label="大模型"><select value={inputs.bigModelId} onChange={(event) => updateBigModel(event.target.value)}>{BIG_MODEL_PRESETS.map((model) => <option value={model.id} key={model.id}>{model.name}</option>)}</select></Field>
          <Field label="大模型权重（GB）" hint="随预设自动带入，也可手动覆盖"><input type="number" min="0" step="0.1" value={inputs.bigModelWeightGB} onChange={(event) => updateField('bigModelWeightGB', event.target.value)} /></Field>
          <div className="hardware-model-note"><span>当前估算</span><b>{selectedBigModel.weightGB} GB</b><small>{selectedBigModel.note}</small></div>
          <Field label="小模型"><select value={inputs.smallModelId} onChange={(event) => updateSmallModel(event.target.value)}>{SMALL_MODEL_PRESETS.map((model) => <option value={model.id} key={model.id}>{model.name}</option>)}</select></Field>
          <Field label="小模型数量" hint="默认 1 个，可设为 0"><input type="number" min="0" step="1" value={inputs.smallModelCount} onChange={(event) => updateField('smallModelCount', event.target.value)} /></Field>
          <Field label="单个小模型预算（GB）" hint="默认 1 GB，可按实测修改"><input type="number" min="0" step="0.1" value={inputs.smallModelBudgetGB} onChange={(event) => updateField('smallModelBudgetGB', event.target.value)} /></Field>
          <Field label="智能体数量"><input type="number" min="0" step="1" value={inputs.agentCount} onChange={(event) => updateField('agentCount', event.target.value)} /></Field>
          <Field label="单个智能体预算（GB）" hint="默认 20 GB，可按工具与上下文修改"><input type="number" min="0" step="0.1" value={inputs.agentBudgetGB} onChange={(event) => updateField('agentBudgetGB', event.target.value)} /></Field>
          <Field label="服务基础缓存（GB）" hint="框架缓存、Tokenizer 与请求管理空间"><input type="number" min="0" step="0.1" value={inputs.cacheGB} onChange={(event) => updateField('cacheGB', event.target.value)} /></Field>
          <Field label="KV Cache（GB）" hint="建议按峰值并发与最长上下文填写"><input type="number" min="0" step="0.1" value={inputs.kvCacheGB} onChange={(event) => updateField('kvCacheGB', event.target.value)} /></Field>
          <Field label="峰值负载放大系数（×）" hint="默认 1.3×，放大动态缓存与并发部分"><input type="number" min="1" step="0.1" value={inputs.peakLoadFactor} onChange={(event) => updateField('peakLoadFactor', event.target.value)} /></Field>
          <Field label="运行时预留（%）" hint="默认 10%，用于框架、算子和瞬时峰值"><input type="number" min="0" max="100" step="1" value={inputs.runtimeReservePercent} onChange={(event) => updateField('runtimeReservePercent', event.target.value)} /></Field>
        </div></div>
        <div className="hardware-input-section"><div className="hardware-section-label"><Image size={14} /><span>图片与持久化存储</span><em>单张图片默认 0.5 MB</em></div><div className="hardware-fields-grid">
          <Field label="每日图片数量"><input type="number" min="0" step="1" value={inputs.imageCountPerDay} onChange={(event) => updateField('imageCountPerDay', event.target.value)} /></Field>
          <Field label="图片保存天数"><input type="number" min="0" step="1" value={inputs.imageRetentionDays} onChange={(event) => updateField('imageRetentionDays', event.target.value)} /></Field>
          <Field label="单张图片大小（MB）" hint="默认按 0.5 MB 计算"><input type="number" min="0" step="0.1" value={inputs.imageSizeMB} onChange={(event) => updateField('imageSizeMB', event.target.value)} /></Field>
          <Field label="图片附属空间（%）" hint="缩略图、元数据与派生文件，默认 15%"><input type="number" min="0" step="1" value={inputs.imageOverheadPercent} onChange={(event) => updateField('imageOverheadPercent', event.target.value)} /></Field>
          <Field label="系统 / 日志存储（GB）"><input type="number" min="0" step="1" value={inputs.systemStorageGB} onChange={(event) => updateField('systemStorageGB', event.target.value)} /></Field>
          <Field label="模型存储暂存系数（×）" hint="默认 1.5×，覆盖升级/下载时新旧版本共存"><input type="number" min="1" step="0.1" value={inputs.modelStagingMultiplier} onChange={(event) => updateField('modelStagingMultiplier', event.target.value)} /></Field>
          <Field label="存储目标占用率（%）" hint="默认 70%，建议不要超过 80%"><input type="number" min="50" max="90" step="1" value={inputs.storageUsageTargetPercent} onChange={(event) => updateField('storageUsageTargetPercent', event.target.value)} /></Field>
        </div></div>
        <div className="hardware-input-footnote"><ShieldCheck size={14} /><span>设备由计算器自动从 GB10、T5000、RTX6000D 中枚举；峰值系数处理动态负载，运行时预留处理框架和瞬时开销。</span></div>
      </div>

      <div className="hardware-calculator-panel hardware-result-panel" aria-live="polite">
        <div className="hardware-panel-heading"><div><span className="hardware-panel-index">02</span><div><b>容量结果</b><small>Memory / Storage / Fit</small></div></div><span className={`hardware-panel-state ${plan.feasible ? 'is-ok' : 'is-warn'}`}>{plan.feasible ? '可落地' : '需降配'}</span></div>
        <div className="hardware-metrics-grid"><Metric icon={MemoryStick} label="总内存需求" value={formatGB(plan.memoryRequiredGB)} note={`峰值动态 ${formatGB(plan.breakdown.peakDynamicMemoryGB)} + ${plan.breakdown.runtimeReservePercent}% 预留`} tone="cyan" /><Metric icon={HardDrive} label="建议存储" value={formatTB(plan.storageRecommendedGB / 1000)} note={`暂存系数 ${plan.breakdown.modelStagingMultiplier}×，目标占用 ${plan.breakdown.storageUsageTargetPercent}%`} tone="violet" /><Metric icon={Server} label="硬件推荐" value={`${recommendedCount} 组`} note={plan.feasible ? '已按保守可用容量筛选' : '当前组合不足以覆盖'} tone={plan.feasible ? 'emerald' : 'amber'} /></div>
        <div className="hardware-ledger"><div className="hardware-result-section-head"><div><span className="hardware-result-kicker">RESOURCE LEDGER</span><b>显存 / 统一内存拆解</b></div><span>{formatGB(plan.memoryRequiredGB)} required</span></div><div className="hardware-ledger-list">
          <LedgerRow label="大模型权重" value={plan.breakdown.bigModelWeightGB} percent={clampPercent(plan.breakdown.bigModelWeightGB, plan.memoryRequiredGB)} tone="cyan" /><LedgerRow label="小模型" value={plan.breakdown.smallModelMemoryGB} percent={clampPercent(plan.breakdown.smallModelMemoryGB, plan.memoryRequiredGB)} tone="violet" /><LedgerRow label="智能体" value={plan.breakdown.agentMemoryGB} percent={clampPercent(plan.breakdown.agentMemoryGB, plan.memoryRequiredGB)} tone="amber" /><LedgerRow label="缓存 + KV Cache" value={plan.breakdown.cacheGB + plan.breakdown.kvCacheGB} percent={clampPercent(plan.breakdown.cacheGB + plan.breakdown.kvCacheGB, plan.memoryRequiredGB)} tone="emerald" /><LedgerRow label={`运行时预留 ${plan.breakdown.runtimeReservePercent}%`} value={plan.breakdown.runtimeReserveGB} percent={clampPercent(plan.breakdown.runtimeReserveGB, plan.memoryRequiredGB)} tone="slate" />
        </div></div>
        <div className="hardware-breakdown-grid"><div><span>图片原始存储</span><b>{formatGB(plan.breakdown.imageRawStorageGB)}</b><small>{inputs.imageCountPerDay} 张/日 × {inputs.imageRetentionDays} 天</small></div><div><span>图片含附属空间</span><b>{formatGB(plan.breakdown.imageWithOverheadGB)}</b><small>已加 {plan.breakdown.imageOverheadPercent}% 缩略图 / 元数据</small></div><div><span>存储档位</span><b>{plan.hardware.recommendedStorageTB} TB 起</b><small>已按 {plan.breakdown.storageUsageTargetPercent}% 占用率反推</small></div></div>
        <div className="hardware-recommendations"><div className="hardware-result-section-head"><div><span className="hardware-result-kicker">HARDWARE FIT</span><b>自动推荐搭配</b></div><span>10% device headroom</span></div>{plan.hardwareRecommendations.length ? <div className="hardware-option-grid">{plan.hardwareRecommendations.map((option) => <div className={`hardware-option-card is-${option.status}`} key={option.label}><div className="hardware-option-card__head"><strong>{option.label}</strong><span>{option.status === 'recommended' ? '推荐' : '边界'}</span></div><div className="hardware-option-card__stats"><span>保守可用 <b>{formatGB(option.conservativeUsableGB)}</b></span><span>原始容量 <b>{formatGB(option.rawCapacityGB)}</b></span></div><small>{option.reason} · 存储 {option.storageTB}TB 起</small></div>)}</div> : <div className="hardware-empty"><TriangleAlert size={16} /><span>即使枚举 4 台设备也无法覆盖当前需求，请降低权重、缓存或负载预算。</span></div>}<p className="hardware-recommendation-note">推荐项已按设备保留约 10% 后筛选；边界项仅原始容量覆盖，适合进一步压测或明确采用异构分工。RTX6000D 的存储容量可自由选择。</p></div>
      </div>
    </div>
    <div className="hardware-calculator-module__formula"><Layers3 size={14} /><span>计算口径</span><b>内存 = 权重 + 动态资源 × 峰值系数</b><i>×（1 + 运行时预留%）</i><em>存储 =（模型暂存 + 系统日志 + 图片附属）÷ 目标占用率</em></div>
  </section>;
}
