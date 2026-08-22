// ============================================================================
//  notify-contact — emails a contact-form submission to the site owner.
//
//  Deploy:
//    supabase functions deploy notify-contact --no-verify-jwt
//
//  Required secret:
//    supabase secrets set RESEND_API_KEY=re_xxxxxxxx
//
//  Optional secrets:
//    NOTIFY_TO    — destination inbox   (default: ailenettugna@gmail.com)
//    NOTIFY_FROM  — verified sender     (default: onboarding@resend.dev)
//    ALLOW_ORIGIN — CORS origin         (default: * )
// ============================================================================

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const NOTIFY_TO      = Deno.env.get("NOTIFY_TO")      ?? "ailenettugna@gmail.com";
const NOTIFY_FROM    = Deno.env.get("NOTIFY_FROM")    ?? "Website <onboarding@resend.dev>";
const ALLOW_ORIGIN   = Deno.env.get("ALLOW_ORIGIN")   ?? "*";

const cors = {
  "Access-Control-Allow-Origin": ALLOW_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

/** Escape user input before it goes anywhere near an HTML email body. */
function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!
  ));
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST")    return json({ error: "Method not allowed" }, 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Body must be JSON" }, 400);
  }

  // A Supabase Database Webhook wraps the row in { type, table, record }.
  // A direct client call sends the fields at the top level. Accept both.
  const src = (body.record ?? body) as Record<string, unknown>;

  const name    = String(src.name    ?? "").trim();
  const email   = String(src.email   ?? "").trim();
  const message = String(src.message ?? "").trim();

  if (!name || name.length > 120)             return json({ error: "Invalid name" }, 400);
  if (!EMAIL_RE.test(email))                  return json({ error: "Invalid email" }, 400);
  if (message.length < 10 || message.length > 2000) return json({ error: "Invalid message" }, 400);

  if (!RESEND_API_KEY) {
    console.error("RESEND_API_KEY is not set — cannot send mail.");
    return json({ error: "Email service is not configured" }, 500);
  }

  const received = new Date().toUTCString();

  const html = `
    <div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;color:#0A1D4B">
      <p style="font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:#8E1C24;margin:0 0 6px">
        New enquiry &middot; ailenetungalatugna.com
      </p>
      <h2 style="font-family:Georgia,serif;font-weight:400;font-size:26px;margin:0 0 24px">${esc(name)}</h2>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #E3D8C7;color:#8a8078;width:96px">Email</td>
          <td style="padding:10px 0;border-bottom:1px solid #E3D8C7">
            <a href="mailto:${esc(email)}" style="color:#8E1C24">${esc(email)}</a>
          </td>
        </tr>
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #E3D8C7;color:#8a8078">Received</td>
          <td style="padding:10px 0;border-bottom:1px solid #E3D8C7">${esc(received)}</td>
        </tr>
      </table>
      <p style="font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#8a8078;margin:28px 0 8px">Message</p>
      <div style="white-space:pre-wrap;line-height:1.7;font-size:15px;border-left:2px solid #B99B6B;padding-left:16px">${esc(message)}</div>
      <p style="margin-top:32px;font-size:12px;color:#8a8078">
        Reply directly to this email to answer ${esc(name)}.
      </p>
    </div>`;

  const text =
    `New enquiry — ailenetungalatugna.com\n\n` +
    `Name:     ${name}\n` +
    `Email:    ${email}\n` +
    `Received: ${received}\n\n` +
    `Message:\n${message}\n`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: NOTIFY_FROM,
      to: [NOTIFY_TO],
      reply_to: email,
      subject: `New enquiry from ${name}`,
      html,
      text,
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    console.error("Resend rejected the send:", res.status, detail);
    return json({ error: "Email provider rejected the message", detail }, 502);
  }

  return json({ ok: true });
});
