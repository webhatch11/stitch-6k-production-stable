import { AsyncLocalStorage } from "async_hooks";

export interface LogContext {
  traceId?: string;
  requestId?: string;
  correlationId?: string;
  sessionId?: string;
  userId?: string;
  orderId?: string;
  paymentId?: string;
  queueJobId?: string;
  route?: string;
  durationMs?: number;
}

export const logStorage = new AsyncLocalStorage<LogContext>();

const SENSITIVE_KEYS = [
  "jwt", "password", "secret", "token", "cvv", "cardnumber", "card_number",
  "auth", "key", "passphrase", "apikey", "api_key", "authorization",
  "pin", "otp", "pass", "creditcard", "credit_card", "razorpay_key",
  "razorpay_secret", "shiprocket_password"
];

function sanitize(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== "object") {
    // If it's a string, double check if it contains a token or bearer keyword
    if (typeof obj === "string") {
      const lower = obj.toLowerCase();
      if (lower.includes("bearer ") || lower.includes("eyj")) {
        return "[REDACTED_SENSITIVE_STRING]";
      }
    }
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(sanitize);
  }
  
  const sanitized: any = {};
  for (const [key, val] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.some(sk => lowerKey.includes(sk))) {
      sanitized[key] = "[REDACTED_SENSITIVE_DATA]";
    } else if (typeof val === "object") {
      sanitized[key] = sanitize(val);
    } else {
      sanitized[key] = val;
    }
  }
  return sanitized;
}

function triggerAlert(level: "INFO" | "WARNING" | "ERROR" | "CRITICAL", message: string, logObj: any) {
  // Operational Alert Framework
  // Writes to structured console logs with alert markers for easy log forwarding/parsing
  const alertMarker = `🚨 [ALERT] [${level}]`;
  console.error(`${alertMarker} ${message}`, JSON.stringify(logObj));
  
  // Future Expansion: Trigger Slack/Email Webhooks
  // const slackWebhook = process.env.SLACK_ALERT_WEBHOOK_URL;
  // if (slackWebhook) { sendSlackWebhook(slackWebhook, level, message, logObj); }
  
  try {
    const Sentry = require("@sentry/nextjs");
    if (Sentry && typeof Sentry.captureMessage === "function") {
      Sentry.captureMessage(`[ALERT] [${level}] ${message}`, {
        level: level === "CRITICAL" ? "fatal" : level === "ERROR" ? "error" : level === "WARNING" ? "warning" : "info",
        extra: logObj,
      });
    }
  } catch (e) {
    // Sentry not loaded or configured — fail silently
  }
}

function log(level: "INFO" | "WARNING" | "ERROR" | "CRITICAL", message: string, meta?: any) {
  const context = logStorage.getStore() || {};
  
  // Sanitize both context and metadata
  const sanitizedContext = sanitize(context);
  const sanitizedMeta = sanitize(meta);

  const logObj = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...sanitizedContext,
    ...sanitizedMeta,
  };
  
  console.log(JSON.stringify(logObj));
  
  // Alert rules: WARNING, ERROR, or CRITICAL trigger the alert framework
  if (level !== "INFO") {
    triggerAlert(level, message, logObj);
  }
}

export const logger = {
  info(message: string, meta?: any) {
    log("INFO", message, meta);
  },
  warn(message: string, meta?: any) {
    log("WARNING", message, meta);
  },
  error(message: string, meta?: any) {
    log("ERROR", message, meta);
  },
  critical(message: string, meta?: any) {
    log("CRITICAL", message, meta);
  },
  
  // Helper to run code inside a logging context
  runWithContext<T>(context: LogContext, fn: () => T): T {
    return logStorage.run(context, fn);
  }
};
