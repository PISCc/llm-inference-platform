import { Search } from 'lucide-react';
import ComingSoon from '../components/ComingSoon.jsx';

export default function Detective() {
  return (
    <ComingSoon
      title="推理侦探"
      desc="从症状出发，点击定位推理链路瓶颈，获得因果链解释，并跳转到对应知识模块。"
      icon={Search}
      highlights={[
        { title: '症状输入', desc: '首字慢、生成卡、OOM 等常见现象', accent: 'cyan' },
        { title: '链路诊断', desc: '从请求入口到 GPU 执行逐层排查', accent: 'violet' },
        { title: '因果链解释', desc: '每个诊断结果附带原因与优化建议', accent: 'emerald' },
      ]}
      todo={['5 个以上诊断场景', '症状-原因-方案映射', '跳转到知识模块']}
    />
  );
}
