import { createServerFn } from '@tanstack/react-start';
import { getRequestHeader, getRequestIP } from '@tanstack/react-start/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/integrations/supabase/client.server';
import { sendUtmifyOrder } from '@/lib/utmify.server';

const ASAAS_BASE = 'https://api.asaas.com/v3';

function getAsaasHeaders(): Record<string, string> {
  const key = process.env.ASAAS_API_KEY?.trim();
  if (!key) throw new Error('ASAAS_API_KEY não configurada.');
  return {
    'access_token': key,
    'Content-Type': 'application/json',
  };
}

function getWebhookUrl(): string {
  const raw =
    process.env.ASAAS_WEBHOOK_BASE_URL?.trim() ||
    'https://copadasfigurinhas.com';
  const base = raw.replace(/[`'"]/g, '').replace(/\/+$/, '');
  return `${base}/api/public/asaas-webhook`;
}

// ============ Warm (no-op) ============
export const warmAsaasPix = createServerFn({ method: 'POST' }).handler(async () => {
  return { ok: true };
});

// ============ Schemas ============
const trackingSchema = z
  .object({
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
  })
  .partial();

const createInput = z.object({
  kitId: z.number().int().min(1).max(99),
  title: z.string().trim().min(3).max(255),
  unitPrice: z.number().positive().min(1).max(10000),
  externalReference: z
    .string()
    .trim()
    .min(8)
    .max(120)
    .refine((v) => !/^(null|undefined|nan)$/i.test(v), 'externalReference inválido'),
  payerEmail: z.string().email().max(120).optional(),
  payerName: z.string().max(160).optional(),
  payerPhone: z.string().max(40).optional(),
  payerDocument: z.string().max(20).optional(),
  tracking: trackingSchema.optional(),
  source: z.enum(['default', 'produto4', 'produto5']).optional(),
});

// ============ Criar ou buscar customer no Asaas ============
async function getOrCreateAsaasCustomer(params: {
  name: string;
  email?: string;
  phone?: string;
  cpfCnpj?: string;
  externalReference: string;
}): Promise<string> {
  const headers = getAsaasHeaders();

  // Tenta encontrar por externalReference
  const searchRes = await fetch(
    `${ASAAS_BASE}/customers?externalReference=${encodeURIComponent(params.externalReference)}&limit=1`,
    { method: 'GET', headers },
  );
  if (searchRes.ok) {
    const searchJson = await searchRes.json();
    const existing = searchJson?.data?.[0];
    if (existing?.id) return existing.id;
  }

  // Cria novo customer
  const cpfDigits = (params.cpfCnpj || '').replace(/\D/g, '');
  const body: Record<string, unknown> = {
    name: (params.name || 'Cliente').slice(0, 100),
    externalReference: params.externalReference,
  };
  if (params.email) body.email = params.email;
  if (params.phone) body.mobilePhone = params.phone.replace(/\D/g, '');
  if (cpfDigits.length === 11 || cpfDigits.length === 14) body.cpfCnpj = cpfDigits;

  const createRes = await fetch(`${ASAAS_BASE}/customers`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const createJson = await createRes.json();
  if (!createRes.ok || !createJson?.id) {
    throw new Error(
      `Asaas: falha ao criar customer — ${createJson?.errors?.[0]?.description || createJson?.message || createRes.status}`,
    );
  }
  return createJson.id as string;
}

// ============ Criar cobrança Pix ============
export const createAsaasPixPayment = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => createInput.parse(input))
  .handler(async ({ data }) => {
    const totalStartedAt = Date.now();
    const forwardedIp = getRequestHeader('x-forwarded-for')?.split(',')[0]?.trim();
    const clientIp =
      getRequestIP({ xForwardedFor: true }) ||
      getRequestHeader('cf-connecting-ip') ||
      getRequestHeader('x-real-ip') ||
      forwardedIp ||
      null;
    const userAgent = getRequestHeader('user-agent') || data.tracking?.user_agent || null;
    const origin = getRequestHeader('origin') || getRequestHeader('referer') || null;

    const tracking = data.tracking ?? {};
    const trackingVazio =
      !tracking ||
      Object.keys(tracking).length === 0 ||
      ((!tracking.utms || Object.keys(tracking.utms || {}).length === 0) &&
        !tracking.fbp &&
        !tracking.fbc &&
        !tracking.fbclid &&
        !tracking.email &&
        !tracking.referrer &&
        !tracking.landing_url);

    const emailFake =
      typeof data.payerEmail === 'string' &&
      /cliente\+null@|cliente\+undefined@/i.test(data.payerEmail);

    const blockReasons: string[] = [];
    if (data.unitPrice < 1) blockReasons.push('amount < R$1,00');
    if (emailFake) blockReasons.push('email fake');
    if (!data.title || data.title.trim().length < 3) blockReasons.push('produto vazio');
    if (!data.externalReference || data.externalReference.trim().length < 8)
      blockReasons.push('external_reference vazio');
    if (trackingVazio) blockReasons.push('tracking_payload vazio');
    if (!userAgent || /^(curl|wget|node|python|axios|go-http|healthcheck|bot)/i.test(userAgent)) {
      blockReasons.push(`user_agent inválido: ${userAgent || 'null'}`);
    }

    if (blockReasons.length) {
      console.error('[asaas-create][BLOQUEIO]', { motivos: blockReasons, origin });
      throw new Error(`Pagamento bloqueado: ${blockReasons.join('; ')}`);
    }

    const pedidoId = data.externalReference;
    const trackingToSave = {
      ...(data.tracking ?? {}),
      _source: data.source || 'produto5',
    } as any;

    // Persistir pedido no banco ANTES de chamar Asaas
    const { error: insertErr } = await supabaseAdmin
      .from('orders')
      .upsert(
        {
          external_reference: pedidoId,
          kit_id: data.kitId,
          kit_title: data.title,
          amount: Number(data.unitPrice.toFixed(2)),
          status: 'pending',
          tracking_payload: trackingToSave,
          client_ip: clientIp,
          client_user_agent: userAgent,
        } as any,
        { onConflict: 'external_reference' },
      );

    if (insertErr) {
      console.error('[asaas-create] erro ao persistir pedido', insertErr);
      throw new Error('Não foi possível registrar o pedido. Tente novamente.');
    }

    // Criar ou recuperar customer no Asaas
    let customerId: string;
    try {
      customerId = await getOrCreateAsaasCustomer({
        name: data.payerName || (tracking as any).name || 'Cliente',
        email: data.payerEmail || (tracking as any).email,
        phone: data.payerPhone || (tracking as any).phone,
        cpfCnpj: data.payerDocument,
        externalReference: pedidoId,
      });
    } catch (err) {
      console.error('[asaas-create] erro ao criar customer', err);
      throw new Error('Erro ao registrar cliente no gateway. Tente novamente.');
    }

    // Vencimento: 1 dia útil
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 1);
    const dueDateStr = dueDate.toISOString().split('T')[0];

    const paymentBody = {
      customer: customerId,
      billingType: 'PIX',
      value: Number(data.unitPrice.toFixed(2)),
      dueDate: dueDateStr,
      description: `${data.title.slice(0, 200)} (${pedidoId})`,
      externalReference: pedidoId,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    let upstream: any = null;
    let httpStatus = 0;

    try {
      const res = await fetch(`${ASAAS_BASE}/payments`, {
        method: 'POST',
        headers: getAsaasHeaders(),
        body: JSON.stringify(paymentBody),
        signal: controller.signal,
      });
      httpStatus = res.status;
      const text = await res.text();
      try { upstream = JSON.parse(text); } catch { upstream = { raw: text }; }

      if (!res.ok) {
        console.error('[asaas-create][ERROR]', { httpStatus, response: upstream, body_sent: paymentBody });
        const errMsg = upstream?.errors?.[0]?.description || upstream?.message || `HTTP ${httpStatus}`;
        throw new Error(`Falha ao gerar Pix (Asaas): ${errMsg}`);
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

    const asaasPaymentId: string = upstream?.id || '';
    if (!asaasPaymentId) {
      console.error('[asaas-create][INCOMPLETO]', upstream);
      throw new Error('Asaas retornou cobrança sem ID.');
    }

    // Buscar QR Code Pix
    let pixCode = '';
    let pixBase64 = '';
    try {
      const qrRes = await fetch(`${ASAAS_BASE}/payments/${asaasPaymentId}/pixQrCode`, {
        method: 'GET',
        headers: getAsaasHeaders(),
      });
      const qrJson = await qrRes.json();
      pixCode = qrJson?.payload || '';
      const rawBase64 = qrJson?.encodedImage || '';
      pixBase64 = rawBase64.startsWith('data:') ? rawBase64.split(',')[1] || '' : rawBase64;
    } catch (err) {
      console.error('[asaas-create] erro ao buscar QR Code', err);
    }

    // Gerar QR base64 local se Asaas não retornou
    if (!pixBase64 && pixCode) {
      try {
        const QRCode = (await import('qrcode')).default;
        const dataUrl = await QRCode.toDataURL(pixCode, { margin: 1, width: 320 });
        pixBase64 = dataUrl.split(',')[1] || '';
      } catch (e) {
        console.error('[asaas-create] erro ao gerar QR base64 local', e);
      }
    }

    if (!pixCode) {
      console.error('[asaas-create][SEM_PIX_CODE]', upstream);
      throw new Error('Asaas não retornou código Pix. Tente novamente.');
    }

    // Salvar dados Asaas no banco (colunas nativas asaas_*)
    const { error: updateErr } = await supabaseAdmin
      .from('orders')
      .update({
        asaas_payment_id: asaasPaymentId,
        asaas_customer_id: customerId,
        asaas_qrcode: pixBase64 || null,
        asaas_copia_cola: pixCode,
        asaas_expires_at: upstream?.dueDate || null,
        asaas_status: 'PENDING',
        asaas_payload: upstream as any,
        payment_provider: 'asaas',
      } as any)
      .eq('external_reference', pedidoId);

    if (updateErr) {
      console.error('[asaas-create] erro ao salvar dados', updateErr);
      throw new Error('Pix gerado, mas não foi possível registrar o vínculo do pedido.');
    }

    console.log('[asaas-create][OK]', {
      pedidoId,
      asaasPaymentId,
      total_ms: Date.now() - totalStartedAt,
    });

    // UTMify: waiting_payment (Pix gerado)
    try {
      const { data: orderFull } = await supabaseAdmin
        .from('orders')
        .select('*')
        .eq('external_reference', pedidoId)
        .maybeSingle();

      if (orderFull) {
        const result = await sendUtmifyOrder(orderFull, { status: 'waiting_payment' });
        console.log('[asaas-create][UTMify-waiting]', {
          ok: result.ok,
          httpStatus: result.httpStatus,
          responseBody: result.responseBody,
        });
      }
    } catch (err) {
      console.error('[asaas-create][UTMify-waiting] erro', err);
    }

    return {
      id: asaasPaymentId,
      txid: asaasPaymentId,
      status: 'pending',
      qr_code: pixCode,
      qr_code_base64: pixBase64,
      ticket_url: upstream?.invoiceUrl || '',
      external_reference: pedidoId,
      transaction_amount: Number(data.unitPrice.toFixed(2)),
      expires_at: upstream?.dueDate || null,
    };
  });

// ============ Polling de status via Supabase + fallback Asaas ============
const statusInput = z.object({ txid: z.string().min(4).max(120) });

export const getAsaasPaymentStatus = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => statusInput.parse(input))
  .handler(async ({ data }) => {
    const { data: order } = await supabaseAdmin
      .from('orders')
      .select('id, status, amount, external_reference, asaas_status, asaas_payment_id, created_at, tracking_payload')
      .eq('asaas_payment_id', data.txid)
      .maybeSingle();

    if (!order) {
      return { status: 'pending', external_reference: undefined, transaction_amount: 0 };
    }

    const internal = String(order.status || '').toLowerCase();
    const gw = String((order as any).asaas_status || '').toUpperCase();

    const isPaid =
      internal === 'approved' || internal === 'paid' || internal === 'pago' ||
      gw === 'CONFIRMED' || gw === 'PAID' || gw === 'APPROVED' || gw === 'RECEIVED';

    const isFailed =
      internal === 'rejected' || internal === 'cancelled' || internal === 'canceled' ||
      gw === 'EXPIRED' || gw === 'OVERDUE' || gw === 'CANCELLED';

    // Fallback: consulta Asaas diretamente se ainda pendente
    if (!isPaid && !isFailed) {
      try {
        const asaasStatus = await consultAsaasPayment(data.txid);
        console.log('[asaas-status][fallback]', { txid: data.txid, status: asaasStatus.status });

        if (asaasStatus.status === 'confirmed') {
          await supabaseAdmin
            .from('orders')
            .update({ status: 'paid', asaas_status: 'CONFIRMED', approved_at: new Date().toISOString() } as any)
            .eq('id', order.id);

          // Acionar webhook interno para processar UTMify + Meta CAPI + email
          try {
            const base = (process.env.ASAAS_WEBHOOK_BASE_URL || 'https://copadasfigurinhas.com')
              .replace(/[`'"]/g, '').replace(/\/+$/, '');
            await fetch(`${base}/api/public/asaas-webhook`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-asaas-internal': '1' },
              body: JSON.stringify({
                event: 'PAYMENT_RECEIVED',
                payment: { id: data.txid, externalReference: order.external_reference, status: 'RECEIVED' },
              }),
            });
          } catch (e) {
            console.error('[asaas-status][fallback] erro ao acionar webhook interno', e);
          }

          return {
            status: 'approved',
            external_reference: order.external_reference || undefined,
            transaction_amount: Number(order.amount || 0),
          };
        }

        if (asaasStatus.status === 'expired') {
          await supabaseAdmin.from('orders').update({ asaas_status: 'OVERDUE' } as any).eq('id', order.id);
          return { status: 'rejected', external_reference: order.external_reference || undefined, transaction_amount: 0 };
        }
      } catch (err) {
        console.error('[asaas-status][fallback] erro ao consultar Asaas', err);
      }
    }

    return {
      status: isPaid ? 'approved' : isFailed ? 'rejected' : 'pending',
      external_reference: order.external_reference || undefined,
      transaction_amount: Number(order.amount || 0),
    };
  });

// ============ Consulta direta no Asaas ============
export async function consultAsaasPayment(paymentId: string): Promise<{
  status: 'pending' | 'confirmed' | 'expired' | 'unknown';
  raw: any;
}> {
  const key = process.env.ASAAS_API_KEY?.trim();
  if (!key) return { status: 'unknown', raw: null };

  try {
    const res = await fetch(`${ASAAS_BASE}/payments/${encodeURIComponent(paymentId)}`, {
      method: 'GET',
      headers: { 'access_token': key, 'Content-Type': 'application/json' },
    });
    const text = await res.text();
    let json: any = null;
    try { json = JSON.parse(text); } catch { json = { raw: text }; }

    console.log('[asaas-consult]', { paymentId, httpStatus: res.status, status: json?.status });

    const statusRaw = String(json?.status || '').toUpperCase();

    const CONFIRMED = new Set(['RECEIVED', 'CONFIRMED', 'OVERDUE_RECEIVED']);
    const EXPIRED = new Set(['OVERDUE', 'CANCELLED']);

    if (CONFIRMED.has(statusRaw)) return { status: 'confirmed', raw: json };
    if (EXPIRED.has(statusRaw)) return { status: 'expired', raw: json };
    return { status: 'pending', raw: json };
  } catch (err) {
    console.error('[asaas-consult] erro', err);
    return { status: 'unknown', raw: null };
  }
}
