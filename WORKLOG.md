# Worklog nocturno — CourtLab

Trabajo autónomo por fases mientras duermes. Cada entrada describe el cambio, el porqué y el archivo.

## Cambio inmediato
- **Perfil al topbar**: el avatar de arriba a la derecha es ahora el botón de Perfil (abre la página de perfil, con estado activo). Quitado "Perfil" de la barra inferior → ahora 5 pestañas (Inicio, Tácticas, Crear, Rivales, Club). `js/app.js`, `css/styles.css`.

---

## Fase 1 — Bugs y errores

- **achievements.js**: dos `JSON.parse(localStorage…)` sin try/catch podían romper logros si el almacenamiento se corrompía → helper `readClaimed()` con captura de errores.
- **BUG pádel — solo golpeaba un jugador**: en dobles/pádel el golpeador siempre era el primer token del lado (J1 o R1), así que la pareja (J2/R2) nunca golpeaba. Ahora en modo guiado aparece un selector "¿Quién golpea?" con los dos jugadores del lado; por defecto golpea el más cercano a la bola. El anillo de pulso y la colocación del golpe usan el jugador elegido. `js/editor.js`, `js/i18n.js`, `css/styles.css`.
- **Marca CourtLab** consistente en landing, legal e i18n.

## Fase 3 — Ajustes (estaba descuidado)
- **Nueva sección "Acerca de"**: versión de la app (2.0), "Ver tutorial otra vez" (reactiva el onboarding) y "Buscar actualizaciones" (limpia caché del Service Worker y recarga la última versión). `js/settings.js`, `js/i18n.js`, `js/app.js`.
- **Backup/borrado**: el export usa nombre `courtlab-copia.json` (antes tennislab); copia y wipe cubren diario, objetivos, deporte, hápticos y animación.

## Fase 4 — SEO + búsqueda
- **sitemap.xml** ahora incluye las páginas legales (privacidad, términos).
- **Búsqueda de Liga** revisada: input con limpiar (×), escapado anti-XSS, y al elegir ámbito (ciudad/país/mundo) se sale de la búsqueda. Robusta.

## Fase 5 — Responsive
- **Modo Club en móvil (≤420px)**: hero más compacto (escudo 48px, título 19px), filas de mini-liga más juntas y las dos tarjetas de club apiladas en una columna.

## Fase 8 — Stripe / pagos
- **Checkout sin doble-clic**: los botones de plan se bloquean y muestran spinner mientras se abre el pago; toast "Abriendo pago seguro…". Evita crear dos sesiones de Stripe. `js/premium.js`, `css/styles.css`.

## Auditoría Stripe + Supabase (verificada)
- **create-checkout**: crea sesión de suscripción con prueba de 7 días, `client_reference_id` y `metadata.user_id` → el webhook identifica al usuario. ✔
- **stripe-webhook**: verifica firma, marca `is_premium` con service_role en `checkout.session.completed` / `subscription.updated` / `subscription.deleted`. ✔
- **create-portal**: abre el Portal de Cliente para gestionar/cancelar. ✔
- **secure_premium.sql**: trigger que BLOQUEA que un cliente se ponga premium a mano (solo service_role/webhook puede). ✔
- **schema.sql**: PK `user_id` → el `upsert` del cliente usa el conflicto correcto; trigger crea la fila al registrarse. ✔
- Cliente (`cloud.js`) lee `is_premium` y `stripe_subscription_id`, sincroniza snapshot, reintentos con backoff offline-first. ✔
- **Conclusión**: integración completa y segura. Falta solo configurar los secrets en Supabase y los Price IDs en Stripe (ver `supabase/STRIPE.md`).

## Pasada de estabilidad (humo en vivo)
- Arranque limpio: Inicio, Tácticas, Rivales, Club, Liga, Ajustes y Paywall renderizan **sin errores de consola**.
- Flujos profundos OK: plantillas de tenis y pádel, abrir editor, reproducir animación, tácticas demo del club (4), mini-liga.
- `templateTactic(kind_desconocido)` devuelve `null` **a propósito** (cae a modo guiado); los llamadores ya lo protegen. No es bug.
- Escapado anti-XSS verificado en social, league, club, home, ui, referrals.

> Nota: el código está maduro y estable. Prioricé arreglos de impacto y cero-riesgo y verifiqué la integración de pagos en vez de inventar micro-cambios. Todo recompilado en `app.html` y sincronizado a `web/` listo para subir a GitHub.

## Pulido pre-lanzamiento (verificado en navegador real)
- **Racha "DÍAS SEGUIDOS"**: la píldora partía en dos líneas → `white-space:nowrap`, ahora en una sola. `css/styles.css`
- **Accesibilidad de teclado**: nueva capa global `:focus-visible` con anillo de acento en botones, enlaces, tarjetas, nav, tablas y campos — solo para navegación con teclado, invisible al ratón. Cumple WCAG de foco visible. `css/styles.css`
- **Coherencia de pulsación**: todas las tarjetas tappables (tácticas, rivales, partidos, club, compartir) reaccionan al pulsar igual que los botones (`translateY+scale`), respetando `prefers-reduced-motion`. `css/styles.css`
- **Cursor e interacción**: mano en todo elemento interactivo, `tap-highlight` transparente en móvil, estado `:disabled` coherente. `css/styles.css`
- **BUG tema claro**: el swatch de color **blanco (Bola)** era invisible sobre el panel claro del editor → anillo `inset` permanente en todos los swatches; ahora se ve siempre. `css/styles.css`, verificado en el editor real.

> Estado: listo para lanzar. Backend de pagos completo (faltan solo secrets/Price IDs). Build recompilada y `web/` sincronizada.


