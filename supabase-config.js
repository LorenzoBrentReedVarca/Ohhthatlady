/* ==========================================================================
   Supabase configuration
   --------------------------------------------------------------------------
   The anon / publishable key is safe to ship in the browser. What protects the
   database is Row Level Security, not the secrecy of this key. See SETUP.md.
   ========================================================================== */

const SUPABASE_URL      = 'https://jojupwhsfzefucbfwctw.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_vknKlBqE09pOU_7flYlChg_SyOvLSud';

/* Table that stores every contact submission. */
const CONTACT_TABLE = 'contact_messages';

/* Table that logs a lightweight, cookie-free record of each visit — see
   SETUP.md and supabase/schema.sql. Set to '' to disable visit logging. */
const VISITS_TABLE = 'page_visits';

/* Edge Function that emails the notification. Deploy it with:
     supabase functions deploy notify-contact
   Set it to '' to skip the email step and only write to the database. */
const NOTIFY_FUNCTION = 'notify-contact';

/* Where contact-form notifications are delivered. Also used for the
   "email me directly instead" fallback link when the network is down. */
const NOTIFY_EMAIL = 'ailenettugna@gmail.com';

/* -------------------------------------------------------------------------- */

let supabaseClient = null;

(function initSupabase(){
  const placeholder = !SUPABASE_URL ||
                      !SUPABASE_ANON_KEY ||
                      SUPABASE_URL.indexOf('YOUR_') === 0 ||
                      SUPABASE_ANON_KEY.indexOf('YOUR_') === 0;

  if (placeholder) {
    console.warn('[supabase] Credentials not configured — the contact form will fall back to email.');
    return;
  }
  if (typeof supabase === 'undefined') {
    console.warn('[supabase] Client library did not load. Check the CDN <script> tag in index.html.');
    return;
  }
  supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
})();
