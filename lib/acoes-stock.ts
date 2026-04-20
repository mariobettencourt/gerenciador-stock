import { supabase } from "./supabase";

/**
 * Processa a saída de stock registando o movimento com snapshot de preço
 * e atualizando a quantidade na tabela de produtos.
 */
export async function processarSaida(
  produtoId: number, 
  qtd: number, 
  destino: string, 
  utilizadorId: string, 
  preco: number // <-- NOVO ARGUMENTO PARA O SNAPSHOT
) {
  // 1. Regista o Movimento (Auditoria) COM O PREÇO NO MOMENTO
  const { error: errMov } = await supabase
    .from("movimentos")
    .insert({
      produto_id: produtoId,
      quantidade: -Math.abs(qtd), // Garante que a saída é registada como número negativo
      tipo: "Saída",
      destino: destino,
      utilizador: utilizadorId,
      custo_unitario: preco // <-- SNAPSHOT DE PREÇO AQUI
    });

  if (errMov) return { success: false, error: errMov.message };

  // 2. Atualiza o Stock Real (Utilizando a função RPC que já tens no Supabase)
  // Nota: Certifica-te que a função rpc 'deduzir_stock' trata a quantidade corretamente
  const { error: errProd } = await supabase.rpc('deduzir_stock', { 
    p_id: produtoId, 
    p_qtd: Math.abs(qtd) 
  });

  if (errProd) {
    console.error("Erro ao deduzir stock via RPC:", errProd.message);
    return { success: false, error: errProd.message };
  }

  return { success: true };
}