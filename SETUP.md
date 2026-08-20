# Setup — contact form → database → your inbox

The site is finished and runs as-is. This document covers the one part that
needs your hands: making contact-form messages arrive at
**brentreed623@gmail.com**.

## Current state

I checked your Supabase project (`jojupwhsfzefucbfwctw`) directly:

- The URL and publishable key in `supabase-config.js` are **valid** — the API
  accepts them.
- The project has **no tables**. `contact_messages` does not exist yet, so
  submissions currently fail and the form falls back to offering the visitor a
  pre-filled `mailto:` link to your address.

Two steps fix that.

---

## Step 1 — Create the table (2 minutes, required)

1. Open <https://supabase.com/dashboard/project/jojupwhsfzefucbfwctw/sql/new>
2. Paste the entire contents of [`supabase/schema.sql`](supabase/schema.sql)
3. Click **Run**

That creates **two** tables, both locked down with Row Level Security the same
way: anonymous visitors can **insert** and nothing else — they cannot read,
edit or delete any row, including their own. Only you (via the dashboard) and
the Edge Function can read them.

| Table | What it's for | Where to read it |
|---|---|---|
| `contact_messages` | Every message submitted through the contact form | *Table Editor → contact_messages* |
| `page_visits` | A lightweight log of who checks the website | *Table Editor → page_visits* |

**After this step the form works** and every message is stored.

### About `page_visits`

Every time someone loads the site, one row is written: a timestamp, the page/
section they landed on, where they came from (`document.referrer`), their
browser and language, and their screen size. No cookies, no IP address, no
third-party tracker — it's a visit counter, not a profile. It fails silently
if the table doesn't exist yet, so nothing breaks before you run the SQL above.

To see visits: *Table Editor → page_visits*, sort by `visited_at`. For a
running count, run this in the SQL Editor:

```sql
select count(*) as total_visits,
       count(*) filter (where visited_at > now() - interval '7 days') as last_7_days
from public.page_visits;
```

---

## Step 2 — Turn on email delivery

The database is the system of record; email is the notification on top of it.

### 2a. Get a Resend API key (free — 3,000 emails/month)

1. Sign up at <https://resend.com>
2. **API Keys → Create API Key**, copy the `re_...` value

You can send from `onboarding@resend.dev` immediately without verifying a
domain. To send from your own domain later, verify it under **Domains** and set
the `NOTIFY_FROM` secret accordingly.

### 2b. Deploy the Edge Function

With the [Supabase CLI](https://supabase.com/docs/guides/cli) installed, from
this folder:

```bash
supabase login
supabase link --project-ref jojupwhsfzefucbfwctw

supabase secrets set RESEND_API_KEY=re_your_key_here
supabase secrets set NOTIFY_TO=brentreed623@gmail.com

supabase functions deploy notify-contact --no-verify-jwt
```

`--no-verify-jwt` matters: visitors are anonymous, so the function must not
demand a signed-in user. (`supabase/config.toml` already sets this too.)

**Prefer not to install the CLI?** You can paste the function in the dashboard
instead: *Edge Functions → Deploy a new function*, name it `notify-contact`,
paste [`supabase/functions/notify-contact/index.ts`](supabase/functions/notify-contact/index.ts),
then add the secrets under *Edge Functions → Secrets* and turn **Verify JWT**
off in the function's settings.

### 2c. Test it

Open the site, fill in the contact form, submit. You should see
*"Thank you — your message is on its way"* and an email within a few seconds.

If the email does not arrive, check *Edge Functions → notify-contact → Logs*.
The message is still safely in the table either way.

---

## How the form behaves

The three outcomes, all handled:

| Situation | What the visitor sees | What you get |
|---|---|---|
| Everything working | "Your message is on its way." | Row in the table **+** email |
| Table exists, email not set up yet | "Your message has been received." | Row in the table |
| Database unreachable | Error **+** a pre-filled `mailto:` link to your address | The visitor's own email |

The form never silently swallows a message. A save that succeeds but an email
that fails still reports success to the visitor, because the message *was*
received — you just read it in the dashboard rather than your inbox.

Also built in:

- **Honeypot field** — a hidden `company` input. Bots fill it, humans can't see
  it; those submissions are discarded silently.
- **Validation** on both sides. The browser checks name/email/message before
  sending; the SQL `CHECK` constraints and the Edge Function re-validate, so a
  crafted request straight at the API cannot write junk.
- **HTML escaping** in the email body, so a message containing markup cannot
  inject anything into the mail you open.

---

## Optional hardening: send email from a database trigger

Invoking the function from the browser is simple, but it means a visitor who
closes the tab at the wrong moment can save a row without triggering the email.
To make the email fire from the database itself:

1. *Database → Webhooks → Create a new hook*
2. Table `contact_messages`, event **Insert**
3. Type **Supabase Edge Function**, choose `notify-contact`

The function already accepts the webhook's `{ record: {...} }` payload shape as
well as a direct call, so no code change is needed. Then set
`NOTIFY_FUNCTION = ''` in `supabase-config.js` so the email is not sent twice.

---

## About the publishable key in the source

`sb_publishable_...` is designed to be public — it identifies the project, it
does not grant authority. Row Level Security is what actually protects the
data, which is why Step 1 sets an insert-only policy. Never put a
`service_role` or `sb_secret_...` key in any file the browser downloads.
