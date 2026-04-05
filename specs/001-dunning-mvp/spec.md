# Feature Specification: Failed Payment Recovery (Dunning) MVP

**Feature Branch**: `001-dunning-mvp`
**Created**: 2026-04-05
**Status**: Draft
**Input**: User description: "SaaS tool for recovering failed subscription payments through smart retries, dunning email sequences, hosted payment update pages, and a recovery dashboard"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Connect Stripe and Activate Recovery (Priority: P1)

A business owner signs up for Dunn Master, connects their Stripe account via OAuth, and activates automatic failed payment recovery. The entire onboarding process takes under 5 minutes with no technical configuration required.

**Why this priority**: Without Stripe connectivity, no other feature works. This is the foundation of the entire product.

**Independent Test**: Can be fully tested by creating an account, completing Stripe Connect OAuth, and verifying the system begins monitoring for failed payments.

**Acceptance Scenarios**:

1. **Given** a new user has registered, **When** they click "Connect Stripe", **Then** they are redirected to Stripe's OAuth flow and upon completion their Stripe account is linked and active.
2. **Given** a connected Stripe account, **When** a `invoice.payment_failed` webhook fires, **Then** the system captures the event and creates a recovery case for the failed invoice.
3. **Given** a user has connected Stripe, **When** they visit the dashboard, **Then** they see a confirmation that monitoring is active and their account status is "Connected".

---

### User Story 2 - Smart Retry of Failed Payments (Priority: P1)

When a subscription payment fails, the system automatically schedules retry attempts based on the decline type (soft vs hard), the customer's timezone, and optimal retry windows. Soft declines (insufficient funds, temporary holds) get multiple retries at smart intervals. Hard declines (expired card, stolen card) skip retries and go directly to the email sequence.

**Why this priority**: Payment retries are the primary recovery mechanism and the core value proposition. Many failed payments recover with a well-timed retry before the customer even notices.

**Independent Test**: Can be tested by triggering a simulated `invoice.payment_failed` event and verifying the system schedules retries at appropriate times based on decline code and customer timezone.

**Acceptance Scenarios**:

1. **Given** a soft decline (e.g., `insufficient_funds`), **When** the system processes the failure, **Then** it schedules up to 3 retry attempts at optimal times considering the customer's timezone.
2. **Given** a hard decline (e.g., `card_expired`), **When** the system processes the failure, **Then** it skips retries and immediately triggers the dunning email sequence.
3. **Given** a scheduled retry, **When** the retry succeeds, **Then** the recovery case is marked as recovered and the business owner is notified.
4. **Given** all retry attempts have been exhausted without success, **When** the final retry fails, **Then** the dunning email sequence begins.

---

### User Story 3 - Dunning Email Sequence (Priority: P1)

After retries are exhausted (or immediately for hard declines), the system sends a sequence of escalating emails to the customer: a friendly notice on day 1, an urgency message on day 4, and a final warning on day 7. Emails use customizable templates that match the business's branding.

**Why this priority**: Email outreach is the second-most effective recovery mechanism and directly addresses cases where the customer needs to take action (update card details).

**Independent Test**: Can be tested by triggering a recovery case that exhausts retries and verifying the three emails are sent at the correct intervals with the correct content.

**Acceptance Scenarios**:

1. **Given** a recovery case enters the email phase, **When** day 1 arrives, **Then** Email 1 ("There was a problem with your payment") is sent to the customer.
2. **Given** Email 1 was sent and payment is still failing, **When** day 4 arrives, **Then** Email 2 ("Your account is at risk") is sent.
3. **Given** Emails 1 and 2 were sent and payment is still failing, **When** day 7 arrives, **Then** Email 3 ("Final notice before cancellation") is sent.
4. **Given** the customer updates their payment method at any point during the sequence, **When** the next scheduled email would fire, **Then** it is cancelled and the recovery case is marked as recovered.
5. **Given** a business owner, **When** they access email template settings, **Then** they can customize the branding (logo, colors, company name) of all dunning emails.

---

### User Story 4 - Hosted Payment Update Page (Priority: P2)

Each dunning email includes a secure, tokenized link to a hosted page where the customer can update their payment method without logging in. The link expires after a configurable period for security.

**Why this priority**: Reducing friction for the customer to update their card is critical to recovery rates, but the page depends on the email sequence being functional first.

**Independent Test**: Can be tested by generating a payment update link, visiting it, submitting new card details, and verifying the payment method is updated in Stripe.

**Acceptance Scenarios**:

1. **Given** a dunning email is sent, **When** the customer clicks the "Update Payment" link, **Then** they see a branded page with a form to enter new card details — no login required.
2. **Given** a valid payment update link, **When** the customer submits new card details, **Then** the default payment method is updated in Stripe and a retry is immediately scheduled.
3. **Given** an expired or invalid link, **When** someone visits the URL, **Then** they see a friendly error message with instructions to contact the business.
4. **Given** a business on the Growth or Scale plan, **When** they access page settings, **Then** they can customize the page with their own branding (logo, colors, messaging).

---

### User Story 5 - Recovery Dashboard (Priority: P2)

The business owner can view a dashboard showing key recovery metrics: MRR at risk, MRR recovered this month, recovery rate percentage, and active pending payments. The dashboard provides a clear picture of the financial impact of the dunning system.

**Why this priority**: Visibility into recovery performance is essential for demonstrating ROI and is a key selling point ("see exactly how much you recovered"), but the core recovery mechanics must work first.

**Independent Test**: Can be tested by creating several recovery cases in various states (pending, recovered, failed) and verifying the dashboard displays accurate aggregated metrics.

**Acceptance Scenarios**:

1. **Given** active recovery cases exist, **When** the business owner visits the dashboard, **Then** they see current MRR at risk (sum of all pending failed invoices).
2. **Given** recovered payments this month, **When** the dashboard loads, **Then** it displays the total MRR recovered and the recovery rate as a percentage.
3. **Given** multiple recovery cases, **When** the business owner views the dashboard, **Then** they see a list of active pending payments with status, amount, and next action.
4. **Given** no recovery cases yet, **When** a new user views the dashboard, **Then** they see an empty state with guidance on what to expect once payments start being monitored.

---

### User Story 6 - Subscription Plan and Billing (Priority: P3)

Business owners can choose between Starter ($29/mo), Growth ($59/mo), and Scale ($99/mo) plans. Each tier has defined limits (MRR monitored, email sequences, customization, API access). The system enforces tier limits and provides clear upgrade prompts when limits are approached.

**Why this priority**: Monetization is essential but can launch with a single tier initially; tiered enforcement can follow the core recovery features.

**Independent Test**: Can be tested by subscribing to each tier and verifying that tier-specific limits are enforced and upgrade prompts appear at appropriate thresholds.

**Acceptance Scenarios**:

1. **Given** a new user, **When** they complete registration, **Then** they can select a pricing plan (Starter, Growth, or Scale) and complete payment via Stripe.
2. **Given** a Starter plan user monitoring more than $10K MRR, **When** a new failed payment would exceed their limit, **Then** they see a prompt to upgrade with a clear explanation of what they gain.
3. **Given** a user on any plan, **When** they visit billing settings, **Then** they see their current plan, usage against limits, and options to upgrade or downgrade.
4. **Given** a user wants to change plans, **When** they select a new tier, **Then** the change is applied with prorated billing at the next billing cycle.

---

### Edge Cases

- What happens when a Stripe account is disconnected mid-recovery? Active recovery cases MUST be paused and the business owner notified.
- What happens when a customer's subscription is cancelled by the business during dunning? The recovery case MUST be closed and remaining emails cancelled.
- What if the same invoice fails multiple times in rapid succession? The system MUST deduplicate and maintain a single recovery case per invoice.
- What happens when Stripe webhook delivery is delayed? The system MUST handle out-of-order events and use idempotency keys.
- What if a payment update page link is shared or forwarded? The link MUST be single-use or tied to a session token to prevent unauthorized access.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST connect to a user's Stripe account via Stripe Connect OAuth within 5 minutes of starting onboarding.
- **FR-002**: System MUST listen for `invoice.payment_failed` webhook events and create a recovery case for each unique failed invoice.
- **FR-003**: System MUST classify decline codes as soft or hard and apply different recovery strategies accordingly.
- **FR-004**: System MUST schedule payment retries at optimal times based on decline type and customer timezone.
- **FR-005**: System MUST send a sequence of up to 3 dunning emails at configurable intervals (default: day 1, day 4, day 7).
- **FR-006**: System MUST provide a hosted payment update page accessible via secure, expiring tokenized links.
- **FR-007**: System MUST update the customer's payment method in Stripe when new card details are submitted through the hosted page.
- **FR-008**: System MUST cancel pending emails and mark a recovery case as recovered when payment succeeds.
- **FR-009**: System MUST display a dashboard with MRR at risk, MRR recovered, recovery rate, and active pending payments.
- **FR-010**: System MUST enforce tier-based limits on MRR monitored and available features.
- **FR-011**: System MUST allow business owners to customize email templates with their branding (logo, colors, company name).
- **FR-012**: System MUST handle webhook idempotency — processing the same event ID multiple times MUST produce the same result.
- **FR-013**: System MUST support multi-currency display for businesses on the Scale plan.

### Key Entities

- **Business**: The SaaS customer using Dunn Master. Has a Stripe Connect account, a subscription plan, and branding settings.
- **Recovery Case**: Represents a single failed payment being actively recovered. Tracks the invoice, decline type, retry attempts, email sequence progress, and final outcome (recovered/failed/cancelled).
- **Retry Attempt**: An individual payment retry within a recovery case. Records scheduled time, actual execution time, and result.
- **Dunning Email**: A scheduled or sent email within the dunning sequence. Tracks template used, scheduled send time, actual send time, and delivery status.
- **Payment Update Session**: A secure, time-limited session for a customer to update their payment method. Linked to a recovery case and contains an expiring token.
- **Subscription Plan**: The Dunn Master tier the business is on (Starter/Growth/Scale), with associated limits and feature flags.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Business owners complete Stripe connection and activation in under 5 minutes from registration.
- **SC-002**: At least 30% of soft-decline failed payments are recovered through automatic retries alone (without customer intervention).
- **SC-003**: The combined recovery rate (retries + email sequence + payment update) reaches at least 50% of all failed payments within 14 days.
- **SC-004**: 90% of customers who receive a dunning email and click the payment update link successfully complete the card update process.
- **SC-005**: Dashboard data reflects accurate recovery metrics with no more than 5-minute delay from the actual event.
- **SC-006**: The system processes failed payment events and schedules the first action (retry or email) within 60 seconds of receiving the webhook.
- **SC-007**: Business owners report clear understanding of their recovery ROI within one visit to the dashboard.

## Assumptions

- Business owners already have an active Stripe account with existing subscriptions before connecting to Dunn Master.
- Stripe Connect OAuth is the sole integration method; direct API key entry is out of scope for MVP.
- The system operates on Stripe's webhook infrastructure for event delivery; polling is not used.
- Email delivery uses a third-party transactional email service; deliverability optimization (SPF, DKIM, DMARC) is the business owner's responsibility for custom sending domains.
- Optimal retry times are based on published industry research on payment success rates by time-of-day and day-of-week; ML-based optimization is out of scope for MVP.
- The hosted payment update page uses Stripe Elements for PCI compliance; Dunn Master never directly handles raw card numbers.
- Multi-currency support (Scale plan) means displaying amounts in the customer's invoice currency; currency conversion is handled by Stripe.
- The MVP targets English-language emails only; internationalization is out of scope.
- A 14-day recovery window is the default dunning cycle length; after 14 days with no recovery, the case is marked as failed.
