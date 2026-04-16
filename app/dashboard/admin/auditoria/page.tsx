"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function PainelAuditoria() {
  const [logs, setLogs] = useState<any[]>([]);
  const [aCarregar, setACarregar] = useState(true);

  // Filtros
  const [filtroTipo, setFiltroTipo] = useState("Todos");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");

  useEffect(() => {
    carregarAuditoria();
  }, [filtroTipo, dataInicio, dataFim]);

  const carregarAuditoria = async () => {
  setACarregar(true);
  
  // 1. Criamos a base da consulta com o Join para o Nome
  let query = supabase
    .from("movimentos")
    .select(`
      id, created_at, tipo, quantidade, utilizador, observacao, 
      produtos (nome),
      perfis:utilizador (nome)
    `);

  // 2. APLICAR FILTROS (Isto é o que faltava para os filtros funcionarem)
  if (filtroTipo !== "Todos") {
    query = query.eq("tipo", filtroTipo);
  }
  if (dataInicio) {
    query = query.gte("created_at", `${dataInicio}T00:00:00Z`);
  }
  if (dataFim) {
    query = query.lte("created_at", `${dataFim}T23:59:59Z`);
  }

  // 3. Executar com Ordem e Limite
  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    console.warn("Relação não detetada, a usar modo de segurança...", error);
    
    // FALLBACK: Se o Join falhar, aplicamos os filtros na consulta simples
    let fallbackQuery = supabase
      .from("movimentos")
      .select(`id, created_at, tipo, quantidade, utilizador, observacao, produtos (nome)`);

    if (filtroTipo !== "Todos") fallbackQuery = fallbackQuery.eq("tipo", filtroTipo);
    if (dataInicio) fallbackQuery = fallbackQuery.gte("created_at", `${dataInicio}T00:00:00Z`);
    if (dataFim) fallbackQuery = fallbackQuery.lte("created_at", `${dataFim}T23:59:59Z`);

    const { data: fallbackData } = await fallbackQuery
      .order("created_at", { ascending: false })
      .limit(500);
      
    setLogs(fallbackData || []);
  } else {
    setLogs(data || []);
  }
  
  setACarregar(false);
};

  const limparFiltros = () => {
    setFiltroTipo("Todos");
    setDataInicio("");
    setDataFim("");
  };

  const obterCorAcao = (tipo: string) => {
    switch(tipo) {
      case "Saída": return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "Entrada": return "bg-green-500/20 text-green-400 border-green-500/30";
      case "Remoção": return "bg-red-500/20 text-red-400 border-red-500/30";
      case "Edição": return "bg-amber-500/20 text-amber-400 border-amber-500/30";
      case "Criação": return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
      default: return "bg-gray-500/20 text-gray-400 border-gray-500/30";
    }
  };

  return (
    <div className="bg-[#0f172a] rounded-[3rem] p-10 shadow-2xl text-white mt-8 h-fit">
      
      <header className="mb-8 border-b border-white/10 pb-8 flex flex-col xl:flex-row justify-between xl:items-end gap-6">
        <div>
          <div className="flex items-center gap-4 mb-1">
            <h2 className="text-2xl font-black uppercase italic tracking-tighter flex items-center gap-3">
              <span>🕵️</span> Registo de Auditoria
            </h2>
          </div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Histórico Geral Lotaçor</p>
        </div>

        {/* FILTROS ATUALIZADOS */}
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="text-[9px] font-black text-gray-400 uppercase block mb-1 px-1 tracking-widest">Ação</label>
            <select 
              value={filtroTipo} 
              onChange={e => setFiltroTipo(e.target.value)} 
              className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:border-amber-500 text-white min-w-[180px]"
            >
              <option value="Todos" className="text-black">Todas as Ações</option>
              <option value="Saída" className="text-black">📦 Saídas</option>
              <option value="Entrada" className="text-black">📥 Entradas</option>
              <option value="Criação" className="text-black">✨ Criação de Artigos</option>
              <option value="Remoção" className="text-black">🗑️ Remoção de Artigos</option>
              <option value="Edição" className="text-black">✏️ Edição</option>
            </select>
          </div>

          <div>
            <label className="text-[9px] font-black text-gray-400 uppercase block mb-1 px-1 tracking-widest">De</label>
            <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs font-bold outline-none text-white" />
          </div>

          <div>
            <label className="text-[9px] font-black text-gray-400 uppercase block mb-1 px-1 tracking-widest">Até</label>
            <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs font-bold outline-none text-white" />
          </div>

          {(filtroTipo !== "Todos" || dataInicio || dataFim) && (
            <button onClick={limparFiltros} className="px-4 py-3 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-xl text-[10px] font-black uppercase transition-all h-[42px]">
              Limpar
            </button>
          )}
        </div>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b-2 border-white/10 text-gray-400 text-[10px] uppercase tracking-widest font-black">
              <th className="py-4 px-4">Data & Hora</th>
              <th className="py-4 px-4">Operador</th>
              <th className="py-4 px-4 text-center">Ação</th>
              <th className="py-4 px-4">Detalhes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {aCarregar ? (
              <tr><td colSpan={4} className="py-10 text-center animate-pulse text-amber-500 font-black uppercase tracking-widest">A sincronizar dados...</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={4} className="py-10 text-center text-gray-400 uppercase text-xs">Sem movimentos registados.</td></tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="text-xs hover:bg-white/5 transition-colors">
                  <td className="py-4 px-4">
                    <span className="font-bold text-gray-300">{new Date(log.created_at).toLocaleDateString('pt-PT')}</span>
                    <span className="text-gray-500 ml-2">{new Date(log.created_at).toLocaleTimeString('pt-PT')}</span>
                  </td>
                  
                  {/* EXIBIÇÃO DO NOME DO UTILIZADOR */}
                  <td className="py-4 px-4 font-black text-amber-500 uppercase">
                    {log.perfis?.nome || "Sistema Automático"}
                  </td>

                  <td className="py-4 px-4 text-center">
                    <span className={`px-3 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest ${obterCorAcao(log.tipo)}`}>
                      {log.tipo}
                    </span>
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex flex-col">
                      <span className="font-bold text-white uppercase">{log.produtos?.nome || "Registo do Sistema"}</span>
                      {log.quantidade !== 0 && (
                        <span className="text-gray-400 text-[10px]">Qtd: {Math.abs(log.quantidade)}</span>
                      )}
                      {log.observacao && <p className="text-[10px] text-gray-500 italic mt-0.5">{log.observacao}</p>}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}