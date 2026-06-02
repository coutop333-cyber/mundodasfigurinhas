import { createFileRoute } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import {
  Loader2,
  Mail,
  Send,
  Eye,
  CheckSquare,
  Square,
  AlertTriangle,
} from 'lucide-react';
import { adminCheck, adminLogin } from '@/lib/rastreios/admin.functions';
import {
  adminListRecipientsByDate,
  adminSendBulkEmailBatch,
  type BulkEmailRecipient,
} from '@/lib/admin/bulk-email.functions';

export const Route = createFileRoute('/admin/email-massa')({
  head: () => ({
    meta: [
      { title: 'E-mail em massa — Admin' },
      { name: 'robots', content: 'noindex, nofollow' },
    ],
  }),
  component: Page,
});

function Page() {
  const check = useServerFn(adminCheck);
  const { data: auth, isLoading, refetch } = useQuery({
    queryKey: ['admin', 'check'],
    queryFn: () => check(),
    staleTime: 0,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }
  if (!auth?.isAdmin) return <LoginGate onLoggedIn={() => refetch()} />;
  return <BulkEmailPanel />;
}

function LoginGate({ onLoggedIn }: { onLoggedIn: () => void }) {
  const login = useServerFn(adminLogin);
  const [pw, setPw] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const m = useMutation({
    mutationFn: (p: string) => login({ data: { password: p } }),
    onSuccess: (r) => (r.ok ? onLoggedIn() : setErr(r.error || 'falha')),
    onError: (e: any) => setErr(e?.message || 'erro'),
  });
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setErr(null);
          m.mutate(pw);
        }}
        className="w-full max-w-sm bg-white shadow-lg rounded-2xl p-8 border border-gray-100"
      >
        <h1 className="text-2xl font-bold mb-1">Painel Admin</h1>
        <p className="text-sm text-gray-500 mb-6">Acesso restrito.</p>
        <input
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          autoFocus
          required
        />
        {err && <div className="mt-3 text-sm text-red-600">{err}</div>}
        <button
          disabled={m.isPending}
          className="mt-5 w-full bg-[#c83f70] text-white font-semibold py-2.5 rounded-lg flex items-center justify-center gap-2"
        >
          {m.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
          Entrar
        </button>
      </form>
    </div>
  );
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function BulkEmailPanel() {
  const list = useServerFn(adminListRecipientsByDate);
  const send = useServerFn(adminSendBulkEmailBatch);

  const [date, setDate] = useState(todayStr());
  const [paidOnly, setPaidOnly] = useState(true);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [progress, setProgress] = useState({ done: 0, ok: 0, fail: 0, skip: 0, total: 0 });

  const recipientsQ = useQuery({
    queryKey: ['bulk-email', 'recipients', date, paidOnly],
    queryFn: () => list({ data: { date, paidOnly } }),
    enabled: !!date,
  });

  const recipients: BulkEmailRecipient[] = recipientsQ.data?.recipients || [];

  const allSelected = recipients.length > 0 && recipients.every((r) => selected.has(r.id));
  function toggleAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(recipients.map((r) => r.id)));
  }
  function toggleOne(id: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  const previewRecipient = recipients.find((r) => selected.has(r.id)) || recipients[0];

  const campaignKey = useMemo(() => {
    // chave estável por dia + assunto + hash simples da mensagem
    const h = simpleHash(`${subject}|${message}`);
    return `bulk-${date}-${h}`;
  }, [date, subject, message]);

  async function handleSend() {
    if (!subject.trim() || !message.trim()) {
      alert('Preencha o assunto e a mensagem.');
      return;
    }
    const ids = Array.from(selected);
    if (ids.length === 0) {
      alert('Selecione pelo menos um destinatário.');
      return;
    }
    if (!confirm(`Enviar e-mail para ${ids.length} cliente(s)?\n\nAssunto: ${subject}`)) return;

    setSending(true);
    setLogs([]);
    setProgress({ done: 0, ok: 0, fail: 0, skip: 0, total: ids.length });

    const batchSize = 10;
    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = ids.slice(i, i + batchSize);
      try {
        const res = await send({
          data: { ids: batch, subject, message, campaignKey },
        });
        setProgress((p) => {
          let ok = p.ok, fail = p.fail, skip = p.skip;
          for (const r of res.results) {
            if (r.ok) ok++;
            else if (r.skipped) skip++;
            else fail++;
          }
          return { ...p, done: p.done + batch.length, ok, fail, skip };
        });
        setLogs((l) => [
          ...l,
          ...res.results.map((r) =>
            r.ok
              ? `✓ ${r.email}`
              : r.skipped === 'already_sent'
                ? `↷ ${r.email} (já recebeu)`
                : r.skipped === 'invalid_email'
                  ? `↷ ${r.email} (e-mail inválido)`
                  : `✗ ${r.email} — ${r.error || 'erro'}`,
          ),
        ]);
      } catch (e: any) {
        setLogs((l) => [...l, `✗ Lote falhou: ${e?.message || e}`]);
        setProgress((p) => ({ ...p, done: p.done + batch.length, fail: p.fail + batch.length }));
      }
      // pequeno delay para evitar rate limit
      await new Promise((r) => setTimeout(r, 400));
    }

    setSending(false);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <Mail className="w-5 h-5 text-[#c83f70]" />
          <div>
            <h1 className="text-lg font-bold">E-mail em massa por data</h1>
            <p className="text-xs text-gray-500">Envia e-mail personalizado para os clientes de uma data</p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 sm:p-6 space-y-4">
        {/* Filtros */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Data dos pedidos</label>
            <input
              type="date"
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setSelected(new Set());
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div className="flex items-end">
            <label className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={paidOnly}
                onChange={(e) => setPaidOnly(e.target.checked)}
                className="w-4 h-4 accent-[#c83f70]"
              />
              Apenas pedidos pagos
            </label>
          </div>
          <div className="flex items-end justify-end">
            <div className="text-sm text-gray-600">
              {recipientsQ.isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin inline" />
              ) : (
                <>
                  <span className="font-semibold text-[#c83f70]">{recipients.length}</span> destinatário(s) únicos
                </>
              )}
            </div>
          </div>
        </div>

        {/* Conteúdo do e-mail */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Assunto</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={180}
              placeholder="Ex: Atualização sobre o seu pedido"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Mensagem</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={5000}
              rows={6}
              placeholder="Escreva a mensagem que será enviada aos clientes..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm"
            />
            <p className="text-[11px] text-gray-400 mt-1">
              Quebras de linha são preservadas. O sistema adiciona automaticamente o link de rastreio do pedido.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 justify-end">
            <button
              type="button"
              onClick={() => setShowPreview((v) => !v)}
              className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50 flex items-center gap-2"
            >
              <Eye className="w-4 h-4" /> {showPreview ? 'Ocultar' : 'Ver'} prévia
            </button>
          </div>
          {showPreview && (
            <PreviewBox
              subject={subject}
              message={message}
              recipient={previewRecipient}
            />
          )}
        </div>

        {/* Lista de destinatários */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b">
            <button
              onClick={toggleAll}
              className="text-[#c83f70] flex items-center gap-2 text-sm font-medium"
            >
              {allSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
              {allSelected ? 'Desmarcar todos' : 'Selecionar todos'}
            </button>
            <div className="text-xs text-gray-500">
              {selected.size} de {recipients.length} selecionado(s)
            </div>
          </div>
          {recipientsQ.isLoading ? (
            <div className="p-8 text-center text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin inline" />
            </div>
          ) : recipients.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-500">
              Nenhum cliente com e-mail válido encontrado para esta data.
            </div>
          ) : (
            <ul className="divide-y divide-gray-100 max-h-96 overflow-auto">
              {recipients.map((r) => (
                <li key={r.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50/50">
                  <button
                    onClick={() => toggleOne(r.id)}
                    className="text-[#c83f70] shrink-0"
                  >
                    {selected.has(r.id) ? (
                      <CheckSquare className="w-5 h-5" />
                    ) : (
                      <Square className="w-5 h-5 text-gray-400" />
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {r.nome || '(sem nome)'}
                    </div>
                    <div className="text-xs text-gray-500 truncate">{r.email}</div>
                  </div>
                  <code className="text-[11px] text-gray-400 font-mono hidden sm:block">
                    {r.external_reference}
                  </code>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Aviso de proteção */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 flex gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            Proteção contra duplicidade: cada e-mail só recebe esta campanha
            (mesmo assunto + mesma mensagem + mesma data) uma única vez.
            Reenvios em duplicidade são automaticamente ignorados.
          </div>
        </div>

        {/* Ação de envio */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1 text-sm text-gray-700">
            Pronto para enviar para <span className="font-semibold">{selected.size}</span> cliente(s).
          </div>
          <button
            onClick={handleSend}
            disabled={sending || selected.size === 0 || !subject.trim() || !message.trim()}
            className="px-5 py-2.5 bg-[#c83f70] hover:bg-[#b03660] disabled:opacity-50 text-white font-semibold rounded-lg flex items-center gap-2"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Enviar e-mails
          </button>
        </div>

        {/* Progresso */}
        {(sending || progress.total > 0) && (
          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div>
                Progresso: <span className="font-semibold">{progress.done}</span> / {progress.total}
              </div>
              <div className="flex gap-3 text-xs">
                <span className="text-emerald-600">✓ {progress.ok}</span>
                <span className="text-amber-600">↷ {progress.skip}</span>
                <span className="text-red-600">✗ {progress.fail}</span>
              </div>
            </div>
            <div className="w-full h-2 bg-gray-100 rounded overflow-hidden">
              <div
                className="h-full bg-[#c83f70] transition-all"
                style={{
                  width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%`,
                }}
              />
            </div>
            {logs.length > 0 && (
              <div className="mt-2 max-h-48 overflow-auto bg-gray-50 border border-gray-100 rounded p-2 text-[11px] font-mono text-gray-700">
                {logs.map((l, i) => (
                  <div key={i}>{l}</div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function PreviewBox({
  subject,
  message,
  recipient,
}: {
  subject: string;
  message: string;
  recipient?: BulkEmailRecipient;
}) {
  return (
    <div className="border border-dashed border-[#c83f70]/40 bg-[#fdf6f8] rounded-xl p-4">
      <div className="text-[11px] uppercase tracking-wide text-[#c83f70] font-semibold mb-1">
        Prévia (destinatário de exemplo: {recipient?.email || '—'})
      </div>
      <div className="text-sm text-gray-600 mb-2">
        <strong>Assunto:</strong> {subject || <em className="text-gray-400">(vazio)</em>}
      </div>
      <div className="bg-white border border-gray-200 rounded-lg p-3 text-sm text-gray-800 whitespace-pre-wrap">
        {recipient?.nome ? `Olá ${recipient.nome},\n\n` : ''}
        {message || <em className="text-gray-400">(mensagem vazia)</em>}
        {recipient?.external_reference && (
          <div className="mt-3 text-xs text-gray-500">
            🔗 Link automático: /rastreio/{recipient.external_reference}
          </div>
        )}
      </div>
    </div>
  );
}

function simpleHash(str: string): string {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}
