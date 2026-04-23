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

  // EFEITO: Sempre que mudamos de separador (Módulo), limpamos o filtro de Ação
  // Isto evita que fiques com o filtro "Envio de Email" ativo se mudares para "Produtos"
  useEffect(() => {
    setFiltroTipo("Todos");
  }, [moduloAtivo]);

  useEffect(() => {
    carregarAuditoria();
  }, [filtroTipo, dataInicio, dataFim, moduloAtivo]);

  const carregarAuditoria = async () => {
    setACarregar(true);
    let todosLogs: any[] = [];

    // --- 1. BUSCAR MOVIMENTOS (Produtos/Contactos) ---
    if (moduloAtivo !== "Pedidos") {
      let queryMovs = supabase
        .from("movimentos")
        .select(`id, created_at, tipo, quantidade, utilizador, observacao, produtos (nome), perfis:utilizador (nome)`);

      if (moduloAtivo === "Produtos") queryMovs = queryMovs.or('produto_id.not.is.null,observacao.ilike.%artigo%');
      if (moduloAtivo === "Contactos") queryMovs = queryMovs.ilike("observacao", "%contacto%");
      
      // Só aplica filtro de tipo aos movimentos se o filtro fizer sentido para eles
      const filtrosMovimento = ["Saída", "Entrada", "Criação", "Remoção", "Edição"];
      if (filtroTipo !== "Todos" && filtrosMovimento.includes(filtroTipo)) {
        queryMovs = queryMovs.eq("tipo", filtroTipo);
      }

      if (dataInicio) queryMovs = queryMovs.gte("created_at", `${dataInicio}T00:00:00Z`);
      if (dataFim) queryMovs = queryMovs.lte("created_at", `${dataFim}T23:59:59Z`);

      const { data: movData } = await queryMovs.order("created_at", { ascending: false }).limit(500);

      if (movData) {
        const formatedMovs = movData.map(m => ({
          id: `mov_${m.id}`,
          created_at: m.created_at,
          operador: m.perfis?.nome || "Sistema",
          acao: m.tipo,
          detalhePrincipal: m.produtos?.nome || (m.observacao?.toLowerCase().includes("contacto") ? "Gestão de Contactos" : "Registo de Artigo"),
          subDetalhe: m.observacao,
          quantidade: m.quantidade || 0
        }));
        todosLogs = [...todosLogs, ...formatedMovs];
      }
    }

    // --- 2. BUSCAR LOGS DE PEDIDOS ---
    if (moduloAtivo === "Todos" || moduloAtivo === "Pedidos") {
      let queryPeds = supabase.from("logs_pedidos").select('*');
      
      if (dataInicio) queryPeds = queryPeds.gte("created_at", `${dataInicio}T00:00:00Z`);
      if (dataFim) queryPeds = queryPeds.lte("created_at", `${dataFim}T23:59:59Z`);

      const { data: pedData } = await queryPeds.order("created_at", { ascending: false }).limit(500);

      if (pedData) {
        let filteredPeds = pedData;
        
        if (filtroTipo !== "Todos") {
          filteredPeds = pedData.filter(p => {
            // Se estivermos na aba Pedidos, o valor do dropdown é exato à ação da base de dados
            if (moduloAtivo === "Pedidos") {
              return p.acao === filtroTipo;
            } 
            // Se estivermos na aba "Todos", temos de fazer a correspondência com os filtros genéricos
            else {
              if (filtroTipo === "Criação" && p.acao === "CRIADO") return true;
              if (filtroTipo === "Remoção" && p.acao === "ELIMINADO") return true;
              if (filtroTipo === "Edição" && p.acao === "ALTERAÇÃO DE ESTADO") return true;
              return false;
            }
          });
        }

        const formatedPeds = filteredPeds.map(p => ({
          id: `ped_${p.id}`,
          created_at: p.created_at,
          operador: p.utilizador,
          acao: p.acao,
          detalhePrincipal: `Ticket / Pedido #${p.pedido_id || 'N/A'}`,
          subDetalhe: p.detalhes,
          quantidade: 0
        }));
        todosLogs = [...todosLogs, ...formatedPeds];
      }
    }

    // --- 3. JUNTAR E ORDENAR ---
    todosLogs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setLogs(todosLogs.slice(0, 500));
    setACarregar(false);
  };

  const limparFiltros = () => {
    setModuloAtivo("Todos");
    setFiltroTipo("Todos");
    setDataInicio("");
    setDataFim("");
  };

  const obterCorAcao = (tipo: string) => {
    switch(tipo.toUpperCase()) {
      case "SAÍDA": return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "ENTRADA": return "bg-green-500/20 text-green-400 border-green-500/30";
      case "REMOÇÃO": 
      case "ELIMINADO": return "bg-red-500/20 text-red-400 border-red-500/30";
      case "EDIÇÃO": 
      case "ALTERAÇÃO DE ESTADO": return "bg-amber-500/20 text-amber-400 border-amber-500/30";
      case "CRIAÇÃO": 
      case "CRIADO": return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
      case "ENVIO DE EMAIL": return "bg-purple-500/20 text-purple-400 border-purple-500/30";
      case "RE-IMPRESSÃO": return "bg-slate-500/20 text-slate-300 border-slate-500/30";
      default: return "bg-gray-500/20 text-gray-400 border-gray-500/30";
    }
  };

  return (
    <div className="bg-[#0f172a] rounded-[3rem] p-10 shadow-2xl text-white mt-8 h-fit relative">
      
      {/* SEPARADORES DE MÓDULOS (TABS NO TOPO) */}
      <div className="flex gap-2 overflow-x-auto pb-px border-b border-white/10 mb-8 scrollbar-hide">
        {["Todos", "Pedidos", "Produtos", "Contactos"].map(modulo => (
          <button
            key={modulo}
            onClick={() => setModuloAtivo(modulo)}
            className={`px-6 py-4 rounded-t-2xl font-black uppercase text-[10px] tracking-widest transition-all whitespace-nowrap ${
              moduloAtivo === modulo 
                ? 'bg-amber-500 text-[#0f172a] shadow-lg' 
                : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
            }`}
          >
            {modulo === "Todos" ? "🌍 " : modulo === "Pedidos" ? "📑 " : modulo === "Produtos" ? "📦 " : "📇 "}
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

        {/* FILTROS (AGORA DINÂMICOS) */}
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="text-[9px] font-black text-gray-400 uppercase block mb-1 px-1 tracking-widest">Ação</label>
            <select 
              value={filtroTipo} 
              onChange={e => setFiltroTipo(e.target.value)} 
              className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:border-amber-500 text-white min-w-[180px]"
            >
              <option value="Todos" className="text-black">Todas as Ações</option>
              
              {/* Se estamos na aba Pedidos, mostramos os filtros específicos dos Tickets */}
              {moduloAtivo === "Pedidos" ? (
                <>
                  <option value="CRIADO" className="text-black">✨ Criação de Pedido</option>
                  <option value="ALTERAÇÃO DE ESTADO" className="text-black">🔄 Alteração de Estado</option>
                  <option value="ELIMINADO" className="text-black">🗑️ Eliminação</option>
                  <option value="ENVIO DE EMAIL" className="text-black">📧 Envio de Email</option>
                  <option value="RE-IMPRESSÃO" className="text-black">🖨️ Re-impressão</option>
                </>
              ) : (
                /* Se estamos nas outras abas, mostramos os filtros normais (com Saídas só para os Produtos) */
                <>
                  {(moduloAtivo === "Todos" || moduloAtivo === "Produtos") && (
                    <>
                      <option value="Saída" className="text-black">📦 Saídas</option>
                      <option value="Entrada" className="text-black">📥 Entradas</option>
                    </>
                  )}
                  <option value="Criação" className="text-black">✨ Criação</option>
                  <option value="Remoção" className="text-black">🗑️ Remoção</option>
                  <option value="Edição" className="text-black">✏️ Edição / Estado</option>
                </>
              )}
            </select>
          </div>

          <div>
            <label className="text-[9px] font-black text-gray-400 uppercase block mb-1 px-1 tracking-widest">De</label>
            <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs font-bold outline-none text-white [color-scheme:dark]" />
          </div>

          <div>
            <label className="text-[9px] font-black text-gray-400 uppercase block mb-1 px-1 tracking-widest">Até</label>
            <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs font-bold outline-none text-white [color-scheme:dark]" />
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
                  <td className="py-4 px-4 whitespace-nowrap">
                    <span className="font-bold text-gray-300">{new Date(log.created_at).toLocaleDateString('pt-PT')}</span>
                    <span className="text-gray-500 ml-2">{new Date(log.created_at).toLocaleTimeString('pt-PT')}</span>
                  </td>
                  
                  <td className="py-4 px-4 font-black text-amber-500 uppercase whitespace-nowrap">
                    {log.operador || "Sistema Automático"}
                  </td>

                  <td className="py-4 px-4 text-center">
                    <span className={`px-3 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest whitespace-nowrap ${obterCorAcao(log.acao)}`}>
                      {log.acao}
                    </span>
                  </td>
                  
                  <td className="py-4 px-4">
                    <div className="flex flex-col">
                      <span className="font-bold text-white uppercase">
                        {log.detalhePrincipal}
                      </span>
                      {log.quantidade !== 0 && (
                        <span className="text-gray-400 text-[10px] mt-0.5">Qtd: {Math.abs(log.quantidade)}</span>
                      )}
                      {log.subDetalhe && <p className="text-[10px] text-gray-500 italic mt-0.5">{log.subDetalhe}</p>}
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