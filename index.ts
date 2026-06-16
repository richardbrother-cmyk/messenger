// ============================================================
//  Edge Function: send-push  (versión con logs de depuración)
//  Reemplaza tu index.ts, redespliega, y revisa los Logs.
// ============================================================
import { createClient } from 'jsr:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC')!;
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE')!;

console.log('VAPID_PUBLIC (primeros 12):', VAPID_PUBLIC?.slice(0, 12));
console.log('VAPID_PRIVATE presente:', !!VAPID_PRIVATE);

webpush.setVapidDetails('mailto:tu-correo@ejemplo.com', VAPID_PUBLIC, VAPID_PRIVATE);

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    const msg = payload.record;
    console.log('Mensaje recibido para recipient:', msg?.recipient_id);

    if (!msg?.recipient_id) {
      return new Response('payload inválido', { status: 200 });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: sender } = await supabase
      .from('profiles').select('display_name').eq('id', msg.sender_id).single();

    const { data: subs, error: subsErr } = await supabase
      .from('push_subscriptions').select('subscription').eq('user_id', msg.recipient_id);

    if (subsErr) console.error('Error leyendo suscripciones:', subsErr);
    console.log('Suscripciones encontradas:', subs?.length ?? 0);

    if (!subs?.length) {
      return new Response('no subs', { status: 200 });
    }

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

    let okCount = 0, failCount = 0;
    await Promise.all(
      subs.map(async (row) => {
        try {
          await webpush.sendNotification(row.subscription, notification);
          okCount++;
        } catch (err) {
          failCount++;
          console.error('FALLO PUSH — statusCode:', err?.statusCode, '| body:', err?.body, '| msg:', err?.message);
          if (err?.statusCode === 410 || err?.statusCode === 404) {
            await supabase.from('push_subscriptions').delete().eq('subscription', row.subscription);
          }
        }
      }),
    );

    console.log(`Resultado: ${okCount} enviados, ${failCount} fallidos`);
    return new Response('ok', { status: 200 });
  } catch (e) {
    console.error('Fallo en send-push:', e);
    return new Response('error', { status: 200 });
  }
});
