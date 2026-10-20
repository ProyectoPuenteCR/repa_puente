import { json, fail, getSession, getConfig, saveConfig, cleanPhone } from './_lib/store.js';
import { mailReady, sendMail } from './_lib/mail.js';

const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

export async function GET(request) {
  try {
    const c = await getConfig(), s = getSession(request);
    const pub = { whatsapp: c.whatsapp, botGreeting: c.botGreeting, mpLink: c.mpLink };
    if (s?.role !== 'admin') return json(pub);
    return json({ ...pub, notifyEmail: c.notifyEmail, mailReady: mailReady() });
  } catch (e) { return fail(e); }
}

export async function PUT(request) {
  if (getSession(request)?.role !== 'admin') return json({ error: 'Solo un administrador puede cambiar la configuración.' }, 401);
  let b = {}; try { b = await request.json(); } catch {}
  const whatsapp = cleanPhone(b.whatsapp), notifyEmail = String(b.notifyEmail || '').trim().slice(0, 160);
  const botGreeting = String(b.botGreeting || '').trim().slice(0, 300), mpLink = String(b.mpLink || '').trim().slice(0, 300);
  if (whatsapp.length < 10) return json({ error: 'El WhatsApp tiene que tener código de área, sin 0 ni 15. Ej.: 2974711779' }, 400);
  if (notifyEmail && !isEmail(notifyEmail)) return json({ error: 'El email de avisos no es válido.' }, 400);
  if (!/^https:\/\/[^\s]+$/.test(mpLink)) return json({ error: 'El link de Mercado Pago tiene que empezar con https://' }, 400);
  try {
    const c = await getConfig();
    const next = { ...c, whatsapp, notifyEmail, botGreeting: botGreeting || c.botGreeting, mpLink };
    await saveConfig(next);
    return json({ ok: true, whatsapp, notifyEmail, botGreeting: next.botGreeting, mpLink, mailReady: mailReady() });
  } catch (e) { return fail(e); }
}

// Email de prueba: { test: true }
export async function POST(request) {
  if (getSession(request)?.role !== 'admin') return json({ error: 'Solo un administrador.' }, 401);
  if (!mailReady()) return json({ error: 'Falta cargar RESEND_API_KEY en Vercel para enviar emails.' }, 400);
  try {
    const c = await getConfig();
    if (!c.notifyEmail) return json({ error: 'Primero guardá el email que recibe los avisos.' }, 400);
    const ok = await sendMail({ to: c.notifyEmail, subject: 'Prueba de avisos · Puente Service', html: '<p>Los avisos de pedidos nuevos van a llegar a este email.</p>' });
    return ok ? json({ ok: true }) : json({ error: 'Resend rechazó el envío. Revisá la API key y que el email sea el de tu cuenta de Resend.' }, 502);
  } catch (e) { return fail(e); }
}
