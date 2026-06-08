import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const UTMIFY_ENDPOINT = 'https://api.utmify.com.br/api-credentials/orders'
const META_CAPI_URL = 'https://graph.facebook.com/v20.0'
const PAID_EVENTS = new Set(['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED', 'PAYMENT_OVERDUE_RECEIVED'])

const cors = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, asaas-access-token',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
  if (req.method === 'GET') return new Response(JSON.stringify({ ok: true, route: 'asaas-webhook' }), { headers: cors })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  let json: any
  try {
    const rawBody = await req.text()
    console.log('[ASAAS_WEBHOOK_RAW]', rawBody)
    json = JSON.parse(rawBody)
  } catch {
    return new Response(JSON.stringify({ error: 'invalid json' }), { status: 400, headers: cors })
  }

  const event = String(json?.event || '').toUpperCase().trim()
  const payment = json?.payment || {}
  const paymentId: string = payment?.id || ''
  const externalRef: string = payment?.externalReference || ''

  console.log('[ASAAS_WEBHOOK_EVENTO]', { event, paymentId, externalRef })

  if (!PAID_EVENTS.has(event)) {
    return new Response(JSON.stringify({ success: true, ignored: true, event }), { headers: cors })
  }

  if (!paymentId && !externalRef) {
    return new Response(JSON.stringify({ error: 'missing payment id' }), { status: 400, headers: cors })
  }

  // Localizar pedido
  let order: any = null
  if (externalRef) {
    const { data } = await supabase.from('orders')
      .select('id, status, amount, external_reference, asaas_status, approved_at, tracking_payload, order_email_sent_at, meta_capi_sent_at, kit_id, kit_title, client_ip')
      .eq('external_reference', externalRef).maybeSingle()
    order = data
  }
  if (!order && paymentId) {
    const { data } = await supabase.from('orders')
      .select('id, status, amount, external_reference, asaas_status, approved_at, tracking_payload, order_email_sent_at, meta_capi_sent_at, kit_id, kit_title, client_ip')
      .eq('asaas_payment_id', paymentId).maybeSingle()
    order = data
  }

  if (!order) {
    console.warn('[ASAAS_WEBHOOK] pedido não encontrado', { paymentId, externalRef })
    return new Response(JSON.stringify({ error: 'order not found' }), { status: 404, headers: cors })
  }

  console.log('[ASAAS_PEDIDO_ENCONTRADO]', { order_id: order.id, status: order.status })

  const alreadyPaid =
    ['paid', 'approved'].includes(String(order.status).toLowerCase()) ||
    String(order.asaas_status).toUpperCase() === 'CONFIRMED'

  if (!alreadyPaid) {
    await supabase.from('orders').update({
      status: 'paid',
      asaas_status: 'CONFIRMED',
      asaas_payment_id: paymentId || undefined,
      approved_at: new Date().toISOString(),
    }).eq('id', order.id).neq('status', 'paid')
  }

  // Rastreio
  const codigo = String(order.external_reference || '').trim()
  if (codigo) {
    await supabase.from('rastreios' as any).upsert(
      { codigo_pedido: codigo, status: 'Pagamento aprovado', observacao: '' } as any,
      { onConflict: 'codigo_pedido', ignoreDuplicates: true }
    ).catch(() => {})
  }

  // UTMify
  const { data: claimed } = await supabase
    .rpc('claim_order_utmify' as any, { _order_id: order.id } as any).maybeSingle()

  if (claimed) {
    const tracking = order.tracking_payload || {}
    const utms = tracking.utms || {}
    const amountCents = Math.max(1, Math.round(Number(order.amount || 0) * 100))
    const createdAt = new Date(order.created_at || Date.now()).toISOString().replace('T', ' ').slice(0, 19)
    const approvedDate = new Date().toISOString().replace('T', ' ').slice(0, 19)

    const cleanUtm = (v: any) => {
      if (!v) return null
      const s = String(v).trim()
      if (!s || ['null','undefined','none','(none)'].includes(s.toLowerCase())) return null
      return s
    }

    const utmifyPayload = {
      orderId: order.external_reference,
      platform: 'CopaFigurinhas',
      paymentMethod: 'pix',
      status: 'paid',
      createdAt,
      approvedDate,
      refundedAt: null,
      customer: {
        name: tracking.name || 'Cliente',
        email: (tracking.email || `cliente+${order.external_reference}@copadasfigurinhas.com`).toLowerCase(),
        phone: String(tracking.phone || '').replace(/\D/g, '') || null,
        document: null,
        country: 'BR',
        ip: order.client_ip || tracking.ip || '0.0.0.0',
      },
      products: [{
        id: `kit-${order.kit_id || 'produto'}`,
        name: order.kit_title || 'Figurinhas Copa 2026',
        planId: null, planName: null, quantity: 1,
        priceInCents: amountCents,
      }],
      trackingParameters: {
        src: cleanUtm(utms.src), sck: cleanUtm(utms.sck),
        utm_source: cleanUtm(utms.utm_source),
        utm_campaign: cleanUtm(utms.utm_campaign),
        utm_medium: cleanUtm(utms.utm_medium),
        utm_content: cleanUtm(utms.utm_content),
        utm_term: cleanUtm(utms.utm_term),
        fbclid: tracking.fbclid || null,
        fbp: tracking.fbp || null,
        fbc: tracking.fbc || null,
      },
      commission: {
        totalPriceInCents: amountCents,
        gatewayFeeInCents: 0,
        userCommissionInCents: amountCents,
        currency: 'BRL',
      },
      isTest: false,
    }

    // waiting_payment primeiro
    try {
      await fetch(UTMIFY_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-token': Deno.env.get('UTMIFY_API_TOKEN')! },
        body: JSON.stringify({ ...utmifyPayload, status: 'waiting_payment', approvedDate: null }),
      })
    } catch {}

    // paid
    const utmRes = await fetch(UTMIFY_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-token': Deno.env.get('UTMIFY_API_TOKEN')! },
      body: JSON.stringify(utmifyPayload),
    })
    const utmBody = await utmRes.text()
    console.log('[UTMIFY_RESPONSE]', { status: utmRes.status, body: utmBody })

    await supabase.from('orders').update({
      utmify_payload: utmifyPayload as any,
      utmify_http_status: utmRes.status,
      utmify_response: utmBody,
      utmify_error: utmRes.ok ? null : utmBody,
      utmify_sent_at: utmRes.ok ? new Date().toISOString() : null,
      utmify_processing_at: null,
    } as any).eq('id', order.id)
  }

  // Meta CAPI Purchase
  if (!order.meta_capi_sent_at) {
    try {
      const pixelId = Deno.env.get('META_PIXEL_ID')
      const token = Deno.env.get('META_CONVERSIONS_API_TOKEN')
      if (pixelId && token) {
        const tracking = order.tracking_payload || {}
        const eventData = {
          data: [{
            event_name: 'Purchase',
            event_time: Math.floor(Date.now() / 1000),
            event_id: order.external_reference,
            action_source: 'website',
            user_data: {
              em: tracking.email ? [await sha256(tracking.email.toLowerCase().trim())] : undefined,
              ph: tracking.phone ? [await sha256(tracking.phone.replace(/\D/g, ''))] : undefined,
              fbp: tracking.fbp || undefined,
              fbc: tracking.fbc || undefined,
              client_ip_address: order.client_ip || undefined,
              client_user_agent: tracking.user_agent || undefined,
            },
            custom_data: {
              value: Number(order.amount || 0),
              currency: 'BRL',
              content_ids: [`kit-${order.kit_id}`],
              content_type: 'product',
            },
          }],
          test_event_code: undefined,
        }

        const metaRes = await fetch(`${META_CAPI_URL}/${pixelId}/events?access_token=${token}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(eventData),
        })
        const metaBody = await metaRes.text()
        console.log('[META_CAPI_RESPONSE]', { status: metaRes.status, body: metaBody })

        await supabase.from('orders').update({
          meta_capi_sent_at: new Date().toISOString(),
          meta_capi_http_status: metaRes.status,
          meta_capi_response: metaBody,
          meta_capi_error: metaRes.ok ? null : metaBody,
        } as any).eq('id', order.id)
      }
    } catch (e) {
      console.error('[META_CAPI_ERROR]', e)
    }
  }

  return new Response(
    JSON.stringify({ success: true, order_id: order.id, external_reference: order.external_reference }),
    { headers: cors }
  )
})

async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')
}
