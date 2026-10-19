import { json, fail, isAdmin, getCatalog, saveCatalog, seedCatalog } from './_lib/store.js';

const seedPrices = Object.fromEntries(seedCatalog().items.map((i) => [i.id, i.price]));
export async function GET() { return json({ ...(await getCatalog()), seedPrices }); }

export async function PUT(request) {
  if (!isAdmin(request)) return json({ error: 'Iniciá sesión para guardar precios.' }, 401);
  let b; try { b = await request.json(); } catch { return json({ error: 'JSON inválido' }, 400); }
  try {
  if (b && b.reset) return json(await saveCatalog(seedCatalog()));
  if (!b || !Array.isArray(b.items) || !Array.isArray(b.hours)) return json({ error: 'Formato inválido' }, 400);
  const items = b.items.slice(0, 1000).map((i) => ({
    id: Number(i.id), cat: String(i.cat || '').slice(0, 80), name: String(i.name || '').slice(0, 160),
    price: i.price == null || i.price === '' ? null : Math.max(0, Math.round(Number(i.price) || 0)),
    unit: String(i.unit || '').slice(0, 80), note: String(i.note || '').slice(0, 300), active: i.active !== false,
  })).filter((i) => i.id && i.name);
  const hours = b.hours.slice(0, 20).map((h) => ({ t: String(h.t || '').slice(0, 80), v: Math.max(0, Math.round(Number(h.v) || 0)), n: String(h.n || '').slice(0, 200) }));
  return json(await saveCatalog({ items, hours }));
  } catch (e) { return fail(e); }
}
