import { createFileRoute } from '@tanstack/react-router';
import { supabaseAdmin } from '@/integrations/supabase/client.server';

// GET /api/public/pedido-status?txid=...
// Endpoint público (somente leitura) para consulta de status do Pix por txid (asaas_payment_id).
export const Route = createFileRoute('/api/public/pedido-status')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const txid = (url.searchParams.get('txid') || '').trim();

        const cors = {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-store',
        };

        if (!txid || txid.length < 8 || txid.length > 120) {
          return new Response(
            JSON.stringify({ error: 'txid inválido' }),
            { status: 400, headers: cors },
          );
        }

        const { data: order, error } = await supabaseAdmin
          .from('orders')
          .select('id, status, amount, external_reference, asaas_status, asaas_payment_id, approved_at')
          .eq('asaas_payment_id', txid)
          .maybeSingle();

        if (error) {
          console.error('[pedido-status] db error', error);
          return new Response(
            JSON.stringify({ error: 'erro interno' }),
            { status: 500, headers: cors },
          );
        }

        if (!order) {
          return new Response(
            JSON.stringify({ status: 'not_found' }),
            { status: 404, headers: cors },
          );
        }

        const internal = String(order.status || '').toLowerCase();
        const gw = String((order as any).asaas_status || '').toUpperCase();
        const isPaid =
          internal === 'approved' ||
          internal === 'paid' ||
          internal === 'pago' ||
          gw === 'RECEIVED' ||
          gw === 'CONFIRMED' ||
          gw === 'PAID' ||
          gw === 'APPROVED';
        const isFailed =
          internal === 'rejected' ||
          internal === 'cancelled' ||
          internal === 'canceled' ||
          gw === 'OVERDUE' ||
          gw === 'CANCELLED';

        return new Response(
          JSON.stringify({
            status: isPaid ? 'approved' : isFailed ? 'rejected' : 'pending',
            txid: (order as any).asaas_payment_id,
            external_reference: order.external_reference,
            amount: Number(order.amount || 0),
            asaas_status: (order as any).asaas_status || null,
            approved_at: (order as any).approved_at || null,
          }),
          { status: 200, headers: cors },
        );
      },

      OPTIONS: async () =>
        new Response(null, {
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          },
        }),
    },
  },
});
