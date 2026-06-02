import { createFileRoute } from '@tanstack/react-router';

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Cache-Control': 'no-store',
};

export const Route = createFileRoute('/api/public/venopag-webhook-test')({
  server: {
    handlers: {
      GET: async () => {
        return new Response(
          JSON.stringify({ ok: true, route: 'venopag-webhook-online' }),
          { status: 200, headers },
        );
      },
    },
  },
});
