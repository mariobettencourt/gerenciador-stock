"use server";

// IMPORTAÇÃO CORRIGIDA: Aponta para o ficheiro que tu já tens no projeto!
import { supabase } from '@/lib/supabase'; 
import { revalidatePath } from 'next/cache';

export async function registarSaidaStock(formData: FormData) {
  // Já não precisamos do 'const supabase = await createClient()' 
  // porque já importámos a variável 'supabase' diretamente acima.

  const produtoId = formData.get('produtoId')?.toString();
  const quantidadeRaw = formData.get('quantidade');
  const destino = formData.get('destino')?.toString();

  const qtdParaRetirar = Number(quantidadeRaw);

  if (!produtoId || !qtdParaRetirar || isNaN(qtdParaRetirar)) {
    return { error: "Dados inválidos. Verifique o formulário." };
  }

  // 1. Registar na tabela de MOVIMENTOS (Auditoria)
  const { error: erroMovimento } = await supabase
    .from('movimentos')
    .insert([
      { 
        produto_id: produtoId, 
        quantidade: qtdParaRetirar, 
        tipo: 'saida', 
        destino: destino, // Certifica-te que tens esta coluna na BD!
        data_movimento: new Date().toISOString()
      }
    ]);

  if (erroMovimento) {
    console.error("Erro na auditoria:", erroMovimento.message);
    return { error: "Não foi possível registar o movimento." };
  }

  // 2. Atualizar a tabela de PRODUTOS (Baixar o stock)
  const { data: produtoAtual, error: erroFetchProduto } = await supabase
    .from('produtos')
    .select('quantidade')
    .eq('id', produtoId)
    .single();

  if (erroFetchProduto) {
    return { error: "Produto não encontrado." };
  }

  if (produtoAtual) {
    const novaQuantidade = produtoAtual.quantidade - qtdParaRetirar;

    const { error: erroUpdate } = await supabase
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