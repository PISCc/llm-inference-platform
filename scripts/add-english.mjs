import fs from 'node:fs';

const data = JSON.parse(fs.readFileSync('./src/data/panorama.json', 'utf-8'));

const ENGLISH_TITLES = {
  vllm: 'Distributed Inference Engine',
  api: 'API & Input Processing',
  scheduler: 'Request Scheduler',
  cb: 'Continuous Batching',
  chunked: 'Chunked Prefill',
  admission: 'Admission Control',
  pd: 'PD Disaggregation',
  kv: 'KV Cache',
  paged: 'PagedAttention',
  mm: 'Memory Manager',
  prefix: 'Prefix Cache',
  offload: 'KV Offload',
  prefill_decode: 'Prefill & Decode',
  kernel: 'Kernel Fusion',
  cudagraph: 'CUDA Graph',
  flash: 'FlashAttention',
  gemm: 'GEMM',
  spec: 'Speculative Decoding',
  mtp: 'Multi-Token Prediction',
  stream: 'Streaming Output',
  bench: 'Benchmark',
  obs: 'Observability',
  expertobs: 'Expert Analysis',
  metrics: 'Performance Metrics',
  token: 'Tokenizer',
  embed: 'Embedding & Positional Encoding',
  block: 'Transformer Block',
  ffn: 'FFN & Normalization',
  attn: 'Self-Attention',
  qkv: 'Q, K, V Projection',
  mask: 'Causal Mask & Multi-Head',
  dense: 'Dense Model',
  moe: 'Mixture of Experts',
  expert: 'Expert Network',
  router: 'Router & Top-K',
  shared: 'Shared Expert',
  choice: 'Routing Strategy',
  balance: 'Load Balancing',
  ep: 'Expert Parallelism',
  mha: 'MHA / MQA / GQA',
  mla: 'MLA',
  quant: 'Quantization',
  awq: 'AWQ & GPTQ',
  expquant: 'Expert Quantization',
  distill: 'Knowledge Distillation',
  lora: 'LoRA',
  moelora: 'MoE LoRA',
  compute: 'GPU Compute',
  vram: 'HBM Memory',
  bw: 'Memory Bandwidth',
  util: 'GPU Utilization',
  nvlink: 'NVLink',
  topo: 'Interconnect Topology',
  tp_pp_dp: 'TP / PP / DP',
  ep_cp_sp: 'EP / CP / SP',
  dispatch: 'Dispatch & Combine',
  alltoall: 'All-to-All',
  nccl: 'NCCL',
  models: 'GPU Selection',
  sizing: 'Deployment Sizing',
};

let updated = 0;
for (const m of data.modules) {
  if (ENGLISH_TITLES[m.id]) {
    m.englishTitle = ENGLISH_TITLES[m.id];
    updated++;
  } else {
    console.log('Missing englishTitle for:', m.id);
  }
}

fs.writeFileSync('./src/data/panorama.json', JSON.stringify(data, null, 2), 'utf-8');
console.log('Added englishTitle to', updated, 'modules');
