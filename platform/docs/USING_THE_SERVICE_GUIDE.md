# Using the Service Guide

Operational guide based on implemented platform behavior as of 2026-08-05.

## 1. Create an account

1. Open the signup page.
2. Enter your full name.
3. Enter a valid email address.
4. Add a referral code if you have one.
5. Choose your role.
   - `User` creates a standard participant account.
   - `Advertiser` creates a business-facing onboarding path.
6. Create a password with at least 8 characters.
7. Confirm the password and submit.

What happens next:

- Your account is created through the authentication service.
- If you had a stored promotional reward reservation as a guest, the app attempts to bind it to your new account.
- You are redirected to sign in.
- Email verification and later recovery messages use the email address you entered.

## 2. Sign in and recover access

The platform currently supports several access paths:

- Email and password sign-in.
- OAuth sign-in through supported providers.
- Phone OTP for existing users where enabled.
- Password reset from the forgot-password flow.

Security behaviors already implemented:

- Failed sign-in attempts may trigger temporary lock protection.
- Sessions are registered with a device/session identifier.
- Remembered logins can extend session duration.
- Active sessions can be reviewed and revoked.
- MFA factors can be enrolled and verified.

## 3. Complete your profile and onboarding

After sign-in, go to your profile and onboarding routes.

Recommended first steps:

1. Verify your email if prompted.
2. Add or update profile details.
3. Review your membership tier, badges, and balances.
4. Open task onboarding.
5. Save your preferred task types.
6. Add the social profile JSON or platform handles required for compliance-aware tasks.

The onboarding flow is designed to help later task verification and social-proof checks.

## 4. Browse campaigns and open tasks

Users can browse available campaigns and then move into task and reward flows. The current authenticated user routes include:

- Dashboard
- Campaign browse and campaign detail
- Tasks
- Wallet
- Orders
- Merchant dashboard
- Notifications
- Gamification

Use the dashboard to monitor rewards, activity, and pending work. Use campaigns to inspect available opportunities before you start.

## 5. Complete daily tasks

Daily task completion currently spans two connected experiences: the tasks page and the gamification page.

### A. Finish the onboarding prerequisites

Before relying on task rewards, make sure you have:

1. A signed-in account.
2. A completed onboarding profile.
3. Any required social handles or profile payload saved.
4. A supported device and browser state for the task type you want to perform.

### B. Use the tasks page correctly

The current tasks page is implemented as a verified reward-video workflow with multiple campaign examples.

To complete a task successfully:

1. Open the task you want to run.
2. Start the session from the task interface.
3. Keep the video or task flow active until the watch threshold or completion threshold is reached.
4. Do not switch tabs, hide the page, lose focus repeatedly, or seek through the content to skip ahead.
5. Wait for the claim window to become available.
6. Claim the reward only after the session is verified.

What the system tracks during daily task completion:

- Watch seconds.
- Completion percentage.
- Heartbeat counts.
- Hidden-tab events.
- Focus-loss counts.
- Seek violations.
- Anti-cheat flags.
- Frequency limits and daily view limits by campaign.

Practical guidance:

- Use one account only.
- Let the task run naturally to completion.
- Avoid device or browser behavior that looks like automation.
- If a task enters review or is denied, check your status messages instead of rerunning it immediately.

### C. Use the gamification page daily

The gamification page adds daily progression on top of core task completion.

You can currently:

- Claim a daily login bonus.
- Build a streak.
- Complete quests.
- Earn XP.
- Track achievements.
- View leaderboard rank.
- Use available spin tokens.
- Open mystery rewards.

The effective daily task plan depends on your membership level. That means the title, expectations, or XP impact of your daily plan can differ by tier.

## 6. Understand rewards, balances, and wallet activity

The wallet page combines multiple records:

- Wallet accounts by balance type.
- Reward ledger history.
- Wallet transactions.
- Wallet transfers.
- Withdrawal requests.
- Receipt-confirmation queue items.

Current wallet account types include main, bonus, referral, cashback, reward, and merchant-specific balances.

Typical reward flow:

1. Complete a verified task or qualifying action.
2. Wait for the reward to enter an eligible state.
3. Review reward and wallet history.
4. Transfer balances between eligible internal wallet types where allowed.
5. Request withdrawal only when your membership tier and wallet policy allow it.

## 7. Request a withdrawal

Withdrawal access is controlled by platform rules.

Important implemented rules to know:

- Free-tier members cannot withdraw funds.
- The platform applies configured minimum and maximum withdrawal limits.
- Processing fees may reduce the net amount received.
- Supported payout methods may include bank transfer, crypto, PayPal, gift cards, and manual payout.
- Some requests can be scheduled for a future date.
- A request may be held after repeated successful withdrawals until you upgrade your plan.
- Outstanding membership fee obligations can affect eligibility.
- Compliance review can delay approval.

How to request a withdrawal:

1. Open the wallet page.
2. Enter the amount.
3. Choose a payout method.
4. Enter the payout destination label and destination value.
5. Confirm the destination currency.
6. Choose a scheduled date if needed.
7. Add an optional note.
8. Submit the request.

After submission, monitor:

- Status messages on the wallet page.
- Notification history.
- The receipt queue when funds are marked as needing confirmation.

If you receive a payout, use the wallet flow to confirm receipt. If funds do not arrive, use the non-receipt reporting path so the payout workflow can be reviewed.

## 8. Use the promotional spin and reward vault

The app includes a promotional reward wheel that can appear on configured public surfaces such as home, signup, or membership-related pages.

What to expect:

1. The wheel may not always be enabled.
2. Availability can depend on rollout stage, cooldown, and guest-display settings.
3. A spin can return a prize outcome and a reward amount.
4. The result may create a vault reservation instead of an immediate cashout.
5. Reservations can require account creation, verification, referrals, membership purchase, and completion before expiry.

Use the status messages around the wheel and reward vault to understand what still blocks release.

## 9. Manage notifications and account security

The platform stores and displays notification history for account, reward, compliance, and payout events.

Notification channels supported in the codebase include:

- In-app
- Email
- Push
- SMS
- WhatsApp
- Telegram

Not every channel is guaranteed to deliver in every environment. Some flows are implemented as best-effort dispatch through backend functions.

For better account security:

1. Use a strong password.
2. Verify your email.
3. Enroll MFA if it is available to you.
4. Review active sessions and revoke unfamiliar ones.
5. Do not share login codes or devices.

## 10. Use merchant and order features when applicable

If your account uses merchant or order flows, the app supports order monitoring, payment-intent creation, merchant analytics, and receipt or dispute-related workflows.

Use these routes only if they apply to your role and current access level.

## 11. Advertiser quick start

If you selected the advertiser role, your next steps are:

1. Sign in.
2. Open the business dashboard.
3. Create or edit campaigns.
4. Review submissions.
5. Monitor analytics and communications.

Advertiser features are role-restricted and separate from the standard user reward flow.

## 12. When something does not look right

If a task does not credit, a withdrawal is held, or a notification indicates review:

1. Check the relevant page status message.
2. Review your notifications.
3. Confirm you completed onboarding and verification requirements.
4. Avoid retrying the same action in a way that could trigger fraud controls.
5. Contact support or use the appropriate escalation path published by your deployment.
