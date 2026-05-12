import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface CreateCheckoutSessionInput {
  userId: string;
  email: string;
  planId: string;
  stripePriceId?: string;
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutSessionResult {
  url: string | null;
  sessionId: string | null;
  /** True when Stripe is fully wired; false when running in stub mode. */
  live: boolean;
}

/**
 * Stripe abstraction layer.
 *
 * The real `stripe` SDK is intentionally NOT a hard dependency yet — Stripe
 * integration must be PREPARED but not fully wired. The service exposes a
 * stable surface (`createCheckoutSession`, `cancelSubscription`,
 * `verifyWebhook`) so callers don't change when the SDK is plugged in.
 *
 * When STRIPE_API_KEY is not configured every call returns a "stub" response
 * and logs a warning rather than throwing — this keeps the rest of the
 * subscription flow exercised in dev.
 */
@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private readonly enabled: boolean;

  constructor(private config: ConfigService) {
    this.enabled = !!this.config.get<string>('stripe.apiKey');
    if (!this.enabled) {
      this.logger.warn(
        'Stripe is not configured (STRIPE_API_KEY missing). Billing runs in stub mode.',
      );
    }
  }

  isLive(): boolean {
    return this.enabled;
  }

  async createCheckoutSession(
    input: CreateCheckoutSessionInput,
  ): Promise<CheckoutSessionResult> {
    if (!this.enabled) {
      // Stub: return a fake "url" so the frontend flow is still exercisable.
      return {
        url: `${input.successUrl}?stub=true&plan=${input.planId}`,
        sessionId: null,
        live: false,
      };
    }
    // TODO(stripe): instantiate Stripe SDK, build line_items, return real session
    this.logger.log(`Would create Stripe checkout for user=${input.userId} plan=${input.planId}`);
    return { url: null, sessionId: null, live: true };
  }

  async cancelSubscription(stripeSubscriptionId: string): Promise<void> {
    if (!this.enabled) {
      this.logger.log(`[stub] cancel Stripe sub ${stripeSubscriptionId}`);
      return;
    }
    // TODO(stripe): call stripe.subscriptions.cancel(stripeSubscriptionId)
    this.logger.log(`Would cancel Stripe sub ${stripeSubscriptionId}`);
  }

  /**
   * Verifies an incoming Stripe webhook signature.
   * Returns the parsed event payload, or `null` if disabled / invalid.
   */
  async verifyWebhook(_rawBody: Buffer, _signature: string): Promise<unknown | null> {
    if (!this.enabled) return null;
    // TODO(stripe): use stripe.webhooks.constructEvent
    return null;
  }
}
