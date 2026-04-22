import { supabase } from "./supabase";

/**
 * PROCESSAMENTO FIFO
 * Esta função abate stock consumindo primeiro as entradas mais antigas.
 */
export async function processarSaidaFIFO(
  produtoId: number, 
  qtdTotalARetirar: number, 
  utilizadorId: string,
  pedidoId?: number
) {
  // 1. Ir buscar todas as entradas/criações deste produto que ainda tenham stock (FIFO)
  const { data: lotes, error: errLotes } = await supabase
    .from("movimentos")
    .select("*")
    .eq("produto_id", produtoId)
    .in("tipo", ["Entrada", "Criação"])
    .gt("quantidade_restante", 0)
    .order("created_at", { ascending: true }); // O mais antigo primeiro (First-In)

  if (errLotes || !lotes) throw new Error("Não foi possível encontrar lotes de stock.");

  let restanteParaRetirar = qtdTotalARetirar;
  let custoTotalDestaSaida = 0;

  // 2. Loop pelos lotes para consumir o stock
  for (const lote of lotes) {
    if (restanteParaRetirar <= 0) break;

    const quantidadeNesteLote = lote.quantidade_restante;
    const aRetirarDesteLote = Math.min(quantidadeNesteLote, restanteParaRetirar);
    const precoDesteLote = lote.custo_unitario || 0;

    // Atualizar o lote original (diminuir a quantidade_restante)
    await supabase
      .from("movimentos")
      .update({ quantidade_restante: quantidadeNesteLote - aRetirarDesteLote })
      .eq("id", lote.id);

    custoTotalDestaSaida += (aRetirarDesteLote * precoDesteLote);
    restanteParaRetirar -= aRetirarDesteLote;
  }

  if (restanteParaRetirar > 0) {
    throw new Error("Stock insuficiente nos lotes para satisfazer o pedido!");
  }

  // 3. Registar o movimento de Saída final com o custo médio real destes lotes
  const custoUnitarioMedio = custoTotalDestaSaida / qtdTotalARetirar;

  const { error: errSaida } = await supabase.from("movimentos").insert({
    produto_id: produtoId,
    quantidade: -qtdTotalARetirar,
    tipo: "Saída",
    utilizador: utilizadorId,
    pedido_id: pedidoId,
    custo_unitario: custoUnitarioMedio,
    observacao: `Saída FIFO (Lotes consumidos).`
  });

  // 4. Atualizar o stock total na tabela de produtos (para consulta rápida)
  const { data: prod } = await supabase.from("produtos").select("quantidade").eq("id", produtoId).single();
  await supabase.from("produtos").update({ 
    quantidade: (prod?.quantidade || 0) - qtdTotalARetirar 
  }).eq("id", produtoId);

  return { success: true, custoTotal: custoTotalDestaSaida };
}