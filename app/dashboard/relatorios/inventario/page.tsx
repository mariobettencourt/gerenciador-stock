"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function RelatorioInventario() {
  const router = useRouter();
  const [dadosInventario, setDadosInventario] = useState<any[]>([]);
  const [aCarregar, setACarregar] = useState(true);
  const [filtroCategoria, setFiltroCategoria] = useState("Todas");

  useEffect(() => {
    carregarValorizacaoFIFO();
  }, []);

  const carregarValorizacaoFIFO = async () => {
    setACarregar(true);
    
    // 1. Procurar todos os movimentos que ainda têm stock disponível (Lotes FIFO ativos)
    const { data: lotes, error } = await supabase
      .from("movimentos")
      .select(`
        quantidade_restante,
        custo_unitario,
        produto_id,
        produtos (
          nome,
          categoria,
          local
        )
      `)
      .gt("quantidade_restante", 0);

    if (error) {
      console.error("Erro ao carregar lotes:", error.message);
      setACarregar(false);
      return;
    }

    // 2. Agrupar os lotes por produto para uma visualização limpa
    const agrupado: any = {};

    lotes?.forEach((lote) => {
      const pId = lote.produto_id;
      if (!agrupado[pId]) {
        agrupado[pId] = {
          nome: lote.produtos.nome,
          categoria: lote.produtos.categoria || "Geral",
          local: lote.produtos.local,
          quantidadeTotal: 0,
          valorTotal: 0,
          lotesContagem: 0
        };
      }
      agrupado[pId].quantidadeTotal += lote.quantidade_restante;
      agrupado[pId].valorTotal += (lote.quantidade_restante * lote.custo_unitario);
      agrupado[pId].lotesContagem += 1;
    });

    setDadosInventario(Object.values(agrupado));
    setACarregar(false);
  };

  const categorias = ["Todas", ...Array.from(new Set(dadosInventario.map(d => d.categoria)))];

  const filtrados = dadosInventario.filter(d => 
    filtroCategoria === "Todas" || d.categoria === filtroCategoria
  );

  const valorTotalGlobal = filtrados.reduce((acc, curr) => acc + curr.valorTotal, 0);

  return (
    <main className="flex-1 p-8 md:p-12 bg-slate-50 h-screen overflow-y-auto">
      {/* Botão Voltar */}
      <button 
        onClick={() => router.back()}
        className="mb-6 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-[#1e3a8a] transition-colors"
      >
        ← Voltar ao Menu
      </button>

      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end mb-10 gap-6">
        <div>
          <h1 className="text-4xl font-black text-[#0f172a] tracking-tighter uppercase italic leading-none">
            Valorização <span className="text-[#1e3a8a]">de Inventário</span>
          </h1>
          <div className="h-1.5 w-24 bg-[#1e3a8a] rounded-full mt-3"></div>
          <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-4">
            Cálculo Baseado em Lotes Ativos (MÉTODO FIFO)
          </p>
        </div>

        <div className="bg-white p-6 rounded-[2rem] shadow-sm border-l-8 border-emerald-500">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Valor Total em Stock</p>
          <p className="text-3xl font-black text-slate-800">{valorTotalGlobal.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}</p>
        </div>
      </header>

      {/* Filtros Rápidos */}
      <div className="flex gap-2 overflow-x-auto pb-6 scrollbar-hide">
        {categorias.map(cat => (
          <button
            key={cat}
            onClick={() => setFiltroCategoria(cat)}
            className={`px-5 py-2 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${
              filtroCategoria === cat ? 'bg-[#1e3a8a] text-white' : 'bg-white text-slate-400 hover:bg-slate-100'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Tabela de Inventário */}
      <div className="bg-white rounded-[2.5rem] shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="p-6 text-[10px] font-black uppercase text-slate-400 tracking-widest">Artigo</th>
              <th className="p-6 text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">Lotes Ativos</th>
              <th className="p-6 text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">Qtd. Total</th>
              <th className="p-6 text-[10px] font-black uppercase text-slate-400 tracking-widest text-right">Valor Total</th>
            </tr>
          </thead>
          <tbody>
            {aCarregar ? (
              <tr>
                <td colSpan={4} className="p-20 text-center font-black text-slate-200 uppercase tracking-widest animate-pulse">
                  A calcular ativos...
                </td>
              </tr>
            ) : filtrados.map((item, idx) => (
              <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                <td className="p-6">
                  <p className="font-black text-slate-700 uppercase text-sm">{item.nome}</p>
                  <p className="text-[9px] text-slate-400 font-bold uppercase">{item.local} | {item.categoria}</p>
                </td>
                <td className="p-6 text-center">
                  <span className="px-3 py-1 bg-blue-50 text-[#1e3a8a] rounded-full text-[10px] font-black">
                    {item.lotesContagem}
                  </span>
                </td>
                <td className="p-6 text-center font-bold text-slate-600">{item.quantidadeTotal}</td>
                <td className="p-6 text-right font-black text-slate-800">
                  {item.valorTotal.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}