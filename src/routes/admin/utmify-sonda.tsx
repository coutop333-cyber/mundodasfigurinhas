import { createFileRoute } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Loader2, Send } from 'lucide-react';
import { sendUtmifyRealPurchaseProbe } from '@/lib/utmify-test.functions';

export const Route = createFileRoute('/admin/utmify-sonda')({
  head: () => ({
    meta: [
      { title: 'Sonda UTMify — venda real' },
      { name: 'robots', content: 'noindex, nofollow' },
    ],
  }),
  component: SondaPage,
});

function SondaPage() {
  const sendProbe = useServerFn(sendUtmifyRealPurchaseProbe);
  const [amount, setAmount] = useState(1);
  const [log, setLog] = useState<any[]>([]);

  const mutation = useMutation({
    mutationFn: () => sendProbe({ data: { confirm: 'SONDA_UTMIFY_REAL', amount } }),
    onSuccess: (res) => setLog((l) => [{ at: new Date().toISOString(), ...res }, ...l]),
    onError: (err: any) =>
      setLog((l) => [{ at: new Date().toISOString(), error: String(err?.message || err) }, ...l]),
  });

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-sm border p-6 space-y-5">
        <header>
          <h1 className="text-2xl font-bold">Sonda UTMify — venda REAL</h1>
          <p className="text-sm text-gray-600 mt-1">
            Dispara um POST em <code>api.utmify.com.br/api-credentials/orders</code> com{' '}
            <strong>isTest: false</strong> e marcador único no <code>orderId</code> /{' '}
            <code>utm_campaign</code> (<code>SONDA_REAL_*</code>). Use para identificar em qual
            dashboard da UTMify a venda cai (qual workspace/token está realmente ativo).
          </p>
        </header>

        <div className="flex items-end gap-3">
          <label className="flex-1">
            <span className="text-xs font-semibold text-gray-700 uppercase">Valor (R$)</span>
            <input
              type="number"
              min={1}
              max={500}
              value={amount}
              onChange={(e) => setAmount(Math.max(1, Number(e.target.value) || 1))}
              className="mt-1 w-full border rounded-lg px-3 py-2"
            />
          </label>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="px-5 py-2 rounded-lg bg-black text-white font-semibold flex items-center gap-2 disabled:opacity-60"
          >
            {mutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            Enviar venda real
          </button>
        </div>

        <div className="rounded-lg border bg-amber-50 text-amber-900 text-xs p-3">
          ⚠️ Esse disparo conta como venda real na UTMify. Use valores pequenos (R$ 1) e exclua
          depois no dashboard que recebeu, se necessário.
        </div>

        <section>
          <h2 className="text-sm font-bold mb-2">Histórico desta sessão</h2>
          {log.length === 0 ? (
            <p className="text-xs text-gray-500">Nenhum disparo ainda.</p>
          ) : (
            <ul className="space-y-2">
              {log.map((item, i) => (
                <li key={i} className="border rounded-lg p-3 text-xs bg-gray-50">
                  <div className="flex justify-between mb-1">
                    <span className="font-mono">{item.marker || '—'}</span>
                    <span className="text-gray-500">{item.at}</span>
                  </div>
                  <div>
                    <strong>ok:</strong> {String(item.ok)} ·{' '}
                    <strong>HTTP:</strong> {item.httpStatus ?? '—'} ·{' '}
                    <strong>token …</strong>{item.tokenSuffix || '?'}
                  </div>
                  {item.response && (
                    <pre className="mt-2 whitespace-pre-wrap break-all text-[11px] bg-white border rounded p-2">
                      {item.response}
                    </pre>
                  )}
                  {item.error && <div className="text-red-600 mt-1">{item.error}</div>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
