import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  // OS LOGS DE DIAGNÓSTICO ENTRAM AQUI (DENTRO DA FUNÇÃO)
  console.log("DEBUG ENV -> URL:", process.env.NEXT_PUBLIC_SUPABASE_URL ? "OK" : "Vazio");
  console.log("DEBUG ENV -> KEY:", process.env.SUPABASE_SERVICE_ROLE_KEY ? "OK" : "Vazio");

  try {
    const { email, password, nome, cargo } = await request.json();

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRole) {
      return NextResponse.json(
        { error: "Configuração do servidor incompleta (.env)" }, 
        { status: 500 }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRole, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      user_metadata: { nome, cargo },
      email_confirm: true
    });

    if (error) {
      console.error("Erro Supabase Auth:", error.message);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data });

  } catch (err: any) {
    console.error("Erro interno na API:", err.message);
    return NextResponse.json({ error: "Erro interno no servidor" }, { status: 500 });
  }
}