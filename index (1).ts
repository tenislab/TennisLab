# CourtLab — Actualización: PWA, Club v2, GIF y recordatorios

Pasos para dejar todo funcionando tras esta actualización. Lo de Supabase
es rápido (pegar SQL). Lo del email es **opcional**.

## 1) Subir los archivos nuevos a GitHub (carpeta `web/`)
Sube/actualiza en tu repo (rama de GitHub Pages):
- `app.html` (recompilada)
- `index.html`, `manifest.webmanifest`, `sw.js`
- la carpeta `icons/` (icon-192.png, icon-512.png, maskable-512.png, apple-touch-icon.png)
- `sitemap.xml`
- la carpeta `js/` y `css/styles.css` si despliegas sin bundle

> Con eso ya tienes: **PWA instalable** (icono en pantalla de inicio + offline),
> **GIF animado** para WhatsApp, **head-to-head destacado**, **punto rojo** en Club,
> **tablón del club** y **"quién vió cada jugada"** (estos dos últimos necesitan el SQL del paso 2).

## 2) Supabase — Club v2 (obligatorio para tablón + vistas)
Supabase → **SQL Editor** → New query → pega **todo** `supabase/update_club_v2.sql` → **Run**.
Es seguro repetirlo. Añade:
- columna `notice` en `clubs` (el tablón)
- tabla `club_tactic_views` con sus permisos (quién vió cada táctica)

Sin este paso, el tablón y el contador 👁 simplemente no aparecen; el resto funciona igual.

## 3) (Opcional) Recordatorio de fin de prueba por email
Recupera a quien se olvida de la prueba. Necesitas una cuenta gratis en **Resend** (resend.com, 3.000 emails/mes).

1. En Resend: crea una API key y verifica un remitente (un dominio, o usa `onboarding@resend.dev` para probar).
2. Secrets en Supabase (terminal):
   ```
   supabase secrets set RESEND_API_KEY=re_xxx
   supabase secrets set RESEND_FROM="CourtLab <hola@tudominio.com>"
   supabase secrets set CRON_SECRET=una-cadena-larga-secreta
   supabase secrets set APP_URL=https://tenislab.github.io/TennisLab
   ```
3. Despliega la función:
   ```
   supabase functions deploy trial-reminder --no-verify-jwt
   ```
4. SQL Editor → pega `supabase/trial_reminder_cron.sql`, cambia `<PROJECT_REF>` y `<CRON_SECRET>` por los tuyos → **Run**.

El webhook de Stripe debe guardar `trial_ends_at` al iniciar la prueba (si no lo hace aún, el aviso del día 5/7 del cliente sigue funcionando dentro de la app).

---

### Qué se añadió en la app (sin tocar nada más)
| Función | Dónde | Necesita Supabase |
|---|---|---|
| PWA instalable + offline | móvil/tablet "Añadir a inicio" | no |
| Exportar **GIF** animado | Compartir → Exportar GIF | no |
| **Head-to-head** destacado | Ficha de rival (titular arriba) | no |
| **Punto rojo** "nuevo" en Club | barra inferior | sí (ya estaba) |
| **Tablón** del club | arriba en Club (lo fija el coach) | sí — paso 2 |
| **Quién vió** cada jugada (👁) | lista de tácticas del club (coach) | sí — paso 2 |
| Recordatorio fin de prueba **por email** | automático | opcional — paso 3 |
