/**
 * Email Delivery Worker Processor (Decoupled No-Op)
 */

export async function emailDeliveryProcessor(_job: any): Promise<void> {
  return Promise.resolve();
}
