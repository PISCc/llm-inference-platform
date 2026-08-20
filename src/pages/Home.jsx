import { Link } from 'react-router-dom';
import { ArrowUpRight, Bot, Clock3, Cpu, FlaskConical, Network, Scale, ScanSearch } from 'lucide-react';
import panoramaData from '../data/panorama.json';
import './HomeWarm.css';

const MODULE_COUNT = panoramaData.modules.length;

const MODULES = [
  { to: '/panorama', title: '互动全景图', desc: `检索并查看大模型推理架构、模型结构与硬件系统的 ${MODULE_COUNT} 个核心技术模块。`, icon: Network, tone: 'blue', tags: [`${MODULE_COUNT} 模块`, '知识检索', '详情联动'] },
  { to: '/pipeline', title: '推理流水线模拟器', desc: '输入一句话，逐步观察分词、Prefill、KV Cache 与 Decode 的完整推理数据流。', icon: Cpu, tone: 'violet', tags: ['Token', 'Prefill', 'Decode'] },
  { to: '/lab', title: '参数实验室', desc: '调整模型与部署参数，复算 KV Cache、权重容量和注意力结构。', icon: FlaskConical, tone: 'green', tags: ['可复算', '参数联动', '容量公式'] },
  { to: '/compare', title: '技术方案对比台', desc: '比较调度与组批、Dense / MoE 和权重量化方案。', icon: Scale, tone: 'amber', tags: ['3 类决策', '并排比较', '跨模块'] },
  { to: '/diagnosis', title: '推理链路诊断台', desc: '从 TTFT、TPOT、OOM 和吞吐现象定位问题。', icon: ScanSearch, tone: 'rose', tags: ['5 类场景', '链路定位', '原因排查'] },
  { to: '/agent', title: 'AI 技术问答', desc: '基于本地知识库检索推理技术概念，并把回答连接到相关互动模块。', icon: Bot, tone: 'indigo', tags: ['12 个预设', '本地检索', '模块跳转'] },
];

const PIPELINE = [
  ['Tokenize', '文本转换为 Token 与 TokenID', 'Input'],
  ['Prefill', '并行处理输入序列并建立注意力状态', 'Compute'],
  ['KV Cache', '保存历史 K、V 供后续步骤复用', 'Memory'],
  ['Decode', '逐 Token 生成并持续更新缓存', 'Output'],
];

export default function Home() {
  return (
    <div className="warm-home">
      <section className="warm-hero" aria-labelledby="home-title">
        <div className="warm-hero__copy">
          <p className="warm-eyebrow">大模型推理互动展示平台</p>
          <h1 id="home-title">看清一次推理，理解完整系统。</h1>
          <p className="warm-hero__lead">把请求调度、Token 处理、模型计算、KV Cache、方案取舍和链路诊断组织在同一套清晰的技术界面中。</p>
          <div className="warm-capabilities" aria-label="平台能力">
            {['知识全景', '过程模拟', '参数实验', '方案对比', '链路诊断', '技术问答'].map((item) => <span key={item}>{item}</span>)}
          </div>
          <dl className="warm-facts">
            <div><dt>{MODULE_COUNT}</dt><dd>核心技术模块</dd></div>
            <div><dt>6</dt><dd>互动产品模块</dd></div>
            <div><dt>离线</dt><dd>单文件可打开</dd></div>
          </dl>
        </div>

        <aside className="warm-process" aria-label="一次请求的推理过程">
          <header className="warm-process__head">
            <span className="warm-process__icon"><Cpu size={17} /></span>
            <span className="warm-process__title"><strong>一次请求的推理过程</strong><small>从输入文本到逐 Token 输出</small></span>
            <span className="warm-process__status">链路就绪</span>
          </header>
          <div className="warm-prompt"><span>INPUT</span><p>为什么 KV Cache 能减少 Decode 阶段的重复计算？</p></div>
          <ol className="warm-pipeline">
            {PIPELINE.map(([title, description, label], index) => (
              <li key={title}>
                <span className="warm-step__index">{String(index + 1).padStart(2, '0')}</span>
                <span className="warm-step__copy"><strong>{title}</strong><small>{description}</small></span>
                <span className="warm-step__label">{label}</span>
              </li>
            ))}
          </ol>
          <footer className="warm-process__foot"><Clock3 size={15} /><span>每个阶段都可进入对应模块继续观察或实验。</span></footer>
        </aside>
      </section>

      <section className="warm-modules" aria-labelledby="modules-title">
        <header className="warm-section-head">
          <h2 id="modules-title">六种方式，进入推理系统。</h2>
          <p>从整体知识结构进入，再观察执行过程、调整参数、比较技术方案、定位问题，或从一个具体问题开始。</p>
        </header>
        <div className="warm-module-grid">
          {MODULES.map((module, index) => {
            const Icon = module.icon;
            return (
              <Link key={module.to} to={module.to} className={`warm-module-card warm-module-card--${module.tone}`}>
                <div className="warm-module-card__top">
                  <span className="warm-module-card__icon"><Icon size={21} /></span>
                  <span className="warm-module-card__index">{String(index + 1).padStart(2, '0')} / 06</span>
                </div>
                <h3>{module.title}</h3>
                <p>{module.desc}</p>
                <div className="warm-module-card__bottom">
                  <span className="warm-module-card__tags">{module.tags.map((tag) => <span key={tag}>{tag}</span>)}</span>
                  <ArrowUpRight size={16} aria-hidden="true" />
                </div>
              </Link>
            );
          })}
        </div>
        <div className="warm-scope">
          <strong>平台覆盖范围</strong>
          <p>请求调度、Token 与模型结构、Prefill / Decode、KV Cache 与缓存优化、Attention 与 MoE、模型压缩、多卡并行、硬件与性能分析。</p>
        </div>
      </section>
    </div>
  );
}
