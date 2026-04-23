"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';

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
  const [dadosGrafico, setDadosGrafico] = useState<any[]>([]);

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

        // Ordenar por gravidade (quem tem menos stock face ao mínimo) e pegar apenas os 5 primeiros
        const top5Criticos = criticos
          .sort((a, b) => a.quantidade - b.quantidade)
          .slice(0, 5);

        setKpis({
          totalArtigos: produtos.length,
          valorInventario: totalVal,
          artigosRutura: emRutura,
          pedidosPendentes: pendentes || 0
        });
        setListaCritica(top5Criticos);
      }

      // 3. Movimentos Recentes
      const { data: movs } = await supabase
        .from("movimentos")
        .select(`id, created_at, tipo, quantidade, produtos (nome)`)
        .order("created_at", { ascending: false })
        .limit(5);
        
      if (movs) setMovimentosRecentes(movs);

      // 4. Lógica do Gráfico de Tendência (Últimos 7 dias)
      const seteDiasAtras = new Date();
      seteDiasAtras.setDate(seteDiasAtras.getDate() - 7);

      const { data: movsGrafico } = await supabase
        .from("movimentos")
        .select("created_at, quantidade")
        .eq("tipo", "Saída")
        .gte("created_at", seteDiasAtras.toISOString());

      if (movsGrafico) {
        const diasSemana = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
        const ultimos7Dias = Array.from({ length: 7 }, (_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - i);
          return {
            original: d.toLocaleDateString(),
            label: diasSemana[d.getDay()]
          };
        }).reverse();

        const contagemPorDia = ultimos7Dias.map(dia => {
          const totalSaidas = movsGrafico
            .filter(m => new Date(m.created_at).toLocaleDateString() === dia.original)
            .reduce((acc, m) => acc + Math.abs(m.quantidade), 0);
          return { dia: dia.label, quantidade: totalSaidas };
        });

        setDadosGrafico(contagemPorDia);
      }
      
      setACarregar(false);
    };

    carregarDashboard();
  }, []);

  if (aCarregar) return (
    <div className="p-12 text-center text-[#1e3a8a] font-black uppercase animate-pulse h-screen flex flex-col items-center justify-center gap-6 bg-slate-50">
      <div className="w-16 h-16 border-4 border-[#1e3a8a] border-t-transparent rounded-full animate-spin"></div>
      Sincronizando Centro de Comando...
    </div>
  );

  return (
    <main className="flex-1 p-6 md:p-10 lg:p-12 overflow-y-auto h-screen bg-slate-50 w-full scrollbar-hide">
      <div className="max-w-[1600px] mx-auto">
        
        <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-6">
          <div>
            <h1 className="text-4xl font-black text-[#0f172a] uppercase italic leading-none tracking-tighter">
              Centro de <span className="text-[#1e3a8a]">Comando</span>
            </h1>
            <div className="h-1.5 w-20 bg-[#1e3a8a] rounded-full mt-3"></div>
          </div>

          <div className="flex gap-3 w-full lg:w-auto">
            <button onClick={() => router.push('/dashboard/pedidos')} className="flex-1 lg:flex-none group flex items-center gap-3 bg-white border border-slate-200 p-2 pr-6 rounded-2xl hover:border-[#1e3a8a] transition-all shadow-sm">
              <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center group-hover:bg-[#1e3a8a] group-hover:text-white transition-colors">📋</div>
              <span className="text-[10px] font-black uppercase text-slate-500">Pedidos</span>
            </button>
            <button onClick={() => router.push('/dashboard/gestao')} className="flex-1 lg:flex-none group flex items-center gap-3 bg-white border border-slate-200 p-2 pr-6 rounded-2xl hover:border-green-500 transition-all shadow-sm">
              <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center group-hover:bg-green-500 group-hover:text-white transition-colors">📥</div>
              <span className="text-[10px] font-black uppercase text-slate-500">Entrada Stock</span>
            </button>
          </div>
        </header>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className={`p-8 rounded-[2.5rem] shadow-sm border ${kpis.artigosRutura > 0 ? 'bg-red-50 border-red-100' : 'bg-white border-slate-100'}`}>
            <p className={`text-[9px] font-black uppercase tracking-widest mb-2 ${kpis.artigosRutura > 0 ? 'text-red-400' : 'text-slate-400'}`}>Stock Crítico</p>
            <div className="flex items-end gap-2">
              <p className={`text-5xl font-black leading-none ${kpis.artigosRutura > 0 ? 'text-red-500 animate-pulse' : 'text-slate-800'}`}>{kpis.artigosRutura}</p>
              <span className="text-[10px] font-bold mb-1 uppercase italic text-slate-400">Artigos</span>
            </div>
          </div>

          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Pedidos em Fila</p>
            <div className="flex items-end gap-2">
              <p className="text-5xl font-black leading-none text-[#1e3a8a]">{kpis.pedidosPendentes}</p>
              <span className="text-[10px] font-bold text-slate-400 mb-1 uppercase italic text-slate-400">Pendentes</span>
            </div>
          </div>

          <div className="bg-[#1e3a8a] p-8 rounded-[2.5rem] shadow-lg lg:col-span-2 flex justify-between items-center text-white relative overflow-hidden group">
            <div className="relative z-10">
              <p className="text-[10px] font-black text-blue-300 uppercase tracking-widest mb-2 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping"></span>
                Valor em Inventário
              </p>
              <p className="text-4xl font-black italic tracking-tight">
                {kpis.valorInventario.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}
              </p>
            </div>
            <div className="text-7xl opacity-[0.05] font-black absolute -right-4 -bottom-8 rotate-12 italic">LOTAÇOR</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          <div className="lg:col-span-2 flex flex-col gap-8">
            <div className="bg-white rounded-[3rem] p-8 shadow-sm border border-slate-100">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-black text-[#0f172a] uppercase italic tracking-tighter">Fluxo de Saída (Semanal)</h2>
                <div className="flex items-center gap-2">
                   <div className="w-3 h-3 bg-[#1e3a8a] rounded-full"></div>
                   <span className="text-[9px] font-black text-slate-400 uppercase">Qtd Movimentada</span>
                </div>
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dadosGrafico}>
                    <defs>
                      <linearGradient id="colorSaida" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#1e3a8a" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#1e3a8a" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="dia" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold', fill: '#cbd5e1'}} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '15px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      itemStyle={{ fontWeight: 'bold', fontSize: '10px', color: '#1e3a8a' }}
                    />
                    <Area type="monotone" dataKey="quantidade" stroke="#1e3a8a" strokeWidth={4} fillOpacity={1} fill="url(#colorSaida)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white rounded-[3rem] p-8 shadow-sm border border-slate-100">
              <h2 className="text-lg font-black text-[#0f172a] uppercase italic tracking-tighter mb-6">Atividade de Hoje</h2>
              <div className="space-y-3">
                {movimentosRecentes.map((mov, i) => (
                  <div key={i} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100 transition-all">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${
                        mov.tipo === 'Saída' ? 'bg-amber-100 text-amber-600' : 
                        mov.tipo === 'Entrada' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'
                      }`}>
                        {mov.tipo === 'Saída' ? '📦' : '📥'}
                      </div>
                      <div>
                        <p className="font-black text-xs uppercase text-slate-700 truncate max-w-[150px] md:max-w-[300px]">{mov.produtos?.nome}</p>
                        <p className="text-[9px] text-slate-400 font-bold uppercase">{new Date(mov.created_at).toLocaleTimeString('pt-PT')} • {mov.tipo}</p>
                      </div>
                    </div>
                    <p className={`font-black text-base ${mov.quantidade < 0 ? 'text-amber-600' : 'text-green-600'}`}>
                      {mov.quantidade > 0 ? '+' : ''}{mov.quantidade}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-8">
            <div className="bg-white border border-slate-100 rounded-[3rem] p-8 shadow-sm flex flex-col h-full min-h-[400px]">
              <h2 className="text-xs font-black text-red-500 uppercase tracking-widest mb-6 flex items-center gap-2">
                <span className="w-2 h-2 bg-red-500 rounded-full"></span> 
                Reposição (Top 5)
              </h2>
              
              <div className="space-y-3 flex-1">
                {listaCritica.length > 0 ? listaCritica.map((p, i) => (
                  <div key={i} className="p-4 rounded-2xl bg-slate-50 border-l-4 border-red-500 shadow-sm transition-transform hover:scale-[1.02]">
                    <p className="text-[10px] font-black text-slate-800 uppercase leading-tight mb-2 truncate">{p.nome}</p>
                    <div className="flex justify-between items-center text-[9px] font-bold">
                      <span className="text-slate-400 uppercase">Min: {p.min_calculado}</span>
                      <span className="bg-red-100 text-red-600 px-2 py-0.5 rounded text-[8px] font-black uppercase">Stock: {p.quantidade}</span>
                    </div>
                  </div>
                )) : (
                  <div className="flex flex-col items-center justify-center h-full text-center opacity-40 py-10">
                    <span className="text-4xl mb-3">✅</span>
                    <p className="text-[9px] font-black uppercase text-slate-500">Stock OK</p>
                  </div>
                )}
                {kpis.artigosRutura > 5 && (
                  <p className="text-center text-[8px] font-black text-slate-300 uppercase tracking-widest pt-2">
                    + {kpis.artigosRutura - 5} artigos em alerta
                  </p>
                )}
              </div>
              {kpis.artigosRutura > 0 && (
                <button onClick={() => router.push('/dashboard/reposicao')} className="w-full mt-6 py-4 bg-[#1e3a8a] text-white rounded-2xl text-[9px] font-black uppercase tracking-widest hover:bg-[#0f172a] transition-all shadow-lg shadow-blue-900/10">
                  Gerar Lista Completa
                </button>
              )}
            </div>

            <div className="bg-gradient-to-br from-amber-400 to-orange-500 rounded-[2.5rem] p-8 text-[#0f172a] shadow-lg relative overflow-hidden shrink-0">
              <div className="absolute -right-4 -top-4 text-7xl opacity-10 rotate-12">💡</div>
              <p className="text-[9px] font-black uppercase tracking-widest opacity-60 mb-2 italic">Estado Operacional</p>
              <p className="font-bold text-xs leading-tight">
                {kpis.pedidosPendentes > 0 
                  ? `Prioridade: Processar os ${kpis.pedidosPendentes} pedidos em espera.` 
                  : "Não existem pedidos pendentes. O economato está atualizado!"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}