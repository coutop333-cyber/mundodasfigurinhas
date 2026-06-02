import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { Check, Mail, Inbox, ShieldAlert, Tag, ExternalLink, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { z } from 'zod';

const searchSchema = z.object({
  ref: z.string().optional(),
  id: z.string().optional(),
  value: z.coerce.number().optional(),
  product: z.string().optional(),
  status: z.string().optional(),
});

export const Route = createFileRoute('/obrigado')({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: 'Pagamento aprovado — Eletros Jundiaí' },
      { name: 'description', content: 'Confirmação de pagamento aprovado. Obrigado pela sua compra.' },
      { name: 'robots', content: 'noindex, nofollow' },
      { property: 'og:title', content: 'Pagamento aprovado — Eletros Jundiaí' },
      { property: 'og:description', content: 'Obrigado pela sua compra.' },
    ],
  }),
  component: ObrigadoPage,
});

function isMobile() {
  if (typeof navigator === 'undefined') return false;
  return /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent);
}

function ObrigadoPage() {
  const { ref, id, value, product, status } = Route.useSearch();
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (status && status !== 'approved') {
      navigate({ to: '/', replace: true });
    }
  }, [status, navigate]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const valorBR =
    typeof value === 'number' && Number.isFinite(value)
      ? value.toFixed(2).replace('.', ',')
      : null;

  const handleAbrirEmail = () => {
    if (isMobile()) {
      window.location.href = 'mailto:';
    } else {
      window.open('https://mail.google.com/mail/u/0/#inbox', '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <main
      className="min-h-screen px-4 py-8 sm:py-12"
      style={{
        background:
          'linear-gradient(180deg, #fdf6f8 0%, #fbeef3 50%, #fdf6f8 100%)',
        fontFamily: 'Outfit, sans-serif',
      }}
    >
      <div className="mx-auto w-full max-w-xl">
        {/* Card principal */}
        <section
          className={`bg-white rounded-3xl shadow-xl border border-pink-100 p-6 sm:p-10 text-center transition-all duration-700 ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          {/* Ícone de check com animação */}
          <div className="relative mx-auto mb-6 flex h-20 w-20 items-center justify-center">
            <span className="absolute inset-0 rounded-full bg-green-200 opacity-60 animate-ping" />
            <span className="absolute inset-0 rounded-full bg-green-100" />
            <Check
              className="relative h-11 w-11 text-green-600"
              strokeWidth={3}
              aria-hidden="true"
            />
          </div>

          <p className="text-xs uppercase tracking-[0.2em] font-semibold text-green-600 mb-2">
            Compra confirmada
          </p>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 leading-tight">
            Pagamento aprovado com sucesso!
          </h1>
          <p className="mt-2 text-base text-gray-600">
            Obrigado pela sua compra. Seu pedido já está sendo preparado com carinho. 💖
          </p>

          {/* SEÇÃO EMAIL — destaque */}
          <div
            className="mt-7 rounded-2xl p-5 sm:p-6 text-left border-2 relative overflow-hidden"
            style={{
              background:
                'linear-gradient(135deg, #fff5f9 0%, #f0fdf4 100%)',
              borderColor: '#f9c5d8',
            }}
          >
            <div className="flex items-start gap-4">
              <div className="relative flex-shrink-0">
                <span
                  className="absolute inset-0 rounded-2xl opacity-40 animate-pulse"
                  style={{ backgroundColor: '#f9c5d8' }}
                />
                <div
                  className="relative flex h-14 w-14 items-center justify-center rounded-2xl shadow-sm"
                  style={{ backgroundColor: '#c83f70' }}
                >
                  <Mail className="h-7 w-7 text-white" strokeWidth={2.2} />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg sm:text-xl font-bold text-gray-900 leading-snug">
                  📩 Acompanhe seu pedido pelo email
                </h2>
                <p className="mt-1.5 text-sm text-gray-700 leading-relaxed">
                  Enviamos automaticamente um email com a{' '}
                  <strong>confirmação da compra</strong> e o{' '}
                  <strong>link para acompanhar seu pedido</strong>.
                </p>
              </div>
            </div>

            <p className="mt-4 text-sm font-semibold text-gray-800">
              Verifique nas pastas:
            </p>
            <ul className="mt-2 grid grid-cols-3 gap-2">
              <li className="flex flex-col items-center gap-1 rounded-xl bg-white/80 backdrop-blur-sm border border-pink-100 px-2 py-3 text-center">
                <Inbox className="h-5 w-5" style={{ color: '#c83f70' }} />
                <span className="text-xs font-medium text-gray-700">Caixa de entrada</span>
              </li>
              <li className="flex flex-col items-center gap-1 rounded-xl bg-white/80 backdrop-blur-sm border border-pink-100 px-2 py-3 text-center">
                <ShieldAlert className="h-5 w-5" style={{ color: '#c83f70' }} />
                <span className="text-xs font-medium text-gray-700">Spam</span>
              </li>
              <li className="flex flex-col items-center gap-1 rounded-xl bg-white/80 backdrop-blur-sm border border-pink-100 px-2 py-3 text-center">
                <Tag className="h-5 w-5" style={{ color: '#c83f70' }} />
                <span className="text-xs font-medium text-gray-700">Promoções</span>
              </li>
            </ul>

            <Button
              onClick={handleAbrirEmail}
              className="w-full mt-5 py-6 text-base font-bold uppercase tracking-wide text-white shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5"
              style={{ backgroundColor: '#c83f70' }}
            >
              <ExternalLink className="mr-2 h-5 w-5" />
              Abrir meu email
            </Button>

            <div className="mt-4 flex items-start gap-2 rounded-lg bg-green-50 border border-green-200 p-3">
              <Package className="h-4 w-4 mt-0.5 text-green-700 flex-shrink-0" />
              <p className="text-xs sm:text-sm text-green-800 font-medium leading-relaxed">
                Seu código de rastreio e atualizações serão enviados por email.
              </p>
            </div>
          </div>

          {/* Detalhes do pedido */}
          {(product || valorBR || ref || id) && (
            <div className="mt-6 rounded-2xl border border-gray-100 bg-gray-50 p-4 sm:p-5 text-left">
              <p className="text-xs uppercase tracking-wider font-semibold text-gray-500 mb-3">
                Detalhes do pedido
              </p>
              {product && (
                <div className="flex justify-between gap-3 text-sm py-1.5">
                  <span className="text-gray-500">Produto</span>
                  <span className="font-medium text-gray-900 text-right">{product}</span>
                </div>
              )}
              {valorBR && (
                <div className="flex justify-between gap-3 text-sm py-1.5 border-t border-gray-200">
                  <span className="text-gray-500">Valor pago</span>
                  <span className="font-bold text-gray-900">R$ {valorBR}</span>
                </div>
              )}
              {ref && (
                <div className="flex justify-between gap-3 text-xs py-1.5 border-t border-gray-200">
                  <span className="text-gray-500">Pedido</span>
                  <span className="font-mono break-all text-right text-gray-600">{ref}</span>
                </div>
              )}
              {id && (
                <div className="flex justify-between gap-3 text-xs py-1.5 border-t border-gray-200">
                  <span className="text-gray-500">Transação</span>
                  <span className="font-mono text-gray-600">#{id}</span>
                </div>
              )}
            </div>
          )}

          {ref && (
            <Button
              asChild
              variant="outline"
              className="w-full mt-4 py-6 text-base font-semibold border-2"
              style={{ borderColor: '#c83f70', color: '#c83f70' }}
            >
              <Link to="/rastreio/$codigo" params={{ codigo: ref }}>
                <Package className="mr-2 h-5 w-5" />
                Acompanhar pedido
              </Link>
            </Button>
          )}

          <Link
            to="/"
            className="mt-5 inline-block text-sm text-gray-500 hover:text-gray-700 transition-colors underline-offset-4 hover:underline"
          >
            Voltar ao site
          </Link>
        </section>

        <p className="mt-6 text-center text-xs text-gray-400">
          🔒 Compra 100% segura · Eletros Jundiaí
        </p>
      </div>
    </main>
  );
}
