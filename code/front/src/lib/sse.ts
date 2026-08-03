/**
 * SSE（Server-Sent Events）工具：服务端把 async generator 包装为流式响应，
 * 客户端解析同一协议。
 *
 * 协议（每条消息一行 JSON，空行分隔）：
 *   data: {"delta":"文本增量"}\n\n
 *   data: {"done":true}\n\n        // 正常结束
 *   data: {"error":"错误信息"}\n\n  // 中途出错
 */

/** 服务端：把文本增量生成器包装为 SSE Response（用于 Route Handler 直接 return） */
export function sseResponse(gen: AsyncGenerator<string>): Response {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const delta of gen) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta })}\n\n`));
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
      } catch (err) {
        const message = err instanceof Error ? err.message : "生成失败，请重试";
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: message })}\n\n`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

export interface SseHandlers {
  onDelta: (text: string) => void;
  onDone?: () => void;
  onError?: (message: string) => void;
}

/** 客户端：解析服务端 SSE 流；HTTP 错误或非流响应也统一走 onError */
export async function readSseStream(res: Response, handlers: SseHandlers): Promise<void> {
  if (!res.ok || !res.body) {
    let message = `请求失败（${res.status}）`;
    try {
      const json = await res.json();
      if (json && typeof json.error === "string") message = json.error;
    } catch {
      // 响应体不是 JSON 时保留默认错误信息
    }
    handlers.onError?.(message);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";

      for (const part of parts) {
        const line = part.trim();
        if (!line.startsWith("data:")) continue;
        try {
          const payload = JSON.parse(line.slice(5).trim());
          if (typeof payload.error === "string") {
            handlers.onError?.(payload.error);
            return;
          }
          if (payload.done) {
            handlers.onDone?.();
            return;
          }
          if (typeof payload.delta === "string") {
            handlers.onDelta(payload.delta);
          }
        } catch {
          // 忽略格式异常的数据块
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  handlers.onDone?.();
}
