import { json, fail, getSession, listOrders, getOrder, saveOrder, deleteOrder, getConfig, ORDER_ID } from './_lib/store.js';
const STATUS = ['pendiente', 'aceptado', 'pagado', 'terminado', 'cancelado', 'devuelto'];
const INTERNAL = ['obs', 'workDone', 'techId', 'techName', 'techNotifiedAt']; // datos internos: el cliente no los ve
const stripInternal = (o) => { const c = { ...o }; INTERNAL.forEach((k) => delete c[k]); return c; };
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const text = (v, n) => String(v ?? '').trim().slice(0, n);

// Admin: todos los pedidos. Visitante (o ?mine=1): solo los asociados a su cuenta.
export async function GET(request) {
  const s = getSession(request);
  if (!s) return json({ error: 'Iniciá sesión para ver los pedidos.' }, 401);
  try {
    const mine = s.role !== 'admin' || new URL(request.url).searchParams.get('mine') === '1';
    const orders = await listOrders(mine ? 500 : 300);
    if (!mine) return json({ orders });
    // Solo pedidos asociados a la cuenta (no por celular: cualquiera podría pedir con un celular ajeno).
    return json({ orders: orders.filter((o) => o.user === s.user).map(stripInternal) });
  } catch (e) { return fail(e); }
}

// El link fijo de Mercado Pago no avisa el pago: el administrador acepta y marca el estado a mano.
// Todos los campos son opcionales: estado, técnico (techId), fechas (startDate/endDate), obs, workDone y notifyTech.
export async function PATCH(request) {
  if (getSession(request)?.role !== 'admin') return json({ error: 'Solo un administrador puede cambiar pedidos.' }, 401);
  let b = {}; try { b = await request.json(); } catch {}
  const id = String(b.id || '');
  if (!ORDER_ID.test(id)) return json({ error: 'Pedido inválido.' }, 400);
  if (b.status !== undefined && !STATUS.includes(b.status)) return json({ error: 'Estado inválido.' }, 400);
  try {
    const o = await getOrder(id);
    if (!o) return json({ error: 'Pedido no encontrado.' }, 404);
    const now = new Date().toISOString();

    if (b.status !== undefined && b.status !== o.status) {
      o.status = b.status; o.statusAt = now;
      if (b.status === 'aceptado' && !o.acceptedAt) o.acceptedAt = now;
    }
    if ('obs' in b) o.obs = text(b.obs, 1500);
    if ('workDone' in b) o.workDone = text(b.workDone, 3000);
    for (const k of ['startDate', 'endDate']) {
      if (!(k in b)) continue;
      const v = text(b[k], 10);
      if (v && (!DATE.test(v) || Number.isNaN(Date.parse(v)))) return json({ error: 'La fecha no es válida.' }, 400);
      o[k] = v;
    }
    if (o.startDate && o.endDate && o.endDate < o.startDate) return json({ error: 'La fecha de fin no puede ser anterior a la de inicio.' }, 400);

    if ('techId' in b) {
      const techId = text(b.techId, 40);
      if (!techId) { delete o.techId; delete o.techName; delete o.techNotifiedAt; }
      else if (techId !== o.techId) {
        const t = ((await getConfig()).technicians || []).find((x) => x.id === techId);
        if (!t) return json({ error: 'Ese técnico no existe. Cargalo en Configuración.' }, 400);
        o.techId = t.id; o.techName = t.name; delete o.techNotifiedAt;
      }
    }
    if (b.notifyTech && o.techId) o.techNotifiedAt = now;
    o.updatedAt = now;
    return json({ ok: true, order: await saveOrder(o) });
  } catch (e) { return fail(e); }
}

// Borra el pedido de forma definitiva: /api/orders?id=PP-XXXX
export async function DELETE(request) {
  if (getSession(request)?.role !== 'admin') return json({ error: 'Solo un administrador puede borrar pedidos.' }, 401);
  const id = String(new URL(request.url).searchParams.get('id') || '');
  if (!ORDER_ID.test(id)) return json({ error: 'Pedido inválido.' }, 400);
  try {
    if (!(await getOrder(id))) return json({ error: 'Pedido no encontrado.' }, 404);
    await deleteOrder(id);
    return json({ ok: true });
  } catch (e) { return fail(e); }
}
