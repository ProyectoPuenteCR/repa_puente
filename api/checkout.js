import { json, fail, getCatalog, saveOrder, getSession, getConfig, getUsers, saveUsers, cleanPhone } from './_lib/store.js';
import { sendMail, orderEmail } from './_lib/mail.js';

const clean = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

// Pedido público: no hace falta usuario. Nombre, apellido, celular, dirección y al menos un servicio son obligatorios.
export async function POST(request) {
  let b = {}; try { b = await request.json(); } catch {}
  if (b.website) return json({ error: 'Pedido inválido.' }, 400); // trampa para bots
  const session = getSession(request);
  const c = {
    nombre: clean(b.nombre, 60), apellido: clean(b.apellido, 60), direccion: clean(b.direccion, 160),
    celular: cleanPhone(b.celular), email: clean(b.email, 160), detalle: String(b.detalle || '').trim().slice(0, 800),
  };
  const faltan = [];
  if (!c.nombre) faltan.push('nombre');
  if (!c.apellido) faltan.push('apellido');
  if (c.celular.length < 10) faltan.push('celular');
  if (!c.direccion) faltan.push('direccion');
  if (faltan.length) return json({ error: 'Completá los datos obligatorios. El celular va con código de área, sin 0 ni 15 (ej.: 2974711779).', fields: faltan }, 400);
  if (c.email && !isEmail(c.email)) return json({ error: 'El email no es válido.', fields: ['email'] }, 400);

  const db = await getCatalog();
  const lines = (Array.isArray(b.items) ? b.items : []).slice(0, 50).map(({ id, q }) => {
    const it = db.items.find((i) => i.id === Number(id) && i.active && i.price != null);
    const qty = Math.min(20, Math.max(1, Math.floor(Number(q) || 0)));
    return it ? { id: it.id, title: it.name, quantity: qty, unit_price: it.price } : null;
  }).filter(Boolean);
  if (!lines.length) return json({ error: 'Elegí al menos un servicio.' }, 400);
  if (b.home) {
    const v = db.items.find((i) => /^Visita técnica a domicilio/.test(i.name) && i.price != null);
    if (v) lines.push({ id: v.id, title: v.name, quantity: 1, unit_price: v.price });
  }
  const total = lines.reduce((a, l) => a + l.unit_price * l.quantity, 0);
  const id = 'PP-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
  const origin = new URL(request.url).origin;
  const name = `${c.nombre} ${c.apellido}`;
  const cfg = await getConfig();

  // Con MP_ACCESS_TOKEN se crea una preferencia con el monto exacto; sin token se usa el link fijo de la configuración.
  let link = cfg.mpLink, mode = 'link';
  const token = process.env.MP_ACCESS_TOKEN;
  if (token) {
    const preference = {
      items: lines.map((l) => ({ id: String(l.id), title: l.title, quantity: l.quantity, currency_id: 'ARS', unit_price: l.unit_price })),
      payer: c.email ? { name, email: c.email } : undefined, external_reference: id, statement_descriptor: 'PUENTE SERVICE',
      back_urls: { success: `${origin}/?pago=aprobado#/mis-pedidos`, failure: `${origin}/?pago=rechazado#/carrito`, pending: `${origin}/?pago=pendiente#/mis-pedidos` },
      auto_return: 'approved', notification_url: `${origin}/api/mp-webhook`,
    };
    const r = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', 'x-idempotency-key': id }, body: JSON.stringify(preference),
    });
    const d = await r.json().catch(() => ({}));
    if (r.ok) { link = d.init_point; mode = token.startsWith('TEST-') ? 'prueba' : 'real'; } else console.error('MP error', r.status, d);
  }

  const order = {
    id, createdAt: new Date().toISOString(), user: session?.user || null,
    name, nombre: c.nombre, apellido: c.apellido, phone: c.celular, address: c.direccion, email: c.email, detalle: c.detalle,
    home: !!b.home, lines, total, status: 'pendiente', mode, link,
  };
  try { await saveOrder(order); } catch (e) { return fail(e); }

  // Si está logueado, guardamos sus datos para precargar el próximo pedido.
  if (session) {
    try {
      const users = await getUsers(), u = users.find((x) => x.user === session.user);
      if (u && (u.phone !== c.celular || u.address !== c.direccion || !u.name)) {
        Object.assign(u, { phone: c.celular, address: c.direccion, name: u.name || name });
        await saveUsers(users);
      }
    } catch (e) { console.error('profile', e); }
  }

  let notified = false;
  try { const m = orderEmail(order, origin); notified = await sendMail({ to: cfg.notifyEmail, ...m }); } catch (e) { console.error('notify', e); }
  return json({ id, total, link, mode, phone: c.celular, notified, user: session?.user || null });
}
