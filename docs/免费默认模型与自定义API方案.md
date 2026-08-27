# 默认模型与自定义 API 方案

## 默认模型

平台默认使用 OpenAI 的 Chat Completions 接口：

```text
Provider: openai-compatible
Base URL: https://api.openai.com/v1
Model: gpt-5-mini（占位，请按你的 OpenAI 账户可用模型调整）
```

OpenAI 接口为按量计费，没有免费档。默认 API Key 只放在部署服务端环境变量中，不写入前端源码、`dist` 或页面上下文。

## 配置方式

复制 `.env.example` 的相关配置到部署平台环境变量，并填写服务端 Key：

```env
LLM_PROVIDER=openai-compatible
LLM_API_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-5-mini
LLM_API_KEY=部署方的_OpenAI_API_Key
```

用户仍可在“问助手 → 配置模型”中填写自己的 OpenAI 兼容 API（包括 DeepSeek、本地 vLLM、Ollama 等）。会话配置优先于部署默认配置，清除后恢复部署默认模型。

## 请求路径

```text
页面
  → /api/agent/chat
  → 服务端默认 OpenAI 或用户会话 API
  → 模型回答
```

模型服务异常、返回 429 或额度用尽时，接口自动返回本地知识库回答，不阻断问答功能。

## 公共额度保护

部署默认模型启用两层限流：

- 单 IP 默认 10 分钟 12 次；
- 所有访客共享默认每日 700 次；
- 用户自定义会话 API 不计入共享额度；
- 可通过 `AGENT_RATE_LIMIT_*` 环境变量调整；
- 关闭限流仅用于受控测试环境，不建议用于公开部署。

当前限流状态保存在单个服务进程的内存中。多实例或无状态 Serverless 部署应将计数器接入平台 KV、Redis 或同类共享存储。

## 部署边界

OpenAI 接口按量计费，模型列表和速率限制由服务商账户实时决定。公开部署前应在 OpenAI 控制台确认当前账户可用的模型名与余额，并观察服务端的 429 比例和本地降级比例。
