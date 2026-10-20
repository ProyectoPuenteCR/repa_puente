// Envío de emails con Resend (https://resend.com). Requiere RESEND_API_KEY en Vercel.
// Sin dominio verificado, Resend solo entrega al email de la cuenta: alcanza para los avisos al administrador.
export const mailReady = () => !!process.env.RESEND_API_KEY;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => '$ ' + Math.round(n).toLocaleString('es-AR');

export async function sendMail({ to, subject, html }) {
  if (!mailReady() || !to) return false;
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: process.env.MAIL_FROM || 'Puente Service <onboarding@resend.dev>', to: [to], subject, html }),
  });
  if (!r.ok) { console.error('mail error', r.status, await r.text().catch(() => '')); return false; }
  return true;
}

export function orderEmail(o, origin) {
  const url = `${origin}/#/admin/${encodeURIComponent(o.id)}`;
  const rows = o.lines.map((l) => `<tr><td style="padding:4px 0">${esc(l.title)}${l.quantity > 1 ? ' ×' + l.quantity : ''}</td><td style="padding:4px 0;text-align:right">${money(l.unit_price * l.quantity)}</td></tr>`).join('');
  const html = `<div style="font-family:Arial,sans-serif;max-width:560px;color:#1f1f1f">
  <h2 style="color:#0050A0;margin:0 0 4px">Se solicitó un servicio</h2>
  <p style="margin:0 0 16px;color:#555">Pedido <b>${esc(o.id)}</b> · ${new Date(o.createdAt).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })}</p>
  <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:12px">
    <tr><td style="color:#555;width:120px">Cliente</td><td><b>${esc(o.name)}</b></td></tr>
    <tr><td style="color:#555">Celular</td><td>${esc(o.phone)}</td></tr>
    <tr><td style="color:#555">Dirección</td><td>${esc(o.address)}</td></tr>
    ${o.email ? `<tr><td style="color:#555">Email</td><td>${esc(o.email)}</td></tr>` : ''}
    ${o.home ? `<tr><td style="color:#555">Domicilio</td><td>Pidió retiro y entrega</td></tr>` : ''}
  </table>
  ${o.detalle ? `<p style="background:#F3F6FA;padding:10px 12px;border-radius:6px;font-size:14px;margin:0 0 12px"><b>Detalle:</b> ${esc(o.detalle)}</p>` : ''}
  <table style="width:100%;border-collapse:collapse;font-size:14px;border-top:1px solid #ddd">${rows}
    <tr><td style="padding-top:8px;border-top:1px solid #ddd"><b>Total</b></td><td style="padding-top:8px;border-top:1px solid #ddd;text-align:right"><b>${money(o.total)}</b></td></tr></table>
  <p style="margin:20px 0"><a href="${url}" style="background:#0050A0;color:#fff;text-decoration:none;padding:12px 18px;border-radius:6px;font-weight:bold;display:inline-block">Ver el pedido y aceptarlo</a></p>
  <p style="font-size:12px;color:#777">Si el botón no funciona, abrí: ${esc(url)}</p></div>`;
  return { subject: `Nuevo pedido ${o.id} de ${o.name} (${money(o.total)})`, html };
}
