"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function EstudoArtigo() {
  const router = useRouter();
  const [produtos, setProdutos] = useState<any[]>([]);
  const [produtoSelecionado, setProdutoSelecionado] = useState<any>(null);
  const [historico, setHistorico] = useState<any[]>([]);
  const [estatisticas, setEstatisticas] = useState({ totalEntradas: 0, totalSaidas: 0, custoMedio: 0 });
  const [aCarregar, setACarregar] = useState(false);

  // Estados para o Modal de Seleção
  const [modalAberto, setModalAberto] = useState(false);
  const [filtroPesquisa, setFiltroPesquisa] = useState("");
  const [categoriaAtiva, setCategoriaAtiva] = useState("Todas");

  useEffect(() => {
    const carregarLista = async () => {
      const { data } = await supabase.from("produtos").select("*").order("nome");
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
        pedidos (
          requisitante,
          contactos!contacto_id (nome)
        )
      `)
      .eq("produto_id", produtoSelecionado.id)
      .order("created_at", { ascending: false });

    if (movs) {
      setHistorico(movs);
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

  // Lógica de Filtros para o Modal
  const categorias = ["Todas", ...Array.from(new Set(produtos.map(p => p.categoria || "Geral")))].sort();
  const produtosFiltrados = produtos.filter(p => {
    const matchPesquisa = p.nome.toLowerCase().includes(filtroPesquisa.toLowerCase());
    const matchCategoria = categoriaAtiva === "Todas" || p.categoria === categoriaAtiva;
    return matchPesquisa && matchCategoria;
  });

  return (
    <main className="flex-1 p-8 md:p-12 bg-slate-50 min-h-screen overflow-y-auto">
      
      {/* BOTÃO VOLTAR */}
      <button onClick={() => router.back()} className="mb-6 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-amber-500 transition-colors flex items-center gap-2">
        <span>←</span> Voltar ao Menu
      </button>

      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end mb-10 gap-6">
        <div>
          <h1 className="text-4xl font-black text-[#0f172a] tracking-tighter uppercase italic leading-none">
            Estudo de <span className="text-amber-500">Artigo</span>
          </h1>
          <div className="h-1.5 w-24 bg-amber-500 rounded-full mt-3"></div>
        </div>

        {/* SELETOR DE ARTIGO MODERNO */}
        <button 
          onClick={() => setModalAberto(true)}
          className="w-full lg:w-auto px-8 py-4 bg-white border-2 border-slate-200 rounded-2xl shadow-sm hover:border-amber-500 transition-all flex items-center justify-between gap-4 group"
        >
          <div className="text-left">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Material em Análise</p>
            <p className="font-black text-[#1e3a8a] uppercase truncate max-w-[200px]">
              {produtoSelecionado ? produtoSelecionado.nome : "Selecionar Artigo..."}
            </p>
          </div>
          <span className="text-xl group-hover:scale-125 transition-transform">🔍</span>
        </button>
      </header>

      {!produtoSelecionado ? (
        <div className="bg-white p-20 rounded-[3rem] text-center border-4 border-dashed border-slate-100 flex flex-col items-center">
          <span className="text-5xl mb-4">📊</span>
          <p className="font-bold text-slate-300 uppercase text-[10px] tracking-widest leading-relaxed">
            Abra o explorador acima para analisar<br/>o histórico de um material.
          </p>
        </div>
      ) : aCarregar ? (
        <div className="text-center py-20 animate-pulse font-black text-slate-300 uppercase italic">A consultar arquivos de armazém...</div>
      ) : (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          
          {/* CARDS DE RESUMO */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-[2rem] shadow-sm border-b-4 border-emerald-400 group hover:-translate-y-1 transition-all">
              <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Total Entradas</p>
              <p className="text-3xl font-black text-emerald-600">+{estatisticas.totalEntradas} <span className="text-xs">un.</span></p>
            </div>
            <div className="bg-white p-6 rounded-[2rem] shadow-sm border-b-4 border-red-400 group hover:-translate-y-1 transition-all">
              <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Total Saídas</p>
              <p className="text-3xl font-black text-red-600">-{estatisticas.totalSaidas} <span className="text-xs">un.</span></p>
            </div>
            <div className="bg-white p-6 rounded-[2rem] shadow-sm border-b-4 border-amber-400 group hover:-translate-y-1 transition-all">
              <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Custo Médio de Aquisição</p>
              <p className="text-3xl font-black text-slate-800">{estatisticas.custoMedio.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}</p>
            </div>
          </div>

          {/* TABELA DE MOVIMENTOS */}
          <div className="bg-white rounded-[2.5rem] shadow-sm overflow-hidden border border-slate-100">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/80 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                  <th className="p-6">Data / Hora</th>
                  <th className="p-6">Tipo</th>
                  <th className="p-6">Interveniente / Observação</th>
                  <th className="p-6 text-center">Quantidade</th>
                  <th className="p-6 text-right">Preço Unit.</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {historico.map((m, idx) => (
                  <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="p-6 font-medium text-slate-500">
                      <span className="font-black text-slate-700">{new Date(m.created_at).toLocaleDateString('pt-PT')}</span>
                      <span className="block text-[10px] opacity-50 uppercase">{new Date(m.created_at).toLocaleTimeString('pt-PT', {hour: '2-digit', minute:'2-digit'})}</span>
                    </td>
                    <td className="p-6">
                      <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase ${
                        m.quantidade > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
                      }`}>
                        {m.tipo}
                      </span>
                    </td>
                    <td className="p-6">
                      <p className="font-bold text-slate-700 uppercase text-xs truncate max-w-[250px]">
                        {m.pedidos?.contactos?.nome || m.observacao || "Ajuste de Sistema"}
                      </p>
                      <p className="text-[10px] text-slate-400 font-bold italic">{m.pedidos?.requisitante || ""}</p>
                    </td>
                    <td className={`p-6 text-center font-black text-lg ${m.quantidade > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {m.quantidade > 0 ? `+${m.quantidade}` : m.quantidade}
                    </td>
                    <td className="p-6 text-right font-bold text-slate-800">
                      {m.custo_unitario ? `${m.custo_unitario.toFixed(2)}€` : "---"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL EXPLORADOR DE ARTIGOS */}
      {modalAberto && (
        <div className="fixed inset-0 bg-[#0f172a]/90 backdrop-blur-sm z-[100] flex items-center justify-center p-4 md:p-12">
          <div className="bg-white w-full max-w-5xl h-[80vh] rounded-[3rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            
            {/* Header do Modal */}
            <div className="p-8 border-b flex flex-col md:flex-row justify-between items-center gap-6">
              <div>
                <h2 className="text-2xl font-black text-[#1e3a8a] uppercase italic tracking-tighter leading-none">Explorador de Catálogo</h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">Selecione o artigo para ver o extrato</p>
              </div>
              
              <div className="flex items-center gap-4 w-full md:w-auto">
                <input 
                  type="text" 
                  placeholder="Pesquisar artigo..."
                  value={filtroPesquisa}
                  onChange={(e) => setFiltroPesquisa(e.target.value)}
                  className="flex-1 md:w-64 p-4 bg-slate-100 rounded-2xl text-xs font-bold outline-none focus:ring-2 ring-amber-500 transition-all"
                />
                <button 
                  onClick={() => setModalAberto(false)}
                  className="p-4 bg-slate-100 text-slate-400 hover:bg-red-50 hover:text-red-500 rounded-2xl transition-all font-black"
                >
                  FECHAR
                </button>
              </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
              {/* Sidebar de Categorias */}
              <div className="w-48 bg-slate-50 border-r overflow-y-auto p-4 hidden md:block">
                <p className="text-[9px] font-black text-slate-300 uppercase tracking-[0.2em] mb-4 px-2">Categorias</p>
                <div className="space-y-2">
                  {categorias.map(cat => (
                    <button
                      key={cat}
                      onClick={() => setCategoriaAtiva(cat)}
                      className={`w-full text-left px-4 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${
                        categoriaAtiva === cat ? 'bg-[#1e3a8a] text-white shadow-lg' : 'text-slate-400 hover:bg-slate-200'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Grelha de Produtos */}
              <div className="flex-1 overflow-y-auto p-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {produtosFiltrados.map(p => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setProdutoSelecionado(p);
                        setModalAberto(false);
                      }}
                      className="p-6 border-2 border-slate-50 rounded-[2rem] text-left hover:border-amber-500 hover:bg-amber-50/30 transition-all group"
                    >
                      <p className="text-[8px] font-black text-slate-300 uppercase mb-1 tracking-widest">{p.categoria}</p>
                      <h4 className="font-black text-[#0f172a] uppercase text-xs group-hover:text-[#1e3a8a] leading-tight">{p.nome}</h4>
                      <div className="mt-4 flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">📍 {p.local}</span>
                        <span className="bg-white px-2 py-1 rounded-lg text-[10px] font-black text-[#1e3a8a] border border-slate-100 shadow-sm">
                          {p.quantidade} un.
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
                
                {produtosFiltrados.length === 0 && (
                  <div className="text-center py-20">
                    <p className="text-slate-300 font-black uppercase text-xs">Nenhum material encontrado com estes filtros.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

    </main>
  );
}