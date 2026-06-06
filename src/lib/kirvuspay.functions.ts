import { createServerFn } from '@tanstack/react-start';
import { getRequestHeader, getRequestIP } from '@tanstack/react-start/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/integrations/supabase/client.server';
import { sendUtmifyOrder } from '@/lib/utmify.server';
import { sendAndLogMetaCapiPurchase } from '@/lib/meta-capi.server';
import { sendOrderApprovedEmail } from '@/lib/email/sendOrderApprovedEmail.server';

const KIRVUS_BASE = 'https://app.kirvuspay.com.br/api/v1';

function getKirvusHeaders(): Record<string, string> {
  const pub = process.env.KIRVUSPAY_PUBLIC_KEY?.trim();
  const sec = process.env.KIRVUSPAY_SECRET_KEY?.trim();
  if (!pub || !sec) throw new Error('KIRVUSPAY_PUBLIC_KEY / KIRVUSPAY_SECRET_KEY não configurados.');
  return {
    'x-public-key': pub,
    'x-secret-key': sec,
    'Content-Type': 'application/json',
  };
}

function getWebhookUrl(): string {
  const raw = process.env.KIRVUSPAY_WEBHOOK_BASE_URL?.trim() || 'https://copadasfigurinhas.com';
  const base = raw.replace(/[`'"]/g, '').replace(/\/+$/, '');
  return `${base}/api/public/kirvuspay-webhook`;
}

// ============ Warm ============
export const warmKirvusPix = createServerFn({ method: 'POST' }).handler(async () => {
  return { ok: true };
});

// ============ Schemas ============
const trackingSchema = z.object({
  utms: z.record(z.string(), z.string()).optional(),
  name: z.string().max(120).optional(),
  email: z.string().email().max(120).optional(),
  phone: z.string().max(40).optional(),
  fbp: z.string().max(200).optional(),
  fbc: z.string().max(200).optional(),
  fbclid: z.string().max(200).optional(),
  referrer: z.string().max(2048).optional(),
  landing_url: z.string().max(2048).optional(),
  user_agent: z.string().max(500).optional(),
  first_seen_at: z.string().max(40).optional(),
}).partial();

const createInput = z.object({
  kitId: z.number().int().min(1).max(99),
  title: z.string().trim().min(3).max(255),
  unitPrice: z.number().positive().min(1).max(10000),
  externalReference: z.string().trim().min(8).max(120)
    .refine((v) => !/^(null|undefined|nan)$/i.test(v), 'externalReference inválido'),
  payerEmail: z.string().email().max(120).optional(),
  payerName: z.string().max(160).optional(),
  payerPhone: z.string().max(40).optional(),
  payerDocument: z.string().max(20).optional(),
  tracking: trackingSchema.optional(),
  source: z.enum(['default', 'produto4', 'produto5']).optional(),
});

// ============ Criar cobrança Pix ============
export const createKirvusPixPayment = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => createInput.parse(input))
  .handler(async ({ data }) => {
    const totalStartedAt = Date.now();
    const forwardedIp = getRequestHeader('x-forwarded-for')?.split(',')[0]?.trim();
    const clientIp =
      getRequestIP({ xForwardedFor: true }) ||
      getRequestHeader('cf-connecting-ip') ||
      getRequestHeader('x-real-ip') ||
      forwardedIp || null;
    const userAgent = getRequestHeader('user-agent') || data.tracking?.user_agent || null;
    const origin = getRequestHeader('origin') || getRequestHeader('referer') || null;

    const tracking = data.tracking ?? {};
    const trackingVazio =
      !tracking ||
      Object.keys(tracking).length === 0 ||
      ((!tracking.utms || Object.keys(tracking.utms || {}).length === 0) &&
        !tracking.fbp && !tracking.fbc && !tracking.fbclid &&
        !tracking.email && !tracking.referrer && !tracking.landing_url);

    const emailFake =
      typeof data.payerEmail === 'string' &&
      /cliente\+null@|cliente\+undefined@/i.test(data.payerEmail);

    const blockReasons: string[] = [];
    if (data.unitPrice < 1) blockReasons.push('amount < R$1,00');
    if (emailFake) blockReasons.push('email fake');
    if (!data.title || data.title.trim().length < 3) blockReasons.push('produto vazio');
    if (!data.externalReference || data.externalReference.trim().length < 8) blockReasons.push('external_reference vazio');
    if (trackingVazio) blockReasons.push('tracking_payload vazio');
    if (!userAgent || /^(curl|wget|node|python|axios|go-http|healthcheck|bot)/i.test(userAgent)) {
      blockReasons.push(`user_agent inválido: ${userAgent || 'null'}`);
    }

    if (blockReasons.length) {
      console.error('[kirvus-create][BLOQUEIO]', { motivos: blockReasons, origin });
      throw new Error(`Pagamento bloqueado: ${blockReasons.join('; ')}`);
    }

    const pedidoId = data.externalReference;
    const trackingToSave = { ...(data.tracking ?? {}), _source: data.source || 'produto5' } as any;

    // Persistir pedido no banco ANTES de chamar KirvusPay
    const { error: insertErr } = await supabaseAdmin
      .from('orders')
      .upsert({
        external_reference: pedidoId,
        kit_id: data.kitId,
        kit_title: data.title,
        amount: Number(data.unitPrice.toFixed(2)),
        status: 'pending',
        tracking_payload: trackingToSave,
        client_ip: clientIp,
        client_user_agent: userAgent,
      } as any, { onConflict: 'external_reference' });

    if (insertErr) {
      console.error('[kirvus-create] erro ao persistir pedido', insertErr);
      throw new Error('Não foi possível registrar o pedido. Tente novamente.');
    }

    const webhookUrl = getWebhookUrl();
    const cpfDigits = (data.payerDocument || '').replace(/\D/g, '');
    const cpfFormatted = cpfDigits.length === 11
      ? cpfDigits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
      : data.payerDocument || '';
    const identifier = pedidoId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 50);

    const body = {
      identifier,
      amount: Number(data.unitPrice.toFixed(2)),
      client: {
        name: (data.payerName || (tracking as any).name || 'Cliente').slice(0, 100),
        email: data.payerEmail || (tracking as any).email || undefined,
        phone: data.payerPhone || (tracking as any).phone || undefined,
        document: cpfFormatted || undefined,
      },
      products: [{
        id: String(data.kitId),
        name: data.title.slice(0, 100),
        quantity: 1,
        price: Number(data.unitPrice.toFixed(2)),
      }],
      callbackUrl: webhookUrl,
      metadata: { externalReference: pedidoId },
    };

    let upstream: any = null;
    let httpStatus = 0;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const res = await fetch(`${KIRVUS_BASE}/gateway/pix/receive`, {
        method: 'POST',
        headers: getKirvusHeaders(),
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      httpStatus = res.status;
      const text = await res.text();
      try { upstream = JSON.parse(text); } catch { upstream = { raw: text }; }

      if (!res.ok) {
        console.error('[kirvus-create][ERROR]', { httpStatus, response: upstream, body_sent: body });
        const details = upstream?.details
          ? (Array.isArray(upstream.details)
            ? upstream.details.map((d: any) => d?.message || JSON.stringify(d)).join(', ')
            : JSON.stringify(upstream.details))
          : null;
        const msg = upstream?.message || upstream?.error || `HTTP ${httpStatus}`;
        throw new Error(`Falha ao gerar Pix (KirvusPay): ${msg}${details ? ` — ${details}` : ''}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if ((err as any)?.name === 'AbortError' || /aborted|abort/i.test(msg)) {
        throw new Error('A geração do Pix demorou mais que o esperado. Tente novamente.');
      }
      throw new Error(msg.startsWith('Falha') ? msg : `Falha ao gerar Pix: ${msg}`);
    } finally {
      clearTimeout(timeoutId);
    }

    const transactionId: string = upstream?.transactionId || '';
    const orderId: string = upstream?.order?.id || '';
    const pixCode: string = upstream?.pix?.code || '';
    const rawBase64: string = upstream?.pix?.base64 || upstream?.pix?.image || '';
    let pixBase64: string = rawBase64.startsWith('data:') ? rawBase64.split(',')[1] || '' : rawBase64;

    if (!transactionId || !pixCode) {
      console.error('[kirvus-create][INCOMPLETO]', upstream);
      throw new Error('KirvusPay retornou cobrança incompleta.');
    }

    // Gerar QR base64 local se não veio
    if (!pixBase64 && pixCode) {
      try {
        const QRCode = (await import('qrcode')).default;
        const dataUrl = await QRCode.toDataURL(pixCode, { margin: 1, width: 320 });
        pixBase64 = dataUrl.split(',')[1] || '';
      } catch (e) {
        console.error('[kirvus-create] erro ao gerar QR base64', e);
      }
    }

    // Salvar no banco
    const { error: updateErr } = await supabaseAdmin
      .from('orders')
      .update({
        efi_txid: transactionId,
        efi_loc_id: orderId,
        efi_qrcode: pixBase64 || null,
        efi_copia_cola: pixCode,
        efi_expires_at: null,
        efi_status: 'PENDING',
        efi_payload: upstream as any,
        payment_provider: 'kirvuspay',
      } as any)
      .eq('external_reference', pedidoId);

    if (updateErr) {
      console.error('[kirvus-create] erro ao salvar dados', updateErr);
      throw new Error('Pix gerado, mas não foi possível registrar o vínculo do pedido.');
    }

    console.log('[kirvus-create][OK]', { pedidoId, transactionId, total_ms: Date.now() - totalStartedAt });

    // UTMify: waiting_payment
    try {
      const { data: orderFull } = await supabaseAdmin.from('orders').select('*').eq('external_reference', pedidoId).maybeSingle();
      if (orderFull) {
        const result = await sendUtmifyOrder(orderFull, { status: 'waiting_payment' });
        console.log('[kirvus-create][UTMify-waiting]', { ok: result.ok, httpStatus: result.httpStatus });
      }
    } catch (err) {
      console.error('[kirvus-create][UTMify-waiting] erro', err);
    }

    return {
      id: transactionId,
      txid: transactionId,
      status: 'pending',
      qr_code: pixCode,
      qr_code_base64: pixBase64,
      ticket_url: upstream?.order?.url || '',
      external_reference: pedidoId,
      transaction_amount: Number(data.unitPrice.toFixed(2)),
      expires_at: null,
    };
  });

// ============ Polling de status ============
const statusInput = z.object({ txid: z.string().min(4).max(120) });

export const getKirvusPaymentStatus = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => statusInput.parse(input))
  .handler(async ({ data }) => {
    const { data: order } = await supabaseAdmin
      .from('orders')
      .select('id, status, amount, external_reference, efi_status, efi_txid, created_at, tracking_payload')
      .eq('efi_txid', data.txid)
      .maybeSingle();

    if (!order) return { status: 'pending', external_reference: undefined, transaction_amount: 0 };

    const internal = String(order.status || '').toLowerCase();
    const gw = String((order as any).efi_status || '').toUpperCase();

    const isPaid =
      internal === 'approved' || internal === 'paid' || internal === 'pago' ||
      gw === 'CONFIRMED' || gw === 'PAID' || gw === 'APPROVED' || gw === 'OK';
    const isFailed =
      internal === 'rejected' || internal === 'cancelled' || internal === 'canceled' ||
      gw === 'EXPIRED' || gw === 'CANCELLED';

    // Fallback: consulta KirvusPay diretamente
    if (!isPaid && !isFailed) {
      try {
        const kirvusStatus = await consultKirvusTransaction(data.txid);
        console.log('[kirvus-status][fallback]', { txid: data.txid, status: kirvusStatus.status });

        if (kirvusStatus.status === 'confirmed') {
          await supabaseAdmin.from('orders')
            .update({ status: 'paid', efi_status: 'CONFIRMED', approved_at: new Date().toISOString() } as any)
            .eq('id', order.id);

          // Processar integrações diretamente
          try {
            const { data: fullOrder } = await supabaseAdmin.from('orders').select('*').eq('id', order.id).maybeSingle();
            const orderFull = fullOrder || order;

            // Rastreio
            try {
              if (order.external_reference) {
                await supabaseAdmin.from('rastreios' as any).upsert(
                  { codigo_pedido: order.external_reference, status: 'Pagamento aprovado', observacao: '' } as any,
                  { onConflict: 'codigo_pedido', ignoreDuplicates: true }
                );
              }
            } catch (e) { console.error('[kirvus-status][rastreio]', e); }

            // UTMify
            try {
              const { data: claimed } = await supabaseAdmin.rpc('claim_order_utmify' as any, { _order_id: order.id } as any).maybeSingle();
              if (claimed) {
                try { await sendUtmifyOrder(orderFull, { status: 'waiting_payment' }); } catch {}
                const result = await sendUtmifyOrder(orderFull, { status: 'paid' });
                console.log('[kirvus-status][UTMify]', { ok: result.ok, httpStatus: result.httpStatus });
                await supabaseAdmin.from('orders').update({
                  utmify_payload: result.payload as any, utmify_http_status: result.httpStatus,
                  utmify_response: result.responseBody, utmify_error: result.error,
                  utmify_sent_at: result.ok ? new Date().toISOString() : null, utmify_processing_at: null,
                } as any).eq('id', order.id);
              }
            } catch (e) { console.error('[kirvus-status][UTMify]', e); }

            // Meta CAPI
            try {
              if (!(orderFull as any).meta_capi_sent_at) {
                await sendAndLogMetaCapiPurchase(orderFull, { eventId: String(orderFull.external_reference), logTag: '[KIRVUS_META_CAPI]' });
              }
            } catch (e) { console.error('[kirvus-status][Meta CAPI]', e); }

            // Email
            try {
              const tp = (orderFull as any).tracking_payload || {};
              const customerEmail: string | undefined = tp.email;
              const customerName: string = tp.name || tp.nome || '';
              if (!(orderFull as any).order_email_sent_at && customerEmail) {
                const { data: emailClaimed, error: claimErr } = await supabaseAdmin
                  .from('orders').update({ order_email_sent_at: new Date().toISOString() } as any)
                  .eq('id', order.id).is('order_email_sent_at', null).select('id').maybeSingle();
                if (!claimErr && emailClaimed) {
                  await sendOrderApprovedEmail({
                    nomeCliente: customerName, emailCliente: customerEmail,
                    codigoPedido: String(order.external_reference || order.id),
                    linkRastreio: `https://copadasfigurinhas.com/rastreio/${order.external_reference}`,
                  });
                }
              }
            } catch (e) { console.error('[kirvus-status][email]', e); }
          } catch (e) { console.error('[kirvus-status][integrações]', e); }

          return { status: 'approved', external_reference: order.external_reference || undefined, transaction_amount: Number(order.amount || 0) };
        }

        if (kirvusStatus.status === 'expired') {
          await supabaseAdmin.from('orders').update({ efi_status: 'EXPIRED' } as any).eq('id', order.id);
          return { status: 'rejected', external_reference: order.external_reference || undefined, transaction_amount: 0 };
        }
      } catch (err) {
        console.error('[kirvus-status][fallback] erro', err);
      }
    }

    // Se já está pago mas UTMify não foi enviado
    if (isPaid) {
      try {
        const { data: claimed } = await supabaseAdmin.rpc('claim_order_utmify' as any, { _order_id: order.id } as any).maybeSingle();
        if (claimed) {
          const { data: fullOrder } = await supabaseAdmin.from('orders').select('*').eq('id', order.id).maybeSingle();
          const orderFull = fullOrder || order;
          try { await sendUtmifyOrder(orderFull, { status: 'waiting_payment' }); } catch {}
          const result = await sendUtmifyOrder(orderFull, { status: 'paid' });
          await supabaseAdmin.from('orders').update({
            utmify_payload: result.payload as any, utmify_http_status: result.httpStatus,
            utmify_response: result.responseBody, utmify_error: result.error,
            utmify_sent_at: result.ok ? new Date().toISOString() : null, utmify_processing_at: null,
          } as any).eq('id', order.id);
          if (!(orderFull as any).meta_capi_sent_at) {
            await sendAndLogMetaCapiPurchase(orderFull, { eventId: String(orderFull.external_reference), logTag: '[KIRVUS_META_CAPI_FALLBACK]' }).catch(() => {});
          }
        }
      } catch (e) { console.error('[kirvus-status][UTMify-paid-fallback]', e); }
    }

    return {
      status: isPaid ? 'approved' : isFailed ? 'rejected' : 'pending',
      external_reference: order.external_reference || undefined,
      transaction_amount: Number(order.amount || 0),
    };
  });

// ============ Consulta direta na KirvusPay ============
export async function consultKirvusTransaction(transactionId: string): Promise<{
  status: 'pending' | 'confirmed' | 'expired' | 'unknown';
  raw: any;
}> {
  const pub = process.env.KIRVUSPAY_PUBLIC_KEY?.trim();
  const sec = process.env.KIRVUSPAY_SECRET_KEY?.trim();
  if (!pub || !sec) return { status: 'unknown', raw: null };

  try {
    const res = await fetch(`${KIRVUS_BASE}/gateway/transactions?id=${encodeURIComponent(transactionId)}`, {
      method: 'GET',
      headers: { 'x-public-key': pub, 'x-secret-key': sec, 'Content-Type': 'application/json' },
    });
    const text = await res.text();
    let json: any = null;
    try { json = JSON.parse(text); } catch { json = { raw: text }; }

    console.log('[kirvus-consult]', { transactionId, httpStatus: res.status, status: json?.status });

    const statusRaw = String(
      json?.status || json?.transaction?.status || json?.data?.status ||
      json?.payment?.status || json?.pix?.status || ''
    ).toLowerCase();

    const CONFIRMED = new Set(['ok', 'paid', 'approved', 'confirmed', 'completed', 'pago', 'concluido', 'success']);
    const EXPIRED = new Set(['expired', 'cancelled', 'canceled', 'failed', 'rejected', 'pending_expired']);

    if (CONFIRMED.has(statusRaw)) return { status: 'confirmed', raw: json };
    if (EXPIRED.has(statusRaw)) return { status: 'expired', raw: json };
    return { status: 'pending', raw: json };
  } catch (err) {
    console.error('[kirvus-consult] erro', err);
    return { status: 'unknown', raw: null };
  }
}
