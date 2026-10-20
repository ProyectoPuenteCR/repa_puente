import { json, fail, getSession, listOrders, getOrder, saveOrder, ORDER_ID } from './_lib/store.js';
const STATUS = ['pendiente', 'aceptado', 'pagado', 'terminado', 'cancelado', 'devuelto'];

// Admin: todos los pedidos. Visitante (o ?mine=1): solo los asociados a su cuenta.
export async function GET(request) {
  const s = getSession(request);
  if (!s) return json({ error: 'Iniciá sesión para ver los pedidos.' }, 401);
  try {
    const mine = s.role !== 'admin' || new URL(request.url).searchParams.get('mine') === '1';
    const orders = await listOrders(mine ? 500 : 300);
    if (!mine) return json({ orders });
    // Solo pedidos asociados a la cuenta (no por celular: cualquiera podría pedir con un celular ajeno).
    return json({ orders: orders.filter((o) => o.user === s.user) });
  } catch (e) { return fail(e); }
}

// El link fijo de Mercado Pago no avisa el pago: el administrador acepta y marca el estado a mano.
export async function PATCH(request) {
  if (getSession(request)?.role !== 'admin') return json({ error: 'Solo un administrador puede cambiar pedidos.' }, 401);
  let b = {}; try { b = await request.json(); } catch {}
  if (!STATUS.includes(b.status)) return json({ error: 'Estado inválido.' }, 400);
  const id = String(b.id || '');
  if (!ORDER_ID.test(id)) return json({ error: 'Pedido inválido.' }, 400);
  try {
    const o = await getOrder(id);
    if (!o) return json({ error: 'Pedido no encontrado.' }, 404);
    o.status = b.status; o.statusAt = new Date().toISOString();
    if (b.status === 'aceptado' && !o.acceptedAt) o.acceptedAt = o.statusAt;
    return json({ ok: true, order: await saveOrder(o) });
  } catch (e) { return fail(e); }
}
