"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  
  const [cargo, setCargo] = useState<string>("A carregar...");
  const [email, setEmail] = useState<string>("");

  useEffect(() => {
    const carregarPerfil = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        setEmail(user.email);
        const { data: perfil } = await supabase.from("perfis").select("cargo").eq("email", user.email).single();
        if (perfil) setCargo(perfil.cargo);
      }
    };
    carregarPerfil();
  }, []);

  const isAdmin = cargo ? cargo.toLowerCase().includes("admin") : false;

  return (
    <aside className="w-72 bg-gradient-to-b from-[#0f172a] to-[#1e3a8a] text-white flex flex-col shadow-2xl shrink-0 h-screen z-50">
      <div className="p-8 mb-4 flex items-center gap-3">
        <div className="bg-white/10 p-2 rounded-xl backdrop-blur-md border border-white/20 text-2xl font-bold italic">🧊</div>
        <div>
          <h1 className="text-xl font-black tracking-tighter leading-none italic uppercase font-sans">Lotaçor</h1>
          <p className="text-[9px] font-bold text-blue-300 tracking-[0.3em] uppercase">Economato</p>
        </div>
      </div>
      
<nav className="flex-1 px-4 space-y-1 overflow-y-auto">
  <button onClick={() => router.push("/dashboard")} className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all uppercase text-[11px] tracking-widest text-left ${pathname === "/dashboard" ? 'bg-white text-[#1e3a8a] shadow-lg font-bold' : 'text-blue-100 hover:bg-white/10'}`}><span>🏠</span> Dashboard</button>
  <button onClick={() => router.push("/dashboard/inventario")} className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all uppercase text-[11px] tracking-widest text-left ${pathname === "/dashboard/inventario" ? 'bg-white text-[#1e3a8a] shadow-lg font-bold' : 'text-blue-100 hover:bg-white/10'}`}><span>🏠</span> Inventário</button>
  <button onClick={() => router.push("/dashboard/gestao")} className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all uppercase text-[11px] tracking-widest text-left ${pathname === "/dashboard/gestao" ? 'bg-white text-[#1e3a8a] shadow-lg font-bold' : 'text-blue-100 hover:bg-white/10'}`}><span>📦</span> Gestão Stock</button>
  <button onClick={() => router.push("/dashboard/pedidos")} className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all uppercase text-[11px] tracking-widest text-left ${pathname.includes("/dashboard/pedidos") ? 'bg-white text-[#1e3a8a] shadow-lg font-bold' : 'text-blue-100 hover:bg-white/10'}`}><span>📋</span> Pedidos</button>
  <button onClick={() => router.push("/dashboard/contactos")} className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all uppercase text-[11px] tracking-widest text-left ${pathname === "/dashboard/contactos" ? 'bg-white text-[#1e3a8a] shadow-lg font-bold' : 'text-blue-100 hover:bg-white/10'}`}><span>📇</span> Contactos</button>
  <button onClick={() => router.push("/dashboard/reposicao")} className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all uppercase text-[11px] tracking-widest text-left ${pathname.includes("/dashboard/reposicao") ? 'bg-white text-[#1e3a8a] shadow-lg font-bold' : 'text-blue-100 hover:bg-white/10'}`}><span>🛒</span> Necessidades</button>
  <button onClick={() => router.push("/dashboard/relatorios")} className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all uppercase text-[11px] tracking-widest text-left ${pathname.includes("/dashboard/relatorios") ? 'bg-white text-[#1e3a8a] shadow-lg font-bold' : 'text-blue-100 hover:bg-white/10'}`}><span>📊</span> Relatórios</button>
  <button 
  onClick={() => router.push('/dashboard/perfil')}
  className="flex items-center gap-3 w-full p-4 hover:bg-slate-100 rounded-2xl transition-all group"
>
  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center group-hover:bg-[#1e3a8a] group-hover:text-white transition-colors">
    👤
  </div>
  <span className="font-bold text-sm text-slate-600 group-hover:text-[#1e3a8a]">O Meu Perfil</span>
</button>
  {isAdmin && (
    <div className="mt-8 pt-4 border-t border-white/20">
      <button 
        onClick={() => router.push("/dashboard/admin")} 
        className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all uppercase text-[11px] font-bold tracking-widest text-left ${pathname.includes("/dashboard/admin") ? 'bg-amber-500 text-[#0f172a]' : 'text-amber-500 hover:bg-white/10'}`}
      >
        <span>⚙️</span> Painel Admin
      </button>
    </div>



  )}

  
</nav>
      
      <div className="m-6 p-4 bg-white/5 border border-white/10 rounded-[2rem] text-[10px]">
        <p className="font-black text-blue-300 uppercase mb-1 tracking-widest leading-none">{cargo}</p>
        <p className="opacity-70 truncate mb-4 font-medium">{email}</p>
        <button onClick={async () => { await supabase.auth.signOut(); router.push("/"); }} className="w-full py-3 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white rounded-xl font-black uppercase transition-all duration-300">Sair</button>
      </div>
    </aside>
  );
}