# Puente Service · Reparación de PC

Tienda de servicios de reparación con carrito, pago por Mercado Pago, panel de precios y gestión de usuarios.

## Cómo funciona un pedido

1. El cliente elige servicios y completa **nombre, apellido, celular con WhatsApp y dirección** (obligatorios), más email y detalle opcionales. No necesita usuario.
2. El pedido se guarda en el Blob (`orders/`) y le llega al administrador un **email** con los datos y un botón que abre el pedido en el Panel (`#/admin/<pedido>`).
3. Se le ofrece **registrarse** para ver su historial (usuario = su celular). Después aparece el botón **Pagar con Mercado Pago** con el monto para copiar.
4. El administrador toca **Aceptar trabajo** en la *Hoja de pedidos* y le escribe al cliente con el botón de WhatsApp (mensaje precargado). Después marca *pagado* y *terminado*.

La hoja de pedidos se puede filtrar por estado y exportar a CSV (abre en Excel o Google Sheets).

## Usuarios y roles

- **Administrador**: Panel (pedidos y precios), Configuración y Usuarios.
- **Visitante**: compra y ve *Mis pedidos*. Se registra solo al terminar un pedido, o lo crea un administrador.
- `ADMIN_USER` / `ADMIN_PASS` siguen funcionando como administrador de respaldo. Cambiá `ADMIN_PASS` por una contraseña propia.

## Configuración (pestaña Configuración)

- **WhatsApp de la tienda**: número del asistente flotante (por defecto 2974711779). Se escribe con código de área, sin 0 ni 15.
- **Mensaje de bienvenida** del asistente.
- **Email de avisos**: recibe un correo por cada pedido nuevo. Requiere `RESEND_API_KEY` en Vercel (cuenta gratis en resend.com). Sin dominio propio verificado, Resend solo entrega al email de la cuenta, que alcanza para los avisos al administrador. Opcional: `MAIL_FROM` con un remitente de un dominio verificado.
- **Link de cobro de Mercado Pago**. Si se carga `MP_ACCESS_TOKEN`, se genera un link con el monto exacto y el pago se marca solo por webhook.

## Publicarlo

1. **Subir el proyecto**: desde esta carpeta, `npx vercel --prod` (o subir la carpeta a GitHub e importarla en Vercel con *Add New → Project*). No necesita configuración: Vercel toma `vercel.json`.
2. **Crear la base de datos**: en el proyecto, pestaña *Storage → Create → Blob*, acceso **Private**, y *Connect* al proyecto. Eso agrega `BLOB_READ_WRITE_TOKEN` solo.
3. **Variables de entorno** (*Settings → Environment Variables*): `ADMIN_USER`, `ADMIN_PASS`, `SESSION_SECRET` (opcional: si falta se deriva del token del Blob). Cambiá la contraseña `Admin` por una propia.
4. **Mercado Pago (opcional)**: cargá `MP_ACCESS_TOKEN`. Con un token `TEST-...` los links son de prueba; con uno de producción cobran de verdad. Sin token, el carrito genera links de demostración y igual guarda el pedido.
5. *Redeploy* para que tome las variables.

## Rutas de la API

| Método | Ruta | Uso |
|---|---|---|
| GET | `/api/catalog` | Catálogo público |
| PUT | `/api/catalog` | Guardar precios (admin) · `{reset:true}` restaura el Excel |
| POST | `/api/login` / `/api/logout` | Sesión (cookie firmada con usuario y rol) |
| GET | `/api/me` | Sesión actual |
| GET/POST/PATCH/DELETE | `/api/users` | Gestión de usuarios (admin) |
| GET / PUT / POST | `/api/config` | Configuración pública y de admin; POST envía un email de prueba |
| POST | `/api/register` | Registro del cliente a partir de su pedido |
| POST | `/api/checkout` | Pedido público con datos obligatorios; recalcula precios, guarda y avisa por email |
| GET / PATCH | `/api/orders` | Admin: todos y cambio de estado. Cliente: sus pedidos |
| POST | `/api/mp-webhook` | Mercado Pago avisa pagos y se actualiza el estado del pedido |
