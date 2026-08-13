import { Scale } from 'lucide-react';
import ComingSoon from '../components/ComingSoon.jsx';

export default function Compare() {
  return (
    <ComingSoon
      title="方案对比台"
      desc="同目标多方案并排可视化，看清 Attention 架构、Dense/MoE、量化精度之间的取舍。"
      icon={Scale}
      highlights={[
        { title: 'Attention 架构', desc: 'MHA / GQA / MLA 的显存与效果对比', accent: 'cyan' },
        { title: 'Dense vs MoE', desc: '同样参数量下，激活参数与推理成本差异', accent: 'violet' },
        { title: '量化精度', desc: 'FP16 / INT8 / INT4 的精度与速度权衡', accent: 'emerald' },
      ]}
      todo={['3 组对比图表', '并排指标展示', '可切换的参数面板']}
    />
  );
}
