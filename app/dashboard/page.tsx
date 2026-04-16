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
      const { data: produtos } = await supabase.from("produtos").select("quantidade, preco, stock_minimo, nome");
      
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
          totalVal += (p.quantidade || 0) * (p.preco || 0);
          if ((p.quantidade || 0) <= (p.stock_minimo || 5)) {
            emRutura++;
            criticos.push(p);
          }
        });

        setKpis({
          totalArtigos: produtos.length,
          valorInventario: totalVal,
          artigosRutura: emRutura,
          pedidosPendentes: pendentes || 0
        });
        setListaCritica(criticos.slice(0, 3)); // Apenas os 3 primeiros para o widget
      }

      // 3. Movimentos Recentes
      const { data: movs } = await supabase
        .from("movimentos")
        .select(`id, created_at, tipo, quantidade, utilizador, produtos(nome)`)
        .order("created_at", { ascending: false })
        .limit(6);
        
      if (movs) setMovimentosRecentes(movs);
      setACarregar(false);
    };

    carregarDashboard();
  }, []);

  if (aCarregar) return (
    <div className="p-12 text-center text-[#1e3a8a] font-black uppercase animate-pulse h-screen flex flex-col items-center justify-center gap-4">
      <div className="w-12 h-12 border-4 border-[#1e3a8a] border-t-transparent rounded-full animate-spin"></div>
      Sincronizando Sistemas...
    </div>
  );

  return (
    <main className="flex-1 p-8 md:p-12 overflow-y-auto h-screen bg-slate-50">
      
      {/* CABEÇALHO COM AÇÕES RÁPIDAS */}
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-10 gap-6">
        <div>
          <h1 className="text-4xl font-black text-[#0f172a] uppercase italic leading-none tracking-tighter">
            Centro de <span className="text-[#1e3a8a]">Comando</span>
          </h1>
          <div className="h-1.5 w-24 bg-[#1e3a8a] rounded-full mt-3 mb-2"></div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Controlo de Atividade e Stock</p>
        </div>

        <div className="flex gap-3">
          <button onClick={() => router.push('/dashboard/pedidos')} className="group flex items-center gap-3 bg-white border-2 border-slate-200 p-2 pr-6 rounded-2xl hover:border-[#1e3a8a] transition-all shadow-sm">
            <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center group-hover:bg-[#1e3a8a] group-hover:text-white transition-colors">➕</div>
            <span className="text-[10px] font-black uppercase text-slate-500 group-hover:text-[#1e3a8a]">Novo Pedido</span>
          </button>
          <button onClick={() => router.push('/dashboard/inventario')} className="group flex items-center gap-3 bg-white border-2 border-slate-200 p-2 pr-6 rounded-2xl hover:border-green-500 transition-all shadow-sm">
            <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center group-hover:bg-green-500 group-hover:text-white transition-colors">📥</div>
            <span className="text-[10px] font-black uppercase text-slate-500 group-hover:text-green-600">Entrada Stock</span>
          </button>
        </div>
      </header>

      {/* GRID DE KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Stock em Alerta</p>
          <div className="flex items-end gap-2">
            <p className={`text-4xl font-black ${kpis.artigosRutura > 0 ? 'text-red-500' : 'text-slate-800'}`}>{kpis.artigosRutura}</p>
            <span className="text-xs font-bold text-slate-300 mb-1 uppercase italic">Itens</span>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Pedidos Pendentes</p>
          <div className="flex items-end gap-2">
            <p className="text-4xl font-black text-[#1e3a8a]">{kpis.pedidosPendentes}</p>
            <span className="text-xs font-bold text-slate-300 mb-1 uppercase italic">Fila</span>
          </div>
        </div>

        <div className="bg-[#1e3a8a] p-8 rounded-[2.5rem] shadow-lg lg:col-span-2 flex justify-between items-center text-white relative overflow-hidden">
          <div className="relative z-10">
            <p className="text-[9px] font-black text-blue-300 uppercase tracking-widest mb-1">Valor Total em Inventário</p>
            <p className="text-4xl font-black italic">{kpis.valorInventario.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}</p>
          </div>
          <div className="text-6xl opacity-10 font-black absolute -right-4 -bottom-4 rotate-12">LOTACOR</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* FEED DE ATIVIDADE (2/3 da largura) */}
        <div className="lg:col-span-2 bg-white rounded-[3rem] p-10 shadow-sm border border-slate-100">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-xl font-black text-[#0f172a] uppercase italic tracking-tighter">Atividade Recente</h2>
            <button onClick={() => router.push('/dashboard/relatorios')} className="text-[9px] font-black text-[#1e3a8a] uppercase border-b-2 border-[#1e3a8a]">Ver Histórico Completo</button>
          </div>
          
          <div className="space-y-3">
            {movimentosRecentes.map((mov, i) => (
              <div key={i} className="flex items-center justify-between p-5 rounded-3xl bg-slate-50/50 border border-slate-100 hover:bg-white hover:shadow-md transition-all">
                <div className="flex items-center gap-5">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl ${mov.tipo === 'Saída' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'}`}>
                    {mov.tipo === 'Saída' ? '📤' : '📥'}
                  </div>
                  <div>
                    <p className="font-black text-xs uppercase text-slate-800">{mov.produtos?.nome}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">
                      {new Date(mov.created_at).toLocaleTimeString('pt-PT')} • {mov.utilizador || "Admin"}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-black text-lg ${mov.tipo === 'Saída' ? 'text-blue-600' : 'text-green-600'}`}>
                    {mov.tipo === 'Saída' ? '-' : '+'}{Math.abs(mov.quantidade)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* COLUNA LATERAL - REPOSIÇÃO URGENTE */}
        <div className="flex flex-col gap-6">
          <div className="bg-white rounded-[3rem] p-8 shadow-sm border border-slate-100 flex-1">
            <h2 className="text-xs font-black text-red-500 uppercase tracking-widest mb-6 flex items-center gap-2">
              <span className="animate-ping w-2 h-2 bg-red-500 rounded-full"></span> 
              Reposição Urgente
            </h2>
            <div className="space-y-6">
              {listaCritica.length > 0 ? listaCritica.map((p, i) => (
                <div key={i} className="relative pl-6 border-l-2 border-slate-100">
                  <p className="text-[10px] font-black text-slate-800 uppercase leading-none mb-1">{p.nome}</p>
                  <p className="text-[10px] font-bold text-slate-400">STOCK ATUAL: <span className="text-red-500">{p.quantidade}</span></p>
                </div>
              )) : (
                <p className="text-[10px] font-bold text-green-500 uppercase italic">Tudo sob controlo!</p>
              )}
            </div>
            <button onClick={() => router.push('/dashboard/reposicao')} className="w-full mt-8 py-4 bg-slate-900 text-white rounded-2xl text-[9px] font-black uppercase tracking-widest hover:bg-[#1e3a8a] transition-colors">Gerar Lista de Compras</button>
          </div>

          <div className="bg-gradient-to-br from-amber-400 to-orange-500 rounded-[3rem] p-8 text-slate-900 shadow-lg">
             <p className="text-[9px] font-black uppercase opacity-60">Dica do Sistema</p>
             <p className="font-bold text-sm mt-2 italic leading-tight">"A Unidade de Ponta Delgada aumentou o consumo de Ribbons em 15% esta semana."</p>
          </div>
        </div>

      </div>
    </main>
  );
}