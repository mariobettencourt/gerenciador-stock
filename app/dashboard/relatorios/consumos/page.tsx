"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function RelatorioConsumos() {
  const router = useRouter();
  const [consumos, setConsumos] = useState<any[]>([]);
  const [aCarregar, setACarregar] = useState(true);
  const [periodo, setPeriodo] = useState("30");
  const [unidadeAberta, setUnidadeAberta] = useState<string | null>(null);

  useEffect(() => {
    carregarConsumosPorUnidade();
  }, [periodo]);

  const carregarConsumosPorUnidade = async () => {
    setACarregar(true);
    const dataCorte = new Date();
    dataCorte.setDate(dataCorte.getDate() - parseInt(periodo));

    const { data: movimentos, error } = await supabase
      .from("movimentos")
      .select(`
        quantidade,
        custo_unitario,
        created_at,
        produto_id,
        produtos (nome),
        pedidos (
          contacto_id,
          contactos!contacto_id (nome, departamento)
        )
      `)
      .eq("tipo", "Saída")
      .gte("created_at", dataCorte.toISOString());

    if (error) {
      console.error(error);
      setACarregar(false);
      return;
    }

    const agrupado: any = {};

    movimentos?.forEach((mov) => {
      const unidadeNome = mov.pedidos?.contactos?.nome || "Consumo Direto / Outros";
      const produtoNome = mov.produtos?.nome || "Artigo Desconhecido";
      const custoTotalMov = Math.abs(mov.quantidade) * (mov.custo_unitario || 0);

      if (!agrupado[unidadeNome]) {
        agrupado[unidadeNome] = {
          nome: unidadeNome,
          departamento: mov.pedidos?.contactos?.departamento || "Geral",
          valorTotal: 0,
          itensTotal: 0,
          materiais: {} // Vamos agrupar materiais aqui dentro
        };
      }

      agrupado[unidadeNome].valorTotal += custoTotalMov;
      agrupado[unidadeNome].itensTotal += Math.abs(mov.quantidade);

      // Lógica para a lista detalhada de materiais por unidade
      if (!agrupado[unidadeNome].materiais[produtoNome]) {
        agrupado[unidadeNome].materiais[produtoNome] = { nome: produtoNome, qtd: 0, gasto: 0 };
      }
      agrupado[unidadeNome].materiais[produtoNome].qtd += Math.abs(mov.quantidade);
      agrupado[unidadeNome].materiais[produtoNome].gasto += custoTotalMov;
    });

    const resultado = Object.values(agrupado).map((unidade: any) => ({
      ...unidade,
      // Converter o objeto de materiais num array ordenado por quantidade
      materiais: Object.values(unidade.materiais).sort((a: any, b: any) => b.qtd - a.qtd)
    })).sort((a: any, b: any) => b.valorTotal - a.valorTotal);
    
    setConsumos(resultado);
    setACarregar(false);
  };

  const gastoMaximo = Math.max(...consumos.map(c => c.valorTotal), 1);

  return (
    <main className="flex-1 p-8 md:p-12 bg-slate-50 h-screen overflow-y-auto">
      <button onClick={() => router.back()} className="mb-6 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-blue-600 transition-colors">
        ← Voltar ao Menu
      </button>

      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end mb-10 gap-6">
        <div>
          <h1 className="text-4xl font-black text-[#0f172a] tracking-tighter uppercase italic leading-none">
            Gastos por <span className="text-blue-600">Unidade</span>
          </h1>
          <div className="h-1.5 w-24 bg-blue-600 rounded-full mt-3"></div>
        </div>

        <div className="flex bg-white p-2 rounded-2xl shadow-sm border border-slate-200">
          {[{ label: "30 DIAS", val: "30" }, { label: "90 DIAS", val: "90" }, { label: "ANO", val: "365" }].map(btn => (
            <button key={btn.val} onClick={() => setPeriodo(btn.val)} className={`px-6 py-2 rounded-xl text-[9px] font-black transition-all ${periodo === btn.val ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>
              {btn.label}
            </button>
          ))}
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4">
        {aCarregar ? (
          <div className="p-20 text-center font-black text-slate-200 uppercase tracking-widest animate-pulse italic">A processar volumes...</div>
        ) : consumos.map((c, idx) => (
          <div key={idx} className="flex flex-col gap-2">
            <div 
              onClick={() => setUnidadeAberta(unidadeAberta === c.nome ? null : c.nome)}
              className={`bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col md:flex-row items-center gap-8 cursor-pointer hover:border-blue-300 transition-all ${unidadeAberta === c.nome ? 'ring-2 ring-blue-500' : ''}`}
            >
              <div className="w-full md:w-1/3">
                <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-1">{c.departamento}</p>
                <h3 className="text-xl font-black text-slate-800 uppercase leading-tight">{c.nome}</h3>
              </div>

              <div className="flex-1 w-full bg-slate-50 h-3 rounded-full overflow-hidden relative">
                <div className="h-full bg-blue-600 rounded-full transition-all duration-700" style={{ width: `${(c.valorTotal / gastoMaximo) * 100}%` }}></div>
              </div>

              <div className="flex gap-8 text-right shrink-0">
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Itens</p>
                  <p className="font-black text-slate-700">{c.itensTotal}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Gasto</p>
                  <p className="font-black text-blue-600 text-lg">{c.valorTotal.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}</p>
                </div>
                <div className="text-blue-200 text-xl font-black">{unidadeAberta === c.nome ? "▲" : "▼"}</div>
              </div>
            </div>

            {/* DROPDOWN DETALHADO */}
            {unidadeAberta === c.nome && (
              <div className="mx-8 bg-white border-x border-b border-slate-200 rounded-b-[2rem] p-6 shadow-inner animate-in slide-in-from-top-4 duration-300">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4">Materiais Requisitados (Ordenado por Qtd)</p>
                <div className="space-y-2">
                  {c.materiais.map((mat: any, mIdx: number) => (
                    <div key={mIdx} className="flex justify-between items-center py-2 border-b border-slate-50 last:border-0">
                      <span className="text-xs font-bold text-slate-600 uppercase">{mat.nome}</span>
                      <div className="flex gap-6">
                        <span className="text-xs font-black text-slate-800 w-16 text-right">{mat.qtd} un.</span>
                        <span className="text-xs font-bold text-slate-400 w-24 text-right">{mat.gasto.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}