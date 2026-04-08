"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function Dashboard() {
  const router = useRouter();
  const [produtos, setProdutos] = useState<any[]>([]);
  const [aCarregar, setACarregar] = useState(true);
  const [cargo, setCargo] = useState<string | null>(null);
  const [emailUtilizador, setEmailUtilizador] = useState<string>("");
  const [pesquisa, setPesquisa] = useState("");

  useEffect(() => {
    const iniciar = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        setEmailUtilizador(user.email);
        const { data: perfil } = await supabase.from("perfis").select("cargo").eq("email", user.email).single();
        if (perfil) setCargo(perfil.cargo);
      }
      const { data } = await supabase.from("produtos").select("*").order("nome");
      setProdutos(data || []);
      setACarregar(false);
    };
    iniciar();
  }, []);

  const produtosFiltrados = produtos.filter(p => p.nome.toLowerCase().includes(pesquisa.toLowerCase()));

  return (
    <div className="flex h-screen bg-[#f8fafc] font-sans">
      {/* SIDEBAR GOURMET */}
      <aside className="w-72 bg-gradient-to-b from-[#0f172a] to-[#1e3a8a] text-white flex flex-col shadow-2xl">
        <div className="p-8 mb-4 flex items-center gap-3">
          <div className="bg-white/10 p-2 rounded-xl backdrop-blur-md border border-white/20 text-2xl">🧊</div>
          <div>
            <h1 className="text-xl font-black tracking-tighter leading-none italic uppercase">Lotaçor</h1>
            <p className="text-[9px] font-bold text-blue-300 tracking-[0.3em] uppercase">Economato</p>
          </div>
        </div>
        <nav className="flex-1 px-4 space-y-1">
          <button onClick={() => router.push("/dashboard")} className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl bg-white text-[#1e3a8a] shadow-lg font-bold uppercase text-[11px] tracking-widest"><span>🏠</span> Inventário</button>
          <button onClick={() => router.push("/dashboard/gestao")} className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl text-blue-100 hover:bg-white/10 transition-all uppercase text-[11px] tracking-widest"><span>📦</span> Gestão Stock</button>
          <button onClick={() => router.push("/dashboard/pedidos")} className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl text-blue-100 hover:bg-white/10 transition-all uppercase text-[11px] tracking-widest"><span>📋</span> Pedidos</button>
          <button onClick={() => router.push("/dashboard/contactos")} className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl text-blue-100 hover:bg-white/10 transition-all uppercase text-[11px] tracking-widest"><span>📇</span> Contactos</button>
          <button onClick={() => router.push("/dashboard/movimentos")} className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl text-blue-100 hover:bg-white/10 transition-all uppercase text-[11px] tracking-widest"><span>🔄</span> Movimentos</button>
        </nav>
        <div className="m-6 p-4 bg-white/5 border border-white/10 rounded-[2rem] text-xs">
          <p className="font-black text-blue-300 uppercase mb-1 tracking-widest">{cargo}</p>
          <p className="opacity-70 truncate mb-4">{emailUtilizador}</p>
          <button onClick={async () => { await supabase.auth.signOut(); router.push("/"); }} className="w-full py-3 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white rounded-xl font-black uppercase transition-all">Sair</button>
        </div>
      </aside>

      <main className="flex-1 p-12 overflow-y-auto">
        <header className="flex justify-between items-center mb-12">
          <div>
            <h1 className="text-4xl font-black text-[#0f172a] tracking-tighter">Stock de <span className="text-[#1e3a8a] italic">Material</span></h1>
            <div className="h-1.5 w-24 bg-[#1e3a8a] rounded-full mt-2"></div>
          </div>
          <input type="text" placeholder="Procurar no inventário..." value={pesquisa} onChange={e => setPesquisa(e.target.value)} className="pl-6 pr-6 py-4 bg-white shadow-xl shadow-blue-900/5 rounded-[2rem] w-80 outline-none focus:ring-2 ring-blue-100 font-medium text-sm" />
        </header>

        <div className="bg-white rounded-[2.5rem] shadow-xl shadow-blue-900/[0.03] overflow-hidden border border-white">
          <table className="w-full text-left">
            <thead className="bg-[#f8fafc] text-[#1e3a8a] uppercase text-[10px] tracking-[0.2em] font-black border-b">
              <tr>
                <th className="p-6">Material</th>
                <th className="p-6">Armazém</th>
                <th className="p-6 text-center">Quantidade</th>
                <th className="p-6 text-right">Valor Unit.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {produtosFiltrados.map((p) => (
                <tr key={p.id} className="hover:bg-blue-50/30 transition-colors group">
                  <td className="p-6">
                    <p className="font-black text-[#0f172a] uppercase text-sm tracking-tighter">{p.nome}</p>
                    <p className="text-[10px] text-gray-400 font-bold uppercase">{p.categoria}</p>
                  </td>
                  <td className="p-6 text-[10px] font-black text-blue-600 uppercase tracking-widest">{p.local}</td>
                  <td className="p-6 text-center">
                    <span className={`px-4 py-1 rounded-full text-[10px] font-black uppercase ${p.quantidade <= p.quantidade_minima ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>{p.quantidade} un.</span>
                  </td>
                  <td className="p-6 text-right font-bold text-gray-700 text-sm">€ {p.preco.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}