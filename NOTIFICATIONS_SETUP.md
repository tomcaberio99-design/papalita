# Papalita Notifications — setup and deployment

This ZIP contains the existing Papalita site plus an additive notification UI and Supabase backend code. **Push will not work until the steps below are completed.** The old local/demo notification history in app.js remains separate.

## 1. Database
Run `supabase/migrations/20261027_notifications.sql` in your Supabase SQL Editor. It creates `customer_notifications`, `push_subscriptions`, and `customer_vouchers`, with per-user row-level security.

## 2. VAPID keys
Generate a VAPID key pair on a trusted computer using `npx web-push generate-vapid-keys` (Node.js required). Never publish the PRIVATE key.
Paste only the **public** key in `js/notifications.js`, at `const vapidPublicKey = '';`.

## 3. Supabase Edge Function secrets
Configure `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (e.g. `mailto:admin@example.com`), and a long random `PAPALITA_NOTIFICATION_SECRET` in Supabase function secrets. Supabase provides `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to Edge Functions in its hosted environment. Do not commit any of these secrets to GitHub.

Deploy `send-notifications` and `voucher-reminders` Edge Functions. Both use `npm:web-push`; verify compatibility with your Supabase Edge Runtime during deployment. Disable Supabase gateway JWT verification for **these two functions only**, since both verify `x-papalita-secret` server-side. Never send this secret from browser JavaScript.

## 4. Authentication caveat
The new notifications use **Supabase Auth user IDs**, not the local/demo login IDs in `app.js`. If customers only use the local/demo login system, they cannot subscribe or receive account-targeted notifications. Connect real customer registration/login to Supabase Auth before enabling production push.

## 5. Try a test notification
After a real Supabase Auth login, open the notification bell, tap **Enable phone notifications**, and allow browser permission.

From a trusted backend or terminal (NOT from the public website), POST to:
`https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-notifications`

Headers: `Content-Type: application/json`, `x-papalita-secret: YOUR_SECRET`.
Body: `{"user_id":"AUTH_USER_UUID","title":"Welcome to Papalita!","body":"Notifications are working.","type":"promo","url":"#/promos"}`.

The sender creates the in-app notification even if the phone has no push subscription. It sends push to all saved subscriptions for that user.

## 6. Automatic voucher reminders
Insert actual user vouchers into `customer_vouchers` from your trusted admin/backend, with `user_id`, `code`, and `expires_at`. The existing hardcoded `window.PROMOS` demo offers are **not** automatically imported into this table.

Schedule an hourly POST to `/functions/v1/voucher-reminders` with the same secret header, using Supabase Cron or another trusted scheduler. This sends reminders for vouchers expiring within 24 hours and sets `reminder_sent_at` to prevent duplicates. Do not put scheduler secrets in public tables or source code.

## 7. Test checklist
- Site works normally: catalog, cart, checkout, install invitation.
- Signed-in Supabase user can open notification bell and see synced messages.
- Push permission is requested only when tapping **Enable phone notifications**.
- Send test message from server; verify in-app notification and Android notification panel.
- Tap notification: opens Papalita route.
- Test voucher expiring within 24 hours and run scheduler manually.
- Verify on an actual installed Chrome PWA; Messenger in-app browser may not support push.

## Production notes
The `send-notifications` function is an **admin/server-only endpoint**, not a public admin UI. Order updates require your real order-status backend to call this function. A voucher admin creation interface is also not included. For large-scale sending, add queueing/retry, unsubscribe handling, per-user preferences, and observability. No browser or OS guarantees instant push delivery.
