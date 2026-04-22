"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function EstudoArtigo() {
  const router = useRouter();
  const [produtos, setProdutos] = useState<any[]>([]);
  const [produtoSelecionado, setProdutoSelecionado] = useState<string>("");
  const [historico, setHistorico] = useState<any[]>([]);
  const [estatisticas, setEstatisticas] = useState({ totalEntradas: 0, totalSaidas: 0, custoMedio: 0 });
  const [aCarregar, setACarregar] = useState(false);

  useEffect(() => {
    const carregarLista = async () => {
      const { data } = await supabase.from("produtos").select("id, nome").order("nome");
      setProdutos(data || []);
    };
    carregarLista();
  }, []);

  useEffect(() => {
    if (produtoSelecionado) carregarHistoricoArtigo();
  }, [produtoSelecionado]);

  const carregarHistoricoArtigo = async () => {
    setACarregar(true);
    const { data: movs, error } = await supabase
      .from("movimentos")
      .select(`
        *,
        utilizador,
        pedidos (
          requisitante,
          contactos!contacto_id (nome)
        )
      `)
      .eq("produto_id", produtoSelecionado)
      .order("created_at", { ascending: false });

    if (movs) {
      setHistorico(movs);
      
      // Calcular Estatísticas Rápidas
      const entradas = movs.filter(m => m.quantidade > 0).reduce((acc, m) => acc + m.quantidade, 0);
      const saidas = movs.filter(m => m.quantidade < 0).reduce((acc, m) => acc + Math.abs(m.quantidade), 0);
      const precoSoma = movs.filter(m => m.tipo === 'Entrada' || m.tipo === 'Criação').reduce((acc, m) => acc + (m.custo_unitario || 0), 0);
      const precoCount = movs.filter(m => m.tipo === 'Entrada' || m.tipo === 'Criação').length;

      setEstatisticas({
        totalEntradas: entradas,
        totalSaidas: saidas,
        custoMedio: precoCount > 0 ? precoSoma / precoCount : 0
      });
    }
    setACarregar(false);
  };

  return (
    <main className="flex-1 p-8 md:p-12 bg-slate-50 h-screen overflow-y-auto">
      <button onClick={() => router.back()} className="mb-6 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-amber-500 transition-colors">
        ← Voltar ao Menu
      </button>

      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end mb-10 gap-6">
        <div>
          <h1 className="text-4xl font-black text-[#0f172a] tracking-tighter uppercase italic leading-none">
            Estudo de <span className="text-amber-500">Artigo</span>
          </h1>
          <div className="h-1.5 w-24 bg-amber-500 rounded-full mt-3"></div>
        </div>

        <div className="w-full lg:w-72">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Selecionar Material</p>
          <select 
            value={produtoSelecionado} 
            onChange={(e) => setProdutoSelecionado(e.target.value)}
            className="w-full p-4 rounded-2xl bg-white shadow-sm border border-slate-200 font-bold text-slate-700 outline-none focus:ring-2 ring-amber-500 transition-all"
          >
            <option value="">-- Escolha um Artigo --</option>
            {produtos.map(p => <option key={p.id} value={p.id}>{p.nome.toUpperCase()}</option>)}
          </select>
        </div>
      </header>

      {!produtoSelecionado ? (
        <div className="bg-white p-20 rounded-[3rem] text-center border-4 border-dashed border-slate-100 flex flex-col items-center">
          <span className="text-5xl mb-4">🔎</span>
          <p className="font-bold text-slate-300 uppercase text-xs tracking-widest">Selecione um artigo acima para ver o histórico completo.</p>
        </div>
      ) : aCarregar ? (
        <div className="text-center py-20 animate-pulse font-black text-slate-300 uppercase italic">A consultar arquivos...</div>
      ) : (
        <div className="space-y-8 animate-in fade-in duration-500">
          
          {/* CARDS DE RESUMO */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-[2rem] shadow-sm border-b-4 border-emerald-400">
              <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Total Entradas</p>
              <p className="text-2xl font-black text-emerald-600">+{estatisticas.totalEntradas} un.</p>
            </div>
            <div className="bg-white p-6 rounded-[2rem] shadow-sm border-b-4 border-red-400">
              <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Total Saídas</p>
              <p className="text-2xl font-black text-red-600">-{estatisticas.totalSaidas} un.</p>
            </div>
            <div className="bg-white p-6 rounded-[2rem] shadow-sm border-b-4 border-amber-400">
              <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Preço Médio de Aquisição</p>
              <p className="text-2xl font-black text-slate-800">{estatisticas.custoMedio.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}</p>
            </div>
          </div>

          {/* TABELA DE MOVIMENTOS */}
          <div className="bg-white rounded-[2.5rem] shadow-sm overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                  <th className="p-6">Data</th>
                  <th className="p-6">Tipo</th>
                  <th className="p-6">Origem/Destino</th>
                  <th className="p-6 text-center">Qtd</th>
                  <th className="p-6 text-right">Custo Unit.</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {historico.map((m, idx) => (
                  <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="p-6 font-medium text-slate-500">
                      {new Date(m.created_at).toLocaleDateString('pt-PT')}
                      <span className="block text-[9px] opacity-50">{new Date(m.created_at).toLocaleTimeString('pt-PT')}</span>
                    </td>
                    <td className="p-6">
                      <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase ${
                        m.quantidade > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
                      }`}>
                        {m.tipo}
                      </span>
                    </td>
                    <td className="p-6">
                      <p className="font-bold text-slate-700 uppercase truncate max-w-[200px]">
                        {m.pedidos?.contactos?.nome || m.observacao || "Sistema / Ajuste"}
                      </p>
                      <p className="text-[10px] text-slate-400 italic">{m.pedidos?.requisitante || ""}</p>
                    </td>
                    <td className={`p-6 text-center font-black ${m.quantidade > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {m.quantidade > 0 ? `+${m.quantidade}` : m.quantidade}
                    </td>
                    <td className="p-6 text-right font-bold text-slate-700">
                      {m.custo_unitario ? `${m.custo_unitario.toFixed(2)}€` : "---"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  );
}