import { json, fail, getOrder, saveOrder, getConfig, taskKeyOk, ORDER_ID } from './_lib/store.js';
import { sendMail } from './_lib/mail.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Lo que ve el técnico: sin precios ni notas internas.
const view = (o) => ({
  id: o.id, techName: o.techName || '', response: o.techResponse || '', respondedAt: o.techRespondedAt || '',
  name: o.name || [o.nombre, o.apellido].filter(Boolean).join(' '), phone: o.phone || '', address: o.address || '',
  home: !!o.home, detalle: o.detalle || '', lines: (o.lines || []).map((l) => ({ title: l.title, quantity: l.quantity, detail: l.detail || '' })),
});

// El link lleva una clave firmada por pedido: sin ella (o con otra) no se devuelve nada. Mismo error en todos los casos.
async function load(id, k) {
  if (!ORDER_ID.test(id) || !taskKeyOk(id, k)) return null;
  const o = await getOrder(id);
  return o && o.techId ? o : null;
}
const BAD = () => json({ error: 'Este link no es válido o la tarea ya no está asignada.' }, 404);

// GET /api/task?id=PP-XXXX&k=clave
export async function GET(request) {
  const q = new URL(request.url).searchParams;
  try {
    const o = await load(String(q.get('id') || ''), String(q.get('k') || ''));
    return o ? json({ task: view(o) }) : BAD();
  } catch (e) { return fail(e); }
}

// POST { id, k, action: 'accept' | 'decline' }
export async function POST(request) {
  let b = {}; try { b = await request.json(); } catch {}
  if (!['accept', 'decline'].includes(b.action)) return json({ error: 'Acción inválida.' }, 400);
  try {
    const o = await load(String(b.id || ''), String(b.k || ''));
    if (!o) return BAD();
    const ok = b.action === 'accept';
    o.techResponse = ok ? 'aceptada' : 'rechazada';
    o.techRespondedAt = new Date().toISOString();
    await saveOrder(o);
    try { // aviso por email al administrador (si el envío está configurado)
      const cfg = await getConfig(), origin = new URL(request.url).origin;
      await sendMail({
        to: cfg.notifyEmail,
        subject: `${o.techName || 'El técnico'} ${ok ? 'aceptó' : 'no puede tomar'} el pedido ${o.id}`,
        html: `<p><b>${esc(o.techName || 'El técnico')}</b> ${ok ? 'aceptó' : 'rechazó'} la tarea del pedido <b>${esc(o.id)}</b> (${esc(view(o).name)}).</p><p><a href="${origin}/#/pedidos/${encodeURIComponent(o.id)}">Abrir el pedido</a></p>`,
      });
    } catch (e) { console.error('notify task', e); }
    return json({ task: view(o) });
  } catch (e) { return fail(e); }
}
