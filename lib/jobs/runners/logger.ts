export type LogLevel = "info" | "warn" | "error" | "debug";

export interface LogParams {
  level?: LogLevel;
  worker: string;
  queue?: string;
  jobId?: string;
  event: string;
  durationMs?: number;
  message?: string;
  error?: string;
}

export function workerLog(params: LogParams): void {
  const logEntry = {
    level: params.level || "info",
    worker: params.worker,
    queue: params.queue || "N/A",
    jobId: params.jobId || "N/A",
    event: params.event,
    duration_ms: params.durationMs ?? null,
    message: params.message || "",
    error: params.error || "",
    timestamp: new Date().toISOString(),
  };

  // Outputs formatted JSON string for PM2 logging redirects
  console.log(JSON.stringify(logEntry));
}
