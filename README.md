# 🎾 CourtLab

Pizarra táctica de tenis: **crea, anima, guarda y comparte jugadas** sobre una pista interactiva. Pensada para jugadores y entrenadores, en móvil, tablet y ordenador.

## ✨ Funciones

- **Modo guiado**: la app te dirige golpe a golpe (saque → resto → …) y construyes el punto solo tocando la pista. Elige quién saca y **cómo pegas cada bola** (plana, cortado, liftada, globo, dejada).
- **Animación** con easing realista, velocidad lento/normal/rápido, línea de tiempo por pasos.
- **Modo avanzado**: dibujo libre (trayectorias, flechas, líneas, puntos, texto), varios jugadores.
- **4 superficies** (tierra, rápida, hierba, indoor) y vista pista completa / media pista.
- **Carpetas**, nombre y número de jugada; **rivales** con ficha de scouting y **estadísticas** (% ganados, táctica top); **partidos** con tácticas asociadas, resultado y análisis.
- **Exportar**: imagen PNG por pasos, hoja PDF, **vídeo WebM animado**; compartir por WhatsApp/correo.
- **Tema claro/oscuro**, bilingüe ES/EN, copia de seguridad (exportar/importar JSON), instalable (PWA).

## 🚀 Usar / desplegar

Es una web estática: no necesita servidor.

- **Local (desarrollo)**: abre `JRR Tennis Lab.html` — carga los módulos sueltos de `js/` y `css/`. Edita aquí.
- **Deploy**: la carpeta `web/` es el sitio publicado. Contiene la landing (`index.html`), el **bundle autocontenido** (`app.html`) y los estáticos.
- **Netlify/Vercel**: arrastra la carpeta `web/` y listo. (GitHub Pages: sirve desde `web/`.)

Los datos se guardan en el navegador de cada usuario (`localStorage`).

## 📁 Estructura

**Fuente (editar aquí):**
```
JRR Tennis Lab.html      ← entrada de desarrollo (carga los js/ sueltos)
index.html               ← landing / portada
css/styles.css           ← sistema de diseño + temas claro/oscuro
js/
  icons.js               ← set de iconos SVG inline
  i18n.js                ← textos ES/EN
  court.js               ← geometría/render de la pista (coordenadas en metros)
  store.js               ← datos (tácticas, carpetas, rivales, partidos) — capa única
  animation.js           ← reproducción animada
  editor.js              ← editor guiado + avanzado
  modals.js              ← guardar/compartir/exportar (PNG, PDF, vídeo)
  rivals.js / matches.js ← rivales y partidos
  settings.js            ← ajustes (tema, idioma, copias de seguridad)
  premium.js             ← plan free/premium y límites
  cloud.js               ← capa Supabase PREPARADA (inactiva)
  social.js / club.js    ← perfil social y modo club
  extras.js              ← atajos, onboarding, plantillas
  planner.js             ← calendario, diario y objetivos
  home.js                ← dashboard + biblioteca
  app.js                 ← controlador: topbar, routing, toast, init
supabase/                ← esquemas SQL + functions (Stripe) + docs
manifest.webmanifest, sw.js, icon.svg  ← PWA instalable
```

**Artefacto generado (no editar a mano):**
```
app.html                 ← bundle autocontenido (todo js/css/assets en un archivo)
web/                      ← carpeta de deploy (landing + app.html + estáticos)
```
Para regenerar el bundle: empaqueta `JRR Tennis Lab.html` → `web/app.html` (y copia a la raíz si quieres). No edites `app.html` directamente; edita la fuente y vuelve a empaquetar.

## ☁️ Conectar a Supabase (cuentas + nube + enlaces reales)

La app funciona sin backend; para multi-dispositivo y compartir entre personas:

1. Crea un proyecto en [supabase.com](https://supabase.com) (gratis).
2. **SQL Editor** → pega y ejecuta `supabase/schema.sql` (crea tablas + reglas: cada usuario solo ve lo suyo, y enlaces privados por token).
3. Copia la **URL** y la **anon key** (Settings → API) en `js/cloud.js` y pon `enabled: true`.
4. Añade el cliente oficial antes de `cloud.js`:
   `<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>`
5. Implementa el espejo de `TL.store` siguiendo el **mapa de migración** comentado en `js/cloud.js` (cada función local tiene su consulta equivalente). Recomendado: localStorage como caché offline + sincronización al guardar.

Con eso tienes: login, datos en la nube en todos los dispositivos y **enlaces de solo lectura reales** (`#share=<token>`).

### 🔗 Enlaces públicos + OG dinámico
Para que compartir una táctica muestre preview (título/imagen) en WhatsApp/redes y la abra cualquiera: ejecuta `supabase/share_schema.sql`, despliega la función `share` (`supabase functions deploy share --no-verify-jwt`) y sigue **`supabase/SHARE.md`**.

---

Hecho con 🎾 — CourtLab.
