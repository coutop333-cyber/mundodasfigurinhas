import { createFileRoute } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { Loader2, Search, Plus, Save, LogOut, ExternalLink, ChevronDown, ChevronRight, CheckSquare, Square } from 'lucide-react';
import {
  adminCheck,
  adminLogin,
  adminLogout,
  adminListRastreios,
  adminCreateRastreio,
  adminUpdateRastreio,
  adminBulkUpdateRastreios,
  type AdminRastreio,
} from '@/lib/rastreios/admin.functions';
import { RASTREIO_STATUSES, DEFAULT_RASTREIO_STATUS, PROBLEMA_ENVIO_STATUS } from '@/lib/rastreios/statuses';

export const Route = createFileRoute('/admin/rastreios')({
  head: () => ({
    meta: [
      { title: 'Painel de rastreios — Admin' },
      { name: 'robots', content: 'noindex, nofollow' },
    ],
  }),
  component: AdminRastreiosPage,
});

function AdminRastreiosPage() {
  const check = useServerFn(adminCheck);
  const { data: auth, isLoading: checking, refetch } = useQuery({
    queryKey: ['admin-rastreios', 'check'],
    queryFn: () => check(),
    staleTime: 0,
  });

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!auth?.isAdmin) return <LoginGate onLoggedIn={() => refetch()} />;
  return <AdminPanel onLogout={() => refetch()} />;
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
    onError: (e: any) => setError(e?.message || 'Erro inesperado'),
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
        <p className="text-sm text-gray-500 mb-6">Acesso restrito. Informe a senha.</p>

        <label className="block text-xs font-medium text-gray-700 mb-1">Senha</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#c83f70] focus:border-transparent"
        />

        {error && <div className="mt-3 text-sm text-red-600">{error}</div>}

        <button
          type="submit"
          disabled={mut.isPending}
          className="mt-5 w-full bg-[#c83f70] hover:bg-[#b03660] disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg flex items-center justify-center gap-2"
        >
          {mut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Entrar
        </button>
      </form>
    </div>
  );
}

function dayKey(iso: string): string {
  const d = new Date(iso);
  // pt-BR date in local TZ
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = d.getFullYear();
  return `${dd}/${mm}/${yy}`;
}

function AdminPanel({ onLogout }: { onLogout: () => void }) {
  const list = useServerFn(adminListRastreios);
  const create = useServerFn(adminCreateRastreio);
  const update = useServerFn(adminUpdateRastreio);
  const bulkUpdate = useServerFn(adminBulkUpdateRastreios);
  const logout = useServerFn(adminLogout);
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState(''); // yyyy-mm-dd
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<string>(DEFAULT_RASTREIO_STATUS);
  const [bulkNotifyProblema, setBulkNotifyProblema] = useState(true);

  const { data: rows = [], isLoading, isFetching } = useQuery({
    queryKey: ['admin-rastreios', 'list', search],
    queryFn: () => list({ data: { search: search || undefined, limit: 500 } }),
  });

  const updateMut = useMutation({
    mutationFn: (input: {
      id: string;
      status?: string;
      observacao?: string | null;
      notifyProblema?: boolean;
    }) => update({ data: input as any }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-rastreios', 'list'] }),
  });

  const createMut = useMutation({
    mutationFn: (input: { codigo_pedido: string; status?: string; observacao?: string }) =>
      create({ data: input as any }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-rastreios', 'list'] });
      setShowCreate(false);
    },
  });

  const bulkMut = useMutation({
    mutationFn: (input: { ids: string[]; status: string; notifyProblema?: boolean }) =>
      bulkUpdate({ data: input as any }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-rastreios', 'list'] });
      setSelected(new Set());
    },
  });

  const logoutMut = useMutation({
    mutationFn: () => logout(),
    onSuccess: () => onLogout(),
  });

  // Filter by date if set
  const filtered = useMemo(() => {
    if (!dateFilter) return rows;
    const target = (() => {
      const [y, m, d] = dateFilter.split('-');
      return `${d}/${m}/${y}`;
    })();
    return rows.filter((r) => dayKey(r.created_at) === target);
  }, [rows, dateFilter]);

  // Group by day, preserving server order (already desc by ultima_atualizacao)
  const groups = useMemo(() => {
    const map = new Map<string, AdminRastreio[]>();
    for (const r of filtered) {
      const k = dayKey(r.created_at);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(r);
    }
    return Array.from(map.entries());
  }, [filtered]);

  // Status counter (for filtered set)
  const statusCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of filtered) c[r.status] = (c[r.status] || 0) + 1;
    return c;
  }, [filtered]);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleSelectGroup(ids: string[]) {
    setSelected((prev) => {
      const next = new Set(prev);
      const allSelected = ids.every((id) => next.has(id));
      if (allSelected) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
  }
  function toggleCollapse(day: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-gray-900">Painel de rastreios</h1>
          <p className="text-xs text-gray-500">Eletros Jundiaí · Admin</p>
        </div>
        <button
          onClick={() => logoutMut.mutate()}
          className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-gray-100"
        >
          <LogOut className="w-4 h-4" /> Sair
        </button>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex flex-col sm:flex-row gap-3 mb-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Pesquisar por código do pedido..."
              className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#c83f70]"
            />
          </div>
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="px-3 py-2.5 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#c83f70]"
          />
          {dateFilter && (
            <button
              onClick={() => setDateFilter('')}
              className="px-3 py-2.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              Limpar
            </button>
          )}
          <button
            onClick={() => setShowCreate((v) => !v)}
            className="bg-[#c83f70] hover:bg-[#b03660] text-white font-medium px-4 py-2.5 rounded-lg flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" /> Novo
          </button>
        </div>

        {/* Status counter */}
        {filtered.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            <span className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 font-medium">
              Total: {filtered.length}
            </span>
            {Object.entries(statusCounts).map(([s, n]) => (
              <span key={s} className="text-xs px-2.5 py-1 rounded-full bg-[#fdebf2] text-[#c83f70] font-medium">
                {s}: {n}
              </span>
            ))}
          </div>
        )}

        {/* Bulk action bar */}
        {selected.size > 0 && (
          <div className="bg-white border border-[#c83f70] rounded-xl p-3 mb-3 flex flex-col gap-3 sticky top-[72px] z-10 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="text-sm font-medium text-gray-900">
                {selected.size} pedido(s) selecionado(s)
              </div>
              <div className="flex-1" />
              <select
                value={bulkStatus}
                onChange={(e) => setBulkStatus(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#c83f70]"
              >
                {RASTREIO_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <button
                onClick={() => setSelected(new Set())}
                className="px-3 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50"
              >
                Limpar
              </button>
              <button
                disabled={bulkMut.isPending}
                onClick={() => {
                  const willNotify = bulkNotifyProblema && bulkStatus === PROBLEMA_ENVIO_STATUS;
                  const msg = willNotify
                    ? `Alterar ${selected.size} pedido(s) para "${bulkStatus}" e enviar e-mail de aviso?`
                    : `Alterar ${selected.size} pedido(s) para "${bulkStatus}"?`;
                  if (!confirm(msg)) return;
                  bulkMut.mutate({
                    ids: Array.from(selected),
                    status: bulkStatus,
                    notifyProblema: willNotify,
                  });
                }}
                className="px-4 py-2 text-sm bg-[#c83f70] hover:bg-[#b03660] disabled:opacity-60 text-white font-semibold rounded-lg flex items-center gap-2"
              >
                {bulkMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Aplicar status
              </button>
            </div>
            {bulkStatus === PROBLEMA_ENVIO_STATUS && (
              <label className="flex items-center gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <input
                  type="checkbox"
                  checked={bulkNotifyProblema}
                  onChange={(e) => setBulkNotifyProblema(e.target.checked)}
                  className="w-4 h-4 accent-[#c83f70]"
                />
                Enviar automaticamente e-mail avisando o cliente sobre o problema (não duplica)
              </label>
            )}
          </div>
        )}

        {showCreate && (
          <CreateForm
            onCancel={() => setShowCreate(false)}
            onSubmit={(values) => createMut.mutate(values)}
            isSubmitting={createMut.isPending}
            error={createMut.error ? String((createMut.error as any).message || createMut.error) : null}
          />
        )}

        {isLoading ? (
          <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin inline" />
          </div>
        ) : groups.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-sm text-gray-500">
            Nenhum rastreio encontrado.
          </div>
        ) : (
          <div className="space-y-4">
            {groups.map(([day, items]) => {
              const ids = items.map((i) => i.id);
              const allSel = ids.every((id) => selected.has(id));
              const someSel = !allSel && ids.some((id) => selected.has(id));
              const isCollapsed = collapsed.has(day);
              return (
                <div key={day} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-200">
                    <button
                      onClick={() => toggleCollapse(day)}
                      className="text-gray-500 hover:text-gray-900"
                    >
                      {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => toggleSelectGroup(ids)}
                      className="text-[#c83f70] hover:text-[#b03660] flex items-center gap-2"
                      title={allSel ? 'Desmarcar todos' : 'Selecionar todos'}
                    >
                      {allSel ? <CheckSquare className="w-4 h-4" /> : <Square className={`w-4 h-4 ${someSel ? 'text-[#c83f70]' : 'text-gray-400'}`} />}
                    </button>
                    <div className="font-semibold text-sm text-gray-900">{day}</div>
                    <div className="text-xs text-gray-500">{items.length} pedido(s)</div>
                  </div>
                  {!isCollapsed && (
                    <ul className="divide-y divide-gray-100">
                      {items.map((r) => (
                        <RastreioRow
                          key={r.id}
                          row={r}
                          selected={selected.has(r.id)}
                          onToggleSelect={() => toggleSelect(r.id)}
                          onSave={(patch) => updateMut.mutate({ id: r.id, ...patch })}
                          saving={updateMut.isPending}
                        />
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {isFetching && !isLoading && (
          <div className="text-xs text-gray-400 text-center py-2">Atualizando...</div>
        )}
      </main>
    </div>
  );
}

function CreateForm({
  onCancel,
  onSubmit,
  isSubmitting,
  error,
}: {
  onCancel: () => void;
  onSubmit: (v: { codigo_pedido: string; status?: string; observacao?: string }) => void;
  isSubmitting: boolean;
  error: string | null;
}) {
  const [codigo, setCodigo] = useState('');
  const [status, setStatus] = useState<string>(DEFAULT_RASTREIO_STATUS);
  const [obs, setObs] = useState('');

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!codigo.trim()) return;
        onSubmit({ codigo_pedido: codigo.trim(), status, observacao: obs.trim() || undefined });
      }}
      className="bg-white border border-gray-200 rounded-xl p-4 mb-4 grid grid-cols-1 sm:grid-cols-2 gap-3"
    >
      <div className="sm:col-span-1">
        <label className="block text-xs font-medium text-gray-700 mb-1">Código do pedido</label>
        <input
          required
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#c83f70]"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Status inicial</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#c83f70]"
        >
          {RASTREIO_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>
      <div className="sm:col-span-2">
        <label className="block text-xs font-medium text-gray-700 mb-1">Observação (opcional)</label>
        <textarea
          value={obs}
          onChange={(e) => setObs(e.target.value)}
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#c83f70]"
        />
      </div>
      {error && <div className="sm:col-span-2 text-sm text-red-600">{error}</div>}
      <div className="sm:col-span-2 flex gap-2 justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 text-sm bg-[#c83f70] hover:bg-[#b03660] text-white font-medium rounded-lg flex items-center gap-2 disabled:opacity-60"
        >
          {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
          Criar rastreio
        </button>
      </div>
    </form>
  );
}

function RastreioRow({
  row,
  selected,
  onToggleSelect,
  onSave,
  saving,
}: {
  row: AdminRastreio;
  selected: boolean;
  onToggleSelect: () => void;
  onSave: (patch: { status?: string; observacao?: string | null; notifyProblema?: boolean }) => void;
  saving: boolean;
}) {
  const [status, setStatus] = useState(row.status);
  const [obs, setObs] = useState(row.observacao ?? '');
  const [notifyProblema, setNotifyProblema] = useState(true);
  const dirty = useMemo(
    () => status !== row.status || (obs || '') !== (row.observacao ?? ''),
    [status, obs, row.status, row.observacao],
  );

  return (
    <li className={`p-4 sm:p-5 transition-colors ${selected ? 'bg-[#fdebf2]/50' : 'hover:bg-gray-50/50'}`}>
      <div className="flex items-start gap-3">
        <button
          onClick={onToggleSelect}
          className="mt-1 text-[#c83f70] hover:text-[#b03660] shrink-0"
          title={selected ? 'Desmarcar' : 'Selecionar'}
        >
          {selected ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5 text-gray-400" />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <code className="font-mono text-sm font-semibold text-gray-900 break-all">
                  {row.codigo_pedido}
                </code>
                <a
                  href={`/rastreio/${encodeURIComponent(row.codigo_pedido)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[#c83f70] hover:underline inline-flex items-center gap-1"
                >
                  ver página <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <div className="text-xs text-gray-400 mt-0.5">
                Atualizado em {new Date(row.ultima_atualizacao).toLocaleString('pt-BR')}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#c83f70] text-sm"
              >
                {RASTREIO_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">Observação</label>
              <textarea
                value={obs}
                onChange={(e) => setObs(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#c83f70] text-sm"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2 mt-3">
            {status === PROBLEMA_ENVIO_STATUS && (
              <label className="flex items-center gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <input
                  type="checkbox"
                  checked={notifyProblema}
                  onChange={(e) => setNotifyProblema(e.target.checked)}
                  className="w-4 h-4 accent-[#c83f70]"
                />
                Avisar cliente por e-mail
              </label>
            )}
            <button
              disabled={!dirty || saving}
              onClick={() =>
                onSave({
                  status,
                  observacao: obs || null,
                  notifyProblema: status === PROBLEMA_ENVIO_STATUS && notifyProblema,
                })
              }
              className="px-4 py-2 text-sm bg-[#c83f70] hover:bg-[#b03660] disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium rounded-lg flex items-center gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Salvar
            </button>
          </div>
        </div>
      </div>
    </li>
  );
}
