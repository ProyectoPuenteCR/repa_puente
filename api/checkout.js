import { json, fail, getCatalog, saveOrder } from './_lib/store.js';

export async function POST(request) {
  let b = {}; try { b = await request.json(); } catch {}
  const db = await getCatalog();
  const lines = (Array.isArray(b.items) ? b.items : []).map(({ id, q }) => {
    const it = db.items.find((i) => i.id === Number(id) && i.active && i.price != null);
    const qty = Math.min(20, Math.max(1, Math.floor(Number(q) || 0)));
    return it ? { id: it.id, title: it.name, quantity: qty, unit_price: it.price } : null;
  }).filter(Boolean);
  if (!lines.length) return json({ error: 'El carrito está vacío.' }, 400);
  if (b.home) {
    const v = db.items.find((i) => /^Visita técnica a domicilio/.test(i.name) && i.price != null);
    if (v) lines.push({ id: v.id, title: v.name, quantity: 1, unit_price: v.price });
  }
  const total = lines.reduce((a, l) => a + l.unit_price * l.quantity, 0);
  const id = 'PP-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
  const origin = new URL(request.url).origin;
  const name = String(b.name || '').slice(0, 120), email = String(b.email || '').slice(0, 160);
  const preference = {
    items: lines.map((l) => ({ id: String(l.id), title: l.title, quantity: l.quantity, currency_id: 'ARS', unit_price: l.unit_price })),
    payer: email ? { name, email } : undefined,
    external_reference: id,
    statement_descriptor: 'PUENTE SERVICE',
    back_urls: { success: `${origin}/?pago=aprobado#/carrito`, failure: `${origin}/?pago=rechazado#/carrito`, pending: `${origin}/?pago=pendiente#/carrito` },
    auto_return: 'approved',
    notification_url: `${origin}/api/mp-webhook`,
  };
  let link, mode = 'demo';
  const token = process.env.MP_ACCESS_TOKEN;
  if (token) {
    const r = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', 'x-idempotency-key': id }, body: JSON.stringify(preference),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { console.error('MP error', r.status, d); return json({ error: 'Mercado Pago rechazó la preferencia. Revisá el Access Token.' }, 502); }
    link = d.init_point; mode = token.startsWith('TEST-') ? 'prueba' : 'real';
  } else {
    link = `https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=DEMO-${id.toLowerCase()}`;
  }
  const order = { id, createdAt: new Date().toISOString(), name, email, lines, total, status: 'pendiente', mode, link };
  try { await saveOrder(order); } catch (e) { return fail(e); }
  return json({ id, total, link, mode, preference });
}
