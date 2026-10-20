import { json, fail, getSession, getUsers, saveUsers, newUser, sessionCookie, getOrder, saveOrder, ORDER_ID } from './_lib/store.js';

// Registro de visitante a partir de un pedido recién hecho: el usuario es el celular del pedido.
export async function POST(request) {
  if (getSession(request)) return json({ error: 'Ya tenés la sesión iniciada.' }, 400);
  let b = {}; try { b = await request.json(); } catch {}
  const id = String(b.orderId || ''), pass = String(b.pass || '');
  if (!ORDER_ID.test(id)) return json({ error: 'Pedido inválido.' }, 400);
  if (pass.length < 8) return json({ error: 'La contraseña debe tener al menos 8 caracteres.' }, 400);
  try {
    const o = await getOrder(id);
    if (!o || !o.phone) return json({ error: 'No encontramos el pedido.' }, 404);
    if (o.user) return json({ error: 'Ese pedido ya está asociado a una cuenta.' }, 409);
    if (Date.now() - new Date(o.createdAt).getTime() > 2 * 3600e3) return json({ error: 'Pasó demasiado tiempo desde el pedido. Pedile la cuenta al administrador.' }, 400);
    const users = await getUsers();
    if (users.some((u) => u.user === o.phone)) return json({ error: 'Ya hay una cuenta con ese celular. Ingresá con tu contraseña.' }, 409);
    const u = newUser({ user: o.phone, name: o.name, pass, role: 'visitante', phone: o.phone, address: o.address || '' }, 'registro');
    users.push(u); await saveUsers(users);
    o.user = u.user; await saveOrder(o);
    const s = { user: u.user, name: u.name, role: u.role };
    return json({ ok: true, ...s }, 201, { 'set-cookie': sessionCookie(s) });
  } catch (e) { return fail(e); }
}
