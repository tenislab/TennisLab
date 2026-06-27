// ============================================================
// Supabase Edge Function: create-checkout
// Crea una sesión de Stripe Checkout para el usuario logueado
// y devuelve la URL a la que redirigir.
// ------------------------------------------------------------
// Desplegar:  supabase functions deploy create-checkout
// Secrets necesarios (supabase secrets set ...):
//   STRIPE_SECRET_KEY      = sk_live_... (o sk_test_...)
//   STRIPE_PRICE_MONTH     = price_xxx   (precio mensual individual)
//   STRIPE_PRICE_YEAR      = price_yyy   (precio anual individual)
//   STRIPE_PRICE_CLUB      = price_zzz   (precio del Plan Club — jugadores ilimitados)
//   APP_URL                = https://tudominio.com  (a dónde vuelve tras pagar)
// ============================================================
import Stripe from 'https://esm.sh/stripe@14?target=denonext';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});
const APP_URL = Deno.env.get('APP_URL') ?? 'http://localhost:8000';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const { plan, club_id } = await req.json();              // 'month' | 'year' | 'club'
    const isClub = plan === 'club';
    const price = isClub
      ? Deno.env.get('STRIPE_PRICE_CLUB')!
      : plan === 'year'
        ? Deno.env.get('STRIPE_PRICE_YEAR')!
        : Deno.env.get('STRIPE_PRICE_MONTH')!;

    // identificar al usuario por su token de Supabase
    const supa = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } },
    );
    const { data: { user } } = await supa.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: 'no auth' }), { status: 401, headers: cors });

    // El Plan Club exige un club_id; además verificamos que quien paga es el dueño
    if (isClub) {
      if (!club_id) return new Response(JSON.stringify({ error: 'no club_id' }), { status: 400, headers: cors });
      const { data: c } = await supa.from('clubs').select('owner_id').eq('id', club_id).maybeSingle();
      if (!c || c.owner_id !== user.id) {
        return new Response(JSON.stringify({ error: 'not club owner' }), { status: 403, headers: cors });
      }
    }

    // metadata distinto según el tipo de pago (el webhook lo usa para saber qué activar)
    const md = isClub
      ? { user_id: user.id, kind: 'club', club_id }
      : { user_id: user.id, kind: 'premium' };

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price, quantity: 1 }],
      customer_email: user.email,
      client_reference_id: user.id,                          // ← clave para el webhook
      metadata: md,
      // el plan individual lleva 7 días de prueba; el Plan Club se cobra desde el inicio
      subscription_data: isClub
        ? { metadata: md }
        : { metadata: md, trial_period_days: 7 },
      success_url: isClub ? `${APP_URL}/app.html?club=ok` : `${APP_URL}/app.html?premium=ok`,
      cancel_url: isClub ? `${APP_URL}/app.html?club=cancel` : `${APP_URL}/app.html?premium=cancel`,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 400, headers: cors });
  }
});
