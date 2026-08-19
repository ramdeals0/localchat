import type { ChatStreamEvent } from "@localchat/shared";
import type { Response } from "express";

export function initSse(res: Response): void {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();
}

export function sendSseEvent(res: Response, event: ChatStreamEvent): void {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

export function endSse(res: Response): void {
  res.end();
}
