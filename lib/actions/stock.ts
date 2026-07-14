"use server";

// Server Action para registo de saída de stock
// NOTA: Este ficheiro usa o cliente supabase com anon key - para operações admin
// sensíveis, considerar usar o service_role key.
import { createClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';

export async function registarSaidaStock(formData: FormData) {
  // Usar service role no servidor para evitar RLS issues
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const produtoId = formData.get('produtoId')?.toString();
  const quantidadeRaw = formData.get('quantidade');
  const destino = formData.get('destino')?.toString();

  const qtdParaRetirar = Number(quantidadeRaw);

  if (!produtoId || !qtdParaRetirar || isNaN(qtdParaRetirar)) {
    return { error: "Dados inválidos. Verifique o formulário." };
  }

  // 1. Registar na tabela de MOVIMENTOS (Auditoria)
  const { error: erroMovimento } = await supabaseAdmin
    .from('movimentos')
    .insert([
      { 
        produto_id: produtoId, 
        quantidade: qtdParaRetirar, 
        tipo: 'Saída', 
        destino: destino,
        data_movimento: new Date().toISOString()
      }
    ]);

  if (erroMovimento) {
    console.error("Erro na auditoria:", erroMovimento.message);
    return { error: "Não foi possível registar o movimento." };
  }

  // 2. Atualizar a tabela de PRODUTOS (Baixar o stock)
  const { data: produtoAtual, error: erroFetchProduto } = await supabaseAdmin
    .from('produtos')
    .select('quantidade')
    .eq('id', produtoId)
    .single();

  if (erroFetchProduto) {
    return { error: "Produto não encontrado." };
  }

  if (produtoAtual) {
    const novaQuantidade = produtoAtual.quantidade - qtdParaRetirar;

    const { error: erroUpdate } = await supabaseAdmin
      .from('produtos')
      .update({ quantidade: novaQuantidade })
      .eq('id', produtoId);
      
    if (erroUpdate) {
        return { error: "Falha ao atualizar o stock final." };
    }
  }

  // Atualizar o ecrã
  revalidatePath('/');
  return { success: true };
}
