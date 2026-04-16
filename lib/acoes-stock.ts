import { supabase } from "./supabase";

export async function processarSaida(produtoId: number, qtd: number, destino: string, utilizadorId: string) {
  // 1. Regista o Movimento (Auditoria)
  const { error: errMov } = await supabase
    .from("movimentos")
    .insert({
      produto_id: produtoId,
      quantidade: qtd,
      tipo: "Saída",
      destino: destino,
      utilizador: utilizadorId // Usa o ID do utilizador logado
    });

  if (errMov) return { success: false, error: errMov.message };

  // 2. Atualiza o Stock Real (Coração)
  // Nota: O Supabase permite fazer cálculos diretamente para evitar erros de concorrência
  const { error: errProd } = await supabase.rpc('deduzir_stock', { 
    p_id: produtoId, 
    p_qtd: qtd 
  });

  return { success: !errProd };
}