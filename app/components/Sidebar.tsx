"use client";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function Sidebar({ cargo, email }: { cargo: string | null, email: string }) {
  const router = useRouter();
  const pathname = usePathname();

  const menus = [
    { n: "Inventário", i: "🏠", path: "/dashboard" },
    { n: "Gestão Stock", i: "📦", path: "/dashboard/gestao" },
    { n: "Pedidos", i: "📋", path: "/dashboard/pedidos" },
    { n: "Contactos", i: "📇", path: "/dashboard/contactos" },
    { n: "Movimentos", i: "🔄", path: "/dashboard/movimentos" },
  ];

  return (
    <aside className="w-72 bg-gradient-to-b from-[#0f172a] to-[#1e3a8a] text-white flex flex-col shadow-xl shrink-0">
      <div className="p-8 mb-4 flex items-center gap-3">
        <div className="bg-white/10 p-2 rounded-xl backdrop-blur-md border border-white/20 text-2xl font-bold italic">🧊</div>
        <div>
          <h1 className="text-xl font-black tracking-tighter leading-none italic uppercase">Lotaçor</h1>
          <p className="text-[9px] font-bold text-blue-300 tracking-[0.3em] uppercase">Economato</p>
        </div>
      </div>
      <nav className="flex-1 px-4 space-y-1">
        {menus.map((m) => (
          <button
            key={m.path}
            onClick={() => router.push(m.path)}
            className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all uppercase text-[11px] tracking-widest text-left ${
              pathname === m.path ? 'bg-white text-[#1e3a8a] shadow-lg font-bold' : 'text-blue-100 hover:bg-white/10'
            }`}
          >
            <span>{m.i}</span> {m.n}
          </button>
        ))}
      </nav>
      <div className="m-6 p-4 bg-white/5 border border-white/10 rounded-[2rem] text-[10px]">
        <p className="font-black text-blue-300 uppercase mb-1 tracking-widest leading-none">{cargo || "A carregar..."}</p>
        <p className="opacity-70 truncate mb-4 font-medium">{email}</p>
        <button 
          onClick={async () => { await supabase.auth.signOut(); router.push("/"); }} 
          className="w-full py-3 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white rounded-xl font-black uppercase transition-all"
        >
          Sair
        </button>
      </div>
    </aside>
  );
}