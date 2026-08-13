import { Bot } from 'lucide-react';
import ComingSoon from '../components/ComingSoon.jsx';

export default function Agent() {
  return (
    <ComingSoon
      title="AI 讲解智能体"
      desc="基于知识库的 RAG 问答，用通俗语言解释推理原理，并引导跳转到对应模块。"
      icon={Bot}
      highlights={[
        { title: '知识库检索', desc: '按关键词映射定位相关知识模块', accent: 'cyan' },
        { title: '大模型回答', desc: '结合检索片段生成通俗解释', accent: 'violet' },
        { title: '主题跳转', desc: '回答末尾推荐相关全景图模块', accent: 'emerald' },
      ]}
      todo={['检索路由实现', 'Prompt 模板组装', '对话界面与跳转']}
    />
  );
}
