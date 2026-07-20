/**
 * Email Queue Helper Interface (Decoupled No-Op Implementation)
 *
 * Prevents BullMQ email queueing and database email log creation.
 */

export async function queueEmailHelper(_params: {
  recipient: string;
  subject: string;
  html: string;
  templateName: string;
  variables: any;
  deduplicationKey: string;
}): Promise<void> {
  return Promise.resolve();
}
