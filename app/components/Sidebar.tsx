"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  
  const [cargo, setCargo] = useState<string>("");
  const [relatoriosAberto, setRelatoriosAberto] = useState(pathname.includes("/dashboard/relatorios"));

  useEffect(() => {
    const carregarPerfil = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        const { data: perfil } = await supabase.from("perfis").select("cargo").eq("email", user.email).single();
        if (perfil) setCargo(perfil.cargo);
      }
    };
    carregarPerfil();
  }, []);

  // Sincronização: Fecha o menu se mudarmos para uma página que não seja relatório
  useEffect(() => {
    if (!pathname.includes("/dashboard/relatorios")) {
      setRelatoriosAberto(false);
    } else {
      setRelatoriosAberto(true);
    }
  }, [pathname]);

  const isAdmin = cargo ? cargo.toLowerCase().includes("admin") : false;

  // Função para estilização dinâmica dos botões
  const btnClass = (rota: string) => `w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all uppercase text-[10px] tracking-widest text-left ${
    pathname === rota ? 'bg-white text-[#1e3a8a] shadow-md font-bold' : 'text-blue-100 hover:bg-white/10'
  }`;

  // Lógica de Navegação e Toggle dos Relatórios
  const manejarCliqueRelatorios = () => {
    if (pathname.includes("/dashboard/relatorios")) {
      // Se já lá estamos, apenas abre/fecha
      setRelatoriosAberto(!relatoriosAberto);
    } else {
      // Se viermos de fora, abre e navega
      setRelatoriosAberto(true);
      router.push("/dashboard/relatorios");
    }
  };

  return (
    <aside className="w-64 bg-gradient-to-b from-[#0f172a] to-[#1e3a8a] text-white flex flex-col shadow-2xl shrink-0 h-screen z-50">
      
      {/* LOGO COMPACTO */}
      <div className="p-6 mb-2 flex items-center gap-3 border-b border-white/5">
        <div className="bg-white/10 p-1.5 rounded-lg border border-white/10 text-xl font-bold italic">🧊</div>
        <h1 className="text-lg font-black tracking-tighter italic uppercase">Lotaçor</h1>
      </div>
      
      {/* NAVEGAÇÃO PRINCIPAL */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto scrollbar-hide">
        <button onClick={() => router.push("/dashboard")} className={btnClass("/dashboard")}><span>🏠</span> Home</button>
        <button onClick={() => router.push("/dashboard/inventario")} className={btnClass("/dashboard/inventario")}><span>📋</span> Inventário</button>
        <button onClick={() => router.push("/dashboard/gestao")} className={btnClass("/dashboard/gestao")}><span>📦</span> Stock</button>
        <button onClick={() => router.push("/dashboard/pedidos")} className={btnClass("/dashboard/pedidos")}><span>📋</span> Pedidos</button>
        <button onClick={() => router.push("/dashboard/contactos")} className={btnClass("/dashboard/contactos")}><span>📇</span> Contactos</button>
        <button onClick={() => router.push("/dashboard/reposicao")} className={btnClass("/dashboard/reposicao")}><span>🛒</span> Reposição</button>

        {/* SECÇÃO RELATÓRIOS EXPANSÍVEL */}
        <div className="py-1">
          <button 
            onClick={manejarCliqueRelatorios} 
            className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl transition-all uppercase text-[10px] tracking-widest text-left ${pathname.includes("/dashboard/relatorios") ? 'bg-white/10 text-white font-bold' : 'text-blue-100 hover:bg-white/10'}`}
          >
            <div className="flex items-center gap-3"><span>📊</span> Relatórios</div>
            <span className={`text-[7px] transition-transform duration-300 ${relatoriosAberto ? 'rotate-180' : ''}`}>▼</span>
          </button>

          {relatoriosAberto && (
            <div className="mt-1 ml-6 border-l border-white/10 pl-2 space-y-0.5 animate-in slide-in-from-top-1 duration-200">
              <button onClick={() => router.push("/dashboard/relatorios/inventario")} className={`w-full text-left px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest ${pathname === "/dashboard/relatorios/inventario" ? 'text-amber-400 font-bold' : 'text-blue-300 hover:text-white'}`}>• Valor</button>
              <button onClick={() => router.push("/dashboard/relatorios/consumos")} className={`w-full text-left px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest ${pathname === "/dashboard/relatorios/consumos" ? 'text-amber-400 font-bold' : 'text-blue-300 hover:text-white'}`}>• Consumos</button>
              <button onClick={() => router.push("/dashboard/relatorios/artigos")} className={`w-full text-left px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest ${pathname === "/dashboard/relatorios/artigos" ? 'text-amber-400 font-bold' : 'text-blue-300 hover:text-white'}`}>• Estudo</button>
              <button onClick={() => router.push("/dashboard/relatorios/compras")} className={`w-full text-left px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest ${pathname === "/dashboard/relatorios/compras" ? 'text-amber-400 font-bold' : 'text-blue-300 hover:text-white'}`}>• Compras</button>
            </div>
          )}
        </div>

        <button onClick={() => router.push('/dashboard/perfil')} className={btnClass("/dashboard/perfil")}><span>👤</span> Perfil</button>

        {isAdmin && (
          <div className="mt-4 pt-4 border-t border-white/10">
            <button onClick={() => router.push("/dashboard/admin/inventarioadmin")} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all uppercase text-[10px] font-bold tracking-widest text-left ${pathname.includes("/dashboard/admin") ? 'bg-amber-500 text-[#0f172a]' : 'text-amber-500 hover:bg-white/10'}`}>
              <span>⚙️</span> Admin
            </button>
          </div>
        )}
      </nav>
      
      {/* BOTÃO SAIR NO FUNDO */}
      <div className="p-4 border-t border-white/5">
        <button 
          onClick={async () => { await supabase.auth.signOut(); router.push("/"); }} 
          className="w-full py-3 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-red-400 hover:bg-red-500/10 rounded-xl transition-all"
        >
          <span>🚪</span> Sair
        </button>
      </div>
    </aside>
  );
}