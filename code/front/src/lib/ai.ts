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

/** 从模型输出中提取 JSON（兼容 markdown 代码块与前后多余文字） */
export function extractJson(text: string): unknown {
  const cleaned = text.replace(/```/g, "");
  const starts = [cleaned.indexOf("{"), cleaned.indexOf("[")].filter((i) => i >= 0);
  if (starts.length === 0) throw new Error("AI 输出格式异常，请重试");
  const start = Math.min(...starts);
  const end = cleaned[start] === "{" ? cleaned.lastIndexOf("}") : cleaned.lastIndexOf("]");
  if (end <= start) throw new Error("AI 输出格式异常，请重试");
  return JSON.parse(cleaned.slice(start, end + 1));
}
