"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function PainelAuditoria() {
  const [logs, setLogs] = useState<any[]>([]);
  const [aCarregar, setACarregar] = useState(true);

  // Filtros
  const [moduloAtivo, setModuloAtivo] = useState("Todos"); 
  const [filtroTipo, setFiltroTipo] = useState("Todos");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");

  // EFEITO: Se mudarmos para a aba Contactos e o filtro for de Stock (Entrada/Saída), limpa o filtro
  useEffect(() => {
    if (moduloAtivo === "Contactos" && (filtroTipo === "Saída" || filtroTipo === "Entrada")) {
      setFiltroTipo("Todos");
    }
  }, [moduloAtivo, filtroTipo]);

  useEffect(() => {
    carregarAuditoria();
  }, [filtroTipo, dataInicio, dataFim, moduloAtivo]);

  const carregarAuditoria = async () => {
    setACarregar(true);
    
    // 1. Base da consulta
    let query = supabase
      .from("movimentos")
      .select(`
        id, created_at, tipo, quantidade, utilizador, observacao, 
        produtos (nome),
        perfis:utilizador (nome)
      `);

    // 2. APLICAR FILTROS DE MÓDULO CORRIGIDOS
    if (moduloAtivo === "Produtos") {
      // É um produto se tiver um ID de produto OU se a observação disser que apagou um artigo
      query = query.or('produto_id.not.is.null,observacao.ilike.%artigo%');
    } else if (moduloAtivo === "Contactos") {
      query = query.ilike("observacao", "%contacto%");
    }

    // 3. APLICAR RESTANTES FILTROS
    if (filtroTipo !== "Todos") {
      query = query.eq("tipo", filtroTipo);
    }
    if (dataInicio) {
      query = query.gte("created_at", `${dataInicio}T00:00:00Z`);
    }
    if (dataFim) {
      query = query.lte("created_at", `${dataFim}T23:59:59Z`);
    }

    // 4. Executar Consulta
    const { data, error } = await query
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) {
      console.warn("Relação não detetada, a usar fallback...", error);
      
      let fallbackQuery = supabase
        .from("movimentos")
        .select(`id, created_at, tipo, quantidade, utilizador, observacao, produtos (nome)`);

      if (moduloAtivo === "Produtos") fallbackQuery = fallbackQuery.or('produto_id.not.is.null,observacao.ilike.%artigo%');
      if (moduloAtivo === "Contactos") fallbackQuery = fallbackQuery.ilike("observacao", "%contacto%");

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
    setModuloAtivo("Todos");
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

  // Função auxiliar para dar um título bonito a artigos removidos ou contactos
  const obterTituloDetalhe = (log: any) => {
    if (log.produtos?.nome) return log.produtos.nome;
    if (log.observacao?.toLowerCase().includes("contacto")) return "Gestão de Contactos";
    if (log.observacao?.toLowerCase().includes("artigo")) return "Gestão de Catálogo (Remoção)";
    return "Registo do Sistema";
  };

  return (
    <div className="bg-[#0f172a] rounded-[3rem] p-10 shadow-2xl text-white mt-8 h-fit relative">
      
      {/* SEPARADORES DE MÓDULOS (TABS NO TOPO) */}
      <div className="flex gap-2 overflow-x-auto pb-px border-b border-white/10 mb-8 scrollbar-hide">
        {["Todos", "Produtos", "Contactos"].map(modulo => (
          <button
            key={modulo}
            onClick={() => setModuloAtivo(modulo)}
            className={`px-6 py-4 rounded-t-2xl font-black uppercase text-[10px] tracking-widest transition-all whitespace-nowrap ${
              moduloAtivo === modulo 
                ? 'bg-amber-500 text-[#0f172a] shadow-lg' 
                : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
            }`}
          >
            {modulo === "Todos" ? "🌍 " : modulo === "Produtos" ? "📦 " : "📇 "}
            {modulo}
          </button>
        ))}
      </div>

      <header className="mb-8 flex flex-col xl:flex-row justify-between xl:items-end gap-6">
        <div>
          <div className="flex items-center gap-4 mb-1">
            <h2 className="text-2xl font-black uppercase italic tracking-tighter flex items-center gap-3">
              <span>🕵️</span> Registo de Auditoria
            </h2>
          </div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Histórico de Alterações Lotaçor</p>
        </div>

        {/* FILTROS EXISTENTES */}
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="text-[9px] font-black text-gray-400 uppercase block mb-1 px-1 tracking-widest">Ação</label>
            <select 
              value={filtroTipo} 
              onChange={e => setFiltroTipo(e.target.value)} 
              className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:border-amber-500 text-white min-w-[180px]"
            >
              <option value="Todos" className="text-black">Todas as Ações</option>
              
              {/* Opções de Stock APENAS visíveis se não estiver na aba de Contactos */}
              {moduloAtivo !== "Contactos" && (
                <>
                  <option value="Saída" className="text-black">📦 Saídas</option>
                  <option value="Entrada" className="text-black">📥 Entradas</option>
                </>
              )}
              
              <option value="Criação" className="text-black">✨ Criação</option>
              <option value="Remoção" className="text-black">🗑️ Remoção</option>
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

          {(filtroTipo !== "Todos" || dataInicio || dataFim || moduloAtivo !== "Todos") && (
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
              <tr><td colSpan={4} className="py-10 text-center text-gray-400 uppercase text-xs">Sem movimentos registados nestes filtros.</td></tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="text-xs hover:bg-white/5 transition-colors">
                  <td className="py-4 px-4">
                    <span className="font-bold text-gray-300">{new Date(log.created_at).toLocaleDateString('pt-PT')}</span>
                    <span className="text-gray-500 ml-2">{new Date(log.created_at).toLocaleTimeString('pt-PT')}</span>
                  </td>
                  
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
                      <span className="font-bold text-white uppercase">
                        {obterTituloDetalhe(log)}
                      </span>
                      {log.quantidade !== 0 && (
                        <span className="text-gray-400 text-[10px] mt-0.5">Qtd: {Math.abs(log.quantidade)}</span>
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