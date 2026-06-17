# TennisLab

Pizarra táctica de tenis: crea, anima y comparte jugadas; gestiona rivales y partidos.
App web (HTML), con cuentas y nube (Supabase) y pagos (Stripe).

## Estructura
- `index.html` — Landing page (página de inicio pública, con SEO).
- `app.html` — La aplicación completa (un solo archivo, autocontenida).
- `og-image.png` — Imagen para redes/Google.
- `icon.svg` — Favicon.
- `robots.txt`, `sitemap.xml` — SEO.
- `legal/` — Privacidad y términos.
- `supabase/` — Esquema SQL, guía de Stripe y funciones (referencia; ya desplegadas en Supabase).

## Publicar en GitHub Pages
1. Sube **todo el contenido de esta carpeta** al repositorio (manteniendo las subcarpetas `legal/` y `supabase/`).
2. En el repo: **Settings → Pages → Source: "Deploy from a branch" → branch `main` / `/root`**.
3. Tu web quedará en `https://<usuario>.github.io/<repo>/`.

> ⚠️ IMPORTANTE: las direcciones de SEO están puestas para `https://jrrjaime.github.io/TennisLab/`.
> Si el repositorio se llama distinto, hay que actualizar esas URLs en `index.html`, `sitemap.xml` y `robots.txt`.

## Tras publicar (para que login y pago vuelvan a la web)
- `supabase secrets set APP_URL=https://<tu-web>`
- Supabase → Authentication → URL Configuration → Site URL = tu web.
