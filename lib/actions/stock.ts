import { createClient } from '@/utils/supabase/server'; // Importa a ligação ao Supabase
import { revalidatePath } from 'next/cache'; // Serve para atualizar a página automaticamente

export async function registarSaidaStock(formData: FormData) {
  const supabase = await createClient();

  // 1. Ir buscar os dados que o utilizador escreveu no formulário
  const produtoId = formData.get('produtoId');
  const qtdParaRetirar = Number(formData.get('quantidade'));
  const destino = formData.get('destino');

  // 2. Primeiro Passo: Registar na tabela de MOVIMENTOS (Auditoria)
  const { error: erroMovimento } = await supabase
    .from('movimentos')
    .insert([
      { 
        produto_id: produtoId, 
        quantidade: qtdParaRetirar, 
        tipo: 'saida', 
        destino: destino,
        data_movimento: new Date().toISOString()
      }
    ]);

  if (erroMovimento) {
    console.error("Erro na auditoria:", erroMovimento.message);
    return { error: "Não foi possível registar o movimento." };
  }

  // 3. Segundo Passo: Atualizar a tabela de PRODUTOS (Baixar o stock)
  // Nota: Isto é uma versão simplificada. Depois podemos fazer um cálculo mais seguro.
  const { data: produtoAtual } = await supabase
    .from('produtos')
    .select('quantidade')
    .eq('id', produtoId)
    .single();

  if (produtoAtual) {
    const novaQuantidade = produtoAtual.quantidade - qtdParaRetirar;

    await supabase
      .from('produtos')
      .update({ quantidade: novaQuantidade })
      .eq('id', produtoId);
  }

  // 4. Atualizar o ecrã do utilizador para mostrar os novos valores
  revalidatePath('/');
  return { success: true };
}