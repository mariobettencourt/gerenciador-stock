"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function InventarioLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  // Estados para os contadores das Badges
  const [totalCatalogo, setTotalCatalogo] = useState<number | null>(null);
  const [alertasReposicao, setAlertasReposicao] = useState<number | null>(null);

  // Vai buscar os números à base de dados para atualizar as abas
  const carregarContadores = async () => {
    try {
      const { count: countCat } = await supabase.from("produtos").select('*', { count: 'exact', head: true });
      setTotalCatalogo(countCat || 0);

      const { data: prods } = await supabase.from("produtos").select("quantidade, stock_minimo");
      if (prods) {
        const faltas = prods.filter(p => (p.quantidade || 0) <= (p.stock_minimo || 5)).length;
        setAlertasReposicao(faltas);
      }
    } catch (error) {
      console.error("Erro ao carregar contadores:", error);
    }
  };

  useEffect(() => {
    carregarContadores();
  }, [pathname]);

  // Definição das Tabs
  const tabs = [
    { 
      nome: "Catálogo", 
      rota: "/dashboard/inventario/catalogo", 
      icone: "📋", 
      badge: totalCatalogo,
      corBadge: "bg-blue-100 text-blue-700" 
    },
    { 
      nome: "Stock & Movimentos", 
      rota: "/dashboard/inventario/stock", 
      icone: "📦", 
      badge: null,
      corBadge: "" 
    },
    { 
      nome: "Reposição", 
      rota: "/dashboard/inventario/reposicao", 
      icone: "🛒", 
      badge: alertasReposicao,
      corBadge: (alertasReposicao && alertasReposicao > 0) ? "bg-red-500 text-white animate-pulse" : "bg-slate-200 text-slate-500" 
    },
  ];

  // --- O TRUQUE MÁGICO AQUI ---
  // Verifica se estamos na raiz (Visão Geral)
  const isVisaoGeral = pathname === "/dashboard/inventario";

  return (
    <main className="flex-1 p-8 md:p-12 overflow-y-auto h-screen bg-slate-50">
      
      {/* HEADER FIXO: SÓ MOSTRA SE NÃO ESTIVERMOS NA VISÃO GERAL */}
      {!isVisaoGeral && (
        <header className="mb-8">
          <div className="flex items-start gap-4">
            <button 
              onClick={() => router.push("/dashboard/inventario")} 
              className="mt-1 text-slate-400 hover:text-[#1e3a8a] transition-colors text-2xl leading-none"
              title="Voltar ao Centro de Controlo"
            >
              ←
            </button>
            <div>
              <h1 className="text-4xl font-black text-[#0f172a] tracking-tighter uppercase italic leading-none">
                Gestão de <span className="text-[#1e3a8a]">Armazém</span>
              </h1>
              <div className="h-1.5 w-24 bg-[#1e3a8a] rounded-full mt-3 mb-8"></div>
            </div>
          </div>

          {/* TABS (SEPARADORES) */}
          <div className="flex gap-2 overflow-x-auto pb-px border-b-2 border-slate-200 scrollbar-hide">
            {tabs.map((tab) => {
              const isActive = pathname === tab.rota;
              return (
                <button
                  key={tab.rota}
                  onClick={() => router.push(tab.rota)}
                  className={`px-8 py-4 font-black uppercase text-[10px] tracking-widest transition-all whitespace-nowrap rounded-t-2xl flex items-center gap-3 relative ${
                    isActive 
                      ? 'bg-[#1e3a8a] text-white shadow-lg' 
                      : 'bg-white text-slate-400 hover:bg-slate-100 hover:text-[#1e3a8a]'
                  }`}
                >
                  <span className="text-sm">{tab.icone}</span> 
                  {tab.nome}
                  
                  {/* BADGE DINÂMICA */}
                  {tab.badge !== null && (
                    <span className={`px-2 py-0.5 rounded-full text-[8px] font-black ${isActive && tab.badge > 0 && tab.nome === "Reposição" ? 'bg-red-500 text-white' : tab.corBadge}`}>
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </header>
      )}

      {/* CONTEÚDO DINÂMICO ENTRA AQUI */}
      <div className="animate-in fade-in duration-300">
        {children}
      </div>
      
    </main>
  );
}