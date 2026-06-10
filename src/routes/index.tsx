import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Star, Check, Truck, Shield, Award, Package, ChevronLeft, ChevronRight, Loader2, Trophy, Sparkles, Flame, Clock, Lock, BadgeCheck, ChevronDown, MessageCircle, Gift, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMetaPixel } from '@/hooks/useMetaPixel';
import { toast } from 'sonner';
import { useServerFn } from '@tanstack/react-start';
import { createKirvusPixPayment, warmKirvusPix } from '@/lib/kirvuspay.functions';
import { captureTracking, newEventId } from '@/lib/tracking';
import { CheckoutForm } from '@/components/CheckoutForm';
import type { PixPaymentInfo } from '@/components/PixCheckoutDialog';
import { OrderReviewDialog, type OrderProduct } from '@/components/OrderReviewDialog';

import promoHero from '@/assets/copa-2026-promo.png';
import promoHero30 from '@/assets/copa-2026-promo-30.png';
import pixLogo from '@/assets/pix-logo.png';
import logoPanini from '@/assets/logo-panini.png';

const VERDE = '#009c3b';
const VERDE_ESCURO = '#00802f';
const AMARELO = '#ffdf00';
const AZUL = '#002776';
const VERMELHO = '#c0392b';

const HERO_IMAGE = promoHero;

export const Route = createFileRoute('/')({
  head: () => ({
    meta: [
      { title: 'Figurinhas Copa 2026 · Pacotes Oficiais Panini com Frete Grátis' },
      { name: 'description', content: 'Complete seu álbum da Copa do Mundo FIFA 2026. Pacotes oficiais Panini com frete grátis para todo o Brasil. Menor preço garantido.' },
      { property: 'og:title', content: 'Figurinhas Copa 2026 · Frete Grátis' },
      { property: 'og:description', content: 'Pacotes oficiais Panini Copa 2026 com frete grátis. Envio em 24h.' },
      { property: 'og:image', content: HERO_IMAGE },
    ],
    links: [
      { rel: 'preload', as: 'image', href: HERO_IMAGE, fetchpriority: 'high' } as any,
    ],
  }),
  component: HomePage,
});

type Kit = {
  id: number;
  packs: number;
  stickers: number;
  quantity: string;
  shortLabel: string;
  price: number;
  pricePerUnit: number;
  oldPrice: number;
  savings: number;
  discount: number;
  pricePerPack: string;
  contentId: string;
  heroImage: string;
  badge?: string;
};

const KITS: Kit[] = [
  {
    id: 3,
    packs: 10,
    stickers: 70,
    quantity: '10 PACOTES DE FIGURINHAS PANINI COPA DO MUNDO FIFA 2026',
    shortLabel: '10 pacotes · 70 figurinhas',
    price: 57.90,
    pricePerUnit: 57.90,
    oldPrice: 124.90,
    savings: 67.00,
    discount: 53,
    pricePerPack: 'R$ 5,79',
    contentId: 'copa-2026-10pacotes',
    heroImage: promoHero,
  },
  {
    id: 1,
    packs: 20,
    stickers: 140,
    quantity: '20 PACOTES DE FIGURINHAS PANINI COPA DO MUNDO FIFA 2026',
    shortLabel: '20 pacotes · 140 figurinhas',
    price: 97.00,
    pricePerUnit: 97.00,
    oldPrice: 249.90,
    savings: 152.90,
    discount: 61,
    pricePerPack: 'R$ 4,85',
    contentId: 'copa-2026-20pacotes',
    heroImage: promoHero,
  },
  {
    id: 2,
    packs: 30,
    stickers: 210,
    quantity: '30 PACOTES DE FIGURINHAS PANINI COPA DO MUNDO FIFA 2026',
    shortLabel: '30 pacotes · 210 figurinhas',
    price: 127.90,
    pricePerUnit: 127.90,
    oldPrice: 374.85,
    savings: 246.95,
    discount: 66,
    pricePerPack: 'R$ 4,26',
    contentId: 'copa-2026-30pacotes',
    heroImage: promoHero30,
  },
  {
    id: 4,
    packs: 40,
    stickers: 280,
    quantity: '40 PACOTES DE FIGURINHAS PANINI COPA DO MUNDO FIFA 2026',
    shortLabel: '40 pacotes · 280 figurinhas',
    price: 160.00,
    pricePerUnit: 160.00,
    oldPrice: 499.80,
    savings: 339.80,
    discount: 68,
    pricePerPack: 'R$ 4,00',
    contentId: 'copa-2026-40pacotes',
    heroImage: promoHero30,
  },
  {
    id: 5,
    packs: 60,
    stickers: 420,
    quantity: '60 PACOTES DE FIGURINHAS PANINI COPA DO MUNDO FIFA 2026 — PACOTE OURO',
    shortLabel: '60 pacotes · 420 figurinhas',
    price: 215.00,
    pricePerUnit: 215.00,
    oldPrice: 749.70,
    savings: 534.70,
    discount: 71,
    pricePerPack: 'R$ 3,58',
    contentId: 'copa-2026-60pacotes',
    heroImage: promoHero30,
    badge: '🥇 PACOTE OURO',
  },
];

const KIT_20 = KITS.find((k) => k.packs === 20)!;
const KIT_30 = KITS.find((k) => k.packs === 30)!;
const KIT_60 = KITS.find((k) => k.packs === 60)!;

const displayImagesByKit: Record<number, { image: string; title: string }[]> = {
  1: [{ image: promoHero, title: 'Kit 20 Pacotes Copa 2026' }],
  2: [{ image: promoHero30, title: 'Kit 30 Pacotes Copa 2026' }],
  3: [{ image: promoHero, title: 'Kit 10 Pacotes Copa 2026' }],
  4: [{ image: promoHero30, title: 'Kit 40 Pacotes Copa 2026' }],
  5: [{ image: promoHero30, title: 'Pacote Ouro 60 Pacotes Copa 2026' }],
};

const REVIEWS = [
  { name: 'Lucas A.', city: 'São Paulo · SP', text: 'Veio rapidíssimo, tudo lacrado. Tirei o Vini Jr brilhante no 3º pacote. Produto 100% original!', rating: 5, ago: '2 dias' },
  { name: 'Bruno M.', city: 'BH · MG', text: 'Comprei pro meu filho e acabei viciando. 20 pacotes rendem muito. Valeu cada centavo.', rating: 5, ago: '1 dia' },
  { name: 'Rafael S.', city: 'Curitiba · PR', text: 'Na banca aqui tá R$8 cada. Aqui sai por R$4,85. Absurdo a diferença! Já é meu 2º pedido.', rating: 5, ago: '3 dias' },
  { name: 'Diego P.', city: 'Salvador · BA', text: 'Chegou em 4 dias em Salvador, super bem embalado. Quase todas diferentes, muito boa variação!', rating: 5, ago: '5 horas' },
  { name: 'Mariana L.', city: 'Rio · RJ', text: 'Presentei meu neto e ele ficou maluco! Emocional demais ver a felicidade dele abrindo os pacotes.', rating: 5, ago: '12 horas' },
  { name: 'Henrique C.', city: 'Recife · PE', text: 'Produto oficial de verdade. Estou quase completando o álbum com 30 pacotes. Recomendo muito!', rating: 5, ago: '1 dia' },
];

function HomePage() {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewProduct, setReviewProduct] = useState<OrderProduct | null>(null);
  const formDataRef = useRef<{ nome?: string; email?: string; telefone?: string; cpf?: string } | null>(null);
  const upsellSelectedRef = useRef(false);
  const eventIdRef = useRef<string | null>(null);
  const [selectedKitId, setSelectedKitId] = useState<number>(KIT_60.id);
  const KIT = KITS.find((k) => k.id === selectedKitId) ?? KITS[0];
  const displayImages = displayImagesByKit[selectedKitId] ?? displayImagesByKit[KITS[0].id];
  useEffect(() => { setCurrentImageIndex(0); }, [selectedKitId]);

  const { trackViewContent, trackAddToCart, trackInitiateCheckout, trackLead, trackPurchase } = useMetaPixel();

  // Countdown — reinicia quando chega a zero
  const [timeLeft, setTimeLeft] = useState(15 * 60);
  useEffect(() => {
    const id = setInterval(() => setTimeLeft((p) => p <= 1 ? 15 * 60 : p - 1), 1000);
    return () => clearInterval(id);
  }, []);
  const mm = Math.floor(timeLeft / 60).toString().padStart(2, '0');
  const ss = (timeLeft % 60).toString().padStart(2, '0');

  const [unitsLeft, setUnitsLeft] = useState(23);

  useEffect(() => { captureTracking(); }, []);

  // ViewContent no carregamento — dispara 1x, com event_id para dedup com CAPI
  const viewContentFired = useRef(false);
  useEffect(() => {
    if (viewContentFired.current) return;
    viewContentFired.current = true;
    const eventId = newEventId('vc');
    trackViewContent({
      content_name: KIT_20.quantity,
      content_ids: [KIT_20.contentId],
      content_type: 'product',
      value: KIT_20.price,
      currency: 'BRL',
      event_id: eventId,
    });
  }, [trackViewContent]);

  const createPixPayment = useServerFn(createKirvusPixPayment);
  const warmPixProxy = useServerFn(warmKirvusPix);

  useEffect(() => {
    const key = 'kirvus_warmed_at';
    const last = Number(window.sessionStorage.getItem(key) || 0);
    if (Date.now() - last < 10 * 60 * 1000) return;
    window.sessionStorage.setItem(key, String(Date.now()));
    const timer = window.setTimeout(() => void warmPixProxy(), 1500);
    return () => window.clearTimeout(timer);
  }, [warmPixProxy]);

  const handlePreviousImage = useCallback(() => setCurrentImageIndex((p) => (p === 0 ? displayImages.length - 1 : p - 1)), [displayImages.length]);
  const handleNextImage = useCallback(() => setCurrentImageIndex((p) => (p === displayImages.length - 1 ? 0 : p + 1)), [displayImages.length]);

  const handleBuyClick = () => {
    if (generating) return;
    void warmPixProxy();
    // AddToCart — dispara no clique do CTA (sinal real de intenção)
    trackAddToCart({
      content_name: KIT.quantity,
      content_ids: [KIT.contentId],
      content_type: 'product',
      value: KIT.price,
      currency: 'BRL',
      num_items: 1,
      event_id: newEventId('atc'),
    });
    setFormOpen(true);
  };

  const handleFormConfirm = (formData: any) => {
    formDataRef.current = formData || {};
    const eventId = newEventId('checkout');
    eventIdRef.current = eventId;
    trackInitiateCheckout({
      content_name: KIT.quantity,
      content_ids: [KIT.contentId],
      value: KIT.price,
      currency: 'BRL',
      num_items: 1,
      event_id: eventId,
    });
    setFormOpen(false);
    setReviewProduct({
      image: KIT.heroImage,
      title: `${KIT.quantity} - Copa das Figurinhas`,
      variation: KIT.shortLabel,
      quantity: 1,
      unitPrice: KIT.pricePerUnit,
      price: KIT.price,
    });
    setReviewOpen(true);
  };

  const handleCreatePixPayment = async (): Promise<PixPaymentInfo | null> => {
    if (generating) return null;
    setGenerating(true);
    try {
      const eventId = eventIdRef.current || newEventId('purchase');
      eventIdRef.current = eventId;
      const tracking = captureTracking();
      const fd = formDataRef.current || {};
      const payment = await createPixPayment({
        data: {
          kitId: selectedKitId === -99 ? 99 : KIT.id,
          title: selectedKitId === -99 ? '1 FIGURINHA TESTE COPA 2026' : (upsellSelectedRef.current ? `${KIT.quantity} + 10 PACOTES EXTRA` : KIT.quantity),
          unitPrice: selectedKitId === -99 ? 5.00 : (KIT.price + (upsellSelectedRef.current ? 29.90 : 0)),
          externalReference: eventId,
          payerEmail: fd.email,
          payerName: fd.nome,
          payerPhone: fd.telefone,
          payerDocument: fd.cpf,
          tracking: {
            ...tracking,
            ...(fd.nome ? { name: fd.nome } : {}),
            ...(fd.email ? { email: fd.email } : {}),
            ...(fd.telefone ? { phone: fd.telefone } : {}),
          } as any,
          source: 'produto5' as any,
        },
      });
      return {
        id: payment.id,
        txid: payment.txid,
        status: payment.status,
        qr_code: payment.qr_code,
        qr_code_base64: payment.qr_code_base64,
        ticket_url: payment.ticket_url,
        external_reference: payment.external_reference,
        transaction_amount: payment.transaction_amount,
        expires_at: payment.expires_at,
      };
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao gerar Pix. Tente novamente.');
      return null;
    } finally {
      setGenerating(false);
    }
  };

  const navigate = useNavigate();

  const handlePixApproved = (p: PixPaymentInfo) => {
    trackPurchase({
      content_name: KIT.quantity,
      content_ids: [KIT.contentId],
      value: p.transaction_amount,
      currency: 'BRL',
      num_items: 1,
      event_id: p.external_reference,
    });
    setUnitsLeft((prev) => Math.max(5, prev - 1));
    setReviewOpen(false);
    const fd = formDataRef.current || {};
    navigate({
      to: '/upsell',
      search: {
        ref: p.external_reference,
        id: String(p.id),
        value: p.transaction_amount,
        product: KIT.quantity,
        email: fd.email,
        nome: fd.nome,
        telefone: fd.telefone,
        cpf: fd.cpf,
      },
      replace: true,
    });
  };

  return (
    <div className="min-h-screen bg-white">

      {/* BARRA DE URGÊNCIA */}
      <div className="text-white py-2.5 px-4 text-center" style={{ background: `linear-gradient(90deg, ${VERDE_ESCURO}, ${VERDE}, ${VERDE_ESCURO})` }}>
        <div className="max-w-5xl mx-auto flex items-center justify-center gap-3 flex-wrap">
          <span className="text-sm font-bold flex items-center gap-1.5">
            <Flame className="w-4 h-4" style={{ color: AMARELO }} />
            Promoção Copa 2026 — Frete Grátis para todo o Brasil
          </span>
          <span className="flex items-center gap-1 bg-black/25 px-2.5 py-1 rounded-md text-sm font-black tabular-nums" style={{ color: AMARELO }}>
            <Clock className="w-3.5 h-3.5" /> {mm}:{ss}
          </span>
        </div>
      </div>

      {/* HEADER */}
      <header className="bg-white border-b sticky top-[44px] z-50" style={{ borderColor: `${AMARELO}` }}>
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <img src={logoPanini} alt="Copa das Figurinhas" className="h-10 md:h-14 w-auto" />
          <div className="flex items-center gap-3">
            <a
              href="https://wa.me/5511999999999?text=Olá! Quero comprar figurinhas da Copa 2026"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden md:flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold text-white"
              style={{ backgroundColor: '#25D366' }}
            >
              <MessageCircle className="w-4 h-4" /> Suporte
            </a>
            <span className="flex items-center gap-1 text-xs font-semibold text-green-700">
              <Shield className="w-3.5 h-3.5" /> Compra segura
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-5">

        {/* HERO HEADLINE — gancho emocional acima da dobra */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold uppercase mb-3" style={{ backgroundColor: `${AZUL}`, color: AMARELO }}>
            <Trophy className="w-3.5 h-3.5" /> Produto Oficial · Panini · FIFA World Cup 2026
          </div>
          <h1 className="text-3xl md:text-4xl font-black leading-tight mb-2" style={{ fontFamily: 'Archivo Black, sans-serif', color: AZUL }}>
            Complete seu álbum da Copa 2026
            <span className="block" style={{ color: VERDE }}> pelo menor preço do Brasil</span>
          </h1>
          <p className="text-gray-600 text-base max-w-xl mx-auto">
            Pacotes <strong>oficiais Panini lacrados</strong> · 7 cromos sortidos cada · todas as 48 seleções · <strong>frete grátis</strong> rastreado para qualquer estado.
          </p>
        </div>

        {/* GRID PRINCIPAL */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10 mb-8">

          {/* COLUNA ESQUERDA — Imagem */}
          <div className="space-y-3">
            <div className="rounded-2xl overflow-hidden shadow-lg relative bg-gray-50" style={{ border: `3px solid ${VERDE}` }}>
              <div className="relative aspect-square">
                <img
                  src={displayImages[currentImageIndex]?.image}
                  alt={displayImages[currentImageIndex]?.title}
                  className="w-full h-full object-contain"
                  width={800} height={800} decoding="async"
                  {...(currentImageIndex === 0 ? { fetchPriority: 'high' as any } : { loading: 'lazy' as const })}
                />
                <button onClick={handlePreviousImage} className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/90 p-2 rounded-full shadow"><ChevronLeft className="h-5 w-5 text-gray-700" /></button>
                <button onClick={handleNextImage} className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/90 p-2 rounded-full shadow"><ChevronRight className="h-5 w-5 text-gray-700" /></button>
                <div className="absolute top-3 left-3 flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase shadow" style={{ backgroundColor: AMARELO, color: AZUL }}>
                  <Sparkles className="w-3 h-3" /> Oficial Panini
                </div>
                <div className="absolute top-3 right-3 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase shadow text-white" style={{ backgroundColor: VERMELHO }}>
                  -{KIT.discount}% OFF
                </div>
              </div>
            </div>

            {/* Rating + Avaliações */}
            <div className="flex items-center justify-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <div className="flex">{[...Array(5)].map((_, i) => <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />)}</div>
              <span className="text-sm font-bold text-gray-800">4.9 · <span className="font-normal text-gray-600">2.341 avaliações verificadas</span></span>
            </div>

            {/* Selos de garantia */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { icon: Shield, label: 'Oficial Panini', sub: 'Licenciado FIFA' },
                { icon: Truck, label: 'Frete Grátis', sub: 'Todo o Brasil' },
                { icon: Package, label: 'Envio 24h', sub: 'Após Pix aprovado' },
              ].map((b, i) => (
                <div key={i} className="flex flex-col items-center gap-1 rounded-xl py-3 px-2 text-center bg-white shadow-sm border border-gray-100">
                  <b.icon className="w-5 h-5" style={{ color: VERDE }} />
                  <span className="text-[10px] font-bold text-gray-800 leading-tight">{b.label}</span>
                  <span className="text-[9px] text-gray-500">{b.sub}</span>
                </div>
              ))}
            </div>
          </div>

          {/* COLUNA DIREITA — Oferta */}
          <div className="space-y-4">

            {/* Seletor de Kit */}
            <div>
              <p className="text-xs font-black uppercase tracking-widest mb-2" style={{ color: AZUL }}>Escolha seu kit:</p>

              {/* Kit Ouro — destaque máximo */}
              {(() => {
                const k = KITS.find(k => k.id === 5)!;
                const sel = selectedKitId === 5;
                return (
                  <button
                    onClick={() => setSelectedKitId(5)}
                    className="relative w-full rounded-2xl p-3.5 text-left transition-all active:scale-[0.98] mb-2 overflow-hidden"
                    style={{
                      background: sel ? 'linear-gradient(135deg, #92400e, #b45309, #d97706)' : 'linear-gradient(135deg, #fef3c7, #fde68a)',
                      border: `3px solid ${sel ? '#f59e0b' : '#f59e0b'}`,
                      boxShadow: sel ? '0 8px 32px rgba(217,119,6,0.5)' : '0 4px 16px rgba(217,119,6,0.2)',
                    }}
                  >
                    {/* Brilho animado */}
                    <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ background: 'linear-gradient(45deg, transparent 30%, rgba(255,255,255,0.6) 50%, transparent 70%)', backgroundSize: '200% 200%' }} />

                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wide" style={{ background: '#92400e', color: '#fef3c7' }}>
                          🥇 PACOTE OURO
                        </span>
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full uppercase" style={{ background: '#dc2626', color: '#fff' }}>
                          🔥 +{k.discount}% OFF
                        </span>
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full uppercase" style={{ background: VERDE, color: '#fff' }}>
                          ✅ MAIS INDICADO
                        </span>
                      </div>
                      {sel && <Check className="w-5 h-5 shrink-0" strokeWidth={3} style={{ color: '#92400e' }} />}
                    </div>

                    <div className="flex items-end justify-between gap-2">
                      <div>
                        <p className="font-black text-lg leading-tight" style={{ color: sel ? '#fef3c7' : '#92400e', fontFamily: 'Archivo Black, sans-serif' }}>
                          60 pacotes · 420 figurinhas
                        </p>
                        <p className="text-xs mt-0.5 font-semibold" style={{ color: sel ? '#fde68a' : '#b45309' }}>
                          Maior chance de completar o álbum · economize R$ {k.savings.toFixed(2).replace('.', ',')}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs line-through opacity-60" style={{ color: sel ? '#fde68a' : '#b45309' }}>R$ {k.oldPrice.toFixed(2).replace('.', ',')}</p>
                        <p className="text-2xl font-black" style={{ color: sel ? '#fef3c7' : '#92400e', fontFamily: 'Archivo Black, sans-serif' }}>
                          R$ 215,00
                        </p>
                        <p className="text-[10px] font-bold" style={{ color: sel ? '#fde68a' : '#b45309' }}>R$ 3,58/pacote</p>
                      </div>
                    </div>
                  </button>
                );
              })()}

              {/* Demais kits */}
              <div className="grid grid-cols-2 gap-2">
                {KITS.filter(k => k.id !== 5).map((k) => {
                  const sel = k.id === selectedKitId;
                  return (
                    <button
                      key={k.id}
                      onClick={() => setSelectedKitId(k.id)}
                      className="relative rounded-xl p-2.5 text-left transition-all active:scale-[0.97]"
                      style={{
                        background: sel ? `linear-gradient(135deg, ${VERDE}, ${VERDE_ESCURO})` : '#fff',
                        border: `2.5px solid ${sel ? AMARELO : '#e5e7eb'}`,
                        color: sel ? '#fff' : '#111',
                        boxShadow: sel ? `0 6px 18px rgba(0,156,59,0.3)` : '0 1px 2px rgba(0,0,0,0.05)',
                        opacity: 0.85,
                      }}
                    >
                      {k.badge && (
                        <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: VERMELHO, color: '#fff' }}>
                          {k.badge}
                        </span>
                      )}
                      <span className="block text-sm font-black" style={{ fontFamily: 'Archivo Black, sans-serif' }}>{k.packs} pacotes</span>
                      <span className="block text-[10px] opacity-80 mt-0.5">{k.stickers} figurinhas</span>
                      <span className="block mt-1.5 text-base font-black" style={{ color: sel ? AMARELO : VERDE, fontFamily: 'Archivo Black, sans-serif' }}>
                        R$ {k.price.toFixed(2).replace('.', ',')}
                      </span>
                      <span className="block text-[9px] opacity-70">{k.pricePerPack}/pacote</span>
                      {sel && <Check className="absolute top-2 right-2 w-3.5 h-3.5" strokeWidth={3} style={{ color: AMARELO }} />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ESCASSEZ */}
            <div className="rounded-xl p-3 text-white" style={{ background: `linear-gradient(135deg, #b91c1c, #7f1d1d)`, border: `2px solid ${AMARELO}` }}>
              <div className="flex items-center justify-between mb-2">
                <span className="flex items-center gap-1.5 text-xs font-bold uppercase">
                  <Flame className="w-3.5 h-3.5" style={{ color: AMARELO }} /> Estoque promocional
                </span>
                <span className="text-xs font-black tabular-nums" style={{ color: AMARELO }}>{mm}:{ss}</span>
              </div>
              <p className="text-sm font-black mb-2" style={{ fontFamily: 'Archivo Black, sans-serif' }}>
                Apenas <span style={{ color: AMARELO }}>{unitsLeft} kits</span> disponíveis hoje
              </p>
              <div className="h-2 rounded-full bg-white/20 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${Math.max(10, (unitsLeft / 50) * 100)}%`, background: `linear-gradient(90deg, ${AMARELO}, #ffae00)` }} />
              </div>
              <div className="flex justify-between text-[10px] mt-1 opacity-80">
                <span>Vendidos: {50 - unitsLeft}/50</span>
                <span style={{ color: AMARELO }}>● esgotando ao vivo</span>
              </div>
            </div>

            {/* PREÇO */}
            <div className="rounded-2xl p-5 text-white" style={{ background: `linear-gradient(135deg, ${VERDE}, ${VERDE_ESCURO})`, border: `3px solid ${AMARELO}` }}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold line-through opacity-70">De R$ {KIT.oldPrice.toFixed(2).replace('.', ',')}</span>
                <span className="text-[11px] font-black px-2 py-0.5 rounded uppercase" style={{ backgroundColor: AMARELO, color: AZUL }}>{KIT.discount}% OFF</span>
              </div>
              <div className="flex items-baseline gap-1 leading-none mb-1">
                <span className="text-lg font-bold">R$</span>
                <span className="text-6xl font-black" style={{ fontFamily: 'Archivo Black, sans-serif', color: AMARELO, textShadow: '1px 1px 0 rgba(0,0,0,0.2)' }}>
                  {Math.floor(KIT.price)}
                </span>
                <span className="text-2xl font-bold" style={{ color: AMARELO }}>,{KIT.price.toFixed(2).split('.')[1]}</span>
              </div>
              <p className="text-xs opacity-90 mb-3">
                = <strong style={{ color: AMARELO }}>{KIT.pricePerPack} por pacote</strong> · você economiza R$ {KIT.savings.toFixed(2).replace('.', ',')}
              </p>

              <div className="flex items-center gap-3 rounded-xl px-3 py-2.5" style={{ backgroundColor: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)' }}>
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white p-1.5 shrink-0">
                  <img src={pixLogo} alt="Pix" className="h-full w-full object-contain" width={32} height={32} />
                </div>
                <div>
                  <p className="text-sm font-black uppercase leading-tight">Preço exclusivo no Pix</p>
                  <p className="text-[10px] opacity-80 mt-0.5">Aprovação imediata · envio em até 24h úteis</p>
                </div>
              </div>
            </div>

            {/* FRETE GRÁTIS */}
            <div className="flex items-center gap-3 rounded-xl px-4 py-3" style={{ backgroundColor: AMARELO, border: `2px solid ${VERDE}` }}>
              <div className="flex h-10 w-10 items-center justify-center rounded-full text-white shrink-0" style={{ backgroundColor: VERDE }}>
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-black uppercase leading-tight" style={{ color: AZUL }}>Frete Grátis para todo o Brasil</p>
                <p className="text-[11px] text-gray-700">Envio rastreado · 3 a 7 dias úteis</p>
              </div>
              <Check className="w-5 h-5 ml-auto text-white rounded-full p-0.5 shrink-0" style={{ backgroundColor: VERDE }} strokeWidth={3} />
            </div>

            {/* BULLETS */}
            <ul className="space-y-2 bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
              {[
                <><strong>{KIT.stickers} figurinhas oficiais Panini</strong> — {KIT.packs} pacotes lacrados de fábrica</>,
                <><strong>Todas as 48 seleções</strong> da Copa 2026 — Brasil incluso</>,
                <><strong>Chance de raras brilhantes</strong> — Legends, foil e mascote</>,
                <><strong>Nota fiscal eletrônica</strong> — Garantia de procedência</>,
              ].map((t, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-800">
                  <div className="flex h-5 w-5 items-center justify-center rounded-full mt-0.5 shrink-0" style={{ backgroundColor: VERDE }}>
                    <Check className="h-3 w-3 text-white" strokeWidth={4} />
                  </div>
                  <span>{t}</span>
                </li>
              ))}
            </ul>

            {/* GARANTIA */}
            <div className="flex items-center gap-3 rounded-xl px-4 py-3 bg-blue-50 border border-blue-100">
              <Shield className="w-8 h-8 text-blue-600 shrink-0" />
              <div>
                <p className="text-sm font-bold text-blue-900">Garantia de satisfação</p>
                <p className="text-xs text-blue-700">Se o produto chegar diferente do descrito, resolvemos em até 7 dias. Sem burocracia.</p>
              </div>
            </div>

            {/* CTA DESKTOP */}
            <div className="hidden lg:block space-y-2">
              <Button
                disabled={generating}
                onClick={handleBuyClick}
                className="w-full py-7 text-lg font-black uppercase tracking-wide text-white shadow-xl active:scale-[0.98] transition-transform"
                style={{ background: `linear-gradient(135deg, ${VERDE}, ${VERDE_ESCURO})`, fontFamily: 'Archivo Black, sans-serif', boxShadow: `0 8px 25px rgba(0,156,59,0.45)` }}
              >
                {generating ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Gerando Pix...</> : `🏆 QUERO MEU KIT — R$ ${KIT.price.toFixed(2).replace('.', ',')}`}
              </Button>
              <div className="flex items-center justify-center gap-4 text-[11px] text-gray-500">
                <span className="flex items-center gap-1"><Lock className="w-3 h-3 text-green-600" />Pagamento seguro</span>
                <span className="flex items-center gap-1"><Truck className="w-3 h-3 text-green-600" />Frete grátis</span>
                <span className="flex items-center gap-1"><Package className="w-3 h-3 text-green-600" />Envio em 24h</span>
              </div>
            </div>
          </div>
        </div>

        {/* COMPARATIVO DE PREÇO */}
        <div className="mb-10 rounded-2xl overflow-hidden shadow border border-gray-100">
          <div className="py-3 px-5 text-center font-black text-white text-sm uppercase" style={{ backgroundColor: AZUL }}>
            💰 Por que aqui é mais barato?
          </div>
          <div className="bg-white divide-y divide-gray-100">
            {[
              { local: 'Banca de jornal', ppk: 'R$ 8,00', total: `R$ ${(8 * KIT.packs).toFixed(0)}`, ok: false },
              { local: 'Papelaria / livraria', ppk: 'R$ 7,50', total: `R$ ${(7.5 * KIT.packs).toFixed(0)}`, ok: false },
              { local: '🏆 Copa das Figurinhas', ppk: KIT.pricePerPack, total: `R$ ${KIT.price.toFixed(2).replace('.', ',')}`, ok: true },
            ].map((r, i) => (
              <div key={i} className="flex items-center justify-between px-5 py-3" style={r.ok ? { backgroundColor: `${VERDE}0d` } : {}}>
                <span className="text-sm font-semibold" style={{ color: r.ok ? VERDE : '#6b7280' }}>{r.local}</span>
                <div className="flex items-center gap-6">
                  <span className="text-xs text-gray-500 hidden sm:block">{r.ppk}/pacote</span>
                  <span className={`text-sm font-bold ${r.ok ? '' : 'line-through text-gray-400'}`} style={r.ok ? { color: VERDE } : {}}>{r.total}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="py-2.5 px-5 text-center text-xs font-bold text-white" style={{ backgroundColor: VERDE }}>
            Você economiza até <strong style={{ color: AMARELO }}>R$ {((8 - parseFloat(KIT.pricePerPack.replace('R$ ', '').replace(',', '.'))) * KIT.packs).toFixed(0)} neste kit</strong>
          </div>
        </div>

        {/* CTA SECUNDÁRIO */}
        <div className="mb-10 rounded-2xl p-7 text-center text-white shadow-xl" style={{ background: `linear-gradient(135deg, ${AZUL}, #001a52)`, border: `3px solid ${AMARELO}` }}>
          <Trophy className="h-10 w-10 mx-auto mb-3" style={{ color: AMARELO }} />
          <h2 className="text-2xl font-black mb-2" style={{ fontFamily: 'Archivo Black, sans-serif' }}>A oferta termina em {mm}:{ss}</h2>
          <p className="text-white/80 text-sm mb-5">
            <strong style={{ color: AMARELO }}>Apenas {unitsLeft} kits restantes.</strong> Após o estoque acabar, o preço volta ao normal.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center max-w-sm mx-auto">
            <Button
              disabled={generating}
              onClick={() => { setSelectedKitId(KIT_60.id); handleBuyClick(); }}
              className="flex-1 py-5 text-base font-black uppercase text-white"
              style={{ background: 'linear-gradient(135deg, #92400e, #d97706)', fontFamily: 'Archivo Black, sans-serif', boxShadow: '0 6px 20px rgba(217,119,6,0.5)' }}
            >
              🥇 60 pacotes — R$ 215,00
            </Button>
            <Button
              disabled={generating}
              onClick={() => { setSelectedKitId(KIT_30.id); handleBuyClick(); }}
              variant="outline"
              className="flex-1 py-5 text-base font-bold uppercase border-2"
              style={{ borderColor: AMARELO, color: AMARELO, backgroundColor: 'transparent' }}
            >
              30 pacotes — R$ 127,90
            </Button>
          </div>
        </div>

        {/* AVALIAÇÕES */}
        <div className="mb-10">
          <h2 className="text-2xl font-black text-center mb-2" style={{ fontFamily: 'Archivo Black, sans-serif', color: AZUL }}>
            O que os colecionadores dizem
          </h2>
          <div className="flex items-center justify-center gap-2 mb-5">
            <div className="flex">{[...Array(5)].map((_, i) => <Star key={i} className="h-5 w-5 fill-yellow-400 text-yellow-400" />)}</div>
            <span className="font-bold text-gray-800">4.9 / 5.0 · 2.341 avaliações</span>
          </div>

          {/* Distribuição */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-5 max-w-xs mx-auto">
            {[{ s: 5, p: 91 }, { s: 4, p: 7 }, { s: 3, p: 2 }].map((r) => (
              <div key={r.s} className="flex items-center gap-3 mb-1.5">
                <span className="text-xs text-gray-600 w-6">{r.s}★</span>
                <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full rounded-full bg-yellow-400" style={{ width: `${r.p}%` }} />
                </div>
                <span className="text-xs text-gray-500 w-7">{r.p}%</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {REVIEWS.map((r, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex gap-0.5">{[...Array(r.rating)].map((_, j) => <Star key={j} className="h-4 w-4 fill-yellow-400 text-yellow-400" />)}</div>
                  <span className="text-[10px] text-gray-400">há {r.ago}</span>
                </div>
                <p className="text-sm text-gray-700 italic flex-1 mb-3">"{r.text}"</p>
                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <div>
                    <p className="text-sm font-bold text-gray-900">{r.name}</p>
                    <p className="text-[10px] text-gray-500">{r.city}</p>
                  </div>
                  <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full text-white flex items-center gap-1" style={{ backgroundColor: VERDE }}>
                    <Check className="w-2.5 h-2.5" /> Verificada
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 text-center">
            <Button
              disabled={generating}
              onClick={handleBuyClick}
              className="px-8 py-5 text-base font-black uppercase text-white"
              style={{ background: `linear-gradient(135deg, ${VERDE}, ${VERDE_ESCURO})`, fontFamily: 'Archivo Black, sans-serif' }}
            >
              🏆 QUERO MEU KIT AGORA
            </Button>
          </div>
        </div>

        {/* FAQ */}
        <div className="mb-10">
          <h2 className="text-2xl font-black text-center mb-5" style={{ fontFamily: 'Archivo Black, sans-serif', color: AZUL }}>Perguntas frequentes</h2>
          <div className="space-y-2 max-w-2xl mx-auto">
            {[
              { q: 'As figurinhas são originais Panini?', a: 'Sim! Produto 100% oficial Panini com licença FIFA. Pacotes lacrados de fábrica, enviados diretamente da distribuidora autorizada.' },
              { q: 'Em quanto tempo chega?', a: 'Despachamos em até 24h úteis após o Pix ser confirmado. Prazo de entrega: 3 a 7 dias úteis para todo o Brasil, com código de rastreio no WhatsApp.' },
              { q: 'O frete é realmente grátis?', a: 'Sim, 100% grátis para todos os estados do Brasil, sem pedido mínimo adicional.' },
              { q: 'Posso pagar de outro jeito?', a: 'Esta promoção é exclusiva para Pix — é o que permite oferecer esse preço. Pix garante aprovação imediata e envio no mesmo dia.' },
              { q: 'E se eu quiser trocar ou devolver?', a: 'Se o produto chegar diferente do descrito ou com defeito, entre em contato pelo WhatsApp em até 7 dias. Resolvemos sem burocracia.' },
            ].map((f, i) => (
              <details key={i} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm group cursor-pointer">
                <summary className="font-bold text-gray-900 list-none flex items-center justify-between text-sm">
                  {f.q}
                  <ChevronDown className="h-4 w-4 text-gray-400 transition-transform group-open:rotate-180 shrink-0 ml-2" />
                </summary>
                <p className="mt-3 text-sm text-gray-600 leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
        </div>

        {/* ÚLTIMO CTA */}
        <div className="mb-8 rounded-2xl overflow-hidden shadow-xl" style={{ border: `3px solid ${AMARELO}` }}>
          <div className="py-2.5 px-5 text-center font-black text-white text-sm flex items-center justify-center gap-2" style={{ backgroundColor: VERMELHO }}>
            <Flame className="w-4 h-4" /> SÓ {unitsLeft} KITS RESTANTES — OFERTA EXPIRA EM {mm}:{ss}
          </div>
          <div className="p-7 text-center" style={{ background: `linear-gradient(135deg, ${AZUL}, #001a52)` }}>
            <h3 className="text-2xl font-black text-white mb-2" style={{ fontFamily: 'Archivo Black, sans-serif' }}>
              Não fique sem o seu kit
            </h3>
            <p className="text-white/80 text-sm mb-5">Frete grátis · aprovação imediata · envio em 24h</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center max-w-sm mx-auto">
              <Button
                disabled={generating}
                onClick={() => { setSelectedKitId(KIT_60.id); handleBuyClick(); }}
                className="flex-1 py-5 text-base font-black uppercase text-white"
                style={{ background: 'linear-gradient(135deg, #92400e, #d97706)', boxShadow: '0 6px 20px rgba(217,119,6,0.5)' }}
              >
                🥇 60 pacotes — R$ 215,00
              </Button>
              <Button
                disabled={generating}
                onClick={() => { setSelectedKitId(KIT_30.id); handleBuyClick(); }}
                variant="outline"
                className="flex-1 py-5 text-base font-bold uppercase border-2"
                style={{ borderColor: AMARELO, color: AMARELO, backgroundColor: 'transparent' }}
              >
                30 pacotes — R$ 127,90
              </Button>
            </div>
          </div>
        </div>
      </main>

      {/* COMPRA TESTE */}
      <div className="max-w-5xl mx-auto px-4 mb-6">
        <details className="bg-gray-50 border border-gray-200 rounded-xl overflow-hidden">
          <summary className="px-4 py-3 text-xs text-gray-400 cursor-pointer select-none list-none flex items-center justify-between hover:text-gray-600 transition-colors">
            <span>Compra teste</span>
            <ChevronDown className="w-3.5 h-3.5" />
          </summary>
          <div className="px-4 pb-4 pt-2 border-t border-gray-200 bg-white">
            <p className="text-xs text-gray-500 mb-3">Ambiente de teste — gera um Pix real de R$ 5,00 para validar a integração.</p>
            <Button
              disabled={generating}
              onClick={() => {
                if (generating) return;
                void warmPixProxy();
                formDataRef.current = formDataRef.current || {};
                setReviewProduct({
                  image: promoHero,
                  title: '1 FIGURINHA TESTE - Copa das Figurinhas',
                  variation: '1 figurinha · teste',
                  quantity: 1,
                  unitPrice: 5.00,
                  price: 5.00,
                });
                setFormOpen(true);
                // Override do kit para teste
                setSelectedKitId(-99 as any);
              }}
              variant="outline"
              className="text-xs h-8 px-4 border-gray-300 text-gray-600"
            >
              {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Gerar Pix de R$ 5,00'}
            </Button>
          </div>
        </details>
      </div>

      {/* FOOTER */}
      <footer className="bg-gray-900 text-white py-10 pb-32 lg:pb-10">
        <div className="max-w-5xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            <div>
              <p className="font-black text-lg mb-2" style={{ color: VERDE }}>COPA DAS FIGURINHAS</p>
              <p className="text-sm text-gray-400">Produto oficial Panini · FIFA World Cup 2026 · Entrega para todo o Brasil.</p>
            </div>
            <div>
              <p className="font-semibold mb-3 text-sm">Atendimento</p>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">Rastrear pedido</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Trocas e devoluções</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Política de privacidade</a></li>
              </ul>
            </div>
            <div>
              <p className="font-semibold mb-3 text-sm">Contato</p>
              <a
                href="https://wa.me/5511999999999"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-white"
                style={{ backgroundColor: '#25D366' }}
              >
                <MessageCircle className="w-4 h-4" /> WhatsApp
              </a>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-5 text-center text-xs text-gray-500">
            © 2026 Copa das Figurinhas. Produto oficial Panini · FIFA World Cup 2026.
          </div>
        </div>
      </footer>

      {/* CTA MOBILE FIXO */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 p-3 bg-white border-t-4 shadow-[0_-6px_20px_rgba(0,0,0,0.12)] z-50" style={{ borderColor: AMARELO }}>
        <div className="flex items-center justify-between mb-2 px-1">
          <div>
            <span className="text-[10px] font-black uppercase flex items-center gap-1" style={{ color: VERDE }}>
              <Flame className="w-3 h-3" /> {KIT.packs} pacotes · frete grátis
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xs text-gray-400 line-through">R$ {KIT.oldPrice.toFixed(2).replace('.', ',')}</span>
              <span className="text-xl font-black" style={{ color: VERDE, fontFamily: 'Archivo Black, sans-serif' }}>R$ {KIT.price.toFixed(2).replace('.', ',')}</span>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: VERMELHO, color: '#fff' }}>-{KIT.discount}%</span>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-black tabular-nums" style={{ color: VERMELHO }}>{mm}:{ss}</span>
            <p className="text-[9px] text-gray-500">termina em</p>
          </div>
        </div>
        <Button
          disabled={generating}
          onClick={handleBuyClick}
          className="w-full py-6 text-base font-black uppercase text-white active:scale-[0.98] transition-transform"
          style={{ background: `linear-gradient(135deg, ${VERDE}, ${VERDE_ESCURO})`, fontFamily: 'Archivo Black, sans-serif', boxShadow: `0 4px 15px rgba(0,156,59,0.45)` }}
        >
          {generating ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Gerando Pix...</> : '🏆 QUERO MEUS PACOTES AGORA'}
        </Button>
      </div>

      <CheckoutForm
        open={formOpen}
        onOpenChange={setFormOpen}
        onConfirm={handleFormConfirm}
        headerEyebrow="🇧🇷 Copa do Mundo FIFA 2026"
        title={`Garanta seus ${KIT.packs} pacotes`}
        description={`Dados para entrega dos seus ${KIT.stickers} cromos Panini com frete grátis.`}
        submitLabel="CONTINUAR PARA O PAGAMENTO →"
        primaryColor={VERDE}
        accentColor={AMARELO}
      />
      <OrderReviewDialog
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        product={reviewProduct}
        onPay={handleCreatePixPayment}
        onApproved={handlePixApproved}
        headerEyebrow="🇧🇷 Copa do Mundo FIFA 2026"
        title={`Kit ${KIT.packs} pacotes`}
        description={`${KIT.stickers} cromos Panini · frete grátis · envio em 24h`}
        primaryColor={VERDE}
        accentColor={AMARELO}
        payButtonLabel={(total) => `🏆 Pagar R$ ${total} com Pix`}
        onUpsellChange={(selected) => { upsellSelectedRef.current = selected; }}
      />
    </div>
  );
}
