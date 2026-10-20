import { json, fail, isAdmin, listOrders, getOrder, saveOrder } from './_lib/store.js';
const STATUS = ['pendiente', 'pagado', 'cancelado', 'devuelto'];
export async function GET(request) {
  if (!isAdmin(request)) return json({ error: 'Iniciá sesión para ver los pedidos.' }, 401);
  try { return json({ orders: await listOrders() }); } catch (e) { return fail(e); }
}
// El link fijo de Mercado Pago no avisa el pago: el administrador marca el estado a mano.
export async function PATCH(request) {
  if (!isAdmin(request)) return json({ error: 'Solo un administrador puede cambiar pedidos.' }, 401);
  let b = {}; try { b = await request.json(); } catch {}
  if (!STATUS.includes(b.status)) return json({ error: 'Estado inválido.' }, 400);
  try {
    const id = String(b.id || '');
    if (!/^PP-[A-Z0-9-]{4,40}$/.test(id)) return json({ error: 'Pedido inválido.' }, 400);
    const o = await getOrder(id);
    if (!o) return json({ error: 'Pedido no encontrado.' }, 404);
    o.status = b.status; o.statusAt = new Date().toISOString();
    return json({ ok: true, order: await saveOrder(o) });
  } catch (e) { return fail(e); }
}
