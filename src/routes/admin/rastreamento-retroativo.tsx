import { createFileRoute, Link } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useState, useRef } from 'react';
import { Loader2, Mail, Send, RefreshCw, ArrowLeft, CheckCircle2, XCircle, SkipForward } from 'lucide-react';
import { adminCheck, adminLogin } from '@/lib/rastreios/admin.functions';
import {
  adminListPendingTrackingEmails,
  adminSendTrackingEmailsBatch,
  adminListAllPaidForResend,
  adminResendTrackingEmailsBatch,
  type PendingTrackingOrder,
} from '@/lib/admin/tracking-backfill.functions';

export const Route = createFileRoute('/admin/rastreamento-retroativo')({
  head: () => ({
    meta: [
      { title: 'Rastreamento retroativo — Admin' },
      { name: 'robots', content: 'noindex, nofollow' },
    ],
  }),
  component: Page,
});

const BATCH_SIZE = 10;

function Page() {
  const check = useServerFn(adminCheck);
  const { data: auth, isLoading, refetch } = useQuery({
    queryKey: ['admin-tracking-backfill', 'check'],
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
  return <Panel />;
}

function LoginGate({ onLoggedIn }: { onLoggedIn: () => void }) {
  const login = useServerFn(adminLogin);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const mut = useMutation({
    mutationFn: (pw: string) => login({ data: { password: pw } }),
    onSuccess: (res) => {
      if (res.ok) onLoggedIn();
      else setError(res.error || 'Falha no login');
    },
  });

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-50 to-white px-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          mut.mutate(password);
        }}
        className="w-full max-w-sm bg-white shadow-lg rounded-2xl p-8 border border-gray-100"
      >
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Painel Admin</h1>
        <p className="text-sm text-gray-500 mb-6">Acesso restrito.</p>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          required
          placeholder="Senha"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#c83f70]"
        />
        {error && <div className="mt-3 text-sm text-red-600">{error}</div>}
        <button
          type="submit"
          disabled={mut.isPending}
          className="mt-5 w-full bg-[#c83f70] hover:bg-[#b03660] text-white font-semibold py-2.5 rounded-lg flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {mut.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
          Entrar
        </button>
      </form>
    </div>
  );
}

interface LogEntry {
  id: string;
  codigo: string;
  status: 'ok' | 'error' | 'skipped';
  message: string;
}

function Panel() {
  const list = useServerFn(adminListPendingTrackingEmails);
  const sendBatch = useServerFn(adminSendTrackingEmailsBatch);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['admin-tracking-backfill', 'pending'],
    queryFn: () => list(),
  });

  const orders: PendingTrackingOrder[] = data?.orders || [];
  const total = data?.total || 0;

  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [counts, setCounts] = useState({ ok: 0, error: 0, skipped: 0 });
  const cancelRef = useRef(false);

  const handleSend = async () => {
    if (!orders.length || sending) return;
    cancelRef.current = false;
    setSending(true);
    setLogs([]);
    setCounts({ ok: 0, error: 0, skipped: 0 });
    setProgress(0);

    const ids = orders.map((o) => o.id);
    let processed = 0;

    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      if (cancelRef.current) break;
      const batch = ids.slice(i, i + BATCH_SIZE);
      try {
        const res = await sendBatch({ data: { ids: batch } });
        const newLogs: LogEntry[] = [];
        const inc = { ok: 0, error: 0, skipped: 0 };
        for (const r of res.results) {
          if (r.ok) {
            inc.ok++;
            newLogs.push({ id: r.id, codigo: r.external_reference, status: 'ok', message: 'Email enviado' });
          } else if (r.skipped) {
            inc.skipped++;
            newLogs.push({
              id: r.id,
              codigo: r.external_reference,
              status: 'skipped',
              message: r.skipped === 'already_sent' ? 'Já enviado anteriormente' : 'Email inválido',
            });
          } else {
            inc.error++;
            newLogs.push({
              id: r.id,
              codigo: r.external_reference,
              status: 'error',
              message: r.error || 'Falha desconhecida',
            });
          }
        }
        setCounts((c) => ({
          ok: c.ok + inc.ok,
          error: c.error + inc.error,
          skipped: c.skipped + inc.skipped,
        }));
        setLogs((l) => [...newLogs, ...l].slice(0, 500));
      } catch (err: any) {
        const newLogs: LogEntry[] = batch.map((id) => ({
          id,
          codigo: orders.find((o) => o.id === id)?.external_reference || '',
          status: 'error' as const,
          message: err?.message || 'Erro de rede',
        }));
        setCounts((c) => ({ ...c, error: c.error + batch.length }));
        setLogs((l) => [...newLogs, ...l].slice(0, 500));
      }
      processed += batch.length;
      setProgress(Math.round((processed / ids.length) * 100));
    }

    setSending(false);
    refetch();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <Link to="/admin/rastreios" className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Voltar
          </Link>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#fdf6f8] flex items-center justify-center text-[#c83f70]">
              <Mail className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-gray-900">Envio retroativo de emails de rastreio</h1>
              <p className="text-sm text-gray-500 mt-1">
                Envia emails de rastreamento para pedidos pagos antigos que ainda não receberam.
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[200px] bg-gradient-to-r from-[#fdf6f8] to-white border border-[#f3d6e1] rounded-xl px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-gray-500">Pedidos pendentes</div>
              <div className="text-2xl font-bold text-[#c83f70]">
                {isLoading ? '…' : total}
              </div>
            </div>
            <button
              onClick={() => refetch()}
              disabled={isFetching || sending}
              className="px-4 py-2.5 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg text-sm font-medium text-gray-700 flex items-center gap-2 disabled:opacity-60"
            >
              <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
              Recarregar
            </button>
            <button
              onClick={handleSend}
              disabled={sending || !total}
              className="px-5 py-2.5 bg-[#c83f70] hover:bg-[#b03660] disabled:opacity-60 text-white font-semibold rounded-lg flex items-center gap-2"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {sending ? 'Enviando…' : `Enviar emails (${total})`}
            </button>
          </div>

          {(sending || progress > 0) && (
            <div className="mt-5">
              <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                <span>Progresso</span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#c83f70] transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="mt-3 flex flex-wrap gap-3 text-sm">
                <span className="inline-flex items-center gap-1 text-emerald-700">
                  <CheckCircle2 className="w-4 h-4" /> {counts.ok} enviados
                </span>
                <span className="inline-flex items-center gap-1 text-amber-700">
                  <SkipForward className="w-4 h-4" /> {counts.skipped} pulados
                </span>
                <span className="inline-flex items-center gap-1 text-red-700">
                  <XCircle className="w-4 h-4" /> {counts.error} erros
                </span>
              </div>
            </div>
          )}
        </div>

        <ResendAllCard />

        {/* Tabela de pendentes */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-6">
          <div className="px-5 py-3 border-b border-gray-100 text-sm font-semibold text-gray-700">
            Pedidos pendentes
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="text-left px-4 py-2">Código</th>
                  <th className="text-left px-4 py-2">Nome</th>
                  <th className="text-left px-4 py-2">Email</th>
                  <th className="text-left px-4 py-2">Aprovado em</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                      <Loader2 className="w-5 h-5 animate-spin inline" />
                    </td>
                  </tr>
                )}
                {!isLoading && orders.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                      Nenhum pedido pendente. 🎉
                    </td>
                  </tr>
                )}
                {orders.slice(0, 200).map((o) => (
                  <tr key={o.id} className="border-t border-gray-100">
                    <td className="px-4 py-2 font-mono text-xs text-gray-700">{o.external_reference}</td>
                    <td className="px-4 py-2 text-gray-800">{o.nome || '—'}</td>
                    <td className="px-4 py-2 text-gray-600">{o.email}</td>
                    <td className="px-4 py-2 text-gray-500 text-xs">
                      {o.approved_at ? new Date(o.approved_at).toLocaleString('pt-BR') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {orders.length > 200 && (
              <div className="px-4 py-2 text-xs text-gray-500 bg-gray-50 border-t border-gray-100">
                Exibindo 200 de {orders.length}. O envio processa todos.
              </div>
            )}
          </div>
        </div>

        {/* Logs */}
        {logs.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 text-sm font-semibold text-gray-700">
              Log de envio ({logs.length})
            </div>
            <div className="max-h-96 overflow-y-auto divide-y divide-gray-50">
              {logs.map((l, i) => (
                <div key={`${l.id}-${i}`} className="px-5 py-2 text-sm flex items-center gap-3">
                  {l.status === 'ok' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                  {l.status === 'error' && <XCircle className="w-4 h-4 text-red-600 shrink-0" />}
                  {l.status === 'skipped' && <SkipForward className="w-4 h-4 text-amber-600 shrink-0" />}
                  <span className="font-mono text-xs text-gray-600 shrink-0">{l.codigo || l.id.slice(0, 8)}</span>
                  <span className="text-gray-700 truncate">{l.message}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ResendAllCard() {
  const list = useServerFn(adminListAllPaidForResend);
  const sendBatch = useServerFn(adminResendTrackingEmailsBatch);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['admin-tracking-resend', 'all-paid'],
    queryFn: () => list(),
  });

  const targets = data?.orders || [];
  const total = data?.total || 0;

  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [counts, setCounts] = useState({ ok: 0, error: 0, skipped: 0 });
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [confirmed, setConfirmed] = useState(false);

  const handleResend = async () => {
    if (!targets.length || sending) return;
    if (!confirmed) {
      const ok = window.confirm(
        `Reenviar email de rastreio para ${total} clientes pagos? Use com cuidado para evitar spam.`,
      );
      if (!ok) return;
      setConfirmed(true);
    }
    setSending(true);
    setLogs([]);
    setCounts({ ok: 0, error: 0, skipped: 0 });
    setProgress(0);

    const ids = targets.map((o) => o.id);
    let processed = 0;
    const BATCH = 10;

    for (let i = 0; i < ids.length; i += BATCH) {
      const batch = ids.slice(i, i + BATCH);
      try {
        const res = await sendBatch({ data: { ids: batch } });
        const newLogs: LogEntry[] = [];
        const inc = { ok: 0, error: 0, skipped: 0 };
        for (const r of res.results) {
          if (r.ok) {
            inc.ok++;
            newLogs.push({ id: r.id, codigo: r.external_reference, status: 'ok', message: 'Email reenviado' });
          } else if (r.skipped) {
            inc.skipped++;
            newLogs.push({ id: r.id, codigo: r.external_reference, status: 'skipped', message: 'Email inválido' });
          } else {
            inc.error++;
            newLogs.push({ id: r.id, codigo: r.external_reference, status: 'error', message: r.error || 'Falha' });
          }
        }
        setCounts((c) => ({
          ok: c.ok + inc.ok,
          error: c.error + inc.error,
          skipped: c.skipped + inc.skipped,
        }));
        setLogs((l) => [...newLogs, ...l].slice(0, 500));
      } catch (err: any) {
        setCounts((c) => ({ ...c, error: c.error + batch.length }));
        setLogs((l) => [
          ...batch.map((id) => ({
            id,
            codigo: targets.find((t) => t.id === id)?.external_reference || '',
            status: 'error' as const,
            message: err?.message || 'Erro de rede',
          })),
          ...l,
        ].slice(0, 500));
      }
      processed += batch.length;
      setProgress(Math.round((processed / ids.length) * 100));
      // pausa pequena entre lotes para evitar rate limit
      await new Promise((r) => setTimeout(r, 400));
    }

    setSending(false);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
          <Send className="w-6 h-6" />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-bold text-gray-900">Reenviar emails de rastreio (novo template)</h2>
          <p className="text-sm text-gray-500 mt-1">
            Envia novamente o email com o novo botão "Acompanhar Pedido" para todos os pedidos pagos com email válido.
            Deduplicado por endereço de email.
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[200px] bg-gradient-to-r from-amber-50 to-white border border-amber-200 rounded-xl px-4 py-3">
          <div className="text-xs uppercase tracking-wide text-gray-500">Clientes únicos</div>
          <div className="text-2xl font-bold text-amber-700">{isLoading ? '…' : total}</div>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching || sending}
          className="px-4 py-2.5 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg text-sm font-medium text-gray-700 flex items-center gap-2 disabled:opacity-60"
        >
          <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          Recarregar
        </button>
        <button
          onClick={handleResend}
          disabled={sending || !total}
          className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white font-semibold rounded-lg flex items-center gap-2"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {sending ? 'Reenviando…' : `Reenviar emails de rastreio (${total})`}
        </button>
      </div>

      {(sending || progress > 0) && (
        <div className="mt-5">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
            <span>Progresso</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-amber-600 transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
          <div className="mt-3 flex flex-wrap gap-3 text-sm">
            <span className="inline-flex items-center gap-1 text-emerald-700">
              <CheckCircle2 className="w-4 h-4" /> {counts.ok} reenviados
            </span>
            <span className="inline-flex items-center gap-1 text-amber-700">
              <SkipForward className="w-4 h-4" /> {counts.skipped} pulados
            </span>
            <span className="inline-flex items-center gap-1 text-red-700">
              <XCircle className="w-4 h-4" /> {counts.error} erros
            </span>
          </div>
        </div>
      )}

      {logs.length > 0 && (
        <div className="mt-5 max-h-72 overflow-y-auto divide-y divide-gray-50 border border-gray-100 rounded-lg">
          {logs.map((l, i) => (
            <div key={`${l.id}-${i}`} className="px-4 py-2 text-sm flex items-center gap-3">
              {l.status === 'ok' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
              {l.status === 'error' && <XCircle className="w-4 h-4 text-red-600 shrink-0" />}
              {l.status === 'skipped' && <SkipForward className="w-4 h-4 text-amber-600 shrink-0" />}
              <span className="font-mono text-xs text-gray-600 shrink-0">{l.codigo || l.id.slice(0, 8)}</span>
              <span className="text-gray-700 truncate">{l.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
