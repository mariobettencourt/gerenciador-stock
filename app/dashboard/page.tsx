"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function DashboardInicial() {
  const router = useRouter();
  const [aCarregar, setACarregar] = useState(true);
  
  const [kpis, setKpis] = useState({
    totalArtigos: 0,
    valorInventario: 0,
    artigosRutura: 0,
    pedidosPendentes: 0
  });
  
  const [movimentosRecentes, setMovimentosRecentes] = useState<any[]>([]);
  const [listaCritica, setListaCritica] = useState<any[]>([]);

  useEffect(() => {
    const carregarDashboard = async () => {
      // 1. Carregar Dados de Produtos
      const { data: produtos } = await supabase.from("produtos").select("id, quantidade, preco, stock_minimo, nome");
      
      // 2. Carregar Pedidos Pendentes
      const { count: pendentes } = await supabase
        .from("pedidos")
        .select('*', { count: 'exact', head: true })
        .eq('estado', 'Pendente');

      if (produtos) {
        let totalVal = 0;
        let emRutura = 0;
        const criticos: any[] = [];
        
        produtos.forEach(p => {
          const qtd = p.quantidade || 0;
          const preco = p.preco || 0;
          const min = p.stock_minimo || 5; 

          totalVal += (qtd * preco);
          
          if (qtd <= min) {
            emRutura++;
            criticos.push({ ...p, min_calculado: min });
          }
        });

        criticos.sort((a, b) => a.quantidade - b.quantidade);

        setKpis({
          totalArtigos: produtos.length,
          valorInventario: totalVal,
          artigosRutura: emRutura,
          pedidosPendentes: pendentes || 0
        });
        setListaCritica(criticos);
      }

      // 3. Movimentos Recentes (Auditoria)
      const { data: movs } = await supabase
        .from("movimentos")
        .select(`
          id, 
          created_at, 
          tipo, 
          quantidade, 
          observacao,
          produtos (nome)
        `)
        .order("created_at", { ascending: false })
        .limit(6);
        
      if (movs) setMovimentosRecentes(movs);
      
      setACarregar(false);
    };

    carregarDashboard();
  }, []);

  if (aCarregar) return (
    <div className="p-12 text-center text-[#1e3a8a] font-black uppercase animate-pulse h-screen flex flex-col items-center justify-center gap-6 bg-slate-50">
      <div className="w-16 h-16 border-4 border-[#1e3a8a] border-t-transparent rounded-full animate-spin"></div>
      A Sincronizar o Centro de Comando...
    </div>
  );

  return (
    <main className="flex-1 p-6 md:p-10 lg:p-12 overflow-y-auto h-screen bg-slate-50 w-full">
      <div className="max-w-[1600px] mx-auto">
        
        {/* CABEÇALHO COM AÇÕES RÁPIDAS */}
        <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-10 gap-6">
          <div>
            <h1 className="text-4xl font-black text-[#0f172a] uppercase italic leading-none tracking-tighter">
              Centro de <span className="text-[#1e3a8a]">Comando</span>
            </h1>
            <div className="h-1.5 w-24 bg-[#1e3a8a] rounded-full mt-3 mb-2"></div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Painel Operacional Lotaçor</p>
          </div>

          <div className="flex flex-wrap gap-3 w-full lg:w-auto">
            <button onClick={() => router.push('/dashboard/pedidos')} className="flex-1 lg:flex-none group flex items-center gap-3 bg-white border-2 border-slate-200 p-2 pr-6 rounded-2xl hover:border-[#1e3a8a] transition-all shadow-sm">
              <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center group-hover:bg-[#1e3a8a] group-hover:text-white transition-colors">📋</div>
              <span className="text-[10px] font-black uppercase text-slate-500 group-hover:text-[#1e3a8a]">Ver Pedidos</span>
            </button>
            
            {/* BOTÃO ALTERADO PARA "NOVO ARTIGO" */}
            <button onClick={() => router.push('/dashboard/inventario')} className="flex-1 lg:flex-none group flex items-center gap-3 bg-white border-2 border-slate-200 p-2 pr-6 rounded-2xl hover:border-green-500 transition-all shadow-sm">
              <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center group-hover:bg-green-500 group-hover:text-white transition-colors">📥</div>
              <span className="text-[10px] font-black uppercase text-slate-500 group-hover:text-green-600">Novo Artigo</span>
            </button>
          </div>
        </header>

        {/* GRID DE KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          
          <div className={`p-8 rounded-[2.5rem] shadow-sm border transition-all ${kpis.artigosRutura > 0 ? 'bg-red-50 border-red-100' : 'bg-white border-slate-100'}`}>
            <p className={`text-[9px] font-black uppercase tracking-widest mb-1 ${kpis.artigosRutura > 0 ? 'text-red-400' : 'text-slate-400'}`}>Stock em Alerta</p>
            <div className="flex items-end gap-2">
              <p className={`text-5xl font-black leading-none ${kpis.artigosRutura > 0 ? 'text-red-500 animate-pulse' : 'text-slate-800'}`}>
                {kpis.artigosRutura}
              </p>
              <span className={`text-xs font-bold mb-1 uppercase italic ${kpis.artigosRutura > 0 ? 'text-red-300' : 'text-slate-300'}`}>Artigos</span>
            </div>
          </div>

          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Pedidos Pendentes</p>
            <div className="flex items-end gap-2">
              <p className="text-5xl font-black leading-none text-[#1e3a8a]">{kpis.pedidosPendentes}</p>
              <span className="text-xs font-bold text-slate-300 mb-1 uppercase italic">Fila</span>
            </div>
          </div>

          <div className="bg-[#1e3a8a] p-8 rounded-[2.5rem] shadow-lg lg:col-span-2 flex justify-between items-center text-white relative overflow-hidden group">
            <div className="relative z-10">
              <p className="text-[10px] font-black text-blue-300 uppercase tracking-widest mb-2 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping"></span>
                Valor Total em Inventário
              </p>
              <p className="text-5xl font-black italic tracking-tight group-hover:scale-105 transition-transform origin-left">
                {kpis.valorInventario.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}
              </p>
            </div>
            <div className="text-7xl opacity-[0.03] font-black absolute -right-4 -bottom-8 rotate-12 select-none pointer-events-none">LOTAÇOR</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* FEED DE ATIVIDADE */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            <div className="bg-white rounded-[3rem] p-8 md:p-10 shadow-sm border border-slate-100 flex-1">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-xl font-black text-[#0f172a] uppercase italic tracking-tighter">Atividade Recente</h2>
                <button onClick={() => router.push('/dashboard/admin/auditoria')} className="text-[9px] font-black text-[#1e3a8a] uppercase border-b-2 border-[#1e3a8a] hover:text-blue-800 transition-colors">
                  Ver Auditoria Completa
                </button>
              </div>
              
              <div className="space-y-3">
                {movimentosRecentes.length === 0 ? (
                  <p className="text-center text-slate-400 text-xs font-bold uppercase tracking-widest py-10">Sem movimentos registados hoje.</p>
                ) : movimentosRecentes.map((mov, i) => (
                  <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between p-5 rounded-3xl bg-slate-50/50 border border-slate-100 hover:bg-white hover:shadow-md transition-all gap-4">
                    <div className="flex items-center gap-5">
                      <div className={`w-12 h-12 shrink-0 rounded-2xl flex items-center justify-center text-xl shadow-inner ${
                        mov.tipo === 'Saída' ? 'bg-amber-100 text-amber-600' : 
                        mov.tipo === 'Entrada' ? 'bg-green-100 text-green-600' :
                        mov.tipo === 'Remoção' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'
                      }`}>
                        {mov.tipo === 'Saída' ? '📦' : mov.tipo === 'Entrada' ? '📥' : mov.tipo === 'Remoção' ? '🗑️' : '✨'}
                      </div>
                      <div>
                        <p className="font-black text-sm uppercase text-slate-800">{mov.produtos?.nome || "Registo Geral"}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">
                          {new Date(mov.created_at).toLocaleDateString('pt-PT')} às {new Date(mov.created_at).toLocaleTimeString('pt-PT')}
                          <span className="text-slate-300 ml-2">| {mov.tipo}</span>
                        </p>
                      </div>
                    </div>
                    {mov.quantidade !== 0 && (
                      <div className="text-right sm:block hidden">
                        <p className={`font-black text-xl ${mov.quantidade < 0 ? 'text-amber-600' : 'text-green-600'}`}>
                          {mov.quantidade > 0 ? '+' : ''}{mov.quantidade}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* COLUNA LATERAL - REPOSIÇÃO URGENTE */}
          <div className="flex flex-col gap-6">
            <div className="bg-red-50 border border-red-100 rounded-[3rem] p-8 shadow-lg shadow-red-900/5 flex-1 flex flex-col max-h-[600px]">
              <h2 className="text-sm font-black text-red-600 uppercase tracking-widest mb-6 flex items-center gap-3 shrink-0">
                <span className="animate-ping w-2.5 h-2.5 bg-red-600 rounded-full"></span> 
                Reposição Urgente
              </h2>
              
              <div className="space-y-4 overflow-y-auto pr-2 scrollbar-hide flex-1">
                {listaCritica.length > 0 ? listaCritica.map((p, i) => (
                  <div key={i} className="bg-white p-4 rounded-2xl border border-red-100 shadow-sm relative overflow-hidden group">
                    <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-red-500"></div>
                    <div className="pl-3">
                      <p className="text-xs font-black text-slate-800 uppercase leading-tight mb-2 group-hover:text-red-600 transition-colors">{p.nome}</p>
                      <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest">
                        <span className="text-slate-400">Mínimo: {p.min_calculado}</span>
                        <span className="bg-red-100 text-red-600 px-2 py-1 rounded-md">Stock: {p.quantidade}</span>
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="h-full flex flex-col items-center justify-center text-center opacity-60 py-10">
                    <span className="text-5xl mb-4">🛡️</span>
                    <p className="text-xs font-black text-green-600 uppercase tracking-widest">Stock Controlado</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase mt-2">Nenhum artigo abaixo do mínimo.</p>
                  </div>
                )}
              </div>
              
              {/* BOTÃO ALTERADO PARA REDIRECIONAR PARA A PÁGINA DE NECESSIDADES */}
              {listaCritica.length > 0 && (
                <button onClick={() => router.push('/dashboard/reposicao')} className="w-full mt-6 py-4 bg-red-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-red-700 shadow-lg shadow-red-600/30 transition-all shrink-0">
                  📋 Gerar Lista de Compras
                </button>
              )}
            </div>

            {/* Dica Automática */}
            <div className="bg-gradient-to-br from-amber-400 to-orange-500 rounded-[2.5rem] p-8 text-slate-900 shadow-lg relative overflow-hidden shrink-0">
              <div className="absolute -right-4 -top-4 text-7xl opacity-20">💡</div>
              <p className="text-[9px] font-black uppercase tracking-widest opacity-80 mb-2">Estado da Operação</p>
              <p className="font-bold text-sm leading-tight">
                {kpis.pedidosPendentes > 0 
                  ? `Existem ${kpis.pedidosPendentes} pedidos a aguardar aprovação ou processamento. Confere a fila de pedidos.` 
                  : "Todos os pedidos internos foram processados. Excelente trabalho!"}
              </p>
            </div>
          </div>

        </div>
      </div>
    </main>
  );
}