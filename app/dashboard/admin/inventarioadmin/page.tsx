"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import toast, { Toaster } from 'react-hot-toast';

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
    nome: "", categoria: "Geral", local: "Sede", quantidade: 0, preco: 0, stock_minimo: 5 
  });
  const [novaCat, setNovaCat] = useState(false);
  const [novoLoc, setNovoLoc] = useState(false);

  // Estado para Confirmação de Remoção (Moderno)
  const [itemParaApagar, setItemParaApagar] = useState<any>(null);

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

  const categoriasUnicas = Array.from(new Set(produtos.map(p => p.categoria).filter(Boolean))).sort();
  const locaisBase = ["Sede", "Entreposto PDL", "Geral"];
  const locaisUnicos = Array.from(new Set([...locaisBase, ...produtos.map(p => p.local).filter(Boolean)])).sort();
  const categoriasParaFiltro = ["Todas", ...Array.from(new Set(produtos.map(p => p.categoria || "Geral"))).sort()];

  // --- CRIAR NOVO ARTIGO ---
  const criarArtigo = async (e: React.FormEvent) => {
    e.preventDefault();
    const tId = toast.loading("A registar novo material...");
    setProcessando(true);
    
    try {
      const { data: produtoCriado, error } = await supabase.from("produtos").insert([{
        nome: novoArtigo.nome,
        categoria: novoArtigo.categoria,
        local: novoArtigo.local,
        quantidade: novoArtigo.quantidade,
        preco: novoArtigo.preco || 0,
        stock_minimo: novoArtigo.stock_minimo || 0
      }]).select().single();

      if (error) throw error;

      await supabase.from("movimentos").insert({
        tipo: "Criação",
        utilizador: userId,
        produto_id: produtoCriado.id,
        quantidade: novoArtigo.quantidade,
        custo_unitario: novoArtigo.preco || 0,
        quantidade_restante: novoArtigo.quantidade,
        observacao: `Stock inicial via Catálogo.`
      });

      toast.success("Artigo criado com sucesso!", { id: tId });
      setModalCriar(false);
      setNovoArtigo({ nome: "", categoria: "Geral", local: "Sede", quantidade: 0, preco: 0, stock_minimo: 5 });
      carregarProdutos();
    } catch (err: any) {
      toast.error("Erro: " + err.message, { id: tId });
    } finally { setProcessando(false); }
  };

  // --- GUARDAR EDIÇÃO (Lógica FIFO Segura) ---
  const guardarEdicao = async (e: React.FormEvent) => {
    e.preventDefault();
    const tId = toast.loading("A atualizar e sincronizar lotes...");
    setProcessando(true);
    
    const artigoOriginal = produtos.find(p => p.id === artigoEmEdicao.id);
    const diffQtd = (artigoEmEdicao.quantidade || 0) - (artigoOriginal?.quantidade || 0);

    try {
      const { error: errProd } = await supabase.from("produtos").update({
        nome: artigoEmEdicao.nome,
        categoria: artigoEmEdicao.categoria,
        local: artigoEmEdicao.local,
        quantidade: artigoEmEdicao.quantidade,
        preco: artigoEmEdicao.preco || 0,
        stock_minimo: artigoEmEdicao.stock_minimo || 0
      }).eq("id", artigoEmEdicao.id);

      if (errProd) throw errProd;

      if (diffQtd !== 0) {
        if (diffQtd > 0) {
          await supabase.from("movimentos").insert({
            tipo: "Edição",
            utilizador: userId,
            produto_id: artigoEmEdicao.id,
            quantidade: diffQtd,
            custo_unitario: artigoEmEdicao.preco || 0,
            quantidade_restante: diffQtd,
            observacao: `Correção manual (Aumento).`
          });
        } else {
          let restanteParaAbater = Math.abs(diffQtd);
          const { data: lotes } = await supabase.from("movimentos")
            .select("*").eq("produto_id", artigoEmEdicao.id)
            .in("tipo", ["Entrada", "Criação", "Edição"])
            .gt("quantidade_restante", 0).order("created_at", { ascending: true });

          if (lotes) {
            for (const lote of lotes) {
              if (restanteParaAbater <= 0) break;
              const aRetirar = Math.min(lote.quantidade_restante, restanteParaAbater);
              await supabase.from("movimentos").update({ 
                quantidade_restante: lote.quantidade_restante - aRetirar 
              }).eq("id", lote.id);
              restanteParaAbater -= aRetirar;
            }
          }
        }
      }

      toast.success("Alterações guardadas!", { id: tId });
      setArtigoEmEdicao(null); 
      carregarProdutos();
    } catch (error: any) {
      toast.error("Falha ao gravar: " + error.message, { id: tId });
    } finally { setProcessando(false); }
  };

  // --- APAGAR ARTIGO (FINAL) ---
  const confirmarApagar = async () => {
    if (!itemParaApagar) return;
    const tId = toast.loading(`A remover ${itemParaApagar.nome}...`);
    
    try {
      const { error } = await supabase.from("produtos").delete().eq("id", itemParaApagar.id);
      if (error) throw error;

      toast.success("Artigo removido permanentemente.", { id: tId });
      setItemParaApagar(null);
      carregarProdutos();
    } catch (err: any) {
      toast.error("Erro: " + err.message, { id: tId });
    }
  };

  let produtosFiltrados = produtos.filter(p => {
    const bPesquisa = p.nome.toLowerCase().includes(pesquisa.toLowerCase());
    const bCategoria = categoriaFiltro === "Todas" || (p.categoria || "Geral") === categoriaFiltro;
    return bPesquisa && bCategoria;
  });

  return (
    <div className="bg-[#0f172a] rounded-[2rem] p-6 md:p-8 shadow-2xl text-white flex flex-col w-full mt-4 h-[calc(100vh-14rem)] min-h-[600px]">
      <Toaster position="top-right" />
      
      {/* HEADER */}
      <header className="flex flex-col mb-6 border-b border-white/10 pb-6 shrink-0">
        <div className="flex flex-col xl:flex-row justify-between xl:items-center gap-6 mb-6">
          <div>
            <h2 className="text-2xl font-black uppercase italic tracking-tighter text-amber-500">
               Catálogo <span className="text-white">Geral</span>
            </h2>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="relative w-full sm:w-64">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30">🔍</span>
              <input type="text" placeholder="Pesquisar artigo..." value={pesquisa} onChange={e => setPesquisa(e.target.value)} className="bg-white/10 border border-white/20 text-white pl-12 pr-5 py-3 rounded-xl text-xs font-bold w-full outline-none focus:border-amber-500" />
            </div>
            
            <button onClick={() => setModalCriar(true)} className="w-full sm:w-auto px-6 py-3 bg-amber-500 text-[#0f172a] rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-amber-400 shadow-lg transition-all">
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
      
      {/* LISTA */}
      <div className="space-y-3 overflow-y-auto pr-2 flex-1 scrollbar-hide">
        {produtosFiltrados.map(p => (
            <div key={p.id} className="bg-white/5 hover:bg-white/10 transition-colors p-5 rounded-2xl border border-white/5 flex flex-col md:flex-row justify-between md:items-center gap-6 group">
              <div className="flex-1">
                <h3 className="font-black text-base uppercase text-white group-hover:text-amber-500 transition-colors">{p.nome}</h3>
                <div className="flex gap-4 mt-1 text-[9px] text-gray-500 font-black uppercase tracking-widest">
                  <p>📂 {p.categoria}</p>
                  <p>📍 {p.local}</p>
                  <p className="text-amber-500/80">Preço Ref: {p.preco?.toFixed(2)}€</p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <p className="text-[9px] text-gray-500 font-black uppercase">Stock</p>
                  <p className={`text-xl font-black ${p.quantidade <= p.stock_minimo ? 'text-red-500' : 'text-white'}`}>{p.quantidade}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setArtigoEmEdicao(p)} className="p-3 bg-white/5 text-gray-400 hover:bg-blue-500 hover:text-white rounded-xl transition-all">
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                     </svg>
                  </button>
                  <button onClick={() => setItemParaApagar(p)} className="p-3 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-xl transition-all">
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1-1v3M4 7h16" />
                     </svg>
                  </button>
                </div>
              </div>
            </div>
        ))}
      </div>

      {/* MODAL REMOVER (MODERNO) */}
      {itemParaApagar && (
        <div className="fixed inset-0 bg-[#0f172a]/95 backdrop-blur-md flex items-center justify-center z-[70] p-6">
          <div className="bg-white rounded-[3rem] p-10 w-full max-w-sm shadow-2xl text-center animate-in zoom-in duration-200">
            <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6 text-3xl">⚠️</div>
            <h2 className="text-xl font-black text-[#0f172a] mb-2 uppercase tracking-tighter italic">Atenção</h2>
            <p className="text-xs text-slate-400 font-bold mb-8 uppercase leading-relaxed">
              Tem a certeza que deseja remover <br/>
              <span className="text-red-500 font-black">"{itemParaApagar.nome}"</span>?
            </p>
            <div className="flex gap-3">
               <button onClick={() => setItemParaApagar(null)} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-[9px] tracking-widest hover:bg-slate-200">Cancelar</button>
               <button onClick={confirmarApagar} className="flex-1 py-4 bg-red-500 text-white rounded-2xl font-black uppercase text-[9px] tracking-widest shadow-lg shadow-red-200">Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CRIAR */}
      {modalCriar && (
        <div className="fixed inset-0 bg-[#0f172a]/90 backdrop-blur-sm flex items-center justify-center z-[60] p-6">
          <div className="bg-white rounded-[3rem] p-10 w-full max-w-2xl shadow-2xl border-4 border-amber-500 animate-in zoom-in duration-200">
            <h2 className="text-2xl font-black text-[#0f172a] mb-8 uppercase italic tracking-tighter">Novo <span className="text-amber-500">Material</span></h2>
            <form onSubmit={criarArtigo} className="space-y-6">
              <div>
                <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">Nome</label>
                <input required type="text" value={novoArtigo.nome} onChange={e => setNovoArtigo({...novoArtigo, nome: e.target.value})} className="w-full p-4 rounded-xl bg-slate-50 border-none font-bold text-sm text-[#0f172a]" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">Categoria</label>
                  {novaCat ? (
                    <input autoFocus type="text" value={novoArtigo.categoria} onChange={e => setNovoArtigo({...novoArtigo, categoria: e.target.value})} className="w-full p-4 rounded-xl bg-amber-50 border-none font-bold text-sm" />
                  ) : (
                    <select value={novoArtigo.categoria} onChange={e => e.target.value === "NOVA" ? setNovaCat(true) : setNovoArtigo({...novoArtigo, categoria: e.target.value})} className="w-full p-4 rounded-xl bg-slate-50 border-none font-bold text-sm text-[#1e3a8a]">
                      {categoriasUnicas.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                      <option value="NOVA">+ Nova Categoria...</option>
                    </select>
                  )}
                </div>
                <div>
                  <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">Local</label>
                  {novoLoc ? (
                    <input autoFocus type="text" value={novoArtigo.local} onChange={e => setNovoArtigo({...novoArtigo, local: e.target.value})} className="w-full p-4 rounded-xl bg-amber-50 border-none font-bold text-sm" />
                  ) : (
                    <select value={novoArtigo.local} onChange={e => e.target.value === "NOVA" ? setNovoLoc(true) : setNovoArtigo({...novoArtigo, local: e.target.value})} className="w-full p-4 rounded-xl bg-slate-50 border-none font-bold text-sm text-[#1e3a8a]">
                      {locaisUnicos.map(loc => <option key={loc} value={loc}>{loc}</option>)}
                      <option value="NOVA">+ Novo Local...</option>
                    </select>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div><label className="text-[9px] font-black text-amber-500 uppercase block mb-1">Stock</label><input type="number" value={novoArtigo.quantidade} onChange={e => setNovoArtigo({...novoArtigo, quantidade: parseInt(e.target.value)})} className="w-full p-4 rounded-xl bg-amber-50 text-center font-black text-xl text-amber-900" /></div>
                <div><label className="text-[9px] font-black text-red-500 uppercase block mb-1">Mínimo</label><input type="number" value={novoArtigo.stock_minimo} onChange={e => setNovoArtigo({...novoArtigo, stock_minimo: parseInt(e.target.value)})} className="w-full p-4 rounded-xl bg-red-50 text-center font-black text-xl text-red-900" /></div>
                <div><label className="text-[9px] font-black text-green-600 uppercase block mb-1">Preço (€)</label><input type="number" step="0.01" value={novoArtigo.preco} onChange={e => setNovoArtigo({...novoArtigo, preco: parseFloat(e.target.value)})} className="w-full p-4 rounded-xl bg-green-50 text-center font-black text-xl text-green-900" /></div>
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setModalCriar(false)} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-[10px]">Cancelar</button>
                <button type="submit" disabled={processando} className="flex-[2] py-4 bg-amber-500 text-[#0f172a] rounded-2xl font-black uppercase text-[10px] shadow-xl">Registar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL EDITAR */}
      {artigoEmEdicao && (
        <div className="fixed inset-0 bg-[#0f172a]/90 backdrop-blur-sm flex items-center justify-center z-[60] p-6">
          <div className="bg-white rounded-[3rem] p-10 w-full max-w-2xl shadow-2xl border-4 border-amber-500 animate-in zoom-in duration-200">
            <h2 className="text-2xl font-black text-[#0f172a] mb-8 uppercase italic tracking-tighter">Editar <span className="text-amber-500">Registo</span></h2>
            <form onSubmit={guardarEdicao} className="space-y-6">
              <div>
                <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">Nome Artigo</label>
                <input required type="text" value={artigoEmEdicao.nome} onChange={e => setArtigoEmEdicao({...artigoEmEdicao, nome: e.target.value})} className="w-full p-4 rounded-xl bg-slate-50 border-none font-bold text-sm text-[#0f172a]" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">Stock Atual</label>
                  <input type="number" value={artigoEmEdicao.quantidade} onChange={e => setArtigoEmEdicao({...artigoEmEdicao, quantidade: parseInt(e.target.value)})} className="w-full p-4 rounded-xl bg-amber-50 text-amber-900 font-black text-center" />
                </div>
                <div>
                  <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">Preço Ref (€)</label>
                  <input type="number" step="0.01" value={artigoEmEdicao.preco} onChange={e => setArtigoEmEdicao({...artigoEmEdicao, preco: parseFloat(e.target.value)})} className="w-full p-4 rounded-xl bg-slate-50 font-bold text-[#1e3a8a] text-center" />
                </div>
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setArtigoEmEdicao(null)} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-[10px]">Cancelar</button>
                <button type="submit" disabled={processando} className="flex-[2] py-4 bg-amber-500 text-[#0f172a] rounded-2xl font-black uppercase text-[10px] shadow-xl">Guardar Alterações</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}