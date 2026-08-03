import OpenAI from "openai";

const apiKey = process.env.AI_API_KEY;
const baseURL = process.env.AI_API_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1";
const model = process.env.AI_MODEL || "qwen-max";

const client = apiKey && apiKey !== "your-api-key-here"
  ? new OpenAI({ apiKey, baseURL })
  : null;

export interface ChatOptions {
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
}

export async function chat(
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>,
  options: ChatOptions = {}
): Promise<string> {
  if (!client) {
    throw new Error("AI_API_KEY 未配置，请在 .env.local 中设置你的 API Key");
  }

  const { systemPrompt, temperature = 0.7, maxTokens } = options;
  const allMessages = systemPrompt
    ? [{ role: "system" as const, content: systemPrompt }, ...messages]
    : messages;

  const response = await client.chat.completions.create({
    model,
    messages: allMessages,
    temperature,
    max_tokens: maxTokens,
  });

  return response.choices[0]?.message?.content ?? "";
}

/**
 * 流式对话补全：逐块产出文本增量（delta），供 SSE 路由转发。
 */
export async function* chatStream(
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>,
  options: ChatOptions = {}
): AsyncGenerator<string> {
  if (!client) {
    throw new Error("AI_API_KEY 未配置，请在 .env.local 中设置你的 API Key");
  }

  const { systemPrompt, temperature = 0.7, maxTokens } = options;
  const allMessages = systemPrompt
    ? [{ role: "system" as const, content: systemPrompt }, ...messages]
    : messages;

  const stream = await client.chat.completions.create({
    model,
    messages: allMessages,
    temperature,
    max_tokens: maxTokens,
    stream: true,
  });

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) yield delta;
  }
}

export { model as currentModel, client };
