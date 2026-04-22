"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AdminInventario() {
  const [produtos, setProdutos] = useState<any[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [processando, setProcessando] = useState(false);
  
  // Estados de Edição
  const [artigoEmEdicao, setArtigoEmEdicao] = useState<any>(null); 
  const [novaCatEditar, setNovaCatEditar] = useState(false);
  const [novoLocEditar, setNovoLocEditar] = useState(false);
  
  // Estados de Criação
  const [modalCriar, setModalCriar] = useState(false);
  const [novoArtigo, setNovoArtigo] = useState({ 
    nome: "", 
    categoria: "Geral", 
    local: "Sede", 
    quantidade: 0, 
    preco: 0, 
    stock_minimo: 5 
  });
  const [novaCat, setNovaCat] = useState(false);
  const [novoLoc, setNovoLoc] = useState(false);

  // Estados para pesquisa, filtros e ordenação
  const [pesquisa, setPesquisa] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState("Todas");
  const [ordenacao, setOrdenacao] = useState("nome-asc");

  useEffect(() => { 
    carregarProdutos(); 
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.id) setUserId(data.user.id);
    });
  }, []);

  const carregarProdutos = async () => {
    const { data } = await supabase.from("produtos").select("*").order("nome");
    setProdutos(data || []);
  };

  // --- LISTAS DINÂMICAS PARA FILTROS E DROPDOWNS (CORRIGIDO) ---
  const categoriasUnicas = Array.from(new Set(produtos.map(p => p.categoria).filter(Boolean))).sort();
  if (categoriasUnicas.length === 0) categoriasUnicas.push("Geral");

  const locaisBase = ["Sede", "Entreposto PDL", "Geral"];
  const locaisUnicos = Array.from(new Set([...locaisBase, ...produtos.map(p => p.local).filter(Boolean)])).sort();

  const categoriasParaFiltro = ["Todas", ...Array.from(new Set(produtos.map(p => p.categoria || "Geral"))).sort()];

  // --- AÇÃO 1: CRIAR NOVO ARTIGO (FIFO READY) ---
  const criarArtigo = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessando(true);
    
    const { data: produtoCriado, error } = await supabase.from("produtos").insert([{
      nome: novoArtigo.nome,
      categoria: novoArtigo.categoria,
      local: novoArtigo.local,
      quantidade: novoArtigo.quantidade,
      preco: novoArtigo.preco || 0,
      stock_minimo: novoArtigo.stock_minimo || 0
    }]).select().single();

    if (error) {
      alert("Erro ao criar: " + error.message);
    } else {
      // Registar o primeiro Lote FIFO
      await supabase.from("movimentos").insert({
        tipo: "Criação",
        utilizador: userId,
        produto_id: produtoCriado.id,
        quantidade: novoArtigo.quantidade,
        custo_unitario: novoArtigo.preco || 0,
        quantidade_restante: novoArtigo.quantidade, // <--- LOTE INICIAL
        observacao: `Stock inicial via Gestor de Catálogo.`
      });

      setModalCriar(false);
      setNovoArtigo({ nome: "", categoria: "Geral", local: "Sede", quantidade: 0, preco: 0, stock_minimo: 5 });
      setNovaCat(false);
      setNovoLoc(false);
      carregarProdutos();
    }
    setProcessando(false);
  };

  // --- AÇÃO 2: GUARDAR EDIÇÃO COM LÓGICA FIFO ---
  const guardarEdicao = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessando(true);
    
    const artigoOriginal = produtos.find(p => p.id === artigoEmEdicao.id);
    const diffQtd = (artigoEmEdicao.quantidade || 0) - (artigoOriginal?.quantidade || 0);

    try {
      // 1. Atualizar Ficha do Produto
      const { error: errProd } = await supabase.from("produtos").update({
        nome: artigoEmEdicao.nome,
        categoria: artigoEmEdicao.categoria,
        local: artigoEmEdicao.local,
        quantidade: artigoEmEdicao.quantidade,
        preco: artigoEmEdicao.preco || 0,
        stock_minimo: artigoEmEdicao.stock_minimo || 0
      }).eq("id", artigoEmEdicao.id);

      if (errProd) throw errProd;

      // 2. Se a quantidade mudou, ajustar Lotes FIFO
      if (diffQtd > 0) {
        // AUMENTO: Criamos um novo lote disponível
        await supabase.from("movimentos").insert({
          tipo: "Edição",
          utilizador: userId,
          produto_id: artigoEmEdicao.id,
          quantidade: diffQtd,
          custo_unitario: artigoEmEdicao.preco || 0,
          quantidade_restante: diffQtd, // Novo lote
          observacao: `Correção manual (Aumento de Stock).`
        });
      } else if (diffQtd < 0) {
        // REDUÇÃO: Temos de abater dos lotes mais antigos (Motor FIFO)
        let restanteParaAbater = Math.abs(diffQtd);
        
        const { data: lotes } = await supabase
          .from("movimentos")
          .select("*")
          .eq("produto_id", artigoEmEdicao.id)
          .in("tipo", ["Entrada", "Criação", "Edição"])
          .gt("quantidade_restante", 0)
          .order("created_at", { ascending: true });

        if (lotes) {
          for (const lote of lotes) {
            if (restanteParaAbater <= 0) break;
            const aRetirar = Math.min(lote.quantidade_restante, restanteParaAbater);
            await supabase
              .from("movimentos")
              .update({ quantidade_restante: lote.quantidade_restante - aRetirar })
              .eq("id", lote.id);
            restanteParaAbater -= aRetirar;
          }
        }

        await supabase.from("movimentos").insert({
          tipo: "Edição",
          utilizador: userId,
          produto_id: artigoEmEdicao.id,
          quantidade: diffQtd, // Será negativo
          custo_unitario: artigoEmEdicao.preco || 0,
          quantidade_restante: 0,
          observacao: `Correção manual (Redução de Stock).`
        });
      }

      setArtigoEmEdicao(null); 
      setNovaCatEditar(false);
      setNovoLocEditar(false);
      carregarProdutos();
      alert("✅ Alterações guardadas e lotes sincronizados!");
    } catch (error: any) {
      alert("Erro ao guardar: " + error.message);
    } finally {
      setProcessando(false);
    }
  };

  // --- AÇÃO 3: APAGAR ARTIGO ---
  const apagarArtigo = async (id: number, nome: string) => {
    if (confirm(`Tem a certeza ABSOLUTA que quer apagar "${nome}"?`)) {
      const produtoA_Apagar = produtos.find(p => p.id === id);
      const { error: deleteError } = await supabase.from("produtos").delete().eq("id", id);
      
      if (deleteError) {
        alert("Erro ao apagar: " + deleteError.message);
        return;
      }

      await supabase.from("movimentos").insert({
        tipo: "Remoção",
        utilizador: userId,
        quantidade: -(produtoA_Apagar?.quantidade || 0),
        custo_unitario: produtoA_Apagar?.preco || 0,
        quantidade_restante: 0,
        observacao: `Artigo removido permanentemente.`
      });

      carregarProdutos();
    }
  };

  // --- FILTRAGEM E ORDENAÇÃO ---
  let produtosFiltrados = produtos.filter(p => {
    const bPesquisa = p.nome.toLowerCase().includes(pesquisa.toLowerCase());
    const bCategoria = categoriaFiltro === "Todas" || (p.categoria || "Geral") === categoriaFiltro;
    return bPesquisa && bCategoria;
  });

  produtosFiltrados.sort((a, b) => {
    switch (ordenacao) {
      case "nome-asc": return a.nome.localeCompare(b.nome);
      case "nome-desc": return b.nome.localeCompare(a.nome);
      case "qtd-desc": return (b.quantidade || 0) - (a.quantidade || 0);
      case "qtd-asc": return (a.quantidade || 0) - (b.quantidade || 0);
      case "preco-desc": return (b.preco || 0) - (a.preco || 0);
      case "preco-asc": return (a.preco || 0) - (b.preco || 0);
      default: return 0;
    }
  });

  return (
    <div className="bg-[#0f172a] rounded-[2rem] p-6 md:p-8 shadow-2xl text-white flex flex-col relative w-full mt-4 h-[calc(100vh-14rem)] min-h-[600px]">
      
      <header className="flex flex-col mb-6 border-b border-white/10 pb-6 shrink-0">
        <div className="flex flex-col xl:flex-row justify-between xl:items-center gap-6 mb-6">
          <div>
            <h2 className="text-2xl font-black uppercase italic tracking-tighter flex items-center gap-2">
              <span className="text-amber-500">Gestor de</span> Catálogo
            </h2>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Sincronização FIFO Ativa</p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-4 w-full xl:w-auto">
            <select value={ordenacao} onChange={e => setOrdenacao(e.target.value)} className="bg-white/5 border border-white/10 text-gray-300 px-5 py-3 rounded-xl text-xs font-bold outline-none cursor-pointer w-full sm:w-auto">
              <option value="nome-asc" className="text-black">Alfabeto (A - Z)</option>
              <option value="nome-desc" className="text-black">Alfabeto (Z - A)</option>
              <option value="qtd-desc" className="text-black">Maior Stock Físico</option>
              <option value="qtd-asc" className="text-black">Menor Stock Físico</option>
              <option value="preco-desc" className="text-black">Custo Mais Alto</option>
              <option value="preco-asc" className="text-black">Custo Mais Baixo</option>
            </select>

            <div className="relative w-full sm:w-64">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40">🔍</span>
              <input type="text" placeholder="Pesquisar..." value={pesquisa} onChange={e => setPesquisa(e.target.value)} className="bg-white/10 border border-white/20 text-white pl-12 pr-5 py-3 rounded-xl text-xs font-bold w-full outline-none focus:border-amber-500 transition-colors" />
            </div>
            
            <button onClick={() => setModalCriar(true)} className="w-full sm:w-auto px-6 py-3 bg-amber-500 text-[#0f172a] rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-amber-400 transition-all shadow-lg whitespace-nowrap">
              + Novo Artigo
            </button>
          </div>
        </div>
        
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {categoriasParaFiltro.map(cat => (
            <button key={cat} onClick={() => setCategoriaFiltro(cat)} className={`px-4 py-2 rounded-full font-black uppercase text-[9px] tracking-widest transition-colors ${categoriaFiltro === cat ? 'bg-amber-500 text-[#0f172a]' : 'bg-white/5 text-gray-400 hover:text-white'}`}>
              {cat}
            </button>
          ))}
        </div>
      </header>
      
      <div className="space-y-3 overflow-y-auto pr-2 flex-1 scrollbar-hide">
        {produtosFiltrados.length === 0 && (
          <div className="border-2 border-dashed border-white/10 rounded-2xl py-16 text-center mt-4">
            <span className="text-4xl mb-4 block opacity-30">📦</span>
            <p className="text-white/30 uppercase font-black text-xs tracking-widest">Nenhum artigo encontrado.</p>
          </div>
        )}

        {produtosFiltrados.map(p => {
          const isEmRutura = p.quantidade <= (p.stock_minimo || 5);
          return (
            <div key={p.id} className="bg-white/5 hover:bg-white/10 transition-colors p-5 rounded-2xl border border-white/5 flex flex-col md:flex-row justify-between md:items-center gap-6">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <h3 className="font-black text-base uppercase text-white">{p.nome}</h3>
                  {isEmRutura && <span className="bg-red-500/20 text-red-400 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest animate-pulse">Stock Baixo</span>}
                </div>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-1 text-[10px] text-gray-400 font-bold uppercase">
                  <p><span className="opacity-50">📂</span> {p.categoria || 'Geral'}</p>
                  <p><span className="opacity-50">📍</span> {p.local}</p>
                  <p><span className="opacity-50">💶</span> {p.preco ? `${p.preco.toFixed(2)}€` : '0.00€'}</p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <p className="text-[9px] text-gray-500 font-black uppercase mb-1">Stock Global</p>
                  <p className={`text-2xl font-black ${isEmRutura ? 'text-red-400' : 'text-white'}`}>{p.quantidade}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setArtigoEmEdicao(p); setNovaCatEditar(false); setNovoLocEditar(false); }} className="px-4 py-3 bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white rounded-xl text-[9px] font-black uppercase transition-all">Editar</button>
                  <button onClick={() => apagarArtigo(p.id, p.nome)} className="px-4 py-3 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white rounded-xl text-[9px] font-black uppercase transition-all">Apagar</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL CRIAR */}
      {modalCriar && (
        <div className="fixed inset-0 bg-[#0f172a]/90 backdrop-blur-sm flex items-center justify-center z-[60] p-6">
          <div className="bg-white rounded-[3rem] p-10 w-full max-w-2xl shadow-2xl border-4 border-amber-500 relative animate-in fade-in zoom-in duration-200">
             <h2 className="text-2xl font-black text-[#0f172a] mb-8 uppercase italic tracking-tighter">Criar <span className="text-amber-500">Novo Artigo</span></h2>
             <form onSubmit={criarArtigo} className="space-y-5">
                <div>
                  <label className="text-[9px] font-black text-gray-400 uppercase block mb-1.5 px-1 tracking-widest">Nome do Artigo</label>
                  <input required type="text" value={novoArtigo.nome} onChange={e => setNovoArtigo({...novoArtigo, nome: e.target.value})} className="w-full p-4 rounded-xl bg-slate-50 border-2 border-transparent focus:border-amber-500/30 focus:bg-white transition-all outline-none font-bold text-sm text-[#0f172a]" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[9px] font-black text-gray-400 uppercase block mb-1.5 px-1 tracking-widest">Categoria</label>
                    {novaCat ? (
                      <div className="flex gap-2">
                        <input autoFocus required type="text" value={novoArtigo.categoria} onChange={e => setNovoArtigo({...novoArtigo, categoria: e.target.value})} className="w-full p-4 rounded-xl bg-amber-50 border-amber-200 outline-none font-bold text-sm text-[#0f172a]" />
                        <button type="button" onClick={() => setNovaCat(false)} className="px-4 py-3 bg-gray-100 rounded-xl font-black text-gray-500 hover:bg-gray-200">X</button>
                      </div>
                    ) : (
                      <select value={novoArtigo.categoria} onChange={e => {
                        if (e.target.value === "NOVA") setNovaCat(true);
                        else setNovoArtigo({...novoArtigo, categoria: e.target.value});
                      }} className="w-full p-4 rounded-xl bg-white border-2 border-slate-100 outline-none font-bold text-sm text-[#1e3a8a]">
                        {categoriasUnicas.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                        <option value="NOVA" className="bg-amber-100 font-bold">➕ Nova Categoria...</option>
                      </select>
                    )}
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-gray-400 uppercase block mb-1.5 px-1 tracking-widest">Localização</label>
                    {novoLoc ? (
                      <div className="flex gap-2">
                        <input autoFocus required type="text" value={novoArtigo.local} onChange={e => setNovoArtigo({...novoArtigo, local: e.target.value})} className="w-full p-4 rounded-xl bg-amber-50 border-amber-200 outline-none font-bold text-sm text-[#0f172a]" />
                        <button type="button" onClick={() => setNovoLoc(false)} className="px-4 py-3 bg-gray-100 rounded-xl font-black text-gray-500 hover:bg-gray-200">X</button>
                      </div>
                    ) : (
                      <select value={novoArtigo.local} onChange={e => {
                        if (e.target.value === "NOVA") setNovoLoc(true);
                        else setNovoArtigo({...novoArtigo, local: e.target.value});
                      }} className="w-full p-4 rounded-xl bg-white border-2 border-slate-100 outline-none font-bold text-sm text-[#1e3a8a]">
                        {locaisUnicos.map(local => <option key={local} value={local}>{local}</option>)}
                        <option value="NOVA" className="bg-amber-100 font-bold">➕ Novo Local...</option>
                      </select>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div><label className="text-[9px] font-black text-amber-500 uppercase block mb-1 tracking-widest">Stock Inicial</label><input type="number" value={novoArtigo.quantidade} onChange={e => setNovoArtigo({...novoArtigo, quantidade: parseInt(e.target.value) || 0})} className="w-full p-4 rounded-xl bg-amber-50 text-amber-900 font-black text-xl text-center outline-none" /></div>
                  <div><label className="text-[9px] font-black text-red-500 uppercase block mb-1 tracking-widest">Stock Mínimo</label><input type="number" value={novoArtigo.stock_minimo} onChange={e => setNovoArtigo({...novoArtigo, stock_minimo: parseInt(e.target.value) || 0})} className="w-full p-4 rounded-xl bg-red-50 text-red-900 font-black text-xl text-center outline-none" /></div>
                  <div><label className="text-[9px] font-black text-green-600 uppercase block mb-1 tracking-widest">Custo (€)</label><input type="number" step="0.01" value={novoArtigo.preco} onChange={e => setNovoArtigo({...novoArtigo, preco: parseFloat(e.target.value) || 0})} className="w-full p-4 rounded-xl bg-green-50 text-green-900 font-black text-xl text-center outline-none" /></div>
                </div>
                <div className="flex gap-4 pt-4">
                  <button type="button" onClick={() => setModalCriar(false)} className="flex-1 py-4 bg-gray-100 text-gray-500 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-gray-200 transition-colors">Cancelar</button>
                  <button type="submit" disabled={processando} className={`flex-[2] py-4 bg-amber-500 text-[#0f172a] rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl transition-all ${processando ? 'opacity-50' : 'hover:bg-amber-400'}`}>Registar Artigo</button>
                </div>
             </form>
          </div>
        </div>
      )}

      {/* MODAL EDITAR */}
      {artigoEmEdicao && (
        <div className="fixed inset-0 bg-[#0f172a]/90 backdrop-blur-sm flex items-center justify-center z-[60] p-6">
          <div className="bg-white rounded-[3rem] p-10 w-full max-w-2xl shadow-2xl border-4 border-amber-500 relative animate-in fade-in zoom-in duration-200">
             <h2 className="text-2xl font-black text-[#0f172a] mb-8 uppercase italic tracking-tighter">Editar <span className="text-amber-500">Artigo</span></h2>
             <form onSubmit={guardarEdicao} className="space-y-5">
                <div>
                  <label className="text-[9px] font-black text-gray-400 uppercase block mb-1.5 px-1 tracking-widest">Nome do Artigo</label>
                  <input required type="text" value={artigoEmEdicao.nome} onChange={e => setArtigoEmEdicao({...artigoEmEdicao, nome: e.target.value})} className="w-full p-4 rounded-xl bg-slate-50 border-2 border-transparent focus:border-amber-500/30 focus:bg-white transition-all outline-none font-bold text-sm text-[#0f172a]" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[9px] font-black text-gray-400 uppercase block mb-1.5 px-1 tracking-widest">Categoria</label>
                    {novaCatEditar ? (
                      <div className="flex gap-2">
                        <input autoFocus required type="text" value={artigoEmEdicao.categoria} onChange={e => setArtigoEmEdicao({...artigoEmEdicao, categoria: e.target.value})} className="w-full p-4 rounded-xl bg-amber-50 border-amber-200 outline-none font-bold text-sm text-[#0f172a]" />
                        <button type="button" onClick={() => setNovaCatEditar(false)} className="px-4 py-3 bg-gray-100 rounded-xl font-black text-gray-500 hover:bg-gray-200">X</button>
                      </div>
                    ) : (
                      <select value={artigoEmEdicao.categoria} onChange={e => {
                        if (e.target.value === "NOVA") setNovaCatEditar(true);
                        else setArtigoEmEdicao({...artigoEmEdicao, categoria: e.target.value});
                      }} className="w-full p-4 rounded-xl bg-white border-2 border-slate-100 outline-none font-bold text-sm text-[#1e3a8a]">
                        {!categoriasUnicas.includes(artigoEmEdicao.categoria) && <option value={artigoEmEdicao.categoria}>{artigoEmEdicao.categoria} (Atual)</option>}
                        {categoriasUnicas.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                        <option value="NOVA" className="bg-amber-100 font-bold">➕ Nova Categoria...</option>
                      </select>
                    )}
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-gray-400 uppercase block mb-1.5 px-1 tracking-widest">Localização</label>
                    {novoLocEditar ? (
                      <div className="flex gap-2">
                        <input autoFocus required type="text" value={artigoEmEdicao.local} onChange={e => setArtigoEmEdicao({...artigoEmEdicao, local: e.target.value})} className="w-full p-4 rounded-xl bg-amber-50 border-amber-200 outline-none font-bold text-sm text-[#0f172a]" />
                        <button type="button" onClick={() => setNovoLocEditar(false)} className="px-4 py-3 bg-gray-100 rounded-xl font-black text-gray-500 hover:bg-gray-200">X</button>
                      </div>
                    ) : (
                      <select value={artigoEmEdicao.local} onChange={e => {
                        if (e.target.value === "NOVA") setNovoLocEditar(true);
                        else setArtigoEmEdicao({...artigoEmEdicao, local: e.target.value});
                      }} className="w-full p-4 rounded-xl bg-white border-2 border-slate-100 outline-none font-bold text-sm text-[#1e3a8a]">
                        {!locaisUnicos.includes(artigoEmEdicao.local) && <option value={artigoEmEdicao.local}>{artigoEmEdicao.local} (Atual)</option>}
                        {locaisUnicos.map(local => <option key={local} value={local}>{local}</option>)}
                        <option value="NOVA" className="bg-amber-100 font-bold">➕ Novo Local...</option>
                      </select>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div><label className="text-[9px] font-black text-amber-500 uppercase block mb-1 tracking-widest">Novo Stock</label><input type="number" value={artigoEmEdicao.quantidade} onChange={e => setArtigoEmEdicao({...artigoEmEdicao, quantidade: parseInt(e.target.value) || 0})} className="w-full p-4 rounded-xl bg-amber-50 text-amber-900 font-black text-xl text-center outline-none" /></div>
                  <div><label className="text-[9px] font-black text-red-500 uppercase block mb-1 tracking-widest">Alerta Mínimo</label><input type="number" value={artigoEmEdicao.stock_minimo || 0} onChange={e => setArtigoEmEdicao({...artigoEmEdicao, stock_minimo: parseInt(e.target.value) || 0})} className="w-full p-4 rounded-xl bg-red-50 text-red-900 font-black text-xl text-center outline-none" /></div>
                  <div><label className="text-[9px] font-black text-green-600 uppercase block mb-1 tracking-widest">Custo (€)</label><input type="number" step="0.01" value={artigoEmEdicao.preco || 0} onChange={e => setArtigoEmEdicao({...artigoEmEdicao, preco: parseFloat(e.target.value) || 0})} className="w-full p-4 rounded-xl bg-green-50 text-green-900 font-black text-xl text-center outline-none" /></div>
                </div>
                <div className="flex gap-4 pt-4">
                  <button type="button" onClick={() => setArtigoEmEdicao(null)} className="flex-1 py-4 bg-gray-100 text-gray-500 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-gray-200 transition-colors">Cancelar</button>
                  <button type="submit" disabled={processando} className={`flex-[2] py-4 bg-amber-500 text-[#0f172a] rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl transition-all ${processando ? 'opacity-50' : 'hover:bg-amber-400'}`}>Gravar Alterações</button>
                </div>
             </form>
          </div>
        </div>
      )}
    </div>
  );
}