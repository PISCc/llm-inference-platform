import { ArrowRight, Calculator, Database, HardDrive, MemoryStick, Server } from 'lucide-react';
import HardwareCalculator from '../components/HardwareCalculator.jsx';

export default function HardwareCalculatorPage() {
  return <div className="wb-page hardware-calculator-page">
    <header className="workbench-page-head hardware-page-head">
      <div>
        <div className="workbench-page-head__eyebrow"><span className="workbench-page-head__rule" />CAPACITY PLANNING / HARDWARE SIZING</div>
        <h1>硬件容量计算器</h1>
        <p>把模型权重、缓存、智能体、图片和持久化空间放到同一张资源账本里，再从 GB10、T5000、RTX6000D 中反推可行的硬件搭配。</p>
      </div>
      <div className="hardware-page-head__status"><span><i />LIVE CALCULATION</span><small>按当前输入实时更新</small></div>
    </header>
    <div className="hardware-page-route-strip"><span><Calculator size={14} />容量规划模块</span><ArrowRight size={13} /><span>输入负载</span><ArrowRight size={13} /><span>计算余量</span><ArrowRight size={13} /><span>输出硬件</span><em>设备由系统自动推荐</em></div>
    <div className="hardware-page-quickfacts"><div><MemoryStick size={15} /><span><b>显存 / 统一内存</b>权重、Cache、KV Cache</span></div><div><HardDrive size={15} /><span><b>建议存储</b>默认按 70% 使用率</span></div><div><Server size={15} /><span><b>硬件范围</b>GB10 / T5000 / RTX6000D</span></div><div><Database size={15} /><span><b>现实约束</b>保留运行时和文件系统空间</span></div></div>
    <HardwareCalculator />
  </div>;
}
