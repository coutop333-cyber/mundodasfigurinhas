import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { z } from 'zod';
import { Truck, AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useServerFn } from '@tanstack/react-start';
import { createKirvusPixPayment } from '@/lib/kirvuspay.functions';
import { captureTracking, newEventId } from '@/lib/tracking';
import { PixCheckoutDialog } from '@/components/PixCheckoutDialog';
import type { PixPaymentInfo } from '@/components/PixCheckoutDialog';
import logoPanini from '@/assets/logo-panini.png';
import { toast } from 'sonner';

const VERDE = '#009c3b';
const VERDE_ESCURO = '#00802f';
const AMARELO = '#ffdf00';

const searchSchema = z.object({
  ref: z.string().optional(),
  id: z.string().optional(),
  value: z.coerce.number().optional(),
  product: z.string().optional(),
  email: z.string().optional(),
  nome: z.string().optional(),
  telefone: z.string().optional(),
});

export const Route = createFileRoute('/upsell')({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: 'Libere seu Pedido — Copa das Figurinhas' },
      { name: 'robots', content: 'noindex, nofollow' },
    ],
  }),
  component: UpsellPage,
});

const FRETE_PRECO = 18.99;

function UpsellPage() {
  const { ref, id, value, product, email, nome, telefone } = Route.useSearch();
  const navigate = useNavigate();
  const createPixPayment = useServerFn(createKirvusPixPayment);

  const [generating, setGenerating] = useState(false);
  const [payment, setPayment] = useState<PixPaymentInfo | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const goToObrigado = () => {
    navigate({
      to: '/obrigado',
      search: { ref, id, value, product, status: 'approved' },
      replace: true,
    });
  };

  const handleGerarPix = async () => {
    if (generating) return;
    setGenerating(true);
    try {
      const upsellRef = `upsell-frete-${newEventId('upsell')}`;
      const tracking = captureTracking();
      const p = await createPixPayment({
        data: {
          kitId: 97,
          title: 'Frete Expresso — Copa das Figurinhas',
          unitPrice: FRETE_PRECO,
          externalReference: upsellRef,
          payerEmail: email,
          payerName: nome,
          payerPhone: telefone,
          tracking: {
            ...tracking,
            ...(nome ? { name: nome } : {}),
            ...(email ? { email } : {}),
            ...(telefone ? { phone: telefone } : {}),
          } as any,
          source: 'produto5' as any,
        },
      });
      setPayment({
        id: p.id,
        txid: p.txid,
        status: p.status,
        qr_code: p.qr_code,
        qr_code_base64: p.qr_code_base64,
        ticket_url: p.ticket_url,
        external_reference: p.external_reference,
        transaction_amount: p.transaction_amount,
        expires_at: p.expires_at,
      });
      setDialogOpen(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao gerar Pix. Tente novamente.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <main className="min-h-screen px-4 py-8 flex flex-col items-center" style={{ background: '#fff9f0', fontFamily: 'Archivo Black, sans-serif' }}>

      {/* Logo */}
      <div className="text-center mb-6">
        <img src={logoPanini} alt="Copa das Figurinhas" className="h-14 w-auto mx-auto" />
      </div>

      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden" style={{ border: '3px solid #f59e0b' }}>

          {/* Faixa topo laranja/amarela */}
          <div className="py-5 px-6 text-center" style={{ background: 'linear-gradient(135deg, #d97706, #f59e0b)' }}>
            <div className="flex justify-center mb-3">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/20">
                <AlertTriangle className="h-9 w-9 text-white" strokeWidth={2.5} />
              </div>
            </div>
            <h1 className="text-2xl font-black text-white leading-tight uppercase">
              Ops! Sem frete grátis
            </h1>
            <p className="text-white/90 text-sm font-semibold mt-1">
              para a sua região
            </p>
          </div>

          {/* Corpo */}
          <div className="p-6 space-y-5">

            {/* Mensagem */}
            <div className="rounded-2xl p-4 text-center" style={{ background: '#fff7ed', border: '1.5px solid #fed7aa' }}>
              <p className="text-gray-800 font-semibold text-base leading-snug">
                Estamos <strong>sem frete grátis disponível</strong> para sua região no momento.
              </p>
              <p className="text-gray-600 text-sm mt-2">
                Pague o frete expresso para <strong>liberar seu pedido</strong> e receba em <strong>2 a 3 dias úteis</strong>.
              </p>
            </div>

            {/* Frete expresso card */}
            <div className="rounded-2xl p-4 flex items-center gap-4" style={{ background: `${VERDE}0d`, border: `2px solid ${VERDE}40` }}>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl shrink-0" style={{ backgroundColor: VERDE }}>
                <Truck className="h-6 w-6 text-white" strokeWidth={2} />
              </div>
              <div className="flex-1">
                <p className="font-black text-gray-900 text-sm">Frete Expresso</p>
                <p className="text-xs text-gray-500">Entrega em 2 a 3 dias úteis</p>
              </div>
              <p className="font-black text-xl" style={{ color: VERDE }}>
                R$ 18,99
              </p>
            </div>

            {/* Botão Pix */}
            <Button
              onClick={handleGerarPix}
              disabled={generating}
              className="w-full py-6 text-base font-black uppercase tracking-wide text-white rounded-2xl shadow-lg"
              style={{ background: `linear-gradient(135deg, ${VERDE}, ${VERDE_ESCURO})`, fontFamily: 'Archivo Black, sans-serif' }}
            >
              {generating ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  Gerando Pix...
                </span>
              ) : (
                '🏆 Pagar R$ 18,99 com Pix'
              )}
            </Button>

            {/* Recusar */}
            <button
              onClick={goToObrigado}
              className="w-full flex items-center justify-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors py-2"
            >
              <X className="h-3.5 w-3.5" />
              Não, obrigado — manter frete grátis e aguardar prazo normal
            </button>

          </div>
        </div>

        <p className="mt-5 text-center text-xs text-gray-400">
          🔒 Pagamento 100% seguro · Copa das Figurinhas
        </p>
      </div>

      {/* Dialog Pix do upsell */}
      {payment && (
        <PixCheckoutDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          payment={payment}
          onApproved={goToObrigado}
        />
      )}
    </main>
  );
}
