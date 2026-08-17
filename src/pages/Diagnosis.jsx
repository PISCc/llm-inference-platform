import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  ScanSearch, Timer, Activity, MemoryStick, Gauge, ServerCog, ArrowRight,
  ArrowUpRight, CheckCircle2, AlertTriangle, CircleGauge, Copy, Workflow, Database,
  Network, ListChecks, Info, ChevronRight, RotateCcw, Search
} from 'lucide-react';
import Badge from '../components/Badge.jsx';
import ProductHeader from '../components/ProductHeader.jsx';
import knowledgeData from '../data/knowledge.json';

const STAGES = [
  { id: 'entry', label: '请求入口', icon: Workflow },
  { id: 'queue', label: '排队调度', icon: ListChecks },
  { id: 'startup', label: '加载与预热', icon: ServerCog },
  { id: 'prefill', label: 'Prefill', icon: Database },
  { id: 'cache', label: 'KV Cache', icon: MemoryStick },
  { id: 'decode', label: 'Decode', icon: Activity },
  { id: 'communication', label: '通信与硬件', icon: Network },
];

const SCENARIOS = [
  {
    id: 'ttft',
    title: '首个 Token 返回慢',
    short: 'TTFT 高',
    icon: Timer,
    accent: 'cyan',
    metric: 'Time To First Token',
    symptom: '请求提交后长时间没有收到第一个输出 Token，需要先区分排队等待、模型准备和 Prefill 计算。',
    evidence: [
      { id: 'queue_wait', label: '队列等待时间明显升高', hint: '进入模型执行前已耗时较长' },
      { id: 'long_prompt', label: '输入 Token 数明显增加', hint: 'Prefill 计算规模随输入增长' },
      { id: 'prefix_miss', label: '重复前缀请求未命中缓存', hint: '相同前缀仍完整执行 Prefill' },
      { id: 'cold_only', label: '只在首次或扩容后请求变慢', hint: '可能涉及加载、编译或预热' },
      { id: 'multi_gpu_wait', label: '多卡同步等待时间升高', hint: 'Prefill 阶段可能被通信拖慢' },
    ],
    causes: [
      {
        id: 'ttft-queue', stage: 'queue', title: '排队或组批等待过长', signals: ['queue_wait'],
        reason: '请求尚未进入模型执行，调度器可能在等待资源、批次或准入条件。',
        verify: ['拆分端到端 TTFT，单独查看 queue time 与 prefill time。', '检查并发、队列深度、Batch 形成时间和请求优先级。', '在固定输入长度下对比低并发与高并发的排队变化。'],
        direction: ['调整准入上限与调度策略。', '缩短组批等待窗口，检查 Continuous Batching 是否有效补位。', '对不同优先级或请求长度实施隔离。'],
        panoramaId: 'scheduler', knowledgeId: 'scheduler', linkLabel: '请求调度策略',
      },
      {
        id: 'ttft-prefill', stage: 'prefill', title: '输入过长使 Prefill 计算增加', signals: ['long_prompt', 'multi_gpu_wait'],
        reason: 'Prefill 会并行处理整段输入，输入 Token 增加会扩大 Attention 与 FFN 的计算量。',
        verify: ['按输入 Token 数分桶比较 Prefill 时间。', '固定并发和输出长度，只改变输入长度做对照。', '观察 Prefill 阶段 GPU 计算与多卡通信时间。'],
        direction: ['限制或分级管理超长输入。', '评估 Chunked Prefill，避免长 Prefill 长时间独占执行。', '结合目标形状检查 Attention 算子和并行配置。'],
        panoramaId: 'prefill_decode', knowledgeId: 'prefill-与-decode', linkLabel: 'Prefill 与 Decode',
      },
      {
        id: 'ttft-prefix', stage: 'cache', title: '可复用前缀没有命中 Prefix Cache', signals: ['prefix_miss'],
        reason: '重复系统提示词或固定模板未复用已有 KV 块，导致请求重新执行相同 Prefill。',
        verify: ['统计 Prefix Cache 命中率和可复用前缀长度。', '确认 Token 序列、模板版本和缓存键是否完全一致。', '对比命中与未命中请求的 Prefill 时间。'],
        direction: ['统一稳定前缀的模板和 Token 序列。', '检查缓存容量、淘汰策略与租户隔离规则。', '只在确定前缀一致时复用，避免错误命中。'],
        panoramaId: 'prefix', knowledgeId: 'prefix-cache', linkLabel: '前缀缓存复用',
      },
      {
        id: 'ttft-cold', stage: 'startup', title: '模型仍在加载、编译或预热', signals: ['cold_only'],
        reason: '首次请求或新实例可能需要权重就绪、推理引擎初始化、图捕获或内核预热。',
        verify: ['对比冷启动首请求与预热后请求的 TTFT。', '拆分权重加载、引擎初始化、图编译和首轮执行时间。', '确认扩容实例是否在接收流量前完成健康检查和预热。'],
        direction: ['在接流量前执行明确的预热流程。', '缓存编译产物并减少运行时格式转换。', '将模型加载状态纳入实例就绪判断。'],
        panoramaId: 'cudagraph', knowledgeId: 'cuda-graph', linkLabel: 'CUDA 计算图加速',
      },
      {
        id: 'ttft-comm', stage: 'communication', title: '多卡通信阻塞 Prefill', signals: ['multi_gpu_wait'],
        reason: '张量并行等方案需要跨卡同步，拓扑或通信等待可能延长 Prefill。',
        verify: ['用性能跟踪区分计算时间和集体通信时间。', '核对进程与 GPU 的拓扑绑定。', '对比单卡或较小并行规模下的阶段时间。'],
        direction: ['优化 GPU 拓扑映射与通信库配置。', '避免并行度超过容量所需而放大通信。', '结合模型形状重新评估 TP、PP 等并行方式。'],
        panoramaId: 'topo', knowledgeId: '拓扑与网络', linkLabel: '系统互连架构',
      },
    ],
  },
  {
    id: 'tpot',
    title: '开始生成后速度慢',
    short: 'Decode / TPOT 高',
    icon: Activity,
    accent: 'violet',
    metric: 'Time Per Output Token',
    symptom: '第一个 Token 已返回，但后续 Token 间隔较长，需要重点检查 Decode、KV Cache、显存带宽、Batch 与通信。',
    evidence: [
      { id: 'context_grows', label: '上下文越长，单 Token 时间越高', hint: 'KV Cache 读取量随上下文增长' },
      { id: 'bandwidth_busy', label: 'HBM 带宽接近瓶颈', hint: 'Decode 常呈带宽密集特征' },
      { id: 'batch_sensitive', label: 'Batch 增大后单请求 TPOT 恶化', hint: '并发与延迟存在取舍' },
      { id: 'kernel_gaps', label: 'GPU 时间线存在大量小间隙', hint: 'Kernel 启动或调度间隙' },
      { id: 'decode_comm', label: '多卡通信占比明显升高', hint: '每步 Decode 都可能同步' },
    ],
    causes: [
      {
        id: 'tpot-kv', stage: 'cache', title: '长上下文增加 KV Cache 读取压力', signals: ['context_grows', 'bandwidth_busy'],
        reason: 'Decode 每生成一个 Token 都需要访问历史 K、V；上下文增长会增加缓存读取与显存带宽压力。',
        verify: ['按当前上下文长度分桶观察 TPOT。', '同时记录 KV Cache 容量、HBM 带宽和 Decode 时间。', '固定 Batch，比较短上下文与长上下文。'],
        direction: ['评估 GQA、MQA、MLA 等缓存结构是否与目标模型匹配。', '控制无效历史长度，优化缓存布局或分页管理。', '在参数实验室复算目标配置的 KV Cache 容量。'],
        panoramaId: 'kv', knowledgeId: 'kv-cache', linkLabel: '键值缓存机制', labTab: 'kv',
      },
      {
        id: 'tpot-batch', stage: 'decode', title: 'Decode Batch 与延迟目标不匹配', signals: ['batch_sensitive'],
        reason: '更大的 Batch 可能提高总体吞吐，但会增加单请求等待和显存压力。',
        verify: ['在固定输入输出长度下扫描 Batch 和并发。', '同时记录 TPOT、吞吐、GPU 利用率与队列时间。', '检查长短请求是否被放在同一调度队列。'],
        direction: ['按服务等级设置 Batch 上限和等待窗口。', '使用 Continuous Batching 动态补位。', '为延迟敏感与吞吐优先流量设置不同策略。'],
        panoramaId: 'cb', knowledgeId: 'batching-与-continuous-batching', linkLabel: '动态连续批处理',
      },
      {
        id: 'tpot-kernel', stage: 'decode', title: '小算子或重复提交造成执行间隙', signals: ['kernel_gaps'],
        reason: 'Decode 每步工作量较小，Kernel 启动、Python/CPU 调度或未融合算子可能占据较高比例。',
        verify: ['检查 GPU 时间线中的 Kernel 数量、间隔与持续时间。', '区分 CPU 提交等待和 GPU 实际计算。', '对比图捕获、算子融合前后的阶段时间。'],
        direction: ['评估 CUDA Graph 与算子融合。', '减少每 Token 路径中的同步和 CPU 往返。', '确保优化实现支持当前形状与精度。'],
        panoramaId: 'kernel', knowledgeId: 'kernel-与-gemm', linkLabel: 'GPU 算子融合与定制',
      },
      {
        id: 'tpot-comm', stage: 'communication', title: '逐 Token 多卡同步开销偏高', signals: ['decode_comm'],
        reason: 'Decode 每一步都可能触发跨卡集体通信，通信延迟会直接进入每 Token 路径。',
        verify: ['跟踪每个 Decode step 的通信算子时间。', '检查 NVLink、PCIe 或网络拓扑是否符合部署预期。', '比较不同并行规模下的 TPOT。'],
        direction: ['只使用容量和目标延迟确实需要的并行度。', '优化进程绑定、通信拓扑和通信库参数。', '评估是否需要调整 TP、PP 或专家并行组合。'],
        panoramaId: 'nvlink', knowledgeId: 'nvlink-与-pcie', linkLabel: 'NVLink 高速互联',
      },
    ],
  },
  {
    id: 'oom',
    title: '显存不足或运行中 OOM',
    short: '显存 OOM',
    icon: MemoryStick,
    accent: 'amber',
    metric: 'Weight + KV Cache + Runtime Memory',
    symptom: '模型无法加载，或请求运行一段时间后显存溢出，需要拆分权重、KV Cache、临时张量、工作区和碎片。',
    evidence: [
      { id: 'load_oom', label: '模型加载阶段就 OOM', hint: '优先检查权重和运行时初始化空间' },
      { id: 'long_context_oom', label: '长上下文或长输出时才 OOM', hint: 'KV Cache 会随 Token 数增长' },
      { id: 'concurrency_oom', label: '提高并发后 OOM', hint: '多个请求同时占用缓存和工作区' },
      { id: 'reserved_gap', label: '保留显存明显高于实际张量', hint: '可能存在碎片或分配器保留' },
      { id: 'moe_weight', label: 'MoE 总权重无法放入现有设备', hint: '总参数和激活参数是不同维度' },
    ],
    causes: [
      {
        id: 'oom-weight', stage: 'startup', title: '权重载荷超过可用显存', signals: ['load_oom', 'moe_weight'],
        reason: '模型权重必须先被设备或分片承载；MoE 即使单 Token 只激活部分专家，总权重仍需要存储。',
        verify: ['按参数量和权重精度计算纯权重容量下界。', '确认量化元数据、临时转换和加载峰值。', '检查各并行分片是否均衡以及是否存在重复权重。'],
        direction: ['采用有验证依据的量化或权重分片。', '调整 TP、PP、EP 等并行布局。', '为加载峰值和运行时空间保留余量。'],
        panoramaId: 'vram', knowledgeId: '显存与带宽', linkLabel: 'HBM 显存容量', compareTab: 'quant',
      },
      {
        id: 'oom-kv', stage: 'cache', title: 'KV Cache 随上下文和并发增长', signals: ['long_context_oom', 'concurrency_oom'],
        reason: 'KV Cache 容量与层数、KV 头、Head 维度、序列长度、Batch 和缓存精度相关。',
        verify: ['根据当前模型配置复算单请求 KV Cache。', '记录活动请求数、上下文长度分布与缓存块占用。', '区分 Prefill 峰值和持续 Decode 增长。'],
        direction: ['限制上下文或并发上限。', '评估 PagedAttention、缓存卸载或更低 KV 头结构。', '在参数实验室检查具体容量。'],
        panoramaId: 'kv', knowledgeId: 'kv-cache', linkLabel: '键值缓存机制', labTab: 'kv',
      },
      {
        id: 'oom-fragment', stage: 'cache', title: '显存碎片或缓存块管理低效', signals: ['reserved_gap', 'concurrency_oom'],
        reason: '频繁增长和释放不同长度请求可能产生内部或外部碎片，使保留显存无法有效承载新请求。',
        verify: ['比较 allocated、reserved 与可用显存。', '检查缓存 Block 利用率、请求长度分布和回收时机。', '在固定总 Token 下比较不同请求长度组合。'],
        direction: ['采用分页式缓存和固定块管理。', '调整 Block 大小与回收策略。', '减少异常长请求对共享缓存池的冲击。'],
        panoramaId: 'paged', knowledgeId: 'pagedattention', linkLabel: '分页式注意力缓存',
      },
      {
        id: 'oom-runtime', stage: 'communication', title: '运行时工作区和临时张量未预留', signals: ['load_oom', 'concurrency_oom'],
        reason: '纯权重与 KV Cache 之外，算子、通信、图捕获和框架还会申请工作区与临时张量。',
        verify: ['分阶段记录加载后、预热后和峰值执行显存。', '检查通信缓冲区与算子 workspace。', '关闭单项优化做对照，确认额外空间来自何处。'],
        direction: ['不要把显存容量全部分配给权重和 KV Cache。', '按目标形状预热并记录峰值。', '为运行时、通信和碎片设置安全余量。'],
        panoramaId: 'mm', knowledgeId: 'memory-manager', linkLabel: '显存分配管理器',
      },
    ],
  },
  {
    id: 'throughput',
    title: '单位时间处理量不足',
    short: '吞吐不足',
    icon: Gauge,
    accent: 'emerald',
    metric: 'Tokens / Requests per Second',
    symptom: '整体请求或 Token 处理量低于目标，需要同时观察请求供给、Batch、GPU 利用率、调度间隙和通信。',
    evidence: [
      { id: 'gpu_low', label: 'GPU 利用率持续偏低', hint: '设备可能在等待或没有足够工作' },
      { id: 'small_batch', label: '实际 Batch 长期偏小', hint: '请求没有形成有效并行' },
      { id: 'queue_empty', label: '队列经常为空但仍未达目标', hint: '可能是流量不足或单步效率低' },
      { id: 'communication_high', label: '通信时间占比偏高', hint: '多卡等待可能限制扩展效率' },
      { id: 'expert_skew', label: '少数专家负载明显更高', hint: 'MoE 热点专家可能成为瓶颈' },
    ],
    causes: [
      {
        id: 'throughput-batch', stage: 'queue', title: '请求供给或组批不足', signals: ['small_batch', 'queue_empty', 'gpu_low'],
        reason: 'GPU 没有持续获得足够并行工作，Batch 过小或调度补位不及时会形成空闲。',
        verify: ['观察实际 Batch 分布、队列深度和 GPU 空闲区间。', '增加受控并发，确认吞吐是否随 Batch 上升。', '检查调度器是否在请求完成后及时补位。'],
        direction: ['启用或调优 Continuous Batching。', '调整组批等待窗口与最大 Token 预算。', '区分流量不足与系统处理能力不足。'],
        panoramaId: 'cb', knowledgeId: 'batching-与-continuous-batching', linkLabel: '动态连续批处理',
      },
      {
        id: 'throughput-util', stage: 'decode', title: 'GPU 在数据搬运、启动或调度间隙中空转', signals: ['gpu_low', 'queue_empty'],
        reason: '利用率低可能来自 Kernel 启动、CPU 提交、数据搬运或同步等待，而不只是算力不足。',
        verify: ['联合查看 GPU 活跃时间、Kernel 时间线与有效 Token 吞吐。', '区分计算、带宽、通信和 CPU 等待。', '固定请求形状比较优化前后的有效吞吐。'],
        direction: ['减少小算子和同步点。', '评估算子融合、CUDA Graph 与数据管线。', '确保优化目标是有效吞吐而非单一利用率数值。'],
        panoramaId: 'util', knowledgeId: 'gpu-利用率', linkLabel: 'GPU 计算资源利用率',
      },
      {
        id: 'throughput-comm', stage: 'communication', title: '并行通信抵消扩展收益', signals: ['communication_high'],
        reason: '增加设备会提高可用容量，但集体通信和同步等待可能限制实际吞吐扩展。',
        verify: ['计算通信时间在完整 step 中的占比。', '对比不同 GPU 数量和并行策略的有效吞吐。', '核对拓扑、链路带宽和跨节点流量。'],
        direction: ['优化并行切分与拓扑映射。', '减少不必要的跨节点通信。', '以端到端吞吐和延迟共同评估扩展效率。'],
        panoramaId: 'topo', knowledgeId: '拓扑与网络', linkLabel: '系统互连架构',
      },
      {
        id: 'throughput-expert', stage: 'communication', title: 'MoE 专家负载不均衡', signals: ['expert_skew', 'communication_high'],
        reason: 'Token 集中到少数专家会让热门专家排队，并通过最慢设备限制整体吞吐。',
        verify: ['记录每个专家的 Token 数、排队时间与设备占用。', '检查 Router 分布和 All-to-All 流量。', '比较均衡度变化与端到端吞吐。'],
        direction: ['评估负载均衡策略与专家重排。', '优化专家放置和热点专家副本。', '避免只追求均匀而损害路由质量。'],
        panoramaId: 'expertobs', knowledgeId: '专家观测体系', linkLabel: '专家级负载分析',
      },
    ],
  },
  {
    id: 'startup',
    title: '模型加载或实例启动慢',
    short: '加载 / 启动慢',
    icon: ServerCog,
    accent: 'rose',
    metric: 'Load → Initialize → Warm-up → Ready',
    symptom: '实例从创建到可稳定接收流量耗时较长，需要把权重读取、格式转换、引擎初始化、图编译、通信初始化和预热分开。',
    evidence: [
      { id: 'io_slow', label: '权重文件读取占主要时间', hint: '存储或网络读取可能是主阶段' },
      { id: 'convert_slow', label: '加载后仍有长时间格式转换', hint: '量化、反序列化或权重重排' },
      { id: 'compile_slow', label: '首次形状执行或图编译耗时长', hint: '需要生成运行时产物' },
      { id: 'distributed_init', label: '多卡通信初始化耗时长', hint: '进程组、拓扑或连接建立' },
      { id: 'first_request', label: '服务就绪后首个请求仍明显更慢', hint: '预热范围可能不完整' },
    ],
    causes: [
      {
        id: 'startup-io', stage: 'startup', title: '权重读取或分片装载成为瓶颈', signals: ['io_slow'],
        reason: '大模型权重体积大，存储吞吐、网络读取和多分片并发会直接影响加载时间。',
        verify: ['记录每个权重分片的读取开始、结束和吞吐。', '区分本地盘、共享存储与对象存储下载时间。', '检查是否存在串行读取或重复下载。'],
        direction: ['使用本地缓存或更合适的存储层。', '在资源允许时并行读取分片。', '避免实例启动时重复获取相同权重。'],
        panoramaId: 'vram', knowledgeId: '显存与带宽', linkLabel: '显存与带宽',
      },
      {
        id: 'startup-format', stage: 'startup', title: '运行时格式转换和权重重排耗时', signals: ['convert_slow'],
        reason: '模型文件与推理引擎需要的量化格式、分片布局或内核布局不一致，会在启动时额外转换。',
        verify: ['拆分读取完成到 GPU 权重就绪之间的步骤。', '确认是否每次启动都执行量化、重排或反序列化。', '比较预转换产物与运行时转换。'],
        direction: ['提前生成与目标引擎匹配的部署产物。', '缓存量化与编译结果。', '固定模型版本、精度和并行布局，避免启动时临时转换。'],
        panoramaId: 'quant', knowledgeId: '量化', linkLabel: '权重量化压缩', compareTab: 'quant',
      },
      {
        id: 'startup-compile', stage: 'startup', title: '图编译、Kernel 选择或预热不完整', signals: ['compile_slow', 'first_request'],
        reason: '引擎可能需要针对输入形状选择 Kernel、分配工作区或捕获计算图。',
        verify: ['记录图编译、Kernel autotune 和预热阶段。', '检查预热形状是否覆盖真实 Batch、输入和输出范围。', '对比首轮与稳定轮的执行时间。'],
        direction: ['缓存可复用的编译产物。', '用代表性形状完成预热。', '将预热完成作为服务就绪条件。'],
        panoramaId: 'cudagraph', knowledgeId: 'cuda-graph', linkLabel: 'CUDA 计算图加速',
      },
      {
        id: 'startup-distributed', stage: 'communication', title: '分布式进程组或拓扑初始化慢', signals: ['distributed_init'],
        reason: '多卡或多节点部署需要建立进程组、发现设备、分配通信资源并验证链路。',
        verify: ['分别记录进程启动、设备发现和通信初始化时间。', '检查节点间网络、DNS、端口和拓扑配置。', '对比单卡、单机多卡和多节点启动时间。'],
        direction: ['预先验证拓扑与通信环境。', '减少启动路径中的串行协调。', '固定进程与 GPU 绑定并缓存稳定配置。'],
        panoramaId: 'nccl', knowledgeId: 'nccl', linkLabel: 'NVIDIA 集体通信库',
      },
    ],
  },
];

const KNOWLEDGE = new Map(knowledgeData.entries.map(entry => [entry.id, entry]));

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

function priorityLabel(count) {
  if (count >= 2) return { label: '优先验证', variant: 'amber' };
  if (count === 1) return { label: '有证据支持', variant: 'cyan' };
  return { label: '待补充证据', variant: 'slate' };
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
    return { ...cause, matched, originalIndex: index };
  }).sort((a, b) => b.matched.length - a.matched.length || a.originalIndex - b.originalIndex), [scenario, selectedEvidence]);

  const visibleCauses = selectedStage ? rankedCauses.filter(cause => cause.stage === selectedStage) : rankedCauses;
  const selectedCause = rankedCauses.find(cause => cause.id === causeId) || visibleCauses[0] || rankedCauses[0];
  const selectedKnowledge = KNOWLEDGE.get(selectedCause.knowledgeId);

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
    const lines = [
      `场景：${scenario.title}（${scenario.metric}）`,
      `候选原因：${selectedCause.title}`,
      `已选证据：${matched.length ? matched.join('；') : '无直接匹配证据，需先执行验证步骤'}`,
      `验证步骤：${selectedCause.verify.map((step, i) => `${i + 1}. ${step}`).join('；')}`,
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
    <div className="mx-auto max-w-7xl space-y-6">
      <ProductHeader
        title="推理链路诊断台"
        subtitle="根据 TTFT、TPOT、OOM、吞吐和启动现象选择已观察到的证据，沿请求调度、Prefill、KV Cache、Decode 与硬件通信逐层形成候选原因、验证步骤和处理方向。"
        accent="cyan"
        badges={[{ label: '证据驱动诊断', variant: 'cyan' }, { label: '不由单一症状断言根因' }]}
      />
      <div className="rounded-xl border border-space-700/50 bg-space-950/45 px-4 py-3 text-xs leading-relaxed text-space-400">
        <div className="flex items-center justify-center gap-2 font-medium text-space-200"><ScanSearch size={15} className="text-cyan-400" />诊断原则</div>
        <div className="mt-1 text-center">先拆指标和阶段，再用观测证据验证；页面不输出未经验证的唯一根因。</div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {SCENARIOS.map((item) => {
          const Icon = item.icon;
          const active = item.id === scenarioId;
          return (
            <button key={item.id} type="button" onClick={() => changeScenario(item.id)} className={`rounded-xl border bg-space-900/55 p-3 text-left transition-all ${accentClasses(item.accent, active)}`}>
              <div className="flex items-center justify-between"><Icon size={18} className={active ? '' : 'text-space-500'} />{active && <CheckCircle2 size={14} />}</div>
              <div className="mt-3 text-sm font-semibold">{item.short}</div>
              <div className="mt-1 text-[11px] text-space-500">{item.metric}</div>
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={scenario.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="space-y-5">
          <section className="rounded-2xl border border-space-700/50 bg-space-900/55 p-5">
            <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
              <div><div className="flex flex-wrap items-center gap-2"><Badge variant={scenario.accent === 'rose' ? 'amber' : scenario.accent}>{scenario.short}</Badge><span className="font-mono text-xs text-space-500">{scenario.metric}</span></div><h2 className="mt-3 text-xl font-bold text-space-100">现象：{scenario.title}</h2><p className="mt-2 max-w-4xl text-sm leading-relaxed text-space-400">{scenario.symptom}</p></div>
              <button type="button" onClick={() => { setSelectedEvidence([]); setSelectedStage(null); setCauseId(scenario.causes[0].id); }} className="inline-flex items-center justify-center gap-2 rounded-lg border border-space-700/60 bg-space-950/35 px-3 py-2 text-xs text-space-400 transition hover:text-space-200"><RotateCcw size={13} />重置本场景</button>
            </div>
          </section>

          <section className="rounded-2xl border border-space-700/50 bg-space-900/45 p-4 md:p-5">
            <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between"><div><h2 className="flex items-center gap-2 text-base font-semibold text-space-100"><CircleGauge size={17} className="text-cyan-400" />推理链路定位</h2><p className="mt-1 text-xs text-space-500">点击阶段只查看该阶段的候选原因，再点击一次取消筛选。</p></div>{selectedStage && <Badge variant="cyan">当前筛选：{STAGES.find(stage => stage.id === selectedStage)?.label}</Badge>}</div>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-7">
              {STAGES.map((stage, index) => {
                const Icon = stage.icon;
                const hasCause = scenario.causes.some(cause => cause.stage === stage.id);
                const active = selectedStage === stage.id;
                return (
                  <button key={stage.id} type="button" disabled={!hasCause} onClick={() => hasCause && selectStage(stage.id)} className={`relative rounded-xl border p-3 text-left transition-all ${active ? 'border-cyan-500/45 bg-cyan-500/10' : hasCause ? 'border-space-700/55 bg-space-950/35 hover:border-cyan-500/25' : 'cursor-not-allowed border-space-800/60 bg-space-950/20 opacity-45'}`}>
                    <div className="flex items-center justify-between"><Icon size={16} className={active ? 'text-cyan-300' : hasCause ? 'text-space-400' : 'text-space-700'} /><span className="font-mono text-[9px] text-space-700">0{index + 1}</span></div><div className={`mt-2 text-xs font-medium ${active ? 'text-cyan-200' : 'text-space-400'}`}>{stage.label}</div>{hasCause && <span className="absolute bottom-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-cyan-400/70" />}
                  </button>
                );
              })}
            </div>
          </section>

          <div className="grid gap-5 xl:grid-cols-[340px_1fr]">
            <section className="space-y-3 rounded-2xl border border-space-700/50 bg-space-900/55 p-4">
              <div><h2 className="flex items-center gap-2 text-base font-semibold text-space-100"><Search size={17} className="text-violet-400" />选择已有证据</h2><p className="mt-1 text-xs leading-relaxed text-space-500">证据只用于调整验证顺序，不等同于根因确认。</p></div>
              {scenario.evidence.map((evidence) => {
                const active = selectedEvidence.includes(evidence.id);
                return (
                  <button key={evidence.id} type="button" onClick={() => toggleEvidence(evidence.id)} className={`w-full rounded-xl border p-3 text-left transition-all ${active ? 'border-violet-500/40 bg-violet-500/10' : 'border-space-700/45 bg-space-950/30 hover:border-space-600'}`}>
                    <div className="flex items-start gap-2.5"><span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${active ? 'border-violet-400 bg-violet-400 text-space-950' : 'border-space-600'}`}>{active && <CheckCircle2 size={11} />}</span><span><span className={`block text-xs font-medium ${active ? 'text-violet-200' : 'text-space-300'}`}>{evidence.label}</span><span className="mt-1 block text-[11px] leading-relaxed text-space-600">{evidence.hint}</span></span></div>
                  </button>
                );
              })}
              <div className="rounded-xl border border-space-700/45 bg-space-950/35 p-3 text-xs text-space-500">已选择 <span className="font-mono font-bold text-violet-300">{selectedEvidence.length}</span> 项证据。没有证据时按链路顺序展示初始候选。</div>
            </section>

            <section className="space-y-3">
              <div className="flex items-end justify-between"><div><h2 className="text-base font-semibold text-space-100">候选原因</h2><p className="mt-1 text-xs text-space-500">按当前证据匹配数量排列，点击查看完整验证链。</p></div><Badge variant="slate">{visibleCauses.length} 项</Badge></div>
              <div className="grid gap-3 md:grid-cols-2">
                {visibleCauses.map((cause) => {
                  const active = selectedCause.id === cause.id;
                  const priority = priorityLabel(cause.matched.length);
                  const stage = STAGES.find(item => item.id === cause.stage);
                  return (
                    <button key={cause.id} type="button" onClick={() => setCauseId(cause.id)} className={`rounded-xl border p-4 text-left transition-all ${active ? 'border-cyan-500/45 bg-cyan-500/[0.08] shadow-[0_0_20px_rgba(34,211,238,0.08)]' : 'border-space-700/50 bg-space-900/50 hover:border-space-600'}`}>
                      <div className="flex items-center justify-between gap-2"><Badge variant={priority.variant}>{priority.label}</Badge><span className="text-[10px] text-space-600">{stage?.label}</span></div>
                      <h3 className="mt-3 text-sm font-semibold text-space-200">{cause.title}</h3>
                      <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-space-500">{cause.reason}</p>
                      <div className="mt-3 flex items-center justify-between text-[11px]"><span className="text-space-600">证据匹配 {cause.matched.length} 项</span><ChevronRight size={13} className={active ? 'text-cyan-300' : 'text-space-600'} /></div>
                    </button>
                  );
                })}
              </div>
              {visibleCauses.length === 0 && <div className="rounded-xl border border-space-700/50 bg-space-900/40 p-6 text-center text-sm text-space-500">当前阶段没有该症状的预设候选原因，请取消阶段筛选。</div>}
            </section>
          </div>

          <section className="overflow-hidden rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-space-900/80 to-space-950/65">
            <div className="border-b border-space-700/50 p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between"><div><div className="flex flex-wrap items-center gap-2"><Badge variant="cyan">当前诊断路径</Badge><Badge variant={priorityLabel(selectedCause.matched.length).variant}>{priorityLabel(selectedCause.matched.length).label}</Badge></div><h2 className="mt-3 text-xl font-bold text-space-100">候选原因：{selectedCause.title}</h2><p className="mt-2 max-w-4xl text-sm leading-relaxed text-space-400">{selectedCause.reason}</p></div><button type="button" onClick={() => navigate('/panorama', { state: { moduleId: selectedCause.panoramaId } })} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-300 transition hover:bg-cyan-500/20">打开“{selectedCause.linkLabel}” <ArrowUpRight size={14} /></button></div>
            </div>

            <div className="grid gap-px bg-space-700/35 lg:grid-cols-3">
              <div className="bg-space-950/65 p-5"><div className="flex items-center gap-2 text-sm font-semibold text-space-200"><CheckCircle2 size={16} className="text-violet-400" />已选证据</div>{selectedCause.matched.length > 0 ? <ul className="mt-3 space-y-2">{selectedCause.matched.map(signal => { const evidence = scenario.evidence.find(item => item.id === signal); return <li key={signal} className="flex gap-2 text-xs leading-relaxed text-space-400"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400" />{evidence?.label}</li>; })}</ul> : <p className="mt-3 text-xs leading-relaxed text-space-500">当前没有直接匹配该候选的已选证据，应先执行验证步骤，不能确认根因。</p>}</div>
              <div className="bg-space-950/65 p-5"><div className="flex items-center gap-2 text-sm font-semibold text-space-200"><ListChecks size={16} className="text-cyan-400" />验证步骤</div><ol className="mt-3 space-y-2.5">{selectedCause.verify.map((step, index) => <li key={step} className="flex gap-2.5 text-xs leading-relaxed text-space-400"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-cyan-500/25 bg-cyan-500/10 font-mono text-[10px] text-cyan-300">{index + 1}</span>{step}</li>)}</ol></div>
              <div className="bg-space-950/65 p-5"><div className="flex items-center gap-2 text-sm font-semibold text-space-200"><ArrowRight size={16} className="text-emerald-400" />处理方向</div><ul className="mt-3 space-y-2.5">{selectedCause.direction.map(step => <li key={step} className="flex gap-2.5 text-xs leading-relaxed text-space-400"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />{step}</li>)}</ul></div>
            </div>

            <div className="flex flex-col gap-3 border-t border-space-700/50 bg-space-900/55 p-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-2"><Info size={15} className="mt-0.5 shrink-0 text-space-500" /><p className="text-xs leading-relaxed text-space-500">技术说明：<span className="text-space-300">{selectedKnowledge?.title}</span> — {selectedKnowledge?.summary}</p></div>
              <div className="flex shrink-0 flex-wrap gap-2"><button type="button" onClick={handleCopySummary} className="inline-flex items-center gap-1.5 rounded-lg border border-space-700/60 bg-space-950/35 px-3 py-2 text-xs text-space-300 transition hover:border-cyan-500/30 hover:text-cyan-300">{copied ? <CheckCircle2 size={13} /> : <Copy size={13} />}{copied ? '已复制' : '复制诊断摘要'}</button><button type="button" onClick={() => navigate('/pipeline')} className="rounded-lg border border-space-700/60 bg-space-950/35 px-3 py-2 text-xs text-space-300 transition hover:border-violet-500/30 hover:text-violet-300">查看推理流水线</button>{selectedCause.labTab && <button type="button" onClick={() => navigate('/lab', { state: { tab: selectedCause.labTab } })} className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">进入参数实验室</button>}{selectedCause.compareTab && <button type="button" onClick={() => navigate('/compare', { state: { tab: selectedCause.compareTab } })} className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">进入方案对比台</button>}</div>
            </div>
          </section>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
