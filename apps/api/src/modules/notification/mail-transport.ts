/** One message as it leaves the system (INT-001). */
export interface MailMessage {
  to: string[];
  subject: string;
  text: string;
}

/**
 * The outbound mail port. Implementations must reject when the server does not accept the
 * message — the caller treats any rejection as "not sent" and never retries (BR-mrr-019).
 */
export interface MailTransport {
  send(message: MailMessage): Promise<void>;
}

export const MAIL_TRANSPORT = Symbol('MAIL_TRANSPORT');
