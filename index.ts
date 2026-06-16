// ============================================================
//  Edge Function: send-push  (DIAGNÓSTICO en la respuesta)
//  Esta versión devuelve el resultado en el cuerpo del curl,
//  así no dependes de la vista de Logs.
// ============================================================
import { createClient } from 'jsr:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC') ?? '';
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE') ?? '';

webpush.setVapidDetails('mailto:hb.ricardo@outlook.com', VAPID_PUBLIC, VAPID_PRIVATE);

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  const diag: Record<string, unknown> = {
    vapid_public_prefix: VAPID_PUBLIC.slice(0, 16),
    vapid_private_present: VAPID_PRIVATE.length > 0,
  };
  try {
    const payload = await req.json();
    const msg = payload.record;
    diag.recipient = msg?.recipient_id ?? null;

    if (!msg?.recipient_id) return json({ ...diag, error: 'payload inválido' });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: sender } = await supabase
      .from('profiles').select('display_name').eq('id', msg.sender_id).single();

    const { data: subs, error: subsErr } = await supabase
      .from('push_subscriptions').select('subscription').eq('user_id', msg.recipient_id);

    diag.subs_error = subsErr?.message ?? null;
    diag.subs_count = subs?.length ?? 0;

    if (!subs?.length) return json({ ...diag, result: 'no subs' });

    let body: string;
    if (msg.content) body = String(msg.content).slice(0, 120);
    else if (msg.attachment_type?.startsWith('image/')) body = '📷 Te envió una foto';
    else if (msg.attachment_path) body = `📎 ${msg.attachment_name ?? 'Archivo adjunto'}`;
    else body = 'Nuevo mensaje';

    const notification = JSON.stringify({
      title: sender?.display_name ?? 'Nuevo mensaje',
      body,
      url: './index.html',
    });

    const results: unknown[] = [];
    for (const row of subs) {
      try {
        await webpush.sendNotification(row.subscription, notification);
        results.push({ ok: true });
      } catch (err) {
        results.push({
          ok: false,
          statusCode: err?.statusCode ?? null,
          body: err?.body ?? null,
          message: err?.message ?? String(err),
        });
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          await supabase.from('push_subscriptions').delete().eq('subscription', row.subscription);
        }
      }
    }

    return json({ ...diag, results });
  } catch (e) {
    return json({ ...diag, fatal: String(e) });
  }
});
