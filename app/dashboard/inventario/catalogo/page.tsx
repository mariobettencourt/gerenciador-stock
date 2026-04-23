"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function CatalogoPage() {
  const [produtos, setProdutos] = useState<any[]>([]);
  const [aCarregar, setACarregar] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  // Estados de Pesquisa e Filtros
  const [pesquisa, setPesquisa] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState("Todas");

  // Estados de Criação
  const [modalCriar, setModalCriar] = useState(false);
  const [novoArtigo, setNovoArtigo] = useState({ nome: "", categoria: "Geral", local: "Sede", quantidade: 0, preco: 0 });
  const [novaCat, setNovaCat] = useState(false);
  const [novoLoc, setNovoLoc] = useState(false);

  useEffect(() => {
    const inicializar = async () => {
      await carregarProdutos();
      
      const { data } = await supabase.auth.getUser();
      if (data?.user?.id) {
        setUserId(data.user.id);
      }
    };
    inicializar();
  }, []);

  const carregarProdutos = async () => {
    setACarregar(true);
    const { data, error } = await supabase.from("produtos").select("*").order("nome");
    if (!error && data) {
      setProdutos(data);
    }
    setACarregar(false);
  };

  const categoriasUnicas = Array.from(new Set(produtos.map(p => p.categoria).filter(Boolean)));
  if (categoriasUnicas.length === 0) categoriasUnicas.push("Geral");

  const locaisBase = ["Sede", "Entreposto PDL", "Geral"];
  const locaisUnicos = Array.from(new Set([...locaisBase, ...produtos.map(p => p.local).filter(Boolean)]));

  const categoriasParaFiltro = ["Todas", ...Array.from(new Set(produtos.map(p => p.categoria || "Geral"))).sort()];

  // --- AÇÃO: CRIAR NOVO ARTIGO (COM SNAPSHOT DE PREÇO) ---
  const criarArtigo = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 1. Insere o produto na tabela 'produtos'
    const { data: produtoCriado, error } = await supabase.from("produtos").insert([{
      nome: novoArtigo.nome,
      categoria: novoArtigo.categoria,
      local: novoArtigo.local,
      quantidade: novoArtigo.quantidade,
      preco: novoArtigo.preco || 0
    }]).select().single();

    if (error) {
      alert("Erro ao criar artigo: " + error.message);
    } else {
      // 2. Regista na Auditoria COM O SNAPSHOT DO PREÇO
      await supabase.from("movimentos").insert({
        tipo: "Criação",
        utilizador: userId,
        produto_id: produtoCriado.id,
        quantidade: novoArtigo.quantidade,
        custo_unitario: novoArtigo.preco || 0, 
        observacao: `Adicionou o artigo "${novoArtigo.nome}" ao catálogo através do Inventário.`
      });

      setModalCriar(false);
      setNovoArtigo({ nome: "", categoria: "Geral", local: "Sede", quantidade: 0, preco: 0 });
      setNovaCat(false); setNovoLoc(false);
      carregarProdutos();
    }
  };

  const produtosFiltrados = produtos.filter(p => {
    const bateCertoPesquisa = p.nome.toLowerCase().includes(pesquisa.toLowerCase());
    const bateCertoCategoria = categoriaFiltro === "Todas" || (p.categoria || "Geral") === categoriaFiltro;
    return bateCertoPesquisa && bateCertoCategoria;
  });

  return (
    <div className="space-y-6">
      
      {/* --- BARRA DE FERRAMENTAS: Pesquisa e Botão --- */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="relative w-full md:w-[400px]">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
          <input 
            type="text" placeholder="Pesquisar artigo no catálogo..." value={pesquisa} onChange={e => setPesquisa(e.target.value)}
            className="w-full pl-12 pr-5 py-4 bg-white rounded-2xl shadow-sm border border-slate-200 font-bold text-sm text-[#1e3a8a] outline-none focus:border-blue-500 transition-all placeholder-slate-300"
          />
        </div>
        
        <button 
          onClick={() => setModalCriar(true)}
          className="w-full md:w-auto px-8 py-4 bg-[#1e3a8a] text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg hover:bg-blue-800 transition-all whitespace-nowrap"
        >
          + Novo Artigo
        </button>
      </div>

      {/* --- FILTROS DE CATEGORIA --- */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {categoriasParaFiltro.map(cat => (
          <button 
            key={cat} onClick={() => setCategoriaFiltro(cat)}
            className={`px-5 py-3 rounded-full font-black uppercase text-[9px] tracking-widest whitespace-nowrap transition-all ${
              categoriaFiltro === cat 
                ? 'bg-[#1e3a8a] text-white shadow-md' 
                : 'bg-white text-slate-400 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* --- TABELA DE CATÁLOGO --- */}
      <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden">
        {aCarregar ? (
          <div className="p-20 text-center text-blue-500 font-black uppercase tracking-widest animate-pulse text-xs">
            A sincronizar catálogo...
          </div>
        ) : produtosFiltrados.length === 0 ? (
          <div className="p-20 text-center text-slate-400 font-black uppercase tracking-widest text-xs border-4 border-dashed border-slate-50 m-8 rounded-3xl">
            Nenhum artigo encontrado.
          </div>
        ) : (
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-100 text-slate-400 font-black uppercase text-[10px] tracking-widest">
              <tr>
                <th className="p-5 pl-8">Artigo</th>
                <th className="p-5">Categoria</th>
                <th className="p-5">Localização</th>
                <th className="p-5 text-right pr-8">Stock Físico</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {produtosFiltrados.map((p) => (
                <tr key={p.id} className="hover:bg-blue-50/30 transition-colors group">
                  <td className="p-5 pl-8 font-black text-slate-800 uppercase text-sm">{p.nome}</td>
                  <td className="p-5">
                    <span className="bg-slate-100 text-slate-500 px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest">
                      {p.categoria || "Geral"}
                    </span>
                  </td>
                  <td className="p-5 text-xs font-bold text-slate-400 uppercase">📍 {p.local}</td>
                  <td className="p-5 text-right pr-8">
                    <span className={`text-lg font-black ${p.quantidade <= 5 ? 'text-red-500' : 'text-[#1e3a8a]'}`}>
                      {p.quantidade} <span className="text-[10px] text-slate-400">UN.</span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* --- MODAL CRIAR ARTIGO --- */}
      {modalCriar && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[60] p-6">
          <div className="bg-white rounded-[3.5rem] p-12 w-full max-w-xl shadow-2xl animate-in fade-in zoom-in duration-200">
             <h2 className="text-2xl font-black text-[#0f172a] mb-2 uppercase italic tracking-tighter">Registar <span className="text-[#1e3a8a]">Artigo</span></h2>
             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-8 pb-4 border-b border-slate-100">Adicionar novo material ao Economato</p>
             <form onSubmit={criarArtigo} className="space-y-5">
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase block mb-1.5 px-1 tracking-widest">Nome do Artigo</label>
                  <input required type="text" value={novoArtigo.nome} onChange={e => setNovoArtigo({...novoArtigo, nome: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-blue-500/30 focus:bg-white transition-all outline-none font-bold text-sm text-[#0f172a]" placeholder="Ex: Esferográfica Azul" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase block mb-1.5 px-1 tracking-widest">Categoria</label>
                    {novaCat ? (
                      <div className="flex gap-2">
                        <input autoFocus required type="text" value={novoArtigo.categoria} onChange={e => setNovoArtigo({...novoArtigo, categoria: e.target.value})} className="w-full p-4 rounded-2xl bg-blue-50 border-2 border-transparent outline-none font-bold text-sm" placeholder="Nova..." />
                        <button type="button" onClick={() => setNovaCat(false)} className="px-4 bg-slate-100 text-slate-500 rounded-xl font-black hover:bg-slate-200">X</button>
                      </div>
                    ) : (
                      <select required value={novoArtigo.categoria} onChange={e => {
                        if (e.target.value === "NOVA") { setNovaCat(true); setNovoArtigo({...novoArtigo, categoria: ""}); }
                        else { setNovoArtigo({...novoArtigo, categoria: e.target.value}); }
                      }} className="w-full p-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:bg-white transition-all outline-none font-bold text-sm text-[#1e3a8a]">
                        {categoriasUnicas.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                        <option value="NOVA" className="bg-blue-100 text-blue-800">➕ Criar Nova...</option>
                      </select>
                    )}
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase block mb-1.5 px-1 tracking-widest">Localização</label>
                    {novoLoc ? (
                      <div className="flex gap-2">
                        <input autoFocus required type="text" value={novoArtigo.local} onChange={e => setNovoArtigo({...novoArtigo, local: e.target.value})} className="w-full p-4 rounded-2xl bg-blue-50 border-2 border-transparent outline-none font-bold text-sm" placeholder="Novo..." />
                        <button type="button" onClick={() => { setNovoLoc(false); setNovoArtigo({...novoArtigo, local: locaisUnicos[0]}) }} className="px-4 bg-slate-100 text-slate-500 rounded-xl font-black hover:bg-slate-200">X</button>
                      </div>
                    ) : (
                      <select required value={novoArtigo.local} onChange={e => {
                        if (e.target.value === "NOVA") { setNovoLoc(true); setNovoArtigo({...novoArtigo, local: ""}); }
                        else { setNovoArtigo({...novoArtigo, local: e.target.value}); }
                      }} className="w-full p-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:bg-white transition-all outline-none font-bold text-sm text-[#1e3a8a]">
                        {locaisUnicos.map(local => <option key={local} value={local}>{local}</option>)}
                        <option value="NOVA" className="bg-blue-100 text-blue-800">➕ Criar Novo Local...</option>
                      </select>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase block mb-1.5 px-1 tracking-widest">Stock de Abertura</label>
                    <input type="number" min="0" value={novoArtigo.quantidade} onChange={e => setNovoArtigo({...novoArtigo, quantidade: parseInt(e.target.value) || 0})} className="w-full p-4 rounded-2xl bg-slate-50 border-none font-black text-lg text-slate-800" />
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase block mb-1.5 px-1 tracking-widest">Custo Ref. (€)</label>
                    <input type="number" step="0.01" min="0" value={novoArtigo.preco} onChange={e => setNovoArtigo({...novoArtigo, preco: parseFloat(e.target.value) || 0})} className="w-full p-4 rounded-2xl bg-slate-50 border-none font-black text-lg text-slate-800" />
                  </div>
                </div>
                <div className="flex gap-4 pt-4">
                  <button type="button" onClick={() => setModalCriar(false)} className="flex-1 py-5 bg-slate-100 text-slate-500 rounded-3xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-colors">Cancelar</button>
                  <button type="submit" className="flex-[2] py-5 bg-[#1e3a8a] text-white rounded-3xl font-black uppercase text-[10px] tracking-widest shadow-xl hover:bg-blue-800 transition-all">Adicionar ao Catálogo</button>
                </div>
             </form>
          </div>
        </div>
      )}
    </div>
  );
}