import { createHash } from 'crypto';
import { supabaseAdmin } from '@/integrations/supabase/client.server';

const sha256 = (v: string) =>
  createHash('sha256').update(v.trim().toLowerCase()).digest('hex');

export type MetaCapiResult = {
  ok: boolean;
  payload: unknown;
  httpStatus: number | null;
  responseBody: string | null;
  error: string | null;
};

export async function sendMetaCapiPurchase(
  order: any,
  opts: { eventId?: string; logTag?: string } = {},
): Promise<MetaCapiResult> {
  const logTag = opts.logTag || '[meta-capi][PURCHASE]';
  const pixelId = process.env.META_PIXEL_ID;
  const accessToken = process.env.META_CONVERSIONS_API_TOKEN;
  const testEventCode = process.env.META_TEST_EVENT_CODE || undefined;

  if (!pixelId || !accessToken) {
    const error = 'META_PIXEL_ID ou META_CONVERSIONS_API_TOKEN ausente';
    console.error(logTag, error);
    return { ok: false, payload: null, httpStatus: null, responseBody: null, error };
  }

  const tracking = order.tracking_payload || {};
  const userData: Record<string, unknown> = {};
  if (tracking.fbp) userData.fbp = tracking.fbp;
  if (tracking.fbc) userData.fbc = tracking.fbc;
  if (order.client_ip) userData.client_ip_address = order.client_ip;
  if (order.client_user_agent) userData.client_user_agent = order.client_user_agent;
  if (tracking.email) userData.em = [sha256(String(tracking.email))];
  if (tracking.phone) userData.ph = [sha256(String(tracking.phone).replace(/\D/g, ''))];
  if (order.id) userData.external_id = [sha256(String(order.id))];

  const hasStrongId = Boolean(tracking.fbp || tracking.fbc || tracking.email);
  const hasIpUa = Boolean(order.client_ip && order.client_user_agent);
  if (!hasStrongId && !hasIpUa) {
    const error = 'tracking_payload sem dados mínimos (fbp/fbc/email ou IP+UA)';
    console.warn(`${logTag}[bloqueio]`, { error, external_reference: order.external_reference });
    return { ok: false, payload: null, httpStatus: null, responseBody: null, error };
  }

  const domain = process.env.KORVEX_WEBHOOK_BASE_URL?.replace(/\/+$/, '') || 'https://copadasfigurinhas.com';
  const eventSourceUrl =
    tracking.landing_url || tracking.checkout_url || `${domain}/`;

  const eventId = opts.eventId || order.external_reference;

  const event = {
    event_name: 'Purchase',
    event_time: Math.floor(Date.now() / 1000),
    event_id: eventId,
    action_source: 'website',
    event_source_url: eventSourceUrl,
    user_data: userData,
    custom_data: {
      currency: 'BRL',
      value: Number(order.amount),
      content_ids: [`kit-${order.kit_id}`],
      content_name: order.kit_title,
      content_type: 'product',
      num_items: 1,
      order_id: order.external_reference,
    },
  };

  const payload: Record<string, unknown> = { data: [event] };
  if (testEventCode) payload.test_event_code = testEventCode;

  const url = `https://graph.facebook.com/v20.0/${pixelId}/events?access_token=${accessToken}`;
  let httpStatus: number | null = null;
  let responseBody: string | null = null;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    httpStatus = res.status;
    responseBody = await res.text();

    console.log('[META_CAPI_RESPONSE]', {
      external_reference: order.external_reference,
      event_id: eventId,
      http_status: httpStatus,
      response: responseBody,
    });

    if (!res.ok) {
      return { ok: false, payload, httpStatus, responseBody, error: `HTTP ${res.status}` };
    }
    return { ok: true, payload, httpStatus, responseBody, error: null };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`${logTag} exceção`, error);
    return { ok: false, payload, httpStatus, responseBody, error };
  }
}

export async function sendAndLogMetaCapiPurchase(
  order: any,
  opts: { eventId?: string; logTag?: string } = {},
): Promise<boolean> {
  const result = await sendMetaCapiPurchase(order, opts);
  await supabaseAdmin
    .from('orders')
    .update({
      meta_capi_payload: result.payload as any,
      meta_capi_http_status: result.httpStatus,
      meta_capi_response: result.responseBody,
      meta_capi_error: result.error,
      meta_capi_sent_at: result.ok ? new Date().toISOString() : null,
    } as any)
    .eq('id', order.id);
  return result.ok;
}
