import { json, fail, isAdmin, listOrders } from './_lib/store.js';
export async function GET(request) {
  if (!isAdmin(request)) return json({ error: 'Iniciá sesión para ver los pedidos.' }, 401);
  try { return json({ orders: await listOrders() }); } catch (e) { return fail(e); }
}
