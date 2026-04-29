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

        // Ordenar por gravidade e pegar os 5 primeiros
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

      // 4. Gráfico de Tendência (Últimos 7 dias)
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
    <div className="p-12 text-center flex flex-col items-center justify-center min-h-screen bg-slate-50 w-full">
        <div className="w-12 h-12 border-4 border-blue-200 border-t-[#1e3a8a] rounded-full animate-spin mb-4"></div>
        <p className="font-black text-slate-400 uppercase tracking-widest text-[10px]">A sincronizar Centro de Comando...</p>
    </div>
  );

  return (
    <main className="flex-1 p-6 md:p-10 lg:p-12 overflow-y-auto min-h-screen bg-slate-50 w-full">
      <div className="max-w-[1600px] mx-auto">
        
        {/* CABEÇALHO */}
        <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end mb-10 gap-6">
          <div>
            <h1 className="text-4xl font-black text-[#0f172a] tracking-tighter uppercase italic leading-none">
              Centro de <span className="text-[#1e3a8a]">Comando</span>
            </h1>
            <div className="h-1.5 w-24 bg-[#1e3a8a] rounded-full mt-3"></div>
          </div>

          <div className="flex flex-wrap gap-4 w-full lg:w-auto">
            <button onClick={() => router.push('/dashboard/pedidos')} className="flex-1 lg:flex-none px-6 py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-sm hover:border-blue-300 hover:text-[#1e3a8a] transition-all flex items-center justify-center gap-2">
              <span className="text-sm">📋</span> Fluxo de Saída
            </button>
            <button onClick={() => router.push('/dashboard/inventario/stock')} className="flex-1 lg:flex-none px-6 py-4 bg-[#1e3a8a] text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-blue-900/20 hover:bg-[#0f172a] hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2">
              <span className="text-sm">📥</span> Entrada Stock
            </button>
          </div>
        </header>

        {/* --- PRIMEIRA LINHA: KPIS --- */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          
          {/* Valor de Inventário (Destaque) */}
          <div className="bg-[#1e3a8a] p-8 rounded-[2.5rem] shadow-xl md:col-span-2 relative overflow-hidden flex flex-col justify-center group">
            <div className="absolute -right-10 -bottom-10 text-8xl opacity-[0.05] font-black italic rotate-12 transition-transform group-hover:scale-110 duration-700">LOTAÇOR</div>
            <div className="relative z-10 flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <span className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-300 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-400"></span>
                        </span>
                        <p className="text-[10px] font-black text-blue-200 uppercase tracking-widest">Valor em Armazém</p>
                    </div>
                    <p className="text-5xl font-black italic tracking-tighter text-white drop-shadow-md">
                        {kpis.valorInventario.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}
                    </p>
                </div>
                <div className="bg-white/10 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/20">
                    <p className="text-[9px] font-black text-blue-200 uppercase tracking-widest text-right">Catálogo Ativo</p>
                    <p className="text-2xl font-black text-white text-right">{kpis.totalArtigos} <span className="text-xs font-bold text-blue-300">REF.</span></p>
                </div>
            </div>
          </div>

          {/* Pedidos em Fila */}
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col justify-center relative group hover:shadow-md transition-all">
            <div className="absolute top-6 right-6 w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <span className="text-xl">🛎️</span>
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Fila de Espera</p>
            <div className="flex items-end gap-2">
              <p className="text-6xl font-black leading-none text-[#0f172a]">{kpis.pedidosPendentes}</p>
            </div>
            {kpis.pedidosPendentes > 0 ? (
                <button onClick={() => router.push('/dashboard/pedidos')} className="mt-4 text-[9px] font-black uppercase tracking-widest text-amber-500 hover:text-amber-600 self-start border-b border-transparent hover:border-amber-500 transition-all">
                    Processar Agora →
                </button>
            ) : (
                <p className="mt-4 text-[9px] font-black uppercase tracking-widest text-emerald-500 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span> Economato em dia
                </p>
            )}
          </div>
        </div>

        {/* --- SEGUNDA LINHA: GRÁFICO E RASTO --- */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          
          {/* Gráfico Saídas */}
          <div className="lg:col-span-2 bg-white rounded-[3rem] p-8 shadow-sm border border-slate-100 flex flex-col h-[400px]">
            <div className="flex justify-between items-center mb-6">
              <div>
                  <h2 className="text-xl font-black text-[#0f172a] uppercase italic tracking-tighter">Saídas</h2>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Unidades Expedidas (Últimos 7 dias)</p>
              </div>
            </div>
            <div className="flex-1 w-full relative">
              {dadosGrafico.every(d => d.quantidade === 0) ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center opacity-30">
                      <span className="text-4xl mb-2">📊</span>
                      <p className="text-xs font-black uppercase text-slate-400">Sem atividade recente</p>
                  </div>
              ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dadosGrafico} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorSaida" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#1e3a8a" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#1e3a8a" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="dia" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold', fill: '#94a3b8'}} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold', fill: '#94a3b8'}} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)', padding: '12px 20px' }}
                        itemStyle={{ fontWeight: '900', fontSize: '14px', color: '#1e3a8a' }}
                        labelStyle={{ fontWeight: 'bold', fontSize: '10px', color: '#64748b', textTransform: 'uppercase' }}
                      />
                      <Area type="monotone" dataKey="quantidade" name="Unidades" stroke="#1e3a8a" strokeWidth={4} fillOpacity={1} fill="url(#colorSaida)" animationDuration={1500} />
                    </AreaChart>
                  </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Atividade de Hoje */}
          <div className="bg-white rounded-[3rem] p-8 shadow-sm border border-slate-100 flex flex-col h-[400px]">
            <h2 className="text-lg font-black text-[#0f172a] uppercase italic tracking-tighter mb-1">Últimos Registos</h2>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-6">Auditoria Rápida</p>
            
            <div className="flex-1 overflow-y-auto pr-2 space-y-4 scrollbar-hide">
              {movimentosRecentes.length === 0 ? (
                  <p className="text-center text-xs font-bold text-slate-400 italic mt-10">O armazém está calmo.</p>
              ) : (
                  movimentosRecentes.map((mov, i) => (
                    <div key={i} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:border-blue-100 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 ${
                          mov.tipo === 'Saída' ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'
                        }`}>
                          {mov.tipo === 'Saída' ? '📦' : '📥'}
                        </div>
                        <div>
                          <p className="font-black text-[11px] uppercase text-slate-700 leading-tight mb-0.5 line-clamp-1" title={Array.isArray(mov.produtos) ? mov.produtos[0]?.nome : mov.produtos?.nome}>
                              {Array.isArray(mov.produtos) ? mov.produtos[0]?.nome : mov.produtos?.nome}
                          </p>
                          <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">
                              {new Date(mov.created_at).toLocaleTimeString('pt-PT', {hour: '2-digit', minute:'2-digit'})} • {mov.tipo}
                          </p>
                        </div>
                      </div>
                      <p className={`font-black text-sm ml-2 shrink-0 ${mov.quantidade < 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                        {mov.quantidade > 0 ? '+' : ''}{mov.quantidade}
                      </p>
                    </div>
                  ))
              )}
            </div>
            
            <button onClick={() => router.push('/dashboard/inventario/movimentos')} className="mt-4 pt-4 border-t border-slate-100 text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-[#1e3a8a] text-center w-full transition-colors">
                Ver Todo o Histórico →
            </button>
          </div>
        </div>

        {/* --- TERCEIRA LINHA: ALERTAS --- */}
        <div className="bg-white border border-slate-100 rounded-[3rem] p-8 shadow-sm">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
              <div>
                  <h2 className="text-xl font-black text-[#0f172a] uppercase italic tracking-tighter flex items-center gap-2">
                    <span className={`w-3 h-3 rounded-full ${kpis.artigosRutura > 0 ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`}></span>
                    Alertas de Rutura
                  </h2>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Materiais abaixo do stock mínimo</p>
              </div>
              {kpis.artigosRutura > 0 && (
                  <button onClick={() => router.push('/dashboard/inventario/reposicao')} className="px-6 py-3 bg-red-50 text-red-600 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all border border-red-100">
                    Gerar Encomenda
                  </button>
              )}
          </div>
          
          {listaCritica.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  {listaCritica.map((p, i) => (
                    <div key={i} className="p-5 rounded-[2rem] bg-slate-50 border border-slate-100 border-l-4 border-l-red-500 hover:shadow-md transition-all flex flex-col justify-between min-h-[120px]">
                      <p className="text-[10px] font-black text-slate-800 uppercase leading-tight mb-4 line-clamp-2" title={p.nome}>{p.nome}</p>
                      <div className="flex justify-between items-end">
                        <div className="flex flex-col">
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Atual</span>
                            <span className="text-xl font-black text-red-600 leading-none">{p.quantidade}</span>
                        </div>
                        <div className="flex flex-col text-right">
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Mínimo</span>
                            <span className="text-sm font-black text-slate-500 leading-none">{p.min_calculado}</span>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
          ) : (
              <div className="flex flex-col items-center justify-center p-12 bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-100">
                <span className="text-4xl mb-4">🛡️</span>
                <p className="text-sm font-black text-emerald-600 uppercase tracking-widest">Armazém Protegido</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">Nenhum artigo atingiu a margem crítica de stock mínimo.</p>
              </div>
          )}
          
          {kpis.artigosRutura > 5 && (
            <div className="mt-4 text-center">
                <p className="text-[10px] font-black text-red-400 uppercase tracking-widest">
                Existem mais {kpis.artigosRutura - 5} materiais em alerta não mostrados aqui.
                </p>
            </div>
          )}
        </div>

      </div>
    </main>
  );
}