"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function RelatorioCompras() {
  const router = useRouter();
  const [entradas, setEntradas] = useState<any[]>([]);
  const [aCarregar, setACarregar] = useState(true);
  
  // Estados para Filtros e Ordenação
  const [pesquisa, setPesquisa] = useState("");
  const [ordemColuna, setOrdemColuna] = useState("created_at");
  const [direcao, setDirecao] = useState<"asc" | "desc">("desc");
  const [filtroData, setFiltroData] = useState("");

  useEffect(() => {
    carregarHistoricoEntradas();
  }, []);

  const carregarHistoricoEntradas = async () => {
    setACarregar(true);
    const { data, error } = await supabase
      .from("movimentos")
      .select(`*, produtos (nome, categoria)`)
      .in("tipo", ["Entrada", "Criação"])
      .order("created_at", { ascending: false });

    if (!error) setEntradas(data || []);
    setACarregar(false);
  };

  // Função para alternar ordenação
  const handleSort = (coluna: string) => {
    const novaDirecao = ordemColuna === coluna && direcao === "desc" ? "asc" : "desc";
    setOrdemColuna(coluna);
    setDirecao(novaDirecao);
  };

  // Lógica de Filtragem e Ordenação Dinâmica
  const dadosProcessados = entradas
    .filter(e => {
      const matchNome = e.produtos?.nome.toLowerCase().includes(pesquisa.toLowerCase());
      const matchData = !filtroData || e.created_at.includes(filtroData);
      return matchNome && matchData;
    })
    .sort((a, b) => {
      let valA, valB;
      
      // Mapeamento de colunas para valores reais
      if (ordemColuna === "artigo") { valA = a.produtos?.nome; valB = b.produtos?.nome; }
      else if (ordemColuna === "total") { valA = a.quantidade * a.custo_unitario; valB = b.quantidade * b.custo_unitario; }
      else { valA = a[ordemColuna]; valB = b[ordemColuna]; }

      if (valA < valB) return direcao === "asc" ? -1 : 1;
      if (valA > valB) return direcao === "asc" ? 1 : -1;
      return 0;
    });

  const totalInvestido = dadosProcessados.reduce((acc, curr) => acc + (curr.quantidade * (curr.custo_unitario || 0)), 0);

  return (
    <main className="flex-1 p-8 md:p-12 bg-slate-50 h-screen overflow-y-auto">
      <button onClick={() => router.back()} className="mb-6 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-purple-600 transition-colors">
        ← Voltar ao Menu
      </button>

      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end mb-10 gap-6">
        <div>
          <h1 className="text-4xl font-black text-[#0f172a] tracking-tighter uppercase italic leading-none">
            Histórico de <span className="text-purple-600">Compras</span>
          </h1>
          <div className="h-1.5 w-24 bg-purple-600 rounded-full mt-3"></div>
        </div>

        <div className="flex flex-wrap gap-4 items-center">
          <div className="bg-white p-4 px-6 rounded-2xl shadow-sm border border-slate-200">
            <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Total Filtrado</p>
            <p className="text-xl font-black text-purple-600">{totalInvestido.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}</p>
          </div>
          
          <input 
            type="date" 
            value={filtroData}
            onChange={(e) => setFiltroData(e.target.value)}
            className="p-4 rounded-2xl bg-white border border-slate-200 text-xs font-bold outline-none focus:ring-2 ring-purple-500 transition-all"
          />

          <div className="relative">
             <input 
              type="text" 
              placeholder="Pesquisar artigo..." 
              value={pesquisa}
              onChange={(e) => setPesquisa(e.target.value)}
              className="p-4 pl-12 rounded-2xl bg-white border border-slate-200 text-xs font-bold outline-none focus:ring-2 ring-purple-500 transition-all w-64"
             />
             <span className="absolute left-4 top-4 opacity-30">🔍</span>
          </div>
        </div>
      </header>

      <div className="bg-white rounded-[2.5rem] shadow-sm overflow-hidden border border-slate-100">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th onClick={() => handleSort("created_at")} className="p-6 text-[10px] font-black uppercase text-slate-400 tracking-widest cursor-pointer hover:text-purple-600 transition-colors">
                Data {ordemColuna === "created_at" && (direcao === "asc" ? "▲" : "▼")}
              </th>
              <th onClick={() => handleSort("artigo")} className="p-6 text-[10px] font-black uppercase text-slate-400 tracking-widest cursor-pointer hover:text-purple-600 transition-colors">
                Artigo {ordemColuna === "artigo" && (direcao === "asc" ? "▲" : "▼")}
              </th>
              <th onClick={() => handleSort("quantidade")} className="p-6 text-[10px] font-black uppercase text-slate-400 tracking-widest text-center cursor-pointer hover:text-purple-600 transition-colors">
                Qtd {ordemColuna === "quantidade" && (direcao === "asc" ? "▲" : "▼")}
              </th>
              <th onClick={() => handleSort("custo_unitario")} className="p-6 text-[10px] font-black uppercase text-slate-400 tracking-widest text-right cursor-pointer hover:text-purple-600 transition-colors">
                Custo Un. {ordemColuna === "custo_unitario" && (direcao === "asc" ? "▲" : "▼")}
              </th>
              <th onClick={() => handleSort("total")} className="p-6 text-[10px] font-black uppercase text-slate-400 tracking-widest text-right cursor-pointer hover:text-purple-600 transition-colors">
                Total Linha {ordemColuna === "total" && (direcao === "asc" ? "▲" : "▼")}
              </th>
            </tr>
          </thead>
          <tbody>
            {aCarregar ? (
              <tr><td colSpan={5} className="p-20 text-center font-black text-slate-200 uppercase tracking-widest animate-pulse">Cruzando dados...</td></tr>
            ) : dadosProcessados.length === 0 ? (
              <tr><td colSpan={5} className="p-20 text-center font-bold text-slate-300 uppercase text-xs">Nenhuma compra encontrada com estes filtros.</td></tr>
            ) : (
              dadosProcessados.map((e, idx) => (
                <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors group">
                  <td className="p-6 font-bold text-slate-500 text-xs">
                    {new Date(e.created_at).toLocaleDateString('pt-PT')}
                  </td>
                  <td className="p-6">
                    <p className="font-black text-slate-700 uppercase text-sm group-hover:text-purple-600 transition-colors">{e.produtos?.nome}</p>
                    <p className="text-[9px] text-slate-400 font-bold uppercase">{e.produtos?.categoria}</p>
                  </td>
                  <td className="p-6 text-center font-black text-slate-600">{e.quantidade}</td>
                  <td className="p-6 text-right font-bold text-slate-700">{e.custo_unitario?.toFixed(2)}€</td>
                  <td className="p-6 text-right font-black text-purple-600">
                    {(e.quantidade * (e.custo_unitario || 0)).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}