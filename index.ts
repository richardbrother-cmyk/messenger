// ============================================================
//  Edge Function: send-push  (COMPLETA: personalizada + adjuntos)
//  Reemplaza TODO tu index.ts por este. Redespliega después.
// ============================================================
import { createClient } from 'jsr:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC') ?? '';
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE') ?? '';

webpush.setVapidDetails('mailto:hb.ricardo@outlook.com', VAPID_PUBLIC, VAPID_PRIVATE);

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    const msg = payload.record;
    if (!msg?.recipient_id) return new Response('payload inválido', { status: 200 });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Remitente: nombre + avatar (avatar_url es opcional; si no existe, queda null)
    const { data: sender } = await supabase
      .from('profiles')
      .select('display_name, avatar_url')
      .eq('id', msg.sender_id)
      .single();

    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('subscription')
      .eq('user_id', msg.recipient_id);

    if (!subs?.length) return new Response('no subs', { status: 200 });

    // Cuerpo según tipo de contenido
    let body: string;
    if (msg.content) body = String(msg.content).slice(0, 140);
    else if (msg.attachment_type?.startsWith('image/')) body = '📷 Te envió una foto';
    else if (msg.attachment_path) body = `📎 ${msg.attachment_name ?? 'Archivo adjunto'}`;
    else body = 'Nuevo mensaje';

    const senderName = sender?.display_name ?? 'Nuevo mensaje';

    const notification = JSON.stringify({
      title: senderName,
      body,
      icon: sender?.avatar_url || 'icon-192.png',
      senderId: msg.sender_id,
      senderName,
    });

    const results: unknown[] = [];
    for (const row of subs) {
      try {
        await webpush.sendNotification(row.subscription, notification);
        results.push({ ok: true });
      } catch (err) {
        results.push({ ok: false, statusCode: err?.statusCode ?? null });
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          await supabase.from('push_subscriptions').delete().eq('subscription', row.subscription);
        }
      }
    }

    return new Response(JSON.stringify({ sent: results }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ fatal: String(e) }), { status: 200 });
  }
});
