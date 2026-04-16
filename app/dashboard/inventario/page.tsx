"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function Dashboard() {
  const [produtos, setProdutos] = useState<any[]>([]);
  const [aCarregar, setACarregar] = useState(true);
  const [pesquisa, setPesquisa] = useState("");

  // O Inventário já nem precisa de carregar o utilizador, 
  // porque a Sidebar no layout já faz isso!
  useEffect(() => {
    const iniciar = async () => {
      const { data } = await supabase.from("produtos").select("*").order("nome");
      setProdutos(data || []);
      setACarregar(false);
    };
    iniciar();
  }, []);

  const produtosFiltrados = produtos.filter(p => p.nome.toLowerCase().includes(pesquisa.toLowerCase()));

  // COMEÇA LOGO NO MAIN! Sem divs extra à volta e sem Sidebar.
  return (
    <main className="flex-1 p-12 overflow-y-auto w-full h-screen">
      <header className="flex justify-between items-center mb-12">
        <div>
          <h1 className="text-4xl font-black text-[#0f172a] tracking-tighter">Stock de <span className="text-[#1e3a8a] italic">Material</span></h1>
          <div className="h-1.5 w-24 bg-[#1e3a8a] rounded-full mt-2"></div>
        </div>
        <input 
          type="text" 
          placeholder="Procurar no inventário..." 
          value={pesquisa} 
          onChange={e => setPesquisa(e.target.value)} 
          className="pl-6 pr-6 py-4 bg-white shadow-xl shadow-blue-900/5 rounded-[2rem] w-80 outline-none focus:ring-2 ring-blue-100 font-medium text-sm" 
        />
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
                  <p className="text-[10px] text-gray-400 font-bold uppercase">{p.categoria || "Geral"}</p>
                </td>
                <td className="p-6 text-[10px] font-black text-blue-600 uppercase tracking-widest">{p.local || "Sede"}</td>
                <td className="p-6 text-center">
                  <span className={`px-4 py-1 rounded-full text-[10px] font-black uppercase ${p.quantidade <= (p.quantidade_minima || 0) ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                    {p.quantidade} un.
                  </span>
                </td>
                <td className="p-6 text-right font-bold text-gray-700 text-sm">€ {(p.preco || 0).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}