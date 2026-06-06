import { createFileRoute } from '@tanstack/react-router';
import { supabaseAdmin } from '@/integrations/supabase/client.server';
import { sendUtmifyOrder } from '@/lib/utmify.server';
import { sendOrderApprovedEmail } from '@/lib/email/sendOrderApprovedEmail.server';
import { sendAndLogMetaCapiPurchase } from '@/lib/meta-capi.server';

// POST /api/public/asaas-webhook
// Webhook chamado pelo Asaas quando o status de uma cobrança muda.

const cors = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, access_token',
  'Cache-Control': 'no-store',
};

// Eventos do Asaas que indicam pagamento confirmado
const PAID_EVENTS = new Set([
  'PAYMENT_RECEIVED',
  'PAYMENT_CONFIRMED',
  'PAYMENT_OVERDUE_RECEIVED',
]);

export const Route = createFileRoute('/api/public/asaas-webhook')({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),

      GET: async () =>
        new Response(
          JSON.stringify({ ok: true, route: 'asaas-webhook', method: 'POST' }),
          { status: 200, headers: cors },
        ),

      POST: async ({ request }) => {
        const headersObj: Record<string, string> = {};
        request.headers.forEach((v, k) => { headersObj[k] = v; });
        console.log('[ASAAS_WEBHOOK_HEADERS]', headersObj);

        // Validação do token de segurança do Asaas (header asaas-access-token)
        const expectedToken = process.env.ASAAS_WEBHOOK_TOKEN?.trim();
        const isInternal = headersObj['x-asaas-internal'] === '1';
        if (expectedToken && !isInternal) {
          const receivedToken = headersObj['asaas-access-token'] || headersObj['authorization'] || '';
          if (receivedToken !== expectedToken) {
            console.warn('[ASAAS_WEBHOOK] token inválido', { received: receivedToken?.slice(0, 8) });
            return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: cors });
          }
        }

        let rawBody = '';
        try {
          rawBody = await request.text();
        } catch (err) {
          console.error('[ASAAS_WEBHOOK] erro ao ler body', err);
          return new Response(JSON.stringify({ error: 'cannot read body' }), { status: 400, headers: cors });
        }
        console.log('[ASAAS_WEBHOOK_BODY_RAW]', rawBody);

        let json: any;
        try {
          json = JSON.parse(rawBody);
        } catch {
          console.error('[ASAAS_WEBHOOK] json inválido', rawBody);
          return new Response(JSON.stringify({ error: 'invalid json' }), { status: 400, headers: cors });
        }
        console.log('[ASAAS_WEBHOOK_BODY_JSON]', json);

        const event = String(json?.event || '').toUpperCase().trim();
        const payment = json?.payment || {};
        const paymentId: string = payment?.id || '';
        const externalRef: string = payment?.externalReference || '';
        const paymentStatus: string = String(payment?.status || '').toUpperCase();

        console.log('[ASAAS_WEBHOOK_EVENTO]', { event, paymentId, externalRef, paymentStatus });

        // Ignorar eventos não-pagamento
        if (!PAID_EVENTS.has(event)) {
          console.log('[asaas-webhook] evento ignorado', { event, paymentId });
          return new Response(
            JSON.stringify({ success: true, ignored: true, event }),
            { status: 200, headers: cors },
          );
        }

        if (!paymentId && !externalRef) {
          console.warn('[asaas-webhook] sem paymentId nem externalRef');
          return new Response(JSON.stringify({ error: 'missing payment id' }), { status: 400, headers: cors });
        }

        // Localizar pedido: primeiro por external_reference, depois por asaas_payment_id
        let order: any = null;

        if (externalRef) {
          const { data, error } = await supabaseAdmin
            .from('orders')
            .select('id, status, amount, external_reference, asaas_status, approved_at, tracking_payload, order_email_sent_at')
            .eq('external_reference', externalRef)
            .maybeSingle();
          if (!error) order = data;
        }

        if (!order && paymentId) {
          const { data, error } = await supabaseAdmin
            .from('orders')
            .select('id, status, amount, external_reference, asaas_status, approved_at, tracking_payload, order_email_sent_at')
            .eq('asaas_payment_id', paymentId)
            .maybeSingle();
          if (!error) order = data;
        }

        if (!order) {
          console.warn('[asaas-webhook] pedido não encontrado', { paymentId, externalRef });
          return new Response(
            JSON.stringify({ error: 'order not found', paymentId }),
            { status: 404, headers: cors },
          );
        }

        console.log('[ASAAS_PEDIDO_ENCONTRADO]', {
          order_id: order.id,
          external_reference: order.external_reference,
          status_atual: order.status,
        });

        const alreadyPaid =
          String(order.status || '').toLowerCase() === 'paid' ||
          String(order.status || '').toLowerCase() === 'approved' ||
          String(order.asaas_status || '').toUpperCase() === 'CONFIRMED';

        if (!alreadyPaid) {
          const { error: updErr } = await supabaseAdmin
            .from('orders')
            .update({
              status: 'paid',
              asaas_status: 'CONFIRMED',
              asaas_payment_id: paymentId || order.asaas_payment_id,
              approved_at: new Date().toISOString(),
            } as any)
            .eq('id', order.id)
            .neq('status', 'paid');

          if (updErr) {
            console.error('[asaas-webhook] erro ao atualizar pedido', updErr);
            return new Response(JSON.stringify({ error: 'update failed' }), { status: 500, headers: cors });
          }
        }

        console.log('[ASAAS_PEDIDO_PAGO]', {
          paymentId,
          order_id: order.id,
          external_reference: order.external_reference,
        });

        // Carregar pedido completo para integrações
        const { data: fullOrder } = await supabaseAdmin
          .from('orders')
          .select('*')
          .eq('id', order.id)
          .maybeSingle();
        const orderFull = fullOrder || order;

        // ===== Rastreio automático =====
        try {
          const codigo = String(order.external_reference || '').trim();
          if (codigo) {
            await supabaseAdmin
              .from('rastreios' as any)
              .upsert(
                { codigo_pedido: codigo, status: 'Pagamento aprovado', observacao: '' } as any,
                { onConflict: 'codigo_pedido', ignoreDuplicates: true },
              );
          }
        } catch (err) {
          console.error('[asaas-webhook][rastreio]', err);
        }

        // ===== UTMify: waiting_payment + paid =====
        try {
          const { data: claimed } = await supabaseAdmin
            .rpc('claim_order_utmify' as any, { _order_id: order.id } as any)
            .maybeSingle();

          if (claimed) {
            try {
              await sendUtmifyOrder(orderFull, { status: 'waiting_payment' });
            } catch (err) {
              console.error('[asaas-webhook][UTMify-waiting]', err);
            }

            const result = await sendUtmifyOrder(orderFull, { status: 'paid' });
            console.log('[ASAAS_UTMIFY_RESPONSE]', {
              ok: result.ok,
              httpStatus: result.httpStatus,
              responseBody: result.responseBody,
            });

            await supabaseAdmin
              .from('orders')
              .update({
                utmify_payload: result.payload as any,
                utmify_http_status: result.httpStatus,
                utmify_response: result.responseBody,
                utmify_error: result.error,
                utmify_sent_at: result.ok ? new Date().toISOString() : null,
                utmify_processing_at: null,
              } as any)
              .eq('id', order.id);
          }
        } catch (err) {
          console.error('[asaas-webhook][UTMify]', err);
        }

        // ===== Meta CAPI Purchase (apenas após pagamento confirmado) =====
        try {
          if (!(orderFull as any).meta_capi_sent_at) {
            const metaResult = await sendAndLogMetaCapiPurchase(orderFull, {
              eventId: String(orderFull.external_reference),
              logTag: '[ASAAS_META_CAPI]',
            });
            console.log('[ASAAS_META_CAPI_RESPONSE]', metaResult);
          }
        } catch (err) {
          console.error('[asaas-webhook][Meta CAPI]', err);
        }

        // ===== Email aprovado =====
        try {
          const tp = (order as any).tracking_payload || {};
          const customerEmail: string | undefined = tp.email;
          const customerName: string | undefined = tp.name || tp.nome || '';

          if (!(order as any).order_email_sent_at && customerEmail) {
            const { data: claimed, error: claimErr } = await supabaseAdmin
              .from('orders')
              .update({ order_email_sent_at: new Date().toISOString() } as any)
              .eq('id', order.id)
              .is('order_email_sent_at', null)
              .select('id')
              .maybeSingle();

            if (!claimErr && claimed) {
              await sendOrderApprovedEmail({
                nomeCliente: String(customerName || ''),
                emailCliente: String(customerEmail),
                codigoPedido: String(order.external_reference || order.id),
                linkRastreio: `https://copadasfigurinhas.com/rastreio/${order.external_reference}`,
              });
            }
          }
        } catch (err) {
          console.error('[asaas-webhook][email]', err);
        }

        return new Response(
          JSON.stringify({
            success: true,
            order_id: order.id,
            external_reference: order.external_reference,
            status: 'paid',
          }),
          { status: 200, headers: cors },
        );
      },
    },
  },
});
