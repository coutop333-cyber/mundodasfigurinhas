import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Check, Star, Flame, Clock, Lock, Truck, Shield, Package, ChevronDown, Trophy, Loader2, MessageCircle, Sparkles, ArrowRight, BookOpen, Target, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
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

export const Route = createFileRoute('/guia')({
  head: () => ({
    meta: [
      { title: 'Como Completar o Álbum da Copa 2026 Mais Rápido — Guia Completo' },
      { name: 'description', content: 'Descubra o método para completar o álbum da Copa 2026 gastando menos. Escolha o kit certo para o seu objetivo e receba com frete grátis.' },
    ],
  }),
  component: GuiaPage,
});

const KITS = [
  {
    id: 3,
    nome: 'Iniciante',
    emoji: '🌱',
    tagline: 'Dá o primeiro passo',
    packs: 10,
    stickers: 70,
    price: 57.90,
    oldPrice: 124.90,
    pricePerPack: 'R$ 5,79',
    discount: 53,
    contentId: 'copa-2026-10pacotes',
    quantity: '10 PACOTES DE FIGURINHAS PANINI COPA DO MUNDO FIFA 2026',
    shortLabel: '10 pacotes · 70 figurinhas',
    heroImage: promoHero,
    color: '#6b7280',
    perks: [
      'Ideal para presentear',
      '70 figurinhas sortidas',
      'Começa a colecionar sem gastar muito',
      'Descobre se vai gostar da coleção',
    ],
    ideal: 'Quem quer experimentar ou presentear alguém',
    completion: 15,
  },
  {
    id: 1,
    nome: 'Colecionador',
    emoji: '⭐',
    tagline: 'O mais escolhido',
    packs: 20,
    stickers: 140,
    price: 97.00,
    oldPrice: 249.90,
    pricePerPack: 'R$ 4,85',
    discount: 61,
    contentId: 'copa-2026-20pacotes',
    quantity: '20 PACOTES DE FIGURINHAS PANINI COPA DO MUNDO FIFA 2026',
    shortLabel: '20 pacotes · 140 figurinhas',
    heroImage: promoHero,
    color: VERDE,
    highlight: true,
    perks: [
      'Cobre ~35% do álbum sozinho',
      '140 figurinhas com boa variação',
      'Chance real de raras brilhantes',
      'Melhor custo-benefício para quem vai trocar',
    ],
    ideal: 'Quem quer avançar rápido e ainda trocar com amigos',
    completion: 35,
  },
  {
    id: 2,
    nome: 'Campeão',
    emoji: '🏆',
    tagline: 'Para completar de verdade',
    packs: 30,
    stickers: 210,
    price: 127.90,
    oldPrice: 374.85,
    pricePerPack: 'R$ 4,26',
    discount: 66,
    contentId: 'copa-2026-30pacotes',
    quantity: '30 PACOTES DE FIGURINHAS PANINI COPA DO MUNDO FIFA 2026',
    shortLabel: '30 pacotes · 210 figurinhas',
    heroImage: promoHero30,
    color: AZUL,
    perks: [
      'Cobre ~50% do álbum sozinho',
      '210 figurinhas — máxima variedade',
      'Mais chances de figurinhas raras',
      'Com troca, você chega perto do fim',
    ],
    ideal: 'Quem está decidido a completar o álbum',
    completion: 50,
  },
];

function GuiaPage() {
  const [selectedKitId, setSelectedKitId] = useState<number>(1);
  const [generating, setGenerating] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewProduct, setReviewProduct] = useState<OrderProduct | null>(null);
  const formDataRef = useRef<any>(null);
  const eventIdRef = useRef<string | null>(null);

  const KIT = KITS.find((k) => k.id === selectedKitId) ?? KITS[1];

  const [timeLeft, setTimeLeft] = useState(12 * 60);
  useEffect(() => {
    const id = setInterval(() => setTimeLeft((p) => p <= 1 ? 12 * 60 : p - 1), 1000);
    return () => clearInterval(id);
  }, []);
  const mm = Math.floor(timeLeft / 60).toString().padStart(2, '0');
  const ss = (timeLeft % 60).toString().padStart(2, '0');

  const { trackViewContent, trackAddToCart, trackInitiateCheckout, trackPurchase } = useMetaPixel();

  useEffect(() => {
    captureTracking();
    trackViewContent({
      content_name: 'Guia Copa 2026',
      content_ids: ['guia-copa-2026'],
      content_type: 'product',
      value: 97.00,
      currency: 'BRL',
      event_id: newEventId('vc'),
    });
  }, []);

  const createPixPayment = useServerFn(createKorvexPixPayment);
  const warmPixProxy = useServerFn(warmKorvexPix);

  useEffect(() => {
    const key = 'korvex_warmed_guia';
    const last = Number(window.sessionStorage.getItem(key) || 0);
    if (Date.now() - last < 10 * 60 * 1000) return;
    window.sessionStorage.setItem(key, String(Date.now()));
    setTimeout(() => void warmPixProxy(), 1500);
  }, []);

  const handleBuyClick = (kitId?: number) => {
    if (generating) return;
    if (kitId) setSelectedKitId(kitId);
    const kit = KITS.find((k) => k.id === (kitId ?? selectedKitId)) ?? KIT;
    void warmPixProxy();
    trackAddToCart({
      content_name: kit.quantity,
      content_ids: [kit.contentId],
      value: kit.price,
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
      unitPrice: KIT.price,
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
          kitId: KIT.id,
          title: KIT.quantity,
          unitPrice: KIT.price,
          externalReference: eventId,
          payerEmail: fd.email,
          payerName: fd.nome,
          payerPhone: fd.telefone,
          payerDocument: fd.cpf,
          tracking: { ...tracking, ...(fd.nome ? { name: fd.nome } : {}), ...(fd.email ? { email: fd.email } : {}), ...(fd.telefone ? { phone: fd.telefone } : {}) } as any,
          source: 'produto5' as any,
        },
      });
      return {
        id: payment.id, txid: payment.txid, status: payment.status,
        qr_code: payment.qr_code, qr_code_base64: payment.qr_code_base64,
        ticket_url: payment.ticket_url, external_reference: payment.external_reference,
        transaction_amount: payment.transaction_amount, expires_at: payment.expires_at,
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
    setReviewOpen(false);
    navigate({ to: '/obrigado', search: { ref: p.external_reference, id: String(p.id), value: p.transaction_amount, product: KIT.quantity, status: 'approved' }, replace: true });
  };

  return (
    <div className="min-h-screen bg-white">

      {/* BARRA TOPO */}
      <div className="text-white py-2.5 px-4 text-center text-sm font-bold" style={{ background: `linear-gradient(90deg, ${VERDE_ESCURO}, ${VERDE}, ${VERDE_ESCURO})` }}>
        <span className="flex items-center justify-center gap-2">
          <Flame className="w-4 h-4" style={{ color: AMARELO }} />
          Frete Grátis · Produto Oficial Panini · Envio em 24h
          <Clock className="w-4 h-4 ml-2" style={{ color: AMARELO }} />
          <span style={{ color: AMARELO }}>{mm}:{ss}</span>
        </span>
      </div>

      {/* HEADER */}
      <header className="bg-white border-b sticky top-[44px] z-50" style={{ borderBottomColor: AMARELO, borderBottomWidth: 3 }}>
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <span className="text-lg font-black" style={{ fontFamily: 'Archivo Black, sans-serif', color: AZUL }}>
            🏆 <span style={{ color: VERDE }}>COPA</span> DAS FIGURINHAS
          </span>
          <div className="flex items-center gap-3">
            <span className="hidden md:flex items-center gap-1 text-xs font-semibold text-green-700">
              <Shield className="w-3.5 h-3.5" /> Compra segura
            </span>
            <a href="https://wa.me/5511999999999" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-white"
              style={{ backgroundColor: '#25D366' }}>
              <MessageCircle className="w-3.5 h-3.5" /> Suporte
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">

        {/* HERO */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold uppercase mb-4" style={{ backgroundColor: AZUL, color: AMARELO }}>
            <BookOpen className="w-3.5 h-3.5" /> Guia Oficial · Copa do Mundo FIFA 2026
          </div>
          <h1 className="text-3xl md:text-5xl font-black leading-tight mb-4" style={{ fontFamily: 'Archivo Black, sans-serif', color: AZUL }}>
            Como completar seu álbum
            <span className="block" style={{ color: VERDE }}> da Copa 2026 mais rápido</span>
          </h1>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto leading-relaxed">
            A maioria das pessoas compra poucos pacotes e fica frustrada. Aqui você vai entender <strong>exatamente quantos pacotes precisa</strong> para cada nível de coleção — e pagar <strong>muito menos</strong> que na banca.
          </p>
        </div>

        {/* O PROBLEMA */}
        <div className="mb-10 rounded-2xl p-6 md:p-8 bg-red-50 border border-red-100">
          <h2 className="text-xl font-black mb-4 text-red-800" style={{ fontFamily: 'Archivo Black, sans-serif' }}>
            😤 Por que a maioria não completa o álbum?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { icon: '💸', title: 'Compra caro', desc: 'Na banca, cada pacote custa R$8. Quem compra 30 pacotes paga R$240 — o dobro do necessário.' },
              { icon: '📦', title: 'Compra pouco', desc: 'Compra 5 ou 10 pacotes, preenche menos de 10% e desanima. Sem volume não tem progresso.' },
              { icon: '🔄', title: 'Não troca', desc: 'Sem figurinhas suficientes para trocar, fica estagnado. Volume é a chave para as trocas.' },
            ].map((item, i) => (
              <div key={i} className="bg-white rounded-xl p-4 border border-red-100">
                <span className="text-2xl mb-2 block">{item.icon}</span>
                <p className="font-bold text-red-800 mb-1">{item.title}</p>
                <p className="text-sm text-gray-600">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* A SOLUÇÃO */}
        <div className="mb-10 rounded-2xl p-6 md:p-8 text-white" style={{ background: `linear-gradient(135deg, ${VERDE}, ${VERDE_ESCURO})` }}>
          <h2 className="text-2xl font-black mb-3" style={{ fontFamily: 'Archivo Black, sans-serif' }}>
            ✅ A solução é simples: quantidade certa + preço justo
          </h2>
          <p className="text-white/90 text-base leading-relaxed mb-4">
            Aqui você compra pacotes <strong>oficiais Panini lacrados</strong> por <strong>menos de R$5 cada</strong> — enquanto na banca custa R$8. Com o volume certo, você preenche o álbum progressivamente e tem figurinhas para trocar.
          </p>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Na banca', price: 'R$8,00/pac', bad: true },
              { label: 'Papelaria', price: 'R$7,50/pac', bad: true },
              { label: 'Aqui', price: 'R$4,26/pac', bad: false },
            ].map((r, i) => (
              <div key={i} className={`rounded-xl p-3 text-center ${r.bad ? 'bg-white/10' : 'bg-white/25 ring-2 ring-white/50'}`}>
                <p className="text-xs font-semibold opacity-80">{r.label}</p>
                <p className={`text-base font-black mt-1 ${r.bad ? 'line-through opacity-60' : ''}`} style={{ color: r.bad ? '#fff' : AMARELO }}>{r.price}</p>
              </div>
            ))}
          </div>
        </div>

        {/* COMO FUNCIONA O ÁLBUM */}
        <div className="mb-10">
          <h2 className="text-2xl font-black text-center mb-6" style={{ fontFamily: 'Archivo Black, sans-serif', color: AZUL }}>
            📖 Entendendo o álbum da Copa 2026
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {[
              { icon: '🌍', title: '48 seleções', desc: 'A maior Copa da história — primeira com 48 países. Mais páginas, mais figurinhas.' },
              { icon: '✨', title: 'Figurinhas raras', desc: 'Foil, brilhantes, Legends e a mascote. Cada pacote pode ter uma surpresa.' },
              { icon: '🔢', title: '7 por pacote', desc: 'Cada pacote traz 7 cromos sortidos. Com volume, a variação aumenta muito.' },
              { icon: '🤝', title: 'Trocas valem ouro', desc: 'Com 20+ pacotes você já tem repetidas para trocar. É assim que o álbum fecha.' },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3 p-4 rounded-xl bg-gray-50 border border-gray-100">
                <span className="text-2xl shrink-0">{item.icon}</span>
                <div>
                  <p className="font-bold text-gray-900 mb-1">{item.title}</p>
                  <p className="text-sm text-gray-600">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* OS 3 PLANOS */}
        <div className="mb-10">
          <h2 className="text-2xl font-black text-center mb-2" style={{ fontFamily: 'Archivo Black, sans-serif', color: AZUL }}>
            🎯 Escolha seu nível de colecionador
          </h2>
          <p className="text-center text-gray-500 text-sm mb-8">Cada kit tem um propósito. Qual é o seu objetivo?</p>

          <div className="space-y-6">
            {KITS.map((kit) => (
              <div
                key={kit.id}
                className={`rounded-2xl overflow-hidden shadow-lg transition-all ${selectedKitId === kit.id ? 'ring-4' : ''}`}
                style={{
                  ringColor: kit.color,
                  border: `2.5px solid ${kit.highlight ? VERDE : kit.color}`,
                }}
              >
                {/* Header do card */}
                <div className="p-5 text-white" style={{ background: kit.highlight ? `linear-gradient(135deg, ${VERDE}, ${VERDE_ESCURO})` : `linear-gradient(135deg, ${kit.color}dd, ${kit.color})` }}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{kit.emoji}</span>
                      <div>
                        <p className="text-xs font-bold uppercase opacity-80">{kit.tagline}</p>
                        <h3 className="text-xl font-black" style={{ fontFamily: 'Archivo Black, sans-serif' }}>Plano {kit.nome}</h3>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs line-through opacity-60">R$ {kit.oldPrice.toFixed(2).replace('.', ',')}</p>
                      <p className="text-2xl font-black" style={{ color: AMARELO, fontFamily: 'Archivo Black, sans-serif' }}>R$ {kit.price.toFixed(2).replace('.', ',')}</p>
                      <p className="text-xs opacity-80">{kit.pricePerPack}/pacote</p>
                    </div>
                  </div>

                  {/* Barra de progresso do álbum */}
                  <div className="mt-3">
                    <div className="flex justify-between text-xs mb-1 opacity-80">
                      <span>Progresso estimado no álbum</span>
                      <span className="font-bold">{kit.completion}%</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-white/20">
                      <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${kit.completion}%`, backgroundColor: AMARELO }} />
                    </div>
                  </div>
                </div>

                {/* Corpo do card */}
                <div className="p-5 bg-white">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs font-bold uppercase text-gray-500 mb-2">O que você recebe:</p>
                      <ul className="space-y-1.5">
                        {[
                          `${kit.packs} pacotes oficiais Panini lacrados`,
                          `${kit.stickers} figurinhas sortidas (7 por pacote)`,
                          'Frete grátis para todo o Brasil',
                          'Envio em até 24h úteis',
                        ].map((item, i) => (
                          <li key={i} className="flex items-center gap-2 text-sm text-gray-700">
                            <Check className="w-4 h-4 shrink-0" style={{ color: kit.highlight ? VERDE : kit.color }} strokeWidth={3} />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase text-gray-500 mb-2">Vantagens deste plano:</p>
                      <ul className="space-y-1.5">
                        {kit.perks.map((perk, i) => (
                          <li key={i} className="flex items-center gap-2 text-sm text-gray-700">
                            <Star className="w-4 h-4 shrink-0" style={{ color: AMARELO }} />
                            {perk}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="mt-4 p-3 rounded-xl text-sm" style={{ backgroundColor: `${kit.highlight ? VERDE : kit.color}12`, border: `1px solid ${kit.highlight ? VERDE : kit.color}30` }}>
                    <span className="font-bold" style={{ color: kit.highlight ? VERDE : kit.color }}>👤 Ideal para: </span>
                    <span className="text-gray-700">{kit.ideal}</span>
                  </div>

                  <Button
                    disabled={generating}
                    onClick={() => handleBuyClick(kit.id)}
                    className="w-full mt-4 py-5 text-base font-black uppercase text-white active:scale-[0.98] transition-transform"
                    style={{
                      background: kit.highlight
                        ? `linear-gradient(135deg, ${VERDE}, ${VERDE_ESCURO})`
                        : `linear-gradient(135deg, ${kit.color}dd, ${kit.color})`,
                      fontFamily: 'Archivo Black, sans-serif',
                      boxShadow: kit.highlight ? `0 6px 20px rgba(0,156,59,0.35)` : 'none',
                    }}
                  >
                    {generating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Gerando Pix...</> : `${kit.emoji} Quero o Plano ${kit.nome} — R$ ${kit.price.toFixed(2).replace('.', ',')}`}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* DICAS BÔNUS */}
        <div className="mb-10 rounded-2xl p-6 md:p-8" style={{ background: `linear-gradient(135deg, ${AZUL}, #001a52)` }}>
          <h2 className="text-2xl font-black text-white mb-6" style={{ fontFamily: 'Archivo Black, sans-serif' }}>
            💡 3 estratégias para completar mais rápido
          </h2>
          <div className="space-y-4">
            {[
              {
                n: '1',
                title: 'Comece com volume',
                desc: 'Não adianta comprar 5 pacotes por vez. Quanto mais de uma vez, maior a variedade e mais rápido o progresso. Com 20+ pacotes você já tem uma base sólida.',
                tip: 'Plano Colecionador ou Campeão',
              },
              {
                n: '2',
                title: 'Monte um grupo de troca',
                desc: 'Crie um grupo no WhatsApp com amigos, colegas de trabalho ou familiares que também estão colecionando. Figurinhas repetidas viram ouro nessa hora.',
                tip: 'Funciona com qualquer plano',
              },
              {
                n: '3',
                title: 'Organize por país',
                desc: 'Separe as figurinhas por seleção assim que abrir. Fica mais fácil ver o que falta, o que está repetido e o que você pode oferecer nas trocas.',
                tip: 'Economiza muito tempo',
              },
            ].map((item, i) => (
              <div key={i} className="flex gap-4 p-4 rounded-xl bg-white/10">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-black text-sm" style={{ backgroundColor: AMARELO, color: AZUL }}>
                  {item.n}
                </div>
                <div>
                  <p className="font-bold text-white mb-1">{item.title}</p>
                  <p className="text-sm text-white/80 mb-2">{item.desc}</p>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${AMARELO}33`, color: AMARELO }}>
                    💡 {item.tip}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* GARANTIAS */}
        <div className="mb-10 grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { icon: Shield, label: 'Oficial Panini', sub: 'Licenciado FIFA' },
            { icon: Truck, label: 'Frete Grátis', sub: 'Todo o Brasil' },
            { icon: Package, label: 'Envio em 24h', sub: 'Após Pix' },
            { icon: Lock, label: 'Pix Seguro', sub: 'Criptografado' },
          ].map((b, i) => (
            <div key={i} className="flex flex-col items-center gap-1.5 p-4 rounded-xl bg-white border border-gray-100 shadow-sm text-center">
              <b.icon className="w-6 h-6" style={{ color: VERDE }} />
              <p className="text-xs font-bold text-gray-900">{b.label}</p>
              <p className="text-[10px] text-gray-500">{b.sub}</p>
            </div>
          ))}
        </div>

        {/* FAQ */}
        <div className="mb-10">
          <h2 className="text-xl font-black text-center mb-5" style={{ fontFamily: 'Archivo Black, sans-serif', color: AZUL }}>Dúvidas frequentes</h2>
          <div className="space-y-2 max-w-2xl mx-auto">
            {[
              { q: 'Os pacotes são realmente oficiais Panini?', a: 'Sim! 100% originais, lacrados de fábrica, recebidos diretamente da distribuidora autorizada Panini Brasil.' },
              { q: 'Em quanto tempo chega?', a: 'Despachamos em até 24h após o Pix confirmar. Prazo de entrega: 3 a 7 dias úteis para todo o Brasil, com rastreio.' },
              { q: 'Posso comprar mais de um plano?', a: 'Claro! Muitos colecionadores compram o Campeão e depois voltam para um segundo pedido. Cada compra garante seu frete grátis.' },
              { q: 'Com quantos pacotes consigo completar o álbum?', a: 'Geralmente são necessários entre 150 e 200 pacotes para completar sozinho — mas com trocas, 30 a 60 pacotes já levam você muito longe.' },
            ].map((f, i) => (
              <details key={i} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm group">
                <summary className="font-bold text-gray-900 list-none flex items-center justify-between text-sm cursor-pointer">
                  {f.q}
                  <ChevronDown className="h-4 w-4 text-gray-400 transition-transform group-open:rotate-180 shrink-0 ml-2" />
                </summary>
                <p className="mt-3 text-sm text-gray-600 leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
        </div>

        {/* CTA FINAL */}
        <div className="rounded-2xl overflow-hidden shadow-xl mb-8" style={{ border: `3px solid ${AMARELO}` }}>
          <div className="py-3 px-5 text-center font-black text-white text-sm" style={{ backgroundColor: VERMELHO }}>
            🔥 Oferta expira em {mm}:{ss} — Frete grátis incluso
          </div>
          <div className="p-7 text-center" style={{ background: `linear-gradient(135deg, ${AZUL}, #001a52)` }}>
            <Trophy className="h-12 w-12 mx-auto mb-3" style={{ color: AMARELO }} />
            <h3 className="text-2xl font-black text-white mb-2" style={{ fontFamily: 'Archivo Black, sans-serif' }}>
              Pronto para começar?
            </h3>
            <p className="text-white/80 text-sm mb-6">Escolha seu plano e receba em casa com frete grátis</p>
            <div className="flex flex-col gap-3 max-w-xs mx-auto">
              {KITS.map((kit) => (
                <Button
                  key={kit.id}
                  disabled={generating}
                  onClick={() => handleBuyClick(kit.id)}
                  className="w-full py-4 text-sm font-black uppercase text-white active:scale-[0.98] transition-transform"
                  style={{
                    background: kit.highlight
                      ? `linear-gradient(135deg, ${VERDE}, ${VERDE_ESCURO})`
                      : 'rgba(255,255,255,0.15)',
                    fontFamily: 'Archivo Black, sans-serif',
                    border: kit.highlight ? `2px solid ${AMARELO}` : '1px solid rgba(255,255,255,0.2)',
                    boxShadow: kit.highlight ? `0 6px 20px rgba(0,156,59,0.4)` : 'none',
                  }}
                >
                  {kit.emoji} {kit.nome} — R$ {kit.price.toFixed(2).replace('.', ',')}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* FOOTER */}
      <footer className="bg-gray-900 text-white py-8 text-center text-sm text-gray-500">
        <p>© 2026 Copa das Figurinhas · Produto oficial Panini · FIFA World Cup 2026</p>
        <p className="mt-1">Frete grátis · Envio em 24h · Pagamento seguro via Pix</p>
      </footer>

      {/* MOBILE CTA */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 p-3 bg-white border-t-4 shadow-[0_-6px_20px_rgba(0,0,0,0.12)] z-50" style={{ borderColor: AMARELO }}>
        <Button
          disabled={generating}
          onClick={() => handleBuyClick(1)}
          className="w-full py-5 text-base font-black uppercase text-white"
          style={{ background: `linear-gradient(135deg, ${VERDE}, ${VERDE_ESCURO})`, fontFamily: 'Archivo Black, sans-serif' }}
        >
          {generating ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /></> : '⭐ Plano Colecionador — R$ 97,00'}
        </Button>
      </div>

      <CheckoutForm
        open={formOpen}
        onOpenChange={setFormOpen}
        onConfirm={handleFormConfirm}
        headerEyebrow="🇧🇷 Copa do Mundo FIFA 2026"
        title={`Plano ${KIT.nome} — ${KIT.packs} pacotes`}
        description={`${KIT.stickers} cromos Panini com frete grátis em até 7 dias úteis.`}
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
        title={`Plano ${KIT.nome}`}
        description={`${KIT.stickers} cromos · frete grátis · envio em 24h`}
        primaryColor={VERDE}
        accentColor={AMARELO}
        payButtonLabel={(total) => `🏆 Pagar R$ ${total} com Pix`}
      />
    </div>
  );
}
