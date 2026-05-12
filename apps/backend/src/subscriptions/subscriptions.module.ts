import { Module } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionsController } from './subscriptions.controller';
import { StripeService } from './billing/stripe.service';

@Module({
  providers: [SubscriptionsService, StripeService],
  controllers: [SubscriptionsController],
  exports: [SubscriptionsService, StripeService],
})
export class SubscriptionsModule {}
