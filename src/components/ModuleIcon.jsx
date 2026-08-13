import { cloneElement } from 'react';

const ICONS = {
  // arch
  vllm: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="8" width="7" height="10" rx="1.5"/><rect x="14" y="4" width="7" height="14" rx="1.5"/><path d="M10 13h4"/></svg>,
  api: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="4" y="6" width="16" height="12" rx="2"/><path d="M8 10h.01M8 14h.01M12 12h4"/></svg>,
  scheduler: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8h.01M7 12h.01M7 16h.01M11 8h6M11 12h4M11 16h6"/></svg>,
  cb: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="6" width="9" height="12" rx="1.5"/><rect x="14" y="6" width="7" height="5" rx="1.5"/><rect x="14" y="13" width="7" height="5" rx="1.5"/><path d="M12 9h2M12 15h2"/></svg>,
  chunked: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 6h6v4H4zM14 6h6v4h-6zM4 14h6v4H4zM14 14h6v4h-6z"/></svg>,
  admission: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 3v4M5 7h14v14H5z"/><path d="M9 11h6M9 15h4"/></svg>,
  pd: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="5" width="7" height="14" rx="1.5"/><rect x="14" y="5" width="7" height="14" rx="1.5"/><path d="M10 9h4M10 15h4"/><circle cx="6.5" cy="16.5" r="1"/><circle cx="17.5" cy="16.5" r="1"/></svg>,
  // memory
  kv: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 6h16v12H4z"/><path d="M4 10h16M8 6v4M16 6v4"/><path d="M6 14h4M14 14h4"/></svg>,
  paged: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="4" width="7" height="7" rx="1"/><rect x="14" y="4" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><path d="M10 7.5h4M7.5 11v3M16.5 11v3"/></svg>,
  mm: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 8h16M4 12h16M4 16h16M8 4v16M12 4v16M16 4v16"/></svg>,
  prefix: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 6h8v12H4z"/><path d="M14 6h6v4h-6zM14 12h6v6h-6z"/><path d="M12 10l2-2"/></svg>,
  offload: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="4" y="4" width="16" height="10" rx="2"/><path d="M8 14v4M16 14v4M6 18h12"/><path d="M12 18v2"/></svg>,
  // exec
  prefill_decode: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M5 6h14v4H5z"/><path d="M5 12h10v2H5zM5 16h6v2H5z"/><path d="M17 12l3 4-3 4"/></svg>,
  kernel: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 6h16v12H4z"/><path d="M4 10h16M8 6v4M12 6v4M16 6v4"/><path d="M6 14h4M14 14h4"/></svg>,
  cudagraph: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 6h16v12H4z"/><path d="M7 9h3v3H7zM14 9h3v3h-3z"/><path d="M10 10.5h4"/></svg>,
  flash: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M13 2L4 14h7l-2 8 9-12h-7l2-8z"/></svg>,
  gemm: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="4" y="4" width="6" height="6"/><rect x="14" y="4" width="6" height="6"/><rect x="4" y="14" width="6" height="6"/><rect x="14" y="14" width="6" height="6"/><path d="M10 7h4M7 10v4M17 10v4M10 17h4"/></svg>,
  // gen
  spec: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M5 6h14v3H5z"/><path d="M5 11h10v3H5z"/><path d="M5 16h6v3H5z"/><path d="M17 11l2 2.5-2 2.5"/></svg>,
  mtp: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M5 6h6v3H5zM13 6h6v3h-6z"/><path d="M5 11h6v3H5zM13 11h6v3h-6z"/><path d="M5 16h6v3H5zM13 16h6v3h-6z"/><path d="M11 7.5h2M11 12.5h2M11 17.5h2"/></svg>,
  stream: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 6h16M4 10h10M4 14h14M4 18h8"/><path d="M20 10l-2 2 2 2"/></svg>,
  // eval
  bench: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="4" y="14" width="4" height="6" rx="1"/><rect x="10" y="8" width="4" height="12" rx="1"/><rect x="16" y="4" width="4" height="16" rx="1"/></svg>,
  obs: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 3"/></svg>,
  expertobs: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 6h16v12H4z"/><path d="M4 10h16M8 6v4M12 6v4M16 6v4"/><circle cx="9" cy="15" r="1"/><circle cx="12" cy="15" r="1"/><circle cx="15" cy="15" r="1"/></svg>,
  metrics: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 18h16"/><path d="M6 18V12M10 18V8M14 18V14M18 18V6"/></svg>,
  // modelbase
  token: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="4" y="6" width="5" height="5" rx="1"/><rect x="15" y="6" width="5" height="5" rx="1"/><rect x="4" y="14" width="5" height="5" rx="1"/><rect x="15" y="14" width="5" height="5" rx="1"/><path d="M9 8.5h6M9 16.5h6"/></svg>,
  embed: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 6h16M4 10h12M4 14h16M4 18h10"/><circle cx="18" cy="18" r="2"/></svg>,
  block: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="4" y="4" width="16" height="5" rx="1"/><rect x="4" y="11" width="16" height="5" rx="1"/><rect x="4" y="18" width="16" height="2" rx="1"/></svg>,
  ffn: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="6" cy="8" r="2"/><circle cx="18" cy="8" r="2"/><circle cx="6" cy="16" r="2"/><circle cx="18" cy="16" r="2"/><path d="M8 8h8M8 16h8M6 10v4M18 10v4"/></svg>,
  // attention
  attn: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="4"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>,
  qkv: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 6h5v12H4zM9.5 6h5v12h-5zM15 6h5v12h-5z"/></svg>,
  mask: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 4h16v16H4z"/><path d="M4 8h16M8 4v16"/><path d="M12 12l6 6"/></svg>,
  // moe
  dense: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="4" y="6" width="16" height="12" rx="2"/><path d="M8 10h8M8 14h8"/></svg>,
  moe: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="2.5"/><circle cx="16" cy="8" r="2.5"/><circle cx="8" cy="16" r="2.5"/><circle cx="16" cy="16" r="2.5"/><path d="M10.5 8h3M8 10.5v3M16 10.5v3M10.5 16h3"/></svg>,
  expert: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="5" y="5" width="6" height="6" rx="1"/><rect x="13" y="5" width="6" height="6" rx="1"/><rect x="5" y="13" width="6" height="6" rx="1"/><rect x="13" y="13" width="6" height="6" rx="1"/><path d="M11 8h2M8 11v2M16 11v2M11 16h2"/></svg>,
  router: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="6" r="2"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/><path d="M11 7.5L7 16.5M13 7.5l5 9"/></svg>,
  shared: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="4" y="4" width="16" height="5" rx="1"/><rect x="6" y="11" width="5" height="8" rx="1"/><rect x="13" y="11" width="5" height="8" rx="1"/></svg>,
  choice: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 6h4v4H6zM14 6h4v4h-4zM6 14h4v4H6zM14 14h4v4h-4z"/><path d="M10 8h4M8 10v4M16 10v4M10 16h4"/></svg>,
  balance: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 18h16"/><path d="M6 18l4-8 4 3 4-7"/></svg>,
  ep: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><path d="M10 6.5h4M6.5 10v4M17.5 10v4M10 17.5h4"/></svg>,
  // attarch
  mha: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="6" r="2"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/><path d="M11 7.5l-3 9M13 7.5l3 9"/><path d="M6 12h12"/></svg>,
  mla: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 6h16v12H4z"/><path d="M4 10h16M8 6v4M12 6v4M16 6v4"/><path d="M7 14l2 2 2-2"/></svg>,
  // compress
  quant: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 6h16v12H4z"/><path d="M4 10h16M8 6v4M16 6v4"/><path d="M7 14l4 4M11 14l-4 4"/></svg>,
  awq: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="4" y="6" width="7" height="10" rx="1"/><rect x="14" y="6" width="6" height="10" rx="1"/><path d="M11 9h3"/></svg>,
  expquant: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 6h5v5H6zM13 6h5v5h-5zM6 13h5v5H6zM13 13h5v5h-5z"/><path d="M11 8.5h2M8.5 11v2M15.5 11v2M11 15.5h2"/></svg>,
  distill: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 3l-8 14h16z"/><path d="M12 8l-4 7h8z"/></svg>,
  lora: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 6h16v4H4zM4 14h10v4H4z"/><path d="M16 14l4 2-4 2"/></svg>,
  moelora: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="2"/><circle cx="16" cy="8" r="2"/><circle cx="8" cy="16" r="2"/><circle cx="16" cy="16" r="2"/><path d="M10 8h4M8 10v4M16 10v4M10 16h4"/></svg>,
  // gpu
  compute: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 8h16M4 12h16M4 16h16M8 4v16M12 4v16M16 4v16"/></svg>,
  vram: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 6h16v12H4z"/><path d="M4 10h16M7 6v4M12 6v4M17 6v4"/><path d="M6 14h4M14 14h4"/></svg>,
  bw: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 12h3l2-5 4 10 2-5h3"/></svg>,
  util: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="8"/><path d="M12 6v6l4 2"/></svg>,
  // interconnect
  nvlink: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="8" width="7" height="8" rx="1"/><rect x="14" y="8" width="7" height="8" rx="1"/><path d="M10 12h4M8 10v4M16 10v4"/></svg>,
  topo: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="6" cy="6" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/><path d="M8 6h8M6 8v8M18 8v8M8 18h8"/></svg>,
  // parallel
  tp_pp_dp: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="5" height="5" rx="1"/><rect x="10" y="3" width="5" height="5" rx="1"/><rect x="3" y="10" width="5" height="5" rx="1"/><rect x="10" y="10" width="5" height="5" rx="1"/><rect x="3" y="17" width="5" height="4" rx="1"/><path d="M8 5.5h2M5.5 8v2M15 5.5h4M12.5 8v9M5.5 15v2"/></svg>,
  ep_cp_sp: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"/><path d="M10 7h4M7 10v4M17 10v4M10 17h4"/></svg>,
  dispatch: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="12" cy="19" r="2"/><circle cx="18" cy="19" r="2"/><path d="M11 6.5L7 17M13 6.5L11 17"/></svg>,
  alltoall: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 6h16v3H4zM4 11h16v3H4zM4 16h16v3H4z"/><path d="M19 7.5l2 1.5-2 1.5M19 12.5l2 1.5-2 1.5"/></svg>,
  nccl: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="4" y="6" width="16" height="12" rx="2"/><path d="M4 10h16M8 6v4M16 6v4"/><path d="M7 14h3M14 14h3"/></svg>,
  // hardware
  models: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="5" y="4" width="14" height="10" rx="1"/><path d="M8 14v4M16 14v4M6 18h12"/><path d="M10 8h4M10 11h4"/></svg>,
  sizing: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 6h16v12H4z"/><path d="M4 10h16M8 6v4M12 6v4M16 6v4"/><path d="M6 14l3 3 3-2 3 3"/><circle cx="17" cy="15" r="1.5"/></svg>,
};

export default function ModuleIcon({ id, className }) {
  const svg = ICONS[id];
  if (!svg) return null;
  const sized = cloneElement(svg, {
    className: 'h-4 w-4',
  });
  return (
    <span className={`inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-current/20 ${className || ''}`}>
      {sized}
    </span>
  );
}
