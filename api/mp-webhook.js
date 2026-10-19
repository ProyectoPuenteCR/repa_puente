import { json, getOrder, saveOrder } from './_lib/store.js';
// Mercado Pago avisa los pagos acá; consultamos el pago y actualizamos el pedido.
export async function POST(request) {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) return json({ ok: true });
  const url = new URL(request.url);
  let b = {}; try { b = await request.json(); } catch {}
  const type = b.type || url.searchParams.get('type') || url.searchParams.get('topic');
  const pid = b?.data?.id || url.searchParams.get('data.id') || url.searchParams.get('id');
  if (type !== 'payment' || !pid) return json({ ok: true });
  const r = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(pid)}`, { headers: { authorization: `Bearer ${token}` } });
  if (!r.ok) return json({ ok: true });
  const p = await r.json();
  const order = p.external_reference && (await getOrder(p.external_reference));
  if (order) {
    const map = { approved: 'pagado', rejected: 'rechazado', cancelled: 'cancelado', refunded: 'devuelto', in_process: 'pendiente', pending: 'pendiente' };
    order.status = map[p.status] || p.status; order.paymentId = String(p.id); order.paidAt = p.date_approved || null;
    await saveOrder(order);
  }
  return json({ ok: true });
}
