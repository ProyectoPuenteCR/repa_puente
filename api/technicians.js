import { json, fail, getSession, getConfig, saveConfig, cleanPhone } from './_lib/store.js';

const clean = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const isAdmin = (request) => getSession(request)?.role === 'admin';
const newId = () => 'T' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase();

// Técnicos que hacen las reparaciones. Se guardan dentro de la configuración (db/config.json).
export async function GET(request) {
  if (!isAdmin(request)) return json({ error: 'Solo un administrador puede ver los técnicos.' }, 401);
  try { return json({ technicians: (await getConfig()).technicians || [] }); } catch (e) { return fail(e); }
}

// Reemplaza la lista completa: { technicians: [{ id?, name, phone, email? }] }
export async function PUT(request) {
  if (!isAdmin(request)) return json({ error: 'Solo un administrador puede cambiar los técnicos.' }, 401);
  let b = {}; try { b = await request.json(); } catch {}
  if (!Array.isArray(b.technicians)) return json({ error: 'Formato inválido.' }, 400);
  const seen = new Set(), list = [];
  for (const t of b.technicians.slice(0, 50)) {
    const name = clean(t.name, 80), phone = cleanPhone(t.phone), email = clean(t.email, 160);
    if (!name) return json({ error: 'Falta el nombre del técnico.' }, 400);
    if (phone.length < 10) return json({ error: `El teléfono de ${name} tiene que llevar código de área, sin 0 ni 15. Ej.: 2974711779` }, 400);
    if (email && !isEmail(email)) return json({ error: `El email de ${name} no es válido.` }, 400);
    let id = /^T[A-Z0-9]{4,24}$/.test(String(t.id || '')) ? String(t.id) : newId();
    while (seen.has(id)) id = newId();
    seen.add(id);
    list.push({ id, name, phone, email });
  }
  try {
    const c = await getConfig();
    await saveConfig({ ...c, technicians: list });
    return json({ technicians: list });
  } catch (e) { return fail(e); }
}
