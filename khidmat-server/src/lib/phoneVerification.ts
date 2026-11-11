import { env } from '../config/env';

export interface PhoneVerificationPort {
  start(phone: string): Promise<void>;
  check(phone: string, code: string): Promise<boolean>;
}

class DevelopmentPhoneVerification implements PhoneVerificationPort {
  private challenges = new Map<string, { expiresAt: number; attempts: number; lastSentAt: number }>();

  async start(phone: string): Promise<void> {
    const now = Date.now();
    const current = this.challenges.get(phone);
    if (current && now - current.lastSentAt < 60_000) throw new Error('WAIT_BEFORE_RESEND');
    this.challenges.set(phone, { expiresAt: now + 10 * 60_000, attempts: 0, lastSentAt: now });
  }

  async check(phone: string, code: string): Promise<boolean> {
    const challenge = this.challenges.get(phone);
    if (!challenge || challenge.expiresAt < Date.now() || challenge.attempts >= 5) return false;
    challenge.attempts += 1;
    if (code !== '1234') return false;
    this.challenges.delete(phone);
    return true;
  }
}

class TwilioVerifyPhoneVerification implements PhoneVerificationPort {
  private readonly baseUrl: string;
  private readonly authorization: string;

  constructor(serviceSid: string, accountSid: string, authToken: string) {
    this.baseUrl = `https://verify.twilio.com/v2/Services/${encodeURIComponent(serviceSid)}`;
    this.authorization = `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`;
  }

  private async post(path: string, fields: Record<string, string>) {
    const response = await fetch(`${this.baseUrl}/${path}`, {
      method: 'POST',
      headers: {
        Authorization: this.authorization,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(fields),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`PHONE_PROVIDER_${response.status}`);
    return body;
  }

  async start(phone: string): Promise<void> {
    await this.post('Verifications', { To: phone, Channel: 'sms' });
  }

  async check(phone: string, code: string): Promise<boolean> {
    const result = await this.post('VerificationCheck', { To: phone, Code: code });
    return result.status === 'approved';
  }
}

export function createPhoneVerificationAdapter(): PhoneVerificationPort {
  if (env.TWILIO_VERIFY_SERVICE_SID && env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN) {
    return new TwilioVerifyPhoneVerification(
      env.TWILIO_VERIFY_SERVICE_SID,
      env.TWILIO_ACCOUNT_SID,
      env.TWILIO_AUTH_TOKEN,
    );
  }
  if (env.NODE_ENV === 'production') {
    throw new Error('Phone verification provider is required in production');
  }
  return new DevelopmentPhoneVerification();
}

export const phoneVerification = createPhoneVerificationAdapter();
