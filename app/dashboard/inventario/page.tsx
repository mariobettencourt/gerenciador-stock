"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function InventarioVisaoGeral() {
  const router = useRouter();
  const [estatisticas, setEstatisticas] = useState({ totalArtigos: 0, valorStock: 0, artigosEmFalta: 0 });
  const [aCarregar, setACarregar] = useState(true);

  useEffect(() => {
    const carregarResumo = async () => {
      const { data: produtos } = await supabase.from("produtos").select("quantidade, preco, stock_minimo");
      
      if (produtos) {
        let total = produtos.length;
        let valor = produtos.reduce((acc, p) => acc + ((p.quantidade || 0) * (p.preco || 0)), 0);
        let faltas = produtos.filter(p => (p.quantidade || 0) <= (p.stock_minimo || 5)).length;

        setEstatisticas({ totalArtigos: total, valorStock: valor, artigosEmFalta: faltas });
      }
      setACarregar(false);
    };
    
    carregarResumo();
  }, []);

  return (
    <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500">
      
      <div className="bg-white rounded-[3rem] p-10 md:p-12 shadow-sm border border-slate-100 flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden">
        <div className="absolute -right-10 -top-10 text-[15rem] opacity-[0.03] pointer-events-none select-none">🏢</div>
        <div className="z-10">
          <h2 className="text-3xl font-black text-[#0f172a] uppercase italic tracking-tighter mb-2">Centro de Controlo Logístico</h2>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Selecione um dos módulos abaixo para gerir o armazém da Lotaçor.</p>
        </div>
        
        {!aCarregar && (
          <div className="flex gap-6 z-10 bg-slate-50 p-6 rounded-3xl border border-slate-100">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Valor em Armazém</p>
              <p className="text-2xl font-black text-[#1e3a8a]">{estatisticas.valorStock.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}</p>
            </div>
            <div className="w-px bg-slate-200"></div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Alertas</p>
              <p className={`text-2xl font-black ${estatisticas.artigosEmFalta > 0 ? 'text-red-500' : 'text-green-500'}`}>
                {estatisticas.artigosEmFalta}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* CARD CATÁLOGO */}
        <button 
          onClick={() => router.push("/dashboard/inventario/catalogo")}
          className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-slate-100 hover:shadow-xl hover:-translate-y-2 transition-all text-left group"
        >
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center text-3xl mb-6 group-hover:bg-[#1e3a8a] group-hover:text-white transition-colors">📋</div>
          <h3 className="text-xl font-black text-[#0f172a] uppercase tracking-tighter mb-2">Catálogo</h3>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-6 h-10">Criação de novos artigos, edição de preços e consulta global.</p>
          <div className="text-[10px] font-black text-[#1e3a8a] uppercase tracking-widest flex items-center gap-2">Aceder ao Módulo <span className="group-hover:translate-x-2 transition-transform">→</span></div>
        </button>

        {/* CARD STOCK */}
        <button 
          onClick={() => router.push("/dashboard/inventario/stock")}
          className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-slate-100 hover:shadow-xl hover:-translate-y-2 transition-all text-left group"
        >
          <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center text-3xl mb-6 group-hover:bg-amber-500 group-hover:text-white transition-colors">📦</div>
          <h3 className="text-xl font-black text-[#0f172a] uppercase tracking-tighter mb-2">Movimentos</h3>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-6 h-10">Registo diário de Entradas e Saídas (consumos) do armazém.</p>
          <div className="text-[10px] font-black text-amber-600 uppercase tracking-widest flex items-center gap-2">Aceder ao Módulo <span className="group-hover:translate-x-2 transition-transform">→</span></div>
        </button>

        {/* CARD REPOSIÇÃO */}
        <button 
          onClick={() => router.push("/dashboard/inventario/reposicao")}
          className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-slate-100 hover:shadow-xl hover:-translate-y-2 transition-all text-left group relative overflow-hidden"
        >
          {estatisticas.artigosEmFalta > 0 && (
            <div className="absolute top-6 right-6 bg-red-500 text-white w-8 h-8 rounded-full flex items-center justify-center text-xs font-black animate-pulse shadow-lg shadow-red-500/40">
              {estatisticas.artigosEmFalta}
            </div>
          )}
          <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center text-3xl mb-6 group-hover:bg-red-500 group-hover:text-white transition-colors">🛒</div>
          <h3 className="text-xl font-black text-[#0f172a] uppercase tracking-tighter mb-2">Reposição</h3>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-6 h-10">Análise de quebras de stock e impressão de guias de encomenda.</p>
          <div className="text-[10px] font-black text-red-600 uppercase tracking-widest flex items-center gap-2">Aceder ao Módulo <span className="group-hover:translate-x-2 transition-transform">→</span></div>
        </button>
      </div>

    </div>
  );
}