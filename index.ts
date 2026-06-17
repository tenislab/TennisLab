# 🏛️ Modo Club — Guía (Supabase)

El **Modo Club** deja que un entrenador comparta tácticas con sus jugadores.
El código de la app **ya está listo**; solo falta activar las tablas en Supabase.

## Paso único: crear las tablas
1. Entra en **Supabase → SQL Editor → New query**.
2. Abre `supabase/club_schema.sql`, copia **todo** y pégalo.
3. Pulsa **Run** → debe decir *Success*.

Con eso, en la app (Premium + sesión iniciada) → **Ajustes → Modo Club → Abrir Club** funciona:

## Cómo se usa
- **Entrenador:** *Crear club* → la app genera un **código** (ej. `ABC123`). Comparte ese código con tus jugadores. Pulsa *Compartir táctica* para publicar jugadas al club, y ves la lista de *Jugadores*.
- **Jugador:** *Unirse a un club* → mete el código del entrenador. Verá las tácticas del club y podrá *Añadir a las mías* para tenerlas en su biblioteca.

## Requisitos
- El usuario debe **haber iniciado sesión** (cuenta en la nube).
- Es función **Premium** (tiene candado). Tú, con el código admin `TL-ADMIN-2026` o tu cuenta marcada premium, lo ves sin pagar.

## Notas / siguiente fase (opcional)
Esta es la **versión 1 (biblioteca compartida)**. Más adelante se puede ampliar con:
- Asignar una táctica a un jugador concreto ("para tu partido del sábado").
- Panel del entrenador con los próximos partidos y estadísticas de cada jugador.
- **Plan Club** en Stripe (precio para equipos, ej. 19,99 €/mes).

> Cuando quieras la fase 2 o el plan Club en Stripe, avísame y lo preparamos.
