# 免费默认模型与自定义 API 方案

## 默认模型

平台默认使用 Groq 的 OpenAI 兼容接口：

```text
Provider: groq
Base URL: https://api.groq.com/openai/v1
Model: qwen/qwen3.6-27b
```

默认 API Key 只放在部署服务端环境变量中，不写入前端源码、`dist` 或页面上下文。

## 配置方式

复制 `.env.example` 的相关配置到部署平台环境变量，并填写服务端 Key：

```env
LLM_PROVIDER=groq
LLM_API_BASE_URL=https://api.groq.com/openai/v1
LLM_MODEL=qwen/qwen3.6-27b
LLM_API_KEY=部署方的_Groq_API_Key
```

用户仍可在“问助手 → 配置模型”中填写自己的兼容 API。会话配置优先于部署默认配置，清除后恢复部署默认模型。

## 请求路径

```text
页面
  → /api/agent/chat
  → 服务端默认 Groq 或用户会话 API
  → 模型回答
```

模型服务异常、返回 429 或共享额度用尽时，接口自动返回本地知识库回答，不阻断问答功能。

## 公共额度保护

共享默认模型启用两层限流：

- 单 IP 默认 10 分钟 12 次；
- 所有访客共享默认每日 700 次；
- 用户自定义会话 API 不计入共享 Groq 额度；
- 可通过 `AGENT_RATE_LIMIT_*` 环境变量调整；
- 关闭限流仅用于受控测试环境，不建议用于公开部署。

当前限流状态保存在单个服务进程的内存中。多实例或无状态 Serverless 部署应将计数器接入平台 KV、Redis 或同类共享存储。

## 部署边界

免费 API 的额度、模型列表和速率限制由服务商账户实时决定。公开部署前应在 Groq 控制台确认当前账户额度，并观察服务端的 429 比例和本地降级比例。
