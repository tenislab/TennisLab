# 💳 Activar pagos con Stripe — Guía paso a paso

> TUS DATOS (ya rellenados):
> - Proyecto Supabase: `kgnfmebprdqebpuhljat`
> - Price MENSUAL (2,99 €): `price_1Tj3edAFoCy0FvpRfF0Hj2Rp`
> - Price ANUAL (22,99 €): `price_1Tj3fBAFoCy0FvpRD8WXJe6R`
> - Price PLAN CLUB: `price_1TkQLcAFoCy0FvpRbNnnVP0l`
> - Webhook URL: `https://kgnfmebprdqebpuhljat.supabase.co/functions/v1/stripe-webhook`

Tiempo: ~30-40 min. Todo es **gratis** salvo la comisión por venta (~1,5% + 0,25 € por cobro) y el dominio (~12 €/año).

> Antes de esto debes tener la **nube de Supabase** funcionando (ver `supabase/schema.sql`) y haberte registrado en la app con tu email.

---

## 1. Crear los productos en Stripe  ✅ HECHO
Ya creaste "Premium mensual" y "Premium anual" en modo prueba.

## 1b. Crear el producto del PLAN CLUB  ⚠️ PENDIENTE
El Plan Club (jugadores ilimitados para entrenadores) es una suscripción aparte.
1. Stripe → **Productos → Add product**. Nombre: "CourtLab Plan Club".
2. Precio recurrente **mensual** (p. ej. 14,99 €/mes) → Save.
3. Copia el **Price ID** (`price_...`) — lo usas en el paso 4 como `STRIPE_PRICE_CLUB`.

## 2. Instalar la CLI de Supabase (una vez)  ✅ HECHO
```bash
npm install -g supabase
supabase login
supabase link --project-ref kgnfmebprdqebpuhljat
```

## 3. Subir las funciones
Las funciones ya están en `supabase/functions/`. Desde la carpeta del proyecto:
```bash
supabase functions deploy create-checkout
supabase functions deploy stripe-webhook --no-verify-jwt
```

## 4. Configurar los secretos (claves)
```bash
supabase secrets set STRIPE_PRICE_MONTH=price_1Tj3edAFoCy0FvpRfF0Hj2Rp
supabase secrets set STRIPE_PRICE_YEAR=price_1Tj3fBAFoCy0FvpRD8WXJe6R
supabase secrets set STRIPE_PRICE_CLUB=price_1TkQLcAFoCy0FvpRbNnnVP0l
supabase secrets set APP_URL=http://localhost:8000
supabase secrets set STRIPE_SECRET_KEY=sk_test_...          # Stripe → Desarrolladores → Claves de API
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...          # Supabase → Settings → API → service_role
```
> ⚠️ La `service_role key` y la `STRIPE_SECRET_KEY` son **secretas**: NUNCA van en la app ni en GitHub. Solo aquí.

## 5. Crear el webhook en Stripe
1. **Developers → Webhooks → Add endpoint**.
2. URL: `https://kgnfmebprdqebpuhljat.supabase.co/functions/v1/stripe-webhook`
3. Eventos a escuchar:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. Copia el **Signing secret** (`whsec_...`) y guárdalo:
```bash
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
```

## 6. Probar
1. Abre la app (hospedada en tu dominio o `localhost`), **inicia sesión**.
2. **Ajustes → Hazte Premium → elige un plan** → te lleva a la página de pago de Stripe.
3. En modo test usa la tarjeta **4242 4242 4242 4242**, fecha futura, CVC cualquiera.
4. Al pagar, Stripe avisa al webhook → tu cuenta queda **Premium** automáticamente. 🎉

---

## Notas
- **Plan Club:** lo paga el **entrenador (dueño del club)** desde *Club → Ampliar*. Al pagar, el webhook pone `plan='pro'` en su club y se desbloquean los jugadores ilimitados. Si cancela, vuelve a `free` (4 jugadores). Requiere ejecutar antes `supabase/club_plan_schema.sql`.
- **Modo test vs live:** mientras pruebas usa claves `sk_test_...`. Para cobrar de verdad, repite con las `sk_live_...` y completa la verificación de tu negocio en Stripe.
- **Cancelaciones:** si un cliente cancela, Stripe manda `customer.subscription.deleted` y el webhook le quita el premium solo.
- **Sin servidor propio:** todo corre en las Edge Functions de Supabase (gratis hasta 500.000 llamadas/mes).
- El **código admin** `TL-ADMIN-2026` te da premium sin pasar por Stripe (para ti).
