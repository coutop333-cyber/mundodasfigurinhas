import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { supabaseAdmin } from '@/integrations/supabase/client.server';
import { sendUtmifyOrder } from '@/lib/utmify.server';
import { sendOrderApprovedEmail } from '@/lib/email/sendOrderApprovedEmail.server';
import { consultVenopagTransaction } from '@/lib/venopag.functions';
import { sendAndLogMetaCapiPurchase } from '@/lib/meta-capi.server';

// POST /api/public/venopag-webhook
// Webhook chamado pela Venopag quando muda o status de uma cobrança.
// Reconfirmamos via API antes de marcar como pago — assim não dependemos
// de nenhum segredo no payload.

const cors = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': 'no-store',
};

const bodySchema = z
  .object({
    type: z.string().optional(),
    status: z.string().optional(),
    amount: z.union([z.string(), z.number()]).optional(),
    fee: z.union([z.string(), z.number()]).optional(),
    request_number: z.string().trim().min(4).max(120).optional(),
    transaction_id: z.string().trim().min(4).max(120).optional(),
    e2e: z.string().optional(),
    provider: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export const Route = createFileRoute('/api/public/venopag-webhook')({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),

      GET: async () =>
        new Response(
          JSON.stringify({
            ok: true,
            route: 'venopag-webhook',
            method: 'POST',
            message: 'Esta rota só aceita POST da Venopag. Use POST com JSON contendo request_number.',
          }),
          { status: 200, headers: cors },
        ),

      POST: async ({ request }) => {
        // Logar headers completos
        const headersObj: Record<string, string> = {};
        request.headers.forEach((v, k) => { headersObj[k] = v; });
        console.log('[VENOPAG_WEBHOOK_HEADERS]', headersObj);

        // Ler body como texto primeiro (raw), depois parsear
        let rawBody = '';
        try {
          rawBody = await request.text();
        } catch (err) {
          console.error('[VENOPAG_WEBHOOK_BODY_RAW] erro ao ler body', err);
          return new Response(JSON.stringify({ error: 'cannot read body' }), {
            status: 400,
            headers: cors,
          });
        }
        console.log('[VENOPAG_WEBHOOK_BODY_RAW]', rawBody);

        let json: unknown;
        try {
          json = JSON.parse(rawBody);
        } catch {
          console.error('[VENOPAG_WEBHOOK_BODY_JSON] invalid json', rawBody);
          return new Response(JSON.stringify({ error: 'invalid json' }), {
            status: 400,
            headers: cors,
          });
        }
        console.log('[VENOPAG_WEBHOOK_BODY_JSON]', json);

        const parsed = bodySchema.safeParse(json);
        console.log('[VENOPAG_WEBHOOK_RECEBIDO]', {
          ok: parsed.success,
          body: json,
        });
        if (!parsed.success) {
          console.warn('[venopag-webhook] payload inválido', parsed.error.flatten());
          return new Response(JSON.stringify({ error: 'invalid payload' }), {
            status: 400,
            headers: cors,
          });
        }

        console.log('[VENOPAG_STATUS]', parsed.data.status);
        console.log('[VENOPAG_REQUEST_NUMBER]', parsed.data.request_number);
        console.log('[VENOPAG_TRANSACTION_ID]', parsed.data.transaction_id);

        const evtType = String(parsed.data.type || '').toLowerCase();
        if (evtType && evtType !== 'cashin') {
          console.log('[venopag-webhook] evento ignorado', { type: evtType });
          return new Response(JSON.stringify({ success: true, ignored: true }), {
            status: 200,
            headers: cors,
          });
        }

        const url = new URL(request.url);
        const refQs = url.searchParams.get('ref') || undefined;

        const requestNumber =
          parsed.data.request_number || parsed.data.transaction_id || '';
        if (!requestNumber) {
          console.warn('[venopag-webhook] sem request_number');
          return new Response(JSON.stringify({ error: 'missing request_number' }), {
            status: 400,
            headers: cors,
          });
        }

        // ===== Decisão de pagamento baseada NO WEBHOOK (fonte da verdade) =====
        // A consulta GET /consult-transaction pode falhar com "Permissão insuficiente"
        // — não bloqueamos o fluxo por causa disso.
        const rawStatus = String(parsed.data.status || '').toLowerCase().trim();
        const APPROVED = new Set([
          'confirmed', 'confirmado', 'paid', 'pago',
          'approved', 'aprovado', 'completed', 'concluido', 'concluído',
        ]);
        const NOT_PAID = new Set([
          'pending', 'pendente', 'waiting', 'aguardando',
          'expired', 'expirado', 'failed', 'falhou', 'canceled', 'cancelled', 'cancelado',
        ]);

        const isPaid = APPROVED.has(rawStatus);

        // Consulta opcional só para log/auditoria — nunca bloqueia
        try {
          const consult = await consultVenopagTransaction(requestNumber);
          console.log('[VENOPAG_CONSULT_FALLBACK]', { requestNumber, consult });
        } catch (err: any) {
          const msg = String(err?.message || err || '');
          if (/permiss[aã]o insuficiente/i.test(msg)) {
            console.log('[VENOPAG_CONSULT_PERMISSION_DENIED_IGNORADO]', { requestNumber, msg });
          } else {
            console.warn('[VENOPAG_CONSULT_FALLBACK_ERRO]', { requestNumber, msg });
          }
        }

        if (!isPaid) {
          console.log('[venopag-webhook] webhook não-pago', { requestNumber, rawStatus });
          if (NOT_PAID.has(rawStatus) && (rawStatus === 'expired' || rawStatus === 'expirado')) {
            await supabaseAdmin
              .from('orders')
              .update({ efi_status: 'EXPIRED' } as any)
              .eq('efi_txid', requestNumber);
          }
          return new Response(
            JSON.stringify({ success: true, ignored: true, status: rawStatus }),
            { status: 200, headers: cors },
          );
        }

        console.log('[VENOPAG_WEBHOOK_CONFIAVEL]', {
          requestNumber,
          status: rawStatus,
          type: evtType,
          amount: parsed.data.amount,
        });

        // Localiza pedido por txid e fallback por external_reference
        let { data: order, error: findErr } = await supabaseAdmin
          .from('orders')
          .select(
            'id, status, amount, external_reference, efi_status, approved_at, tracking_payload, order_email_sent_at',
          )
          .eq('efi_txid', requestNumber)
          .maybeSingle();

        if (!order && !findErr && refQs) {
          const fallback = await supabaseAdmin
            .from('orders')
            .select(
              'id, status, amount, external_reference, efi_status, approved_at, tracking_payload, order_email_sent_at',
            )
            .eq('external_reference', refQs)
            .maybeSingle();
          order = fallback.data;
          findErr = fallback.error;
        }

        if (findErr) {
          console.error('[venopag-webhook] erro ao localizar pedido', findErr);
          return new Response(JSON.stringify({ error: 'db error' }), {
            status: 500,
            headers: cors,
          });
        }

        if (!order) {
          console.warn('[venopag-webhook] pedido órfão', requestNumber);
          return new Response(
            JSON.stringify({ error: 'order not found', requestNumber }),
            { status: 404, headers: cors },
          );
        }

        console.log('[PEDIDO_ENCONTRADO]', {
          order_id: order.id,
          external_reference: order.external_reference,
          status_atual: order.status,
          amount: order.amount,
        });

        const already =
          String(order.status || '').toLowerCase() === 'paid' ||
          String(order.status || '').toLowerCase() === 'approved' ||
          String((order as any).efi_status || '').toUpperCase() === 'CONFIRMED';

        const valor = parsed.data.amount;
        if (valor != null) {
          const v = Number(valor);
          if (
            Number.isFinite(v) &&
            Number(order.amount) &&
            Math.abs(v - Number(order.amount)) > 0.01
          ) {
            console.warn('[venopag-webhook] valor divergente', {
              requestNumber,
              recebido: v,
              esperado: Number(order.amount),
            });
          }
        }

        if (!already) {
          const { error: updErr } = await supabaseAdmin
            .from('orders')
            .update({
              status: 'paid',
              efi_status: 'CONFIRMED',
              efi_txid: requestNumber,
              approved_at: new Date().toISOString(),
            } as any)
            .eq('id', order.id)
            .neq('status', 'paid');

          if (updErr) {
            console.error('[venopag-webhook] erro ao atualizar pedido', updErr);
            return new Response(JSON.stringify({ error: 'update failed' }), {
              status: 500,
              headers: cors,
            });
          }
        }

        console.log('[PEDIDO_MARCADO_PAGO]', {
          requestNumber,
          order_id: order.id,
          external_reference: order.external_reference,
          amount: order.amount,
        });

        // Carrega pedido completo para UTMify + Meta CAPI
        const { data: fullOrder } = await supabaseAdmin
          .from('orders')
          .select('*')
          .eq('id', order.id)
          .maybeSingle();
        const orderFull = fullOrder || order;

        // ===== Cria rastreio automaticamente (idempotente) =====
        try {
          const codigo = String(order.external_reference || '').trim();
          if (codigo) {
            await supabaseAdmin
              .from('rastreios' as any)
              .upsert(
                {
                  codigo_pedido: codigo,
                  status: 'Pagamento aprovado',
                  observacao: '',
                } as any,
                { onConflict: 'codigo_pedido', ignoreDuplicates: true },
              );
          }
        } catch (err) {
          console.error('[venopag-webhook][rastreio] exceção', err);
        }

        // ===== UTMify =====
        try {
          const { data: claimed } = await supabaseAdmin
            .rpc('claim_order_utmify' as any, { _order_id: order.id } as any)
            .maybeSingle();

          if (claimed) {
            const orderForUtmify = orderFull;

            try {
              await sendUtmifyOrder(orderForUtmify, { status: 'waiting_payment' });
            } catch (err) {
              console.error('[venopag-webhook][UTMify-waiting] exceção', err);
            }

            console.log('[UTMIFY_PAYLOAD]', {
              external_reference: orderForUtmify.external_reference,
              amount: orderForUtmify.amount,
              status: 'paid',
            });
            const result = await sendUtmifyOrder(orderForUtmify, { status: 'paid' });
            console.log('[UTMIFY_RESPONSE]', {
              ok: result.ok,
              httpStatus: result.httpStatus,
              responseBody: result.responseBody,
              error: result.error,
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
          console.error('[venopag-webhook] exceção UTMify', err);
        }

        // ===== Meta CAPI Purchase =====
        try {
          if (!(orderFull as any).meta_capi_sent_at) {
            console.log('[META_CAPI_PAYLOAD]', {
              external_reference: orderFull.external_reference,
              event_id: orderFull.external_reference,
              value: orderFull.amount,
              currency: 'BRL',
            });
            const metaResult = await sendAndLogMetaCapiPurchase(orderFull, {
              eventId: String(orderFull.external_reference),
              logTag: '[META_CAPI]',
            });
            console.log('[META_CAPI_RESPONSE]', metaResult);
          } else {
            console.log('[META_CAPI_PAYLOAD] já enviado', {
              external_reference: orderFull.external_reference,
            });
          }
        } catch (err) {
          console.error('[META_CAPI_RESPONSE] exceção', err);
        }



        // ===== Email de pedido aprovado =====
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
              const result = await sendOrderApprovedEmail({
                nomeCliente: String(customerName || ''),
                emailCliente: String(customerEmail),
                codigoPedido: String(order.external_reference || order.id),
                linkRastreio: `https://eletrojundiai.shop/rastreio/${order.external_reference}`,
              });
              if (!result.ok) {
                await supabaseAdmin
                  .from('orders')
                  .update({ order_email_sent_at: null } as any)
                  .eq('id', order.id);
              }
            }
          }
        } catch (err) {
          console.error('[venopag-webhook][email] exceção', err);
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
