import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { Check, Star, ChevronDown, Trophy, MessageCircle, BookOpen, Target, Zap, Users, Package, Shuffle, Heart, ArrowRight, Clock, TrendingUp, Lightbulb, Medal } from 'lucide-react';

const VERDE = '#009c3b';
const VERDE_ESCURO = '#00802f';
const AMARELO = '#ffdf00';
const AZUL = '#002776';

export const Route = createFileRoute('/guia')({
  head: () => ({
    meta: [
      { title: 'Como Completar o Álbum da Copa 2026 Mais Rápido — Guia Completo' },
      { name: 'description', content: 'Guia definitivo para completar o álbum da Copa do Mundo 2026 mais rápido. Dicas de organização, trocas, estratégias e muito mais.' },
      { property: 'og:title', content: 'Como Completar o Álbum da Copa 2026 Mais Rápido' },
      { property: 'og:description', content: 'Guia definitivo com todas as estratégias para completar seu álbum da Copa 2026.' },
    ],
  }),
  component: GuiaPage,
});

const DICAS_RAPIDAS = [
  { icon: '📦', title: 'Abra muitos de uma vez', desc: 'Abrir vários pacotes seguidos aumenta a variedade e reduz repetidas. Quanto mais de uma vez, melhor.' },
  { icon: '🗂️', title: 'Organize por seleção', desc: 'Separe as figurinhas por país assim que abrir. Você enxerga melhor o que falta e o que pode trocar.' },
  { icon: '📱', title: 'Use um app de controle', desc: 'Aplicativos como Figurinha Fácil ou Álbum Virtual permitem marcar o que você tem e achar trocas online.' },
  { icon: '🤝', title: 'Monte um grupo de trocas', desc: 'Um grupo no WhatsApp com amigos, colegas e família multiplica suas chances de completar sem gastar mais.' },
  { icon: '🔁', title: 'Priorize figurinhas de número alto', desc: 'As últimas páginas do álbum costumam ser as mais difíceis. Foque nas trocas dessas seções primeiro.' },
  { icon: '🌐', title: 'Entre em comunidades online', desc: 'Grupos no Facebook, Reddit e Telegram têm milhares de colecionadores dispostos a trocar de todo o Brasil.' },
];

const ERROS_COMUNS = [
  {
    erro: 'Comprar poucos pacotes de cada vez',
    solucao: 'Compre em volume. Com poucos pacotes você não tem repetidas suficientes para trocar e o progresso é lento.',
    icon: '📉',
  },
  {
    erro: 'Não organizar as figurinhas',
    solucao: 'Sem organização você não sabe o que tem, o que falta e o que pode oferecer nas trocas. Organize desde o início.',
    icon: '🗃️',
  },
  {
    erro: 'Trocar sem estratégia',
    solucao: 'Antes de trocar, liste tudo o que você tem de repetida. Trocas cegas fazem você dispensar figurinhas que precisaria.',
    icon: '🎲',
  },
  {
    erro: 'Ignorar as figurinhas especiais',
    solucao: 'Figurinhas brilhantes e raras valem mais nas trocas. Use elas para conseguir várias comuns que você precisa.',
    icon: '✨',
  },
];

const ESTRATEGIAS = [
  {
    num: '01',
    titulo: 'A estratégia do volume',
    descricao: 'Esta é a regra número um: quantidade importa. Colecionadores que tentam completar o álbum comprando 5 ou 10 pacotes por vez geralmente desistem. O motivo? Progresso lento e poucas repetidas para trocar.',
    detalhe: 'Com mais de 600 figurinhas no álbum da Copa 2026 — a maior edição da história — você precisa de volume para ter variedade real. Quanto mais pacotes de uma vez, maior a diversidade e mais rápido o progresso.',
    dica: 'Recomendamos abrir pelo menos 20 pacotes de uma só vez para sentir uma progressão significativa no álbum.',
    icon: Package,
    color: VERDE,
  },
  {
    num: '02',
    titulo: 'A estratégia das trocas inteligentes',
    descricao: 'Trocas são o verdadeiro motor para completar o álbum. Mas trocar sem estratégia pode fazer você dispensar figurinhas importantes sem perceber.',
    detalhe: 'Antes de qualquer troca, digitalize ou liste todas as suas repetidas. Só ofereça o que você tem mais de 2 cópias. E lembre-se: figurinhas brilhantes e especiais valem muito mais — use-as para conseguir várias comuns de uma vez.',
    dica: 'Use apps como Figurinha Fácil para registrar suas repetidas e encontrar pessoas para trocar automaticamente.',
    icon: Shuffle,
    color: AZUL,
  },
  {
    num: '03',
    titulo: 'A estratégia da comunidade',
    descricao: 'Colecionadores que participam de comunidades de troca completam o álbum muito mais rápido — e pagando menos.',
    detalhe: 'Entre em grupos de troca no WhatsApp, Telegram e Facebook. Nesses grupos você encontra colecionadores de todo o Brasil com figurinhas diferentes das suas. Uma boa rede de trocas pode economizar centenas de reais.',
    dica: 'Procure grupos locais também — trocas presenciais são mais rápidas e você pode trocar dezenas de figurinhas de uma vez.',
    icon: Users,
    color: '#7c3aed',
  },
  {
    num: '04',
    titulo: 'A estratégia das seções difíceis',
    descricao: 'Nem todas as partes do álbum têm a mesma dificuldade. Identificar as seções mais raras antes dos outros dá uma vantagem enorme.',
    detalhe: 'Em álbuns da Copa, as seções de estádios, troféus e figurinhas especiais costumam ser as mais escassas. Foque suas trocas nessas partes primeiro — é mais fácil encontrar parceiros que precisam das comuns que você tem sobrando.',
    dica: 'Acompanhe fóruns de colecionadores para saber quais figurinhas estão sendo mais difíceis de encontrar na sua região.',
    icon: Target,
    color: '#dc2626',
  },
];

const RECURSOS = [
  {
    titulo: 'Apps para controlar o álbum',
    items: [
      { nome: 'Figurinha Fácil', desc: 'App brasileiro muito popular para registrar, marcar e trocar figurinhas' },
      { nome: 'Álbum Virtual', desc: 'Interface simples para marcar o que você já tem no álbum' },
      { nome: 'Panini Collector', desc: 'App oficial com checklist e recursos de troca' },
    ],
    icon: '📱',
  },
  {
    titulo: 'Comunidades para trocas',
    items: [
      { nome: 'Grupos no WhatsApp', desc: 'Procure "troca figurinhas Copa 2026" + sua cidade' },
      { nome: 'Facebook Groups', desc: 'Grupos como "Troca de Figurinhas Copa do Mundo" têm milhares de membros' },
      { nome: 'Reddit r/figurinhas', desc: 'Comunidade ativa de colecionadores brasileiros' },
    ],
    icon: '👥',
  },
  {
    titulo: 'Como guardar e proteger',
    items: [
      { nome: 'Mangas protetoras', desc: 'Para as figurinhas especiais e brilhantes — evitam amassados e riscos' },
      { nome: 'Pastas com divisórias', desc: 'Ótimas para organizar as repetidas por número ou seleção' },
      { nome: 'Caixinhas numeradas', desc: 'Sistema simples para organizar centenas de figurinhas em ordem' },
    ],
    icon: '🛡️',
  },
];

const PERGUNTAS = [
  {
    q: 'Quantos pacotes preciso para completar o álbum sozinho?',
    a: 'Matematicamente, sem nenhuma repetida, você precisaria de cerca de 90 pacotes. Na prática, considerando repetidas, a maioria dos colecionadores precisa de 150 a 200+ pacotes. Por isso as trocas são essenciais — elas podem reduzir esse número pela metade.',
  },
  {
    q: 'Qual a melhor ordem para colar as figurinhas?',
    a: 'Comece pelas seleções que você tem mais figurinhas para aproveitar o momento. Deixe as seções especiais (troféus, estádios, figurinhas brilhantes) por último — assim você sabe exatamente o que precisa buscar nas trocas.',
  },
  {
    q: 'Vale a pena comprar figurinhas avulsas?',
    a: 'Sim! Para as últimas figurinhas que faltam, comprar avulsas de outros colecionadores pode ser muito mais barato do que abrir dezenas de pacotes esperando sair a que você precisa. Use grupos de troca para comprar as específicas.',
  },
  {
    q: 'Como não perder o controle das repetidas?',
    a: 'Use um app ou uma planilha simples. Anote o número de cada figurinha que você tem repetida. Isso facilita enormemente na hora das trocas e evita que você ofereça algo que ainda precisa.',
  },
  {
    q: 'A Copa 2026 tem mais figurinhas que as anteriores?',
    a: 'Sim! É o maior álbum da história da Copa do Mundo. Com 48 seleções pela primeira vez (contra 32 anteriores), o álbum tem mais páginas, mais figurinhas por seleção e mais seções especiais. É uma coleção histórica.',
  },
];

function GuiaPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-white">

      {/* TOP BAR */}
      <div className="text-white py-2.5 px-4 text-center text-sm font-semibold" style={{ background: `linear-gradient(90deg, ${VERDE_ESCURO}, ${VERDE}, ${VERDE_ESCURO})` }}>
        🇧🇷 Guia Completo · Copa do Mundo FIFA 2026
      </div>

      {/* HEADER */}
      <header className="bg-white border-b-4 sticky top-[44px] z-50" style={{ borderColor: AMARELO }}>
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="w-7 h-7" style={{ color: AMARELO }} />
            <span className="text-xl font-black" style={{ fontFamily: 'Archivo Black, sans-serif', color: AZUL }}>
              GUIA DO <span style={{ color: VERDE }}>ÁLBUM</span>
            </span>
          </div>
          <a
            href="https://wa.me/5511999999999"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-white"
            style={{ backgroundColor: '#25D366' }}
          >
            <MessageCircle className="w-3.5 h-3.5" /> Dúvidas?
          </a>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-10">

        {/* HERO */}
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold uppercase mb-5" style={{ backgroundColor: `${AZUL}15`, color: AZUL, border: `2px solid ${AZUL}30` }}>
            <BookOpen className="w-4 h-4" /> Guia Definitivo · Copa 2026
          </div>
          <h1 className="text-4xl md:text-5xl font-black leading-tight mb-5" style={{ fontFamily: 'Archivo Black, sans-serif', color: AZUL }}>
            Como completar seu álbum
            <span className="block mt-1" style={{ color: VERDE }}>da Copa 2026 mais rápido</span>
          </h1>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto leading-relaxed">
            Reunimos as melhores estratégias de colecionadores experientes para você avançar no álbum sem frustrações. Do básico ao avançado — tudo que você precisa saber.
          </p>

          {/* Destaques rápidos */}
          <div className="flex flex-wrap justify-center gap-3 mt-8">
            {[
              { label: '4 estratégias', icon: '🎯' },
              { label: '6 dicas rápidas', icon: '⚡' },
              { label: 'Apps recomendados', icon: '📱' },
              { label: 'Erros a evitar', icon: '🚫' },
            ].map((item, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold bg-gray-100 text-gray-700">
                {item.icon} {item.label}
              </span>
            ))}
          </div>
        </div>

        {/* DADOS DO ÁLBUM */}
        <div className="mb-14">
          <div className="rounded-2xl overflow-hidden shadow border border-gray-100">
            <div className="py-4 px-6 font-black text-white text-center" style={{ background: `linear-gradient(135deg, ${AZUL}, #001a52)` }}>
              <span style={{ color: AMARELO }}>📊</span> O que você precisa saber sobre o álbum da Copa 2026
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y divide-gray-100">
              {[
                { label: 'Seleções', valor: '48', sub: 'maior Copa da história' },
                { label: 'Figurinhas', valor: '600+', sub: 'para colecionar' },
                { label: 'Por pacote', valor: '7', sub: 'cromos sortidos' },
                { label: 'Países-sede', valor: '3', sub: 'EUA, México e Canadá' },
              ].map((item, i) => (
                <div key={i} className="p-5 text-center bg-white">
                  <p className="text-3xl font-black" style={{ fontFamily: 'Archivo Black, sans-serif', color: VERDE }}>{item.valor}</p>
                  <p className="font-bold text-gray-900 text-sm mt-1">{item.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{item.sub}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ESTRATÉGIAS PRINCIPAIS */}
        <div className="mb-14">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-black" style={{ fontFamily: 'Archivo Black, sans-serif', color: AZUL }}>
              As 4 estratégias que funcionam
            </h2>
            <p className="text-gray-500 mt-2">Usadas pelos colecionadores que completam o álbum mais rápido</p>
          </div>

          <div className="space-y-6">
            {ESTRATEGIAS.map((s, i) => (
              <div key={i} className="rounded-2xl overflow-hidden shadow border border-gray-100">
                <div className="p-6 text-white" style={{ background: `linear-gradient(135deg, ${s.color}, ${s.color}cc)` }}>
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-4xl font-black opacity-30" style={{ fontFamily: 'Archivo Black, sans-serif' }}>{s.num}</span>
                    <div className="flex items-center gap-2">
                      <s.icon className="w-6 h-6" />
                      <h3 className="text-xl font-black" style={{ fontFamily: 'Archivo Black, sans-serif' }}>{s.titulo}</h3>
                    </div>
                  </div>
                  <p className="text-white/90 leading-relaxed">{s.descricao}</p>
                </div>
                <div className="p-6 bg-white">
                  <p className="text-gray-700 leading-relaxed mb-4">{s.detalhe}</p>
                  <div className="flex items-start gap-3 p-4 rounded-xl" style={{ backgroundColor: `${s.color}10`, border: `1px solid ${s.color}25` }}>
                    <Lightbulb className="w-5 h-5 shrink-0 mt-0.5" style={{ color: s.color }} />
                    <p className="text-sm font-semibold" style={{ color: s.color }}>{s.dica}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* DICAS RÁPIDAS */}
        <div className="mb-14">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-black" style={{ fontFamily: 'Archivo Black, sans-serif', color: AZUL }}>
              ⚡ 6 dicas rápidas
            </h2>
            <p className="text-gray-500 mt-2">Pequenas mudanças que fazem grande diferença</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {DICAS_RAPIDAS.map((dica, i) => (
              <div key={i} className="flex items-start gap-4 p-5 rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                <span className="text-3xl shrink-0">{dica.icon}</span>
                <div>
                  <p className="font-bold text-gray-900 mb-1">{dica.title}</p>
                  <p className="text-sm text-gray-600 leading-relaxed">{dica.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ERROS COMUNS */}
        <div className="mb-14">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-black" style={{ fontFamily: 'Archivo Black, sans-serif', color: AZUL }}>
              🚫 Erros que vão te atrasar
            </h2>
            <p className="text-gray-500 mt-2">Evite estes erros e complete o álbum muito mais rápido</p>
          </div>
          <div className="space-y-4">
            {ERROS_COMUNS.map((item, i) => (
              <div key={i} className="rounded-2xl overflow-hidden shadow-sm border border-gray-100">
                <div className="flex items-center gap-3 px-5 py-4 bg-red-50 border-b border-red-100">
                  <span className="text-xl">{item.icon}</span>
                  <p className="font-bold text-red-800">❌ {item.erro}</p>
                </div>
                <div className="flex items-start gap-3 px-5 py-4 bg-white">
                  <Check className="w-5 h-5 shrink-0 mt-0.5" style={{ color: VERDE }} strokeWidth={3} />
                  <p className="text-sm text-gray-700 leading-relaxed"><strong className="text-green-700">Solução:</strong> {item.solucao}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RECURSOS */}
        <div className="mb-14">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-black" style={{ fontFamily: 'Archivo Black, sans-serif', color: AZUL }}>
              🛠️ Ferramentas e recursos
            </h2>
            <p className="text-gray-500 mt-2">Tudo que você precisa para organizar sua coleção</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {RECURSOS.map((rec, i) => (
              <div key={i} className="rounded-2xl p-5 bg-white border border-gray-100 shadow-sm">
                <div className="text-3xl mb-3">{rec.icon}</div>
                <h3 className="font-black text-gray-900 mb-4" style={{ fontFamily: 'Archivo Black, sans-serif' }}>{rec.titulo}</h3>
                <ul className="space-y-3">
                  {rec.items.map((item, j) => (
                    <li key={j} className="pb-3 border-b border-gray-100 last:border-0 last:pb-0">
                      <p className="text-sm font-bold text-gray-900">{item.nome}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* CRONOGRAMA SUGERIDO */}
        <div className="mb-14 rounded-2xl overflow-hidden shadow border border-gray-100">
          <div className="py-4 px-6 font-black text-white text-center text-lg" style={{ background: `linear-gradient(135deg, ${VERDE}, ${VERDE_ESCURO})` }}>
            📅 Cronograma sugerido para completar o álbum
          </div>
          <div className="bg-white divide-y divide-gray-100">
            {[
              { fase: 'Semana 1', acao: 'Compra inicial com bom volume', meta: 'Preencher 20-30% do álbum', icon: '🚀' },
              { fase: 'Semana 2', acao: 'Organiza repetidas e entra em grupos de troca', meta: 'Identificar as seções mais difíceis', icon: '🗂️' },
              { fase: 'Semana 3-4', acao: 'Foco nas trocas e segunda compra se necessário', meta: 'Chegar a 50-60% do álbum', icon: '🔄' },
              { fase: 'Mês 2+', acao: 'Compra de figurinhas avulsas específicas', meta: 'Completar as últimas páginas', icon: '🏆' },
            ].map((fase, i) => (
              <div key={i} className="flex items-center gap-4 px-6 py-4">
                <span className="text-2xl shrink-0">{fase.icon}</span>
                <div className="flex-1">
                  <p className="font-bold text-gray-900 text-sm">{fase.fase}: {fase.acao}</p>
                  <p className="text-xs text-gray-500 mt-0.5">🎯 Meta: {fase.meta}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ */}
        <div className="mb-14">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-black" style={{ fontFamily: 'Archivo Black, sans-serif', color: AZUL }}>
              ❓ Perguntas frequentes
            </h2>
          </div>
          <div className="space-y-2 max-w-3xl mx-auto">
            {PERGUNTAS.map((f, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden cursor-pointer"
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
              >
                <div className="flex items-center justify-between px-5 py-4">
                  <p className="font-bold text-gray-900 text-sm pr-4">{f.q}</p>
                  <ChevronDown className={`w-5 h-5 text-gray-400 shrink-0 transition-transform ${openFaq === i ? 'rotate-180' : ''}`} />
                </div>
                {openFaq === i && (
                  <div className="px-5 pb-4 border-t border-gray-100">
                    <p className="text-sm text-gray-600 leading-relaxed pt-3">{f.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* CONCLUSÃO */}
        <div className="rounded-2xl p-8 md:p-10 text-white text-center" style={{ background: `linear-gradient(135deg, ${AZUL}, #001a52)` }}>
          <Medal className="w-16 h-16 mx-auto mb-4" style={{ color: AMARELO }} />
          <h2 className="text-2xl md:text-3xl font-black mb-3" style={{ fontFamily: 'Archivo Black, sans-serif' }}>
            Você está pronto para completar!
          </h2>
          <p className="text-white/80 max-w-xl mx-auto leading-relaxed mb-6">
            Com as estratégias deste guia, você tem tudo que precisa para avançar no álbum da Copa 2026 de forma inteligente. Lembre-se: volume, organização e trocas são os três pilares do sucesso.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {['Volume é a chave 📦', 'Organize desde o início 🗂️', 'Trocas multiplicam seu progresso 🤝', 'Use apps para controlar 📱'].map((item, i) => (
              <span key={i} className="px-3 py-1.5 rounded-full text-sm font-semibold" style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: '#fff' }}>
                {item}
              </span>
            ))}
          </div>
        </div>

      </main>

      {/* FOOTER */}
      <footer className="bg-gray-900 text-center py-8 mt-10">
        <p className="text-gray-500 text-sm">© 2026 Guia do Álbum Copa do Mundo · Conteúdo educacional gratuito</p>
        <p className="text-gray-600 text-xs mt-1">Feito com ❤️ para colecionadores brasileiros</p>
      </footer>

    </div>
  );
}
