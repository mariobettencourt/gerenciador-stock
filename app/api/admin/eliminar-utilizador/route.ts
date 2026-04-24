// app/api/admin/eliminar-utilizador/route.ts
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { id } = await request.json();

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // 1. Apagar o utilizador do motor de Autenticação (Auth)
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(id);
    if (authError) throw authError;

    // 2. O perfil na tabela pública será apagado automaticamente se tiveres 
    -- o "ON DELETE CASCADE" configurado na BD, caso contrário:
    const { error: profileError } = await supabaseAdmin
      .from("perfis")
      .delete()
      .eq("id", id);
    
    if (profileError) throw profileError;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}