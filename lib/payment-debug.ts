export interface PaymentDebugPayload {
  traceId?: string;
  timestamp?: string;
  functionName: string;
  orderId?: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  oldStatus?: string;
  newStatus?: string;
  reason?: string;
  rpc?: string;
  rpcResult?: string;
  jobId?: string;
  jobName?: string;
  attemptsMade?: number;
  error?: string;
  metadata?: any;
}

export function paymentDebugLog(payload: PaymentDebugPayload) {
  const logObj = {
    timestamp: payload.timestamp || new Date().toISOString(),
    traceId: payload.traceId || "N/A",
    functionName: payload.functionName,
    orderId: payload.orderId || "N/A",
    razorpayOrderId: payload.razorpayOrderId || "N/A",
    razorpayPaymentId: payload.razorpayPaymentId || "N/A",
    oldStatus: payload.oldStatus || undefined,
    newStatus: payload.newStatus || undefined,
    reason: payload.reason || undefined,
    rpc: payload.rpc || undefined,
    rpcResult: payload.rpcResult || undefined,
    jobId: payload.jobId || undefined,
    jobName: payload.jobName || undefined,
    attemptsMade: payload.attemptsMade !== undefined ? payload.attemptsMade : undefined,
    error: payload.error || undefined,
    metadata: payload.metadata || undefined,
  };

  console.log(`[PAYMENT_DEBUG] ${JSON.stringify(logObj)}`);
}
