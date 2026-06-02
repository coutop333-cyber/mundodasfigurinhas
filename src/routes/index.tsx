import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, User, ShoppingCart, Menu, Star, Check, Truck, Shield, Award, Package, ChevronLeft, ChevronRight, Gift, Mail, AlertTriangle, TrendingUp, Loader2, Trophy, Sparkles, Flame, Clock, MessageCircle, Lock, Zap, Eye, BadgeCheck, ArrowRight, Phone, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { useMetaPixel } from '@/hooks/useMetaPixel';
import { toast } from 'sonner';
import { useServerFn } from '@tanstack/react-start';
import { createKorvexPixPayment, warmKorvexPix } from '@/lib/korvex.functions';
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
      { title: 'Figurinhas Copa 2026 · 30 Pacotes por R$127,90 com Frete Grátis | Eletros Jundiaí' },
      { name: 'description', content: 'Complete seu álbum da Copa do Mundo FIFA 2026 mais rápido. Pacotes oficiais Panini com frete grátis e rastreio para todo o Brasil. Estoque promocional limitado.' },
      { property: 'og:title', content: 'Complete seu álbum da Copa 2026 · Frete Grátis' },
      { property: 'og:description', content: 'Pacotes oficiais Panini Copa do Mundo 2026 com frete grátis e rastreado.' },
      { property: 'og:image', content: HERO_IMAGE },
    ],
    links: [
      { rel: 'preload', as: 'image', href: HERO_IMAGE, fetchpriority: 'high' } as any,
    ],
  }),
  component: Produto5Page,
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
    badge: 'Melhor custo-benefício',
  },
];

const KIT_30 = KITS.find((k) => k.packs === 30)!;

const displayImagesByKit: Record<number, { image: string; title: string }[]> = {
  1: [{ image: promoHero, title: 'Kit 20 Pacotes Copa 2026' }],
  2: [{ image: promoHero30, title: 'Kit 30 Pacotes Copa 2026' }],
  3: [{ image: promoHero, title: 'Kit 10 Pacotes Copa 2026' }],
};

const reviews = [
  { name: 'Lucas Andrade', city: 'São Paulo · SP', text: 'Veio rapidíssimo e tudo lacrado. Tirei o Vini Jr brilhante no terceiro pacote. Tô amando!', rating: 5, ago: '2 dias' },
  { name: 'Bruno Marques', city: 'Belo Horizonte · MG', text: 'Comprei pro meu filho e acabei colecionando junto. 20 pacotes rendem demais, valeu cada centavo.', rating: 5, ago: '1 dia' },
  { name: 'Rafael Souza', city: 'Curitiba · PR', text: 'Na banca aqui da rua tá R$8 cada. Aqui sai por menos de R$5 cada. Preço imbatível!', rating: 5, ago: '3 dias' },
  { name: 'Diego Pereira', city: 'Salvador · BA', text: 'Chegou em 4 dias em Salvador, embalado direitinho. Já é meu segundo pedido.', rating: 5, ago: '5 horas' },
  { name: 'Vinícius Rocha', city: 'Porto Alegre · RS', text: 'Reviveu a infância. Tô colecionando com meus amigos do trabalho, virou febre aqui.', rating: 5, ago: '12 horas' },
  { name: 'Henrique Costa', city: 'Recife · PE', text: 'Variadas mesmo, quase não veio repetida. Já estou perto de fechar o álbum!', rating: 5, ago: '1 dia' },
];

function Produto5Page() {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [email, setEmail] = useState('');
  const [generating, setGenerating] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewProduct, setReviewProduct] = useState<OrderProduct | null>(null);
  const formDataRef = useRef<{ nome?: string; email?: string; telefone?: string; cpf?: string } | null>(null);
  const eventIdRef = useRef<string | null>(null);
  const KIT_20 = KITS.find((k) => k.packs === 20)!;
  const [selectedKitId, setSelectedKitId] = useState<number>(KIT_20.id);
  const KIT = KITS.find((k) => k.id === selectedKitId) ?? KITS[0];
  const displayImages = displayImagesByKit[selectedKitId] ?? displayImagesByKit[KITS[0].id];
  useEffect(() => { setCurrentImageIndex(0); }, [selectedKitId]);
  const { trackViewContent, trackAddToCart, trackInitiateCheckout, trackLead, trackPurchase } = useMetaPixel();

  const [timeLeft, setTimeLeft] = useState(15 * 60);
  useEffect(() => {
    if (timeLeft <= 0) return;
    const id = setInterval(() => setTimeLeft((p) => Math.max(0, p - 1)), 1000);
    return () => clearInterval(id);
  }, [timeLeft]);
  const mm = Math.floor(timeLeft / 60).toString().padStart(2, '0');
  const ss = (timeLeft % 60).toString().padStart(2, '0');

  const TOTAL_ESTOQUE = 50;
  const [unitsLeft, setUnitsLeft] = useState(37);
  const [viewersCount] = useState(Math.floor(Math.random() * 18) + 34);
  const [liveNotice, setLiveNotice] = useState<{ id: number; name: string; city: string; packs: number; ago: string } | null>(null);
  const noticeIdRef = useRef(0);

  const BUYER_POOL = [
    { name: 'Lucas A.', city: 'São Paulo · SP' },
    { name: 'Bruno M.', city: 'Belo Horizonte · MG' },
    { name: 'Rafael S.', city: 'Curitiba · PR' },
    { name: 'Diego P.', city: 'Salvador · BA' },
    { name: 'Vinícius R.', city: 'Porto Alegre · RS' },
    { name: 'Henrique C.', city: 'Recife · PE' },
    { name: 'Mariana L.', city: 'Rio de Janeiro · RJ' },
    { name: 'Felipe T.', city: 'Fortaleza · CE' },
    { name: 'Camila D.', city: 'Brasília · DF' },
    { name: 'Pedro H.', city: 'Manaus · AM' },
    { name: 'Juliana B.', city: 'Goiânia · GO' },
    { name: 'André N.', city: 'Campinas · SP' },
  ];
  const PACK_OPTIONS = [10, 20, 30];

  useEffect(() => {
    let timeoutId: number | undefined;
    let cancelled = false;
    const schedule = () => {
      const delay = 6000 + Math.random() * 12000;
      timeoutId = window.setTimeout(() => {
        if (cancelled) return;
        const buyer = BUYER_POOL[Math.floor(Math.random() * BUYER_POOL.length)];
        const packs = PACK_OPTIONS[Math.floor(Math.random() * PACK_OPTIONS.length)];
        noticeIdRef.current += 1;
        setLiveNotice({ id: noticeIdRef.current, name: buyer.name, city: buyer.city, packs, ago: `${Math.floor(Math.random() * 4) + 1} min` });
        setUnitsLeft((prev) => Math.max(7, prev - 1));
        window.setTimeout(() => setLiveNotice((cur) => (cur && cur.id === noticeIdRef.current ? null : cur)), 5500);
        schedule();
      }, delay);
    };
    const initial = window.setTimeout(schedule, 2500);
    return () => { cancelled = true; window.clearTimeout(initial); if (timeoutId) window.clearTimeout(timeoutId); };
  }, []);

  const estoquePct = Math.max(8, Math.min(100, (unitsLeft / TOTAL_ESTOQUE) * 100));

  useEffect(() => { captureTracking(); }, []);

  useEffect(() => {
    trackViewContent({ content_name: KIT.quantity, content_ids: [KIT.contentId], content_type: 'product', value: KIT.price, currency: 'BRL' });
    trackAddToCart({ content_name: KIT.quantity, content_ids: [KIT.contentId], value: KIT.price, currency: 'BRL', num_items: 1 });
  }, [trackViewContent, trackAddToCart, KIT.quantity, KIT.contentId, KIT.price]);

  const createPixPayment = useServerFn(createKorvexPixPayment);
  const warmPixProxy = useServerFn(warmKorvexPix);

  useEffect(() => {
    const key = 'efi_proxy_warmed_at';
    const last = Number(window.sessionStorage.getItem(key) || 0);
    if (Date.now() - last < 10 * 60 * 1000) return;
    window.sessionStorage.setItem(key, String(Date.now()));
    const timer = window.setTimeout(() => void warmPixProxy(), 1200);
    return () => window.clearTimeout(timer);
  }, [warmPixProxy]);

  const handlePreviousImage = useCallback(() => setCurrentImageIndex((p) => (p === 0 ? displayImages.length - 1 : p - 1)), [displayImages.length]);
  const handleNextImage = useCallback(() => setCurrentImageIndex((p) => (p === displayImages.length - 1 ? 0 : p + 1)), [displayImages.length]);

  const handleBuyClick = () => {
    if (generating) return;
    void warmPixProxy();
    setFormOpen(true);
  };

  const handleFormConfirm = (formData: { nome?: string; email?: string; telefone?: string } | unknown) => {
    formDataRef.current = (formData as { nome?: string; email?: string; telefone?: string; cpf?: string }) || {};
    trackInitiateCheckout({ content_name: KIT.quantity, content_ids: [KIT.contentId], value: KIT.price, currency: 'BRL', num_items: 1 });
    setFormOpen(false);
    setReviewProduct({
      image: KIT.heroImage,
      title: `${KIT.quantity} - Eletros Jundiaí`,
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
      const trackingPayload = {
        ...tracking,
        ...(fd.nome ? { name: fd.nome } : {}),
        ...(fd.email ? { email: fd.email } : {}),
        ...(fd.telefone ? { phone: fd.telefone } : {}),
      };
      const payment = await createPixPayment({
        data: {
          kitId: KIT.id,
          title: KIT.quantity,
          unitPrice: KIT.price,
          externalReference: eventId,
          payerEmail: fd.email,
          payerName: fd.nome,
          payerPhone: fd.telefone,
          payerDocument: fd.cpf,
          tracking: trackingPayload as any,
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
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Erro ao gerar Pix. Tente novamente.');
      return null;
    } finally {
      setGenerating(false);
    }
  };

  const navigate = useNavigate();

  const handlePixApproved = (p: PixPaymentInfo) => {
    trackPurchase({ content_name: KIT.quantity, content_ids: [KIT.contentId], value: p.transaction_amount, currency: 'BRL', num_items: 1, event_id: p.external_reference });
    toast.success('Pagamento aprovado!');
    setReviewOpen(false);
    navigate({ to: '/obrigado', search: { ref: p.external_reference, id: String(p.id), value: p.transaction_amount, product: KIT.quantity, status: 'approved' }, replace: true });
  };

  const handleNewsletterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      trackLead({ content_name: 'Newsletter Signup', content_category: 'Engagement', value: 0, currency: 'BRL' });
      toast.success('Inscrição realizada com sucesso!');
      setEmail('');
    }
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f0faf0' }}>

      {/* ── BARRA DE URGÊNCIA DUPLA ── */}
      <div className="text-white py-2 px-4 text-center text-xs font-bold uppercase tracking-wider" style={{ backgroundColor: VERMELHO }}>
        ⚠️ ATENÇÃO: Apenas {unitsLeft} kits restantes neste lote promocional — após esgotar, preço volta ao normal
      </div>
      <div className="text-white py-2.5 px-4 text-center" style={{ background: `linear-gradient(90deg, ${VERDE_ESCURO} 0%, ${VERDE} 50%, ${VERDE_ESCURO} 100%)` }}>
        <div className="max-w-7xl mx-auto flex items-center justify-center gap-3 flex-wrap">
          <p className="text-sm md:text-base font-extrabold uppercase tracking-wide flex items-center gap-2" style={{ fontFamily: 'Archivo Black, sans-serif' }}>
            <Flame className="w-4 h-4 animate-pulse" style={{ color: AMARELO }} />
            Promoção Relâmpago Copa 2026 — FRETE GRÁTIS
          </p>
          <div className="flex items-center gap-1.5 bg-black/40 px-3 py-1.5 rounded-lg text-sm font-black tabular-nums" style={{ color: AMARELO, border: `1px solid ${AMARELO}55` }}>
            <Clock className="w-4 h-4" />
            <span>Expira em {mm}:{ss}</span>
          </div>
        </div>
      </div>

      {/* ── HEADER ── */}
      <header className="bg-white shadow-sm sticky top-[72px] z-50 border-b-4" style={{ borderColor: AMARELO }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between">
            <div className="flex-1 flex items-center md:hidden">
              <div className="flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full" style={{ backgroundColor: `${VERMELHO}15`, color: VERMELHO }}>
                <Eye className="w-3 h-3" />
                <span>{viewersCount} vendo agora</span>
              </div>
            </div>
            <div className="hidden md:flex flex-1 items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full animate-pulse" style={{ backgroundColor: `${VERMELHO}15`, color: VERMELHO }}>
                <Eye className="w-3.5 h-3.5" />
                <span>{viewersCount} pessoas estão vendo agora</span>
              </div>
            </div>
            <div className="flex-shrink-0 flex items-center justify-center">
              <h1 className="flex items-center justify-center">
                <img src={logoPanini} alt="Eletros Jundiaí - Panini" className="h-10 md:h-14 w-auto" />
              </h1>
            </div>
            <div className="flex-1 flex items-center justify-end gap-3">
              <div className="hidden md:flex items-center gap-1 text-xs font-semibold text-green-700">
                <Shield className="w-3.5 h-3.5" />
                <span>Compra segura</span>
              </div>
              <button className="p-2 hover:bg-muted rounded-lg transition-colors relative" aria-label="Carrinho">
                <ShoppingCart className="h-5 w-5 text-gray-700" />
                <span className="absolute -top-1 -right-1 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center" style={{ backgroundColor: VERDE }}>0</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-6">

        {/* ── FAIXA LICENÇA ── */}
        <div className="mb-5 flex items-center justify-center gap-3 rounded-xl px-4 py-3 shadow-md" style={{ background: `linear-gradient(135deg, ${AZUL} 0%, #001a52 100%)`, border: `2px solid ${AMARELO}` }}>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: `${AMARELO}33` }}>
            <Trophy className="h-4 w-4" style={{ color: AMARELO }} />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/80">Produto licenciado oficial</span>
            <span className="text-sm md:text-base font-extrabold uppercase tracking-wide text-white" style={{ fontFamily: 'Archivo Black, sans-serif' }}>
              Panini · FIFA World Cup <span style={{ color: AMARELO }}>2026</span>
            </span>
          </div>
          <div className="ml-auto hidden sm:flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold uppercase" style={{ backgroundColor: `${AMARELO}22`, border: `1px solid ${AMARELO}55`, color: AMARELO }}>
            <BadgeCheck className="w-3.5 h-3.5" /> Verificado
          </div>
        </div>

        {/* ── PRODUTO + OFERTA ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10 mb-8">

          {/* Galeria */}
          <div>
            <div className="rounded-2xl p-3 shadow-xl" style={{ background: 'white', border: `3px solid ${VERDE}` }}>
              <div className="relative aspect-square mb-3 overflow-hidden rounded-xl bg-gray-50">
                <img
                  src={displayImages[currentImageIndex]?.image}
                  alt={displayImages[currentImageIndex]?.title}
                  className="w-full h-full object-contain"
                  width={800} height={800} decoding="async"
                  {...(currentImageIndex === 0 ? { fetchPriority: 'high' as any } : { loading: 'lazy' as const })}
                />
                <button onClick={handlePreviousImage} aria-label="Imagem anterior" className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/95 hover:bg-white text-gray-800 p-2 rounded-full shadow-lg transition"><ChevronLeft className="h-5 w-5" /></button>
                <button onClick={handleNextImage} aria-label="Próxima imagem" className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/95 hover:bg-white text-gray-800 p-2 rounded-full shadow-lg transition"><ChevronRight className="h-5 w-5" /></button>
                <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide shadow-md" style={{ backgroundColor: AMARELO, color: AZUL }}>
                  <Sparkles className="w-3.5 h-3.5" /> Oficial Panini
                </div>
                <div className="absolute top-3 right-3 flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide shadow-md text-white" style={{ backgroundColor: VERMELHO }}>
                  {KIT.discount}% OFF
                </div>
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {displayImages.map((item, index) => (
                  <button key={index} onClick={() => setCurrentImageIndex(index)} className="aspect-square rounded-lg overflow-hidden border-2 bg-gray-50 transition" style={{ borderColor: currentImageIndex === index ? VERDE : 'transparent' }}>
                    <img src={item.image} alt={`Miniatura: ${item.title}`} className="w-full h-full object-cover" width={120} height={120} loading="lazy" decoding="async" />
                  </button>
                ))}
              </div>
            </div>

            {/* Garantia abaixo da imagem */}
            <div className="mt-4 grid grid-cols-3 gap-2">
              {[
                { icon: Shield, label: 'Produto', sub: 'Oficial Panini' },
                { icon: Truck, label: 'Frete', sub: 'Grátis' },
                { icon: Lock, label: 'Pix', sub: '100% Seguro' },
              ].map((b, i) => (
                <div key={i} className="flex flex-col items-center gap-1 rounded-xl py-3 px-2 text-center bg-white shadow-sm border border-gray-100">
                  <b.icon className="w-5 h-5" style={{ color: VERDE }} />
                  <span className="text-[10px] font-extrabold uppercase text-gray-800">{b.label}</span>
                  <span className="text-[10px] text-gray-500">{b.sub}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Oferta */}
          <div className="space-y-4 text-gray-900">
            {/* Rating */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex">{[...Array(5)].map((_, i) => <Star key={i} className="h-5 w-5 fill-yellow-400 text-yellow-400" />)}</div>
              <span className="text-sm font-semibold text-gray-700">4.9 · 2.341 avaliações</span>
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase text-white" style={{ backgroundColor: VERDE }}>
                <Check className="w-3 h-3" /> Em estoque
              </span>
            </div>

            {/* Título */}
            <div>
              <h2 className="text-2xl md:text-3xl font-extrabold mb-1 leading-tight" style={{ fontFamily: 'Archivo Black, sans-serif', color: AZUL }}>
                Figurinhas Panini Copa 2026
                <span className="block mt-1 text-xl md:text-2xl" style={{ color: VERDE }}>Pacotes Oficiais com Frete Grátis</span>
              </h2>
              <p className="text-sm text-gray-700 leading-relaxed">
                <strong>Produto lacrado direto da distribuidora.</strong> {KIT.stickers} figurinhas — 7 cromos por pacote — todas as 48 seleções — chance de foil brilhante.
              </p>
            </div>

            {/* Alerta viewers */}
            <div className="flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ backgroundColor: '#fff3cd', border: `1.5px solid ${AMARELO}` }}>
              <Eye className="w-4 h-4 shrink-0 animate-pulse" style={{ color: VERMELHO }} />
              <p className="text-xs font-bold text-gray-800">
                <span style={{ color: VERMELHO }}>{viewersCount} pessoas</span> estão vendo este produto agora — estoque se esgota rapidamente
              </p>
            </div>

            {/* Seletor de kit */}
            <div>
              <span className="block text-xs font-extrabold uppercase tracking-widest mb-2" style={{ color: AZUL, fontFamily: 'Archivo Black, sans-serif' }}>
                Escolha seu kit:
              </span>
              <div className="grid grid-cols-3 gap-2">
                {KITS.map((k) => {
                  const selected = k.id === selectedKitId;
                  return (
                    <button
                      key={k.id}
                      type="button"
                      onClick={() => setSelectedKitId(k.id)}
                      aria-pressed={selected}
                      className="relative text-left rounded-xl p-2.5 transition-all active:scale-[0.98]"
                      style={{
                        background: selected ? `linear-gradient(135deg, ${VERDE} 0%, ${VERDE_ESCURO} 100%)` : '#ffffff',
                        border: `3px solid ${selected ? AMARELO : '#e5e7eb'}`,
                        color: selected ? '#ffffff' : '#111827',
                        boxShadow: selected ? '0 8px 20px rgba(0,156,59,0.35)' : '0 1px 2px rgba(0,0,0,0.05)',
                      }}
                    >
                      {k.badge && (
                        <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase shadow" style={{ backgroundColor: VERMELHO, color: '#fff' }}>
                          ⭐ {k.badge}
                        </span>
                      )}
                      <span className="block text-sm font-black leading-none" style={{ fontFamily: 'Archivo Black, sans-serif' }}>
                        {k.packs} pacotes
                      </span>
                      <span className="block text-[10px] mt-0.5 opacity-80">{k.stickers} figurinhas</span>
                      <span className="block mt-2 text-base font-extrabold" style={{ fontFamily: 'Archivo Black, sans-serif', color: selected ? AMARELO : VERDE }}>
                        R$ {k.price.toFixed(2).replace('.', ',')}
                      </span>
                      <span className="block text-[9px] opacity-75">{k.pricePerPack}/pacote</span>
                      {selected && (
                        <span className="absolute top-2 right-2 h-4 w-4 rounded-full flex items-center justify-center" style={{ backgroundColor: AMARELO }}>
                          <Check className="w-2.5 h-2.5" style={{ color: AZUL }} strokeWidth={3} />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* BLOCO ESCASSEZ */}
            <div className="relative overflow-hidden rounded-2xl p-4 shadow-xl" style={{ background: `linear-gradient(135deg, #b91c1c 0%, #7f1d1d 100%)`, border: `3px solid ${AMARELO}` }}>
              <div className="absolute -top-6 -right-6 h-24 w-24 rounded-full opacity-20" style={{ backgroundColor: AMARELO }} />
              <div className="relative flex items-center gap-2 mb-2">
                <Flame className="w-5 h-5 animate-pulse" style={{ color: AMARELO }} />
                <span className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-white/90" style={{ fontFamily: 'Archivo Black, sans-serif' }}>
                  Últimas unidades deste lote
                </span>
                <span className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-extrabold uppercase tabular-nums" style={{ backgroundColor: AMARELO, color: AZUL }}>
                  <Clock className="w-3 h-3" /> {mm}:{ss}
                </span>
              </div>
              <h3 className="relative text-xl font-black leading-tight text-white" style={{ fontFamily: 'Archivo Black, sans-serif' }}>
                Apenas <span style={{ color: AMARELO }}>{unitsLeft} kits disponíveis</span> agora
              </h3>
              <p className="relative text-[11px] text-white/80 mt-0.5">Reposição somente após o início da Copa • preço volta ao normal</p>
              <div className="relative mt-3">
                <div className="h-3 rounded-full bg-white/15 overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${estoquePct}%`, background: `linear-gradient(90deg, ${AMARELO} 0%, #ffae00 100%)`, boxShadow: '0 0 12px rgba(255,223,0,0.6)' }} />
                </div>
                <div className="flex items-center justify-between mt-1.5 text-[10px] font-bold">
                  <span className="text-white/80">Vendidos: {TOTAL_ESTOQUE - unitsLeft}/{TOTAL_ESTOQUE}</span>
                  <span className="flex items-center gap-1" style={{ color: AMARELO }}>
                    <span className="inline-block h-1.5 w-1.5 rounded-full animate-pulse" style={{ backgroundColor: AMARELO }} />
                    esgotando ao vivo
                  </span>
                </div>
              </div>
            </div>

            {/* PREÇO */}
            <div className="rounded-2xl p-5 shadow-xl" style={{ background: `linear-gradient(135deg, ${VERDE} 0%, ${VERDE_ESCURO} 100%)`, border: `3px solid ${AMARELO}` }}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-white/80 line-through">De R$ {KIT.oldPrice.toFixed(2).replace('.', ',')}</span>
                <span className="text-[11px] font-extrabold px-2 py-0.5 rounded uppercase" style={{ backgroundColor: AMARELO, color: AZUL }}>{KIT.discount}% OFF</span>
                <span className="ml-auto text-[10px] font-bold text-white/80">Você economiza <strong style={{ color: AMARELO }}>R$ {KIT.savings.toFixed(2).replace('.', ',')}</strong></span>
              </div>
              <div className="flex items-baseline gap-1 leading-none">
                <span className="text-xl font-extrabold text-white" style={{ fontFamily: 'Archivo Black, sans-serif' }}>R$</span>
                <span className="text-6xl md:text-7xl font-black tracking-tight" style={{ fontFamily: 'Archivo Black, sans-serif', color: AMARELO, textShadow: '2px 2px 0 rgba(0,0,0,0.2)' }}>{Math.floor(KIT.price)}</span>
                <span className="text-3xl font-extrabold" style={{ fontFamily: 'Archivo Black, sans-serif', color: AMARELO }}>,{KIT.price.toFixed(2).split('.')[1]}</span>
              </div>
              <p className="mt-1 text-xs text-white/90 font-semibold">
                = <span style={{ color: AMARELO }}>{KIT.pricePerPack} por pacote</span> · na banca custa R$ 8,00 cada
              </p>

              <div className="mt-3 flex items-center gap-3 rounded-xl px-3 py-2.5" style={{ backgroundColor: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)' }}>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white p-1.5">
                  <img src={pixLogo} alt="Pix" className="h-full w-full object-contain" width={32} height={32} loading="lazy" decoding="async" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-extrabold uppercase tracking-wide text-white leading-tight" style={{ fontFamily: 'Archivo Black, sans-serif' }}>Preço exclusivo no Pix</p>
                  <p className="text-[10px] text-white/90 leading-tight mt-0.5">Aprovação imediata · envio em até 24h úteis</p>
                </div>
              </div>
            </div>

            {/* FRETE GRÁTIS */}
            <div className="flex items-center gap-3 rounded-xl px-4 py-3 shadow-md" style={{ backgroundColor: AMARELO, border: `2px solid ${VERDE}` }}>
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white" style={{ backgroundColor: VERDE }}>
                <Truck className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-extrabold uppercase tracking-wide leading-tight" style={{ fontFamily: 'Archivo Black, sans-serif', color: AZUL }}>Frete Grátis para todo o Brasil</p>
                <p className="text-[11px] text-gray-800 leading-tight mt-0.5">Envio rastreado · chega em 3 a 7 dias úteis</p>
              </div>
              <Check className="w-5 h-5 shrink-0 text-white" style={{ backgroundColor: VERDE, borderRadius: '50%', padding: '2px' }} strokeWidth={3} />
            </div>

            {/* Bullets */}
            <ul className="space-y-2 bg-white rounded-xl p-4 shadow-sm border border-gray-200">
              {[
                <><strong>{KIT.stickers} figurinhas oficiais Panini</strong> — {KIT.packs} pacotes lacrados, 7 cromos cada</>,
                <><strong>Todas as 48 seleções da Copa 2026</strong> — Brasil, Argentina, França e +45 países</>,
                <><strong>Chance de raras brilhantes</strong> — legends, escudos foil e mascote da Copa</>,
                <><strong>Direto da distribuidora</strong> — sem violação, sem cromos repetidos em sequência</>,
              ].map((t, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-800">
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full mt-0.5" style={{ backgroundColor: VERDE }}>
                    <Check className="h-3 w-3 text-white" strokeWidth={4} />
                  </div>
                  <span>{t}</span>
                </li>
              ))}
            </ul>

            {/* Prova social recente */}
            <div className="flex items-center gap-3 rounded-xl bg-white px-3 py-2.5 border border-gray-200 shadow-sm">
              <div className="flex -space-x-2">
                {['#009c3b', '#ffdf00', '#002776', '#c0392b'].map((c, i) => (
                  <span key={i} className="h-7 w-7 rounded-full ring-2 ring-white flex items-center justify-center text-[10px] font-bold" style={{ backgroundColor: c, color: c === '#ffdf00' ? '#002776' : '#fff' }}>
                    {['L', 'B', 'R', 'M'][i]}
                  </span>
                ))}
              </div>
              <div className="text-xs text-gray-700 leading-tight">
                <strong className="text-gray-900">312 colecionadores</strong> compraram nas últimas 24h
                <div className="flex items-center gap-1 mt-0.5 text-[11px] text-gray-500">
                  <span className="inline-block h-1.5 w-1.5 rounded-full animate-pulse" style={{ backgroundColor: VERDE }} />
                  Última compra há 2 minutos
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-amber-900 bg-amber-50 border border-amber-300 rounded-lg px-3 py-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
              <span><strong>Só {unitsLeft} unidades restantes.</strong> Ao esgotar, o preço volta para R$ {KIT.oldPrice.toFixed(2).replace('.', ',')}.</span>
            </div>

            {/* CTA desktop */}
            <div className="hidden lg:block pt-1 space-y-3">
              <Button
                disabled={generating}
                onClick={handleBuyClick}
                className="w-full py-7 text-lg font-black shadow-2xl active:scale-[0.98] transition-transform uppercase tracking-wider disabled:opacity-90 text-white"
                style={{ background: `linear-gradient(135deg, ${VERDE} 0%, ${VERDE_ESCURO} 100%)`, fontFamily: 'Archivo Black, sans-serif', boxShadow: `0 8px 30px rgba(0,156,59,0.5)` }}
              >
                {generating ? (<><Loader2 className="w-5 h-5 mr-2 animate-spin" />GERANDO PIX...</>) : `🏆 QUERO COMPLETAR MEU ÁLBUM — R$ ${KIT.price.toFixed(2).replace('.', ',')}`}
              </Button>
              <div className="flex items-center justify-center gap-4 text-[11px] text-gray-500">
                <span className="flex items-center gap-1"><Lock className="w-3 h-3" style={{ color: VERDE }} /> Pagamento 100% seguro</span>
                <span className="flex items-center gap-1"><Truck className="w-3 h-3" style={{ color: VERDE }} /> Frete grátis</span>
                <span className="flex items-center gap-1"><Package className="w-3 h-3" style={{ color: VERDE }} /> Envio em 24h</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── COMPARAÇÃO DE PREÇO ── */}
        <div className="mb-8 rounded-2xl overflow-hidden shadow-lg border-2" style={{ borderColor: VERDE }}>
          <div className="py-3 px-5 text-center font-extrabold uppercase text-white text-sm" style={{ backgroundColor: AZUL, fontFamily: 'Archivo Black, sans-serif' }}>
            💰 Comparativo de preço — por que comprar aqui?
          </div>
          <div className="bg-white divide-y divide-gray-100">
            {[
              { local: 'Banca de jornal', pricePerPack: 'R$ 8,00', total: `R$ ${(8 * KIT.packs).toFixed(2).replace('.', ',')}`, highlight: false },
              { local: 'Papelaria / livraria', pricePerPack: 'R$ 7,50', total: `R$ ${(7.5 * KIT.packs).toFixed(2).replace('.', ',')}`, highlight: false },
              { local: 'Eletros Jundiaí 🏆', pricePerPack: KIT.pricePerPack, total: `R$ ${KIT.price.toFixed(2).replace('.', ',')}`, highlight: true },
            ].map((row, i) => (
              <div key={i} className="flex items-center justify-between px-5 py-3" style={row.highlight ? { backgroundColor: `${VERDE}10` } : {}}>
                <span className="text-sm font-semibold" style={{ color: row.highlight ? VERDE : '#374151' }}>
                  {row.highlight && <Check className="inline w-4 h-4 mr-1" style={{ color: VERDE }} strokeWidth={3} />}
                  {row.local}
                </span>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-gray-500">{row.pricePerPack}/pacote</span>
                  <span className={`text-sm font-bold ${row.highlight ? '' : 'line-through text-gray-400'}`} style={row.highlight ? { color: VERDE } : {}}>
                    {row.total}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="py-3 px-5 text-center text-sm font-bold text-white" style={{ backgroundColor: VERDE }}>
            Você economiza até <strong style={{ color: AMARELO }}>R$ {((8 - parseFloat(KIT.pricePerPack.replace('R$ ', '').replace(',', '.'))) * KIT.packs).toFixed(2).replace('.', ',')} neste kit</strong> comprando aqui
          </div>
        </div>

        {/* ── TRUST BADGES ── */}
        <div className="mb-8">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            {[
              { icon: Shield, title: 'Produto Oficial', description: 'Licenciado Panini / FIFA', color: VERDE },
              { icon: Truck, title: 'Frete Grátis', description: 'Rastreado · todo Brasil', color: AZUL },
              { icon: Package, title: 'Envio em 24h', description: 'Após confirmação Pix', color: VERDE },
              { icon: MessageCircle, title: 'Suporte WhatsApp', description: 'Atendimento humano', color: AZUL },
              { icon: Lock, title: 'Pagamento Seguro', description: 'Pix criptografado SSL', color: VERDE },
              { icon: Award, title: '+12.500 vendas', description: 'Loja verificada', color: AZUL },
            ].map((badge, index) => (
              <Card key={index} className="border-2 shadow-sm" style={{ borderColor: badge.color }}>
                <CardContent className="p-4 text-center">
                  <badge.icon className="h-8 w-8 mx-auto mb-2" style={{ color: badge.color }} />
                  <h4 className="font-bold text-sm mb-1 text-gray-900">{badge.title}</h4>
                  <p className="text-xs text-gray-600">{badge.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* ── CTA MID-PAGE ── */}
        <div className="mb-8 rounded-2xl p-6 md:p-8 text-center shadow-2xl" style={{ background: `linear-gradient(135deg, ${AZUL} 0%, #001a52 100%)`, border: `3px solid ${AMARELO}` }}>
          <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold uppercase mb-4" style={{ backgroundColor: VERMELHO, color: '#fff' }}>
            <Zap className="w-3.5 h-3.5" /> Oferta expirando em {mm}:{ss}
          </div>
          <h3 className="text-2xl md:text-3xl font-extrabold text-white mb-2" style={{ fontFamily: 'Archivo Black, sans-serif' }}>
            Complete seu álbum da Copa 2026
          </h3>
          <p className="text-white/90 mb-5 max-w-xl mx-auto text-sm">
            <strong style={{ color: AMARELO }}>Apenas {unitsLeft} kits restantes.</strong> Com frete grátis e envio em 24h — mais barato que qualquer banca do Brasil.
          </p>
          <Button
            disabled={generating}
            onClick={() => { setSelectedKitId(KIT_30.id); handleBuyClick(); }}
            className="px-10 py-6 text-lg font-black shadow-2xl uppercase tracking-wider text-white active:scale-[0.98] transition-transform"
            style={{ background: `linear-gradient(135deg, ${VERDE} 0%, ${VERDE_ESCURO} 100%)`, fontFamily: 'Archivo Black, sans-serif', boxShadow: `0 8px 30px rgba(0,156,59,0.5)` }}
          >
            {generating ? (<><Loader2 className="w-5 h-5 mr-2 animate-spin" />GERANDO PIX...</>) : '🏆 QUERO 30 PACOTES POR R$ 127,90'}
          </Button>
          <div className="flex items-center justify-center gap-4 mt-3 text-[11px] text-white/60">
            <span><Lock className="inline w-3 h-3 mr-1" />Pagamento seguro</span>
            <span><Truck className="inline w-3 h-3 mr-1" />Frete grátis</span>
            <span><Package className="inline w-3 h-3 mr-1" />Envio em 24h</span>
          </div>
        </div>

        {/* ── BANNER EMOÇÃO ── */}
        <div className="mb-8 rounded-2xl overflow-hidden shadow-lg" style={{ border: `3px solid ${VERDE}` }}>
          <div className="p-6 md:p-8 text-white" style={{ background: `linear-gradient(135deg, ${VERDE} 0%, ${VERDE_ESCURO} 100%)` }}>
            <span className="text-xs font-bold uppercase tracking-widest mb-2 block" style={{ color: AMARELO }}>🇧🇷 O Brasil em campo</span>
            <h3 className="text-2xl md:text-3xl font-extrabold mb-3 leading-tight" style={{ fontFamily: 'Archivo Black, sans-serif' }}>
              A Copa só começa quando o álbum chega em casa.
            </h3>
            <p className="text-white/90 text-sm leading-relaxed mb-4">
              Junte a família, abra os pacotes, troque com os amigos e viva a emoção da maior coleção da história. <strong style={{ color: AMARELO }}>20 ou 30 pacotes</strong> — você escolhe seu kit e a gente entrega na sua porta com frete zero.
            </p>
            <button onClick={handleBuyClick} className="inline-flex items-center gap-2 font-extrabold uppercase text-sm px-5 py-2.5 rounded-xl transition-all active:scale-[0.98]" style={{ backgroundColor: AMARELO, color: AZUL, fontFamily: 'Archivo Black, sans-serif' }}>
              Comprar agora <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── DESCRIÇÃO ── */}
        <div className="mb-8">
          <Card className="shadow-md border-2" style={{ borderColor: VERDE }}>
            <CardContent className="p-6 md:p-8">
              <h3 className="text-xl font-extrabold mb-3" style={{ fontFamily: 'Archivo Black, sans-serif', color: AZUL }}>O que você recebe no kit</h3>
              <ul className="space-y-2 text-sm text-gray-700">
                {[
                  `${KIT.packs} pacotes oficiais Panini Copa do Mundo FIFA 2026, lacrados de fábrica`,
                  '7 cromos sortidos por pacote — variedade garantida',
                  'Cromos de todas as 48 seleções classificadas',
                  'Chance real de figurinhas brilhantes (foil), legends e mascote',
                  'Embalagem original da coleção 2026',
                  'Frete grátis e rastreado para todo o Brasil',
                  'Nota fiscal eletrônica · garantia de procedência',
                ].map((t, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <Check className="h-5 w-5 shrink-0 mt-0.5" style={{ color: VERDE }} strokeWidth={3} />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* ── AVALIAÇÕES ── */}
        <div className="mb-8">
          <div className="text-center mb-6">
            <h3 className="text-2xl md:text-3xl font-extrabold mb-2" style={{ fontFamily: 'Archivo Black, sans-serif', color: AZUL }}>O QUE OS COLECIONADORES DIZEM</h3>
            <div className="flex items-center justify-center gap-2">
              <div className="flex">{[...Array(5)].map((_, i) => <Star key={i} className="h-5 w-5 fill-yellow-400 text-yellow-400" />)}</div>
              <span className="text-lg font-bold text-gray-900">4.9 / 5.0</span>
              <span className="text-sm text-gray-600">· 2.341 avaliações verificadas</span>
            </div>
          </div>

          {/* Barra de rating */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6 max-w-sm mx-auto">
            {[{ stars: 5, pct: 91 }, { stars: 4, pct: 7 }, { stars: 3, pct: 2 }].map((r) => (
              <div key={r.stars} className="flex items-center gap-3 mb-1.5">
                <span className="text-xs font-bold w-8 text-right text-gray-600">{r.stars}★</span>
                <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${r.pct}%`, backgroundColor: '#facc15' }} />
                </div>
                <span className="text-xs text-gray-500 w-8">{r.pct}%</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {reviews.map((r, i) => (
              <Card key={i} className="border shadow-sm hover:shadow-md transition">
                <CardContent className="p-5 flex flex-col h-full">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex gap-0.5">{[...Array(r.rating)].map((_, j) => <Star key={j} className="h-4 w-4 fill-yellow-400 text-yellow-400" />)}</div>
                    <span className="text-[10px] text-gray-400">há {r.ago}</span>
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed mb-4 flex-1 italic">"{r.text}"</p>
                  <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                    <div>
                      <span className="font-semibold text-sm text-gray-900 block">{r.name}</span>
                      <span className="text-[10px] text-gray-500">{r.city}</span>
                    </div>
                    <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: VERDE }}>
                      <Check className="w-2.5 h-2.5" /> Verificada
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* CTA pós-reviews */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600 mb-3">Junte-se a +12.500 colecionadores satisfeitos</p>
            <Button
              disabled={generating}
              onClick={handleBuyClick}
              className="px-8 py-5 text-base font-black shadow-xl uppercase tracking-wider text-white active:scale-[0.98] transition-transform"
              style={{ background: `linear-gradient(135deg, ${VERDE} 0%, ${VERDE_ESCURO} 100%)`, fontFamily: 'Archivo Black, sans-serif' }}
            >
              {generating ? (<><Loader2 className="w-5 h-5 mr-2 animate-spin" />GERANDO PIX...</>) : '🏆 QUERO MEU KIT AGORA'}
            </Button>
          </div>
        </div>

        {/* ── FAQ ── */}
        <div className="mb-8">
          <h3 className="text-xl font-extrabold mb-5 text-center" style={{ fontFamily: 'Archivo Black, sans-serif', color: AZUL }}>Perguntas frequentes</h3>
          <div className="space-y-3 max-w-3xl mx-auto">
            {[
              { q: 'As figurinhas são oficiais?', a: 'Sim. São pacotes oficiais Panini licenciados pela FIFA para a Copa do Mundo 2026, recebidos diretamente da distribuidora oficial. Cada pacote vem lacrado de fábrica.' },
              { q: 'Em quanto tempo recebo?', a: 'Despachamos em até 24h úteis após a confirmação do Pix. O prazo de entrega é de 3 a 7 dias úteis para todo o Brasil, com código de rastreio enviado por WhatsApp.' },
              { q: 'Posso pagar de outra forma?', a: 'Esta oferta promocional é válida apenas para pagamento via Pix (aprovação imediata). O Pix garante o desconto e a aprovação na hora.' },
              { q: 'O frete é grátis mesmo?', a: 'Sim! Frete grátis para todas as regiões do Brasil, sem valor mínimo extra. Você paga apenas o valor do kit.' },
              { q: 'E se eu quiser devolver?', a: 'Se o produto chegar diferente do descrito ou com defeito de fabricação, entre em contato pelo WhatsApp em até 7 dias. Resolvemos sem burocracia.' },
            ].map((f, i) => (
              <details key={i} className="bg-white rounded-xl border-2 p-4 shadow-sm group" style={{ borderColor: '#e5e7eb' }}>
                <summary className="cursor-pointer font-bold text-gray-900 list-none flex items-center justify-between text-sm">
                  <span>{f.q}</span>
                  <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" style={{ color: VERDE }} />
                </summary>
                <p className="mt-3 text-sm text-gray-700 leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
        </div>

        {/* ── ÚLTIMO CTA URGÊNCIA ── */}
        <div className="mb-8 rounded-2xl overflow-hidden shadow-2xl" style={{ border: `4px solid ${AMARELO}` }}>
          <div className="py-3 px-5 text-center font-black uppercase text-white text-sm flex items-center justify-center gap-2" style={{ backgroundColor: VERMELHO, fontFamily: 'Archivo Black, sans-serif' }}>
            <Flame className="w-4 h-4 animate-pulse" /> NÃO PERCA — APENAS {unitsLeft} KITS RESTANTES
          </div>
          <div className="p-6 md:p-8 text-center" style={{ background: `linear-gradient(135deg, ${AZUL} 0%, #001a52 100%)` }}>
            <Trophy className="h-12 w-12 mx-auto mb-3" style={{ color: AMARELO }} />
            <h3 className="text-2xl md:text-3xl font-extrabold text-white mb-2" style={{ fontFamily: 'Archivo Black, sans-serif' }}>
              Última chance de pegar no preço promocional
            </h3>
            <p className="text-white/80 text-sm mb-1">Timer: <span className="font-black tabular-nums" style={{ color: AMARELO }}>{mm}:{ss}</span></p>
            <p className="text-white/90 mb-6 max-w-lg mx-auto text-sm">
              Depois que o estoque acabar, o preço volta para R$ {KIT_30.oldPrice.toFixed(2).replace('.', ',')}. Frete grátis · aprovação imediata no Pix.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center max-w-md mx-auto">
              <Button
                disabled={generating}
                onClick={() => { setSelectedKitId(KIT_30.id); handleBuyClick(); }}
                className="flex-1 py-5 text-base font-black shadow-2xl uppercase tracking-wider text-white active:scale-[0.98] transition-transform"
                style={{ background: `linear-gradient(135deg, ${VERDE} 0%, ${VERDE_ESCURO} 100%)`, fontFamily: 'Archivo Black, sans-serif', boxShadow: `0 8px 30px rgba(0,156,59,0.5)` }}
              >
                {generating ? <Loader2 className="w-5 h-5 animate-spin" /> : '🏆 30 PACOTES — R$ 127,90'}
              </Button>
              <Button
                disabled={generating}
                onClick={() => { setSelectedKitId(KIT_20.id); handleBuyClick(); }}
                variant="outline"
                className="flex-1 py-5 text-base font-black uppercase tracking-wider border-2 active:scale-[0.98] transition-transform"
                style={{ borderColor: AMARELO, color: AMARELO, fontFamily: 'Archivo Black, sans-serif', backgroundColor: 'transparent' }}
              >
                20 PACOTES — R$ 97,00
              </Button>
            </div>
            <div className="flex items-center justify-center gap-4 mt-3 text-[11px] text-white/50">
              <span><Lock className="inline w-3 h-3 mr-1" />100% seguro</span>
              <span><Truck className="inline w-3 h-3 mr-1" />Frete grátis</span>
              <span><Package className="inline w-3 h-3 mr-1" />Envio em 24h</span>
            </div>
          </div>
        </div>

        {/* ── NEWSLETTER ── */}
        <div className="mb-8">
          <Card className="border-none shadow-lg text-white" style={{ background: `linear-gradient(135deg, ${AZUL} 0%, #001a52 100%)` }}>
            <CardContent className="p-6 md:p-8 text-center">
              <Mail className="h-10 w-10 mx-auto mb-3" style={{ color: AMARELO }} />
              <h3 className="text-xl font-extrabold mb-2" style={{ fontFamily: 'Archivo Black, sans-serif' }}>Avise-me quando chegar novo lote</h3>
              <p className="text-white/90 mb-5 max-w-md mx-auto text-sm">Cadastre-se para receber prioridade de compra e descontos exclusivos na próxima remessa.</p>
              <form onSubmit={handleNewsletterSubmit} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
                <Input type="email" placeholder="Seu melhor e-mail" required value={email} onChange={(e) => setEmail(e.target.value)} className="bg-white/10 border-white/20 text-white placeholder:text-white/60 focus-visible:ring-white" />
                <Button type="submit" className="font-bold text-white" style={{ backgroundColor: VERDE }}>Inscrever-se</Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>

      <footer className="bg-[#0a0a0a] text-white mt-6 pb-36 lg:pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
            <div>
              <h4 className="text-xl font-bold mb-3 tracking-tight" style={{ fontFamily: 'Archivo Black, sans-serif' }}>
                <span style={{ color: VERDE }}>ELETROS</span> <span style={{ color: AMARELO }}>JUNDIAÍ</span>
              </h4>
              <p className="text-sm text-gray-400 leading-relaxed">Produtos oficiais com preço justo, garantia e entrega rápida para todo o Brasil.</p>
            </div>
            <div>
              <span className="block font-semibold mb-4 text-gray-100 text-sm">Institucional</span>
              <ul className="space-y-2.5 text-sm text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">Nossa história</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Garantia</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Política de privacidade</a></li>
              </ul>
            </div>
            <div>
              <span className="block font-semibold mb-4 text-gray-100 text-sm">Atendimento</span>
              <ul className="space-y-2.5 text-sm text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">Trocas e devoluções</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Prazos de entrega</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Rastrear pedido</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Fale conosco</a></li>
              </ul>
            </div>
            <div>
              <span className="block font-semibold mb-4 text-gray-100 text-sm">Contato</span>
              <ul className="space-y-2.5 text-sm text-gray-400">
                <li>Instagram: @eletrojundiai</li>
                <li>E-mail: suporte@eletrojundiai.shop</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-5 text-center text-xs text-gray-500">
            <p>&copy; 2026 Eletros Jundiaí. Todos os direitos reservados. Produto oficial Panini · FIFA World Cup 2026.</p>
          </div>
        </div>
      </footer>

      {/* ── NOTIFICAÇÃO AO VIVO ── */}
      {liveNotice && (
        <div
          key={liveNotice.id}
          className="fixed left-3 right-3 sm:left-4 sm:right-auto sm:max-w-sm z-[60] pointer-events-none animate-in slide-in-from-bottom-4 fade-in duration-300"
          style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 132px)' }}
        >
          <div className="rounded-xl bg-white shadow-2xl border-l-4 px-3 py-2.5 flex items-center gap-3" style={{ borderLeftColor: VERDE }}>
            <div className="relative shrink-0">
              <div className="h-9 w-9 rounded-full flex items-center justify-center text-white font-extrabold text-sm" style={{ background: `linear-gradient(135deg, ${VERDE} 0%, ${AZUL} 100%)`, fontFamily: 'Archivo Black, sans-serif' }}>
                {liveNotice.name.charAt(0)}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-white animate-pulse" style={{ backgroundColor: VERDE }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-bold text-gray-900 leading-tight truncate">
                {liveNotice.name} <span className="text-gray-500 font-normal">acabou de comprar</span>
              </p>
              <p className="text-[11px] text-gray-600 leading-tight truncate">
                <strong style={{ color: VERDE }}>{liveNotice.packs} pacotes</strong> · {liveNotice.city} · há {liveNotice.ago}
              </p>
            </div>
            <Check className="h-4 w-4 shrink-0" style={{ color: VERDE }} strokeWidth={3} />
          </div>
        </div>
      )}

      {/* ── CTA MOBILE FIXO ── */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 p-3 bg-white/98 backdrop-blur-md shadow-[0_-8px_24px_rgba(0,0,0,0.18)] border-t-4 z-50" style={{ borderColor: AMARELO }}>
        <div className="flex items-center justify-between mb-2 px-1 gap-2">
          <div className="min-w-0">
            <span className="text-[10px] uppercase font-extrabold tracking-wider flex items-center gap-1" style={{ color: VERMELHO, fontFamily: 'Archivo Black, sans-serif' }}>
              <Flame className="w-3 h-3 animate-pulse" /> Só {unitsLeft} restantes · frete grátis
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xs text-gray-400 line-through">R$ {KIT.oldPrice.toFixed(2).replace('.', ',')}</span>
              <span className="text-xl font-black" style={{ color: VERDE, fontFamily: 'Archivo Black, sans-serif' }}>R$ {KIT.price.toFixed(2).replace('.', ',')}</span>
              <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase" style={{ backgroundColor: VERMELHO, color: '#fff' }}>-{Math.round((1 - KIT.price / KIT.oldPrice) * 100)}%</span>
            </div>
          </div>
          <div className="flex flex-col items-end shrink-0">
            <div className="flex items-center gap-1 text-[10px] font-black" style={{ color: VERMELHO }}>
              <Clock className="w-3 h-3" />
              <span className="tabular-nums">{mm}:{ss}</span>
            </div>
            <span className="text-[9px] text-gray-500 leading-tight">termina em</span>
          </div>
        </div>
        <Button
          disabled={generating}
          onClick={handleBuyClick}
          className="w-full py-6 text-base font-black active:scale-[0.98] shadow-lg transition-transform uppercase tracking-wide disabled:opacity-90 text-white"
          style={{ background: `linear-gradient(135deg, ${VERDE} 0%, ${VERDE_ESCURO} 100%)`, fontFamily: 'Archivo Black, sans-serif', boxShadow: `0 4px 20px rgba(0,156,59,0.5)` }}
        >
          {generating ? (<><Loader2 className="w-5 h-5 mr-2 animate-spin" />GERANDO PIX...</>) : '🏆 QUERO MEUS PACOTES AGORA'}
        </Button>
      </div>

      <CheckoutForm
        open={formOpen}
        onOpenChange={setFormOpen}
        onConfirm={handleFormConfirm}
        headerEyebrow="🇧🇷 Copa do Mundo FIFA 2026"
        title={`Garanta seus ${KIT.packs} pacotes`}
        description={`Preencha seus dados para receber seus ${KIT.stickers} cromos oficiais Panini com frete grátis.`}
        submitLabel="QUERO MEUS PACOTES 🏆"
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
        title={`Revise seu kit de ${KIT.packs} pacotes`}
        description={`Confira seus ${KIT.stickers} cromos Panini, escolha o frete e finalize com Pix.`}
        primaryColor={VERDE}
        accentColor={AMARELO}
        payButtonLabel={(total) => `🏆 Pagar R$ ${total} com Pix`}
      />
    </div>
  );
}
