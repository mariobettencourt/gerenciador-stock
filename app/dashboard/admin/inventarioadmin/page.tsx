"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AdminInventario() {
  const [produtos, setProdutos] = useState<any[]>([]);
  const [userId, setUserId] = useState<string | null>(null); // Guarda o UUID de quem faz a ação
  
  // Estados de Edição
  const [artigoEmEdicao, setArtigoEmEdicao] = useState<any>(null); 
  const [novaCatEditar, setNovaCatEditar] = useState(false);
  const [novoLocEditar, setNovoLocEditar] = useState(false);
  
  // Estados de Criação
  const [modalCriar, setModalCriar] = useState(false);
  const [novoArtigo, setNovoArtigo] = useState({ nome: "", categoria: "Geral", local: "Sede", quantidade: 0, preco: 0 });
  const [novaCat, setNovaCat] = useState(false);
  const [novoLoc, setNovoLoc] = useState(false);

  // Estados para pesquisa e filtros
  const [pesquisa, setPesquisa] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState("Todas");

  useEffect(() => { 
    carregarProdutos(); 
    
    // Vai buscar o ID único (UUID) de quem está logado
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.id) {
        setUserId(data.user.id);
      }
    });
  }, []);

  const carregarProdutos = async () => {
    const { data } = await supabase.from("produtos").select("*").order("nome");
    setProdutos(data || []);
  };

  // Dinâmicas para os menus suspensos (Categorias e Locais Únicos)
  const categoriasUnicas = Array.from(new Set(produtos.map(p => p.categoria).filter(Boolean)));
  if (categoriasUnicas.length === 0) categoriasUnicas.push("Geral");

  const locaisBase = ["Sede", "Entreposto PDL", "Geral"];
  const locaisUnicos = Array.from(new Set([...locaisBase, ...produtos.map(p => p.local).filter(Boolean)]));

  const categoriasParaFiltro = ["Todas", ...Array.from(new Set(produtos.map(p => p.categoria || "Geral"))).sort()];

  // --- AÇÃO 1: CRIAR NOVO ARTIGO ---
  const criarArtigo = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Insere e pede o ID de volta
    const { data: produtoCriado, error } = await supabase.from("produtos").insert([{
      nome: novoArtigo.nome,
      categoria: novoArtigo.categoria,
      local: novoArtigo.local,
      quantidade: novoArtigo.quantidade,
      preco: novoArtigo.preco || 0
    }]).select().single();

    if (error) {
      alert("Erro ao criar: " + error.message);
    } else {
      // Regista na Auditoria usando o userId real
      await supabase.from("movimentos").insert({
        tipo: "Criação",
        utilizador: userId, // CORRIGIDO
        produto_id: produtoCriado.id,
        quantidade: novoArtigo.quantidade,
        observacao: `Adicionou "${novoArtigo.nome}" ao catálogo com stock inicial de ${novoArtigo.quantidade}.`
      });

      setModalCriar(false);
      setNovoArtigo({ nome: "", categoria: "Geral", local: "Sede", quantidade: 0, preco: 0 });
      setNovaCat(false); setNovoLoc(false);
      carregarProdutos();
    }
  };

  // --- AÇÃO 2: EDITAR ARTIGO ---
  const guardarEdicao = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("produtos").update({
      nome: artigoEmEdicao.nome,
      categoria: artigoEmEdicao.categoria,
      local: artigoEmEdicao.local,
      quantidade: artigoEmEdicao.quantidade,
      preco: artigoEmEdicao.preco || 0 
    }).eq("id", artigoEmEdicao.id);

    if (error) {
      alert("Erro ao guardar edição: " + error.message);
    } else {
      // Regista na Auditoria usando o userId real
      await supabase.from("movimentos").insert({
        tipo: "Edição",
        utilizador: userId, // CORRIGIDO
        produto_id: artigoEmEdicao.id,
        quantidade: 0,
        observacao: `Alterou detalhes do artigo "${artigoEmEdicao.nome}" (Nova Qtd: ${artigoEmEdicao.quantidade} | Custo: ${artigoEmEdicao.preco}€)`
      });

      setArtigoEmEdicao(null); 
      setNovaCatEditar(false); setNovoLocEditar(false);
      carregarProdutos(); 
    }
  };

  // --- AÇÃO 3: APAGAR ARTIGO ---
  const apagarArtigo = async (id: number, nome: string) => {
    if (confirm(`Tem a certeza ABSOLUTA que quer apagar "${nome}" do sistema?`)) {
      
      // 1. Apaga primeiro da tabela produtos para evitar erros de Foreign Key
      const { error: deleteError } = await supabase.from("produtos").delete().eq("id", id);
      
      if (deleteError) {
        alert("Erro ao apagar. O produto pode ter histórico associado: " + deleteError.message);
        return;
      }

      // 2. Regista na Auditoria DEPOIS do produto ser apagado, SEM o produto_id
      await supabase.from("movimentos").insert({
        tipo: "Remoção",
        utilizador: userId, // CORRIGIDO
        quantidade: 0,
        observacao: `Apagou permanentemente o artigo: ${nome}`
      });

      carregarProdutos();
    }
  };

  // Filtros Visuais
  const produtosFiltrados = produtos.filter(p => {
    const bateCertoPesquisa = p.nome.toLowerCase().includes(pesquisa.toLowerCase());
    const bateCertoCategoria = categoriaFiltro === "Todas" || (p.categoria || "Geral") === categoriaFiltro;
    return bateCertoPesquisa && bateCertoCategoria;
  });

  return (
    <>
      <div className="flex flex-col bg-[#0f172a] rounded-[3rem] p-10 shadow-2xl text-white h-full mt-8">
        <header className="flex flex-col mb-6 border-b border-white/10 pb-6">
          <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-6">
            <h2 className="text-xl font-black uppercase italic tracking-tighter">Gestor de Catálogo</h2>
            
            <div className="flex items-center gap-4">
              <input 
                type="text" placeholder="Pesquisar artigo..." value={pesquisa} onChange={e => setPesquisa(e.target.value)}
                className="bg-white/10 border border-white/20 text-white placeholder-white/40 px-5 py-3 rounded-2xl text-xs outline-none focus:bg-white/20 transition-all w-64"
              />
              <button onClick={() => setModalCriar(true)} className="px-6 py-3 bg-amber-500 text-[#0f172a] rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-amber-400 transition-all shadow-lg whitespace-nowrap">
                + Criar Artigo
              </button>
            </div>
          </div>
          
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {categoriasParaFiltro.map(cat => (
              <button 
                key={cat} onClick={() => setCategoriaFiltro(cat)}
                className={`px-4 py-2 rounded-full font-black uppercase text-[9px] tracking-widest whitespace-nowrap transition-colors ${categoriaFiltro === cat ? 'bg-amber-500 text-[#0f172a] shadow-lg' : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border border-white/5'}`}
              >
                {cat}
              </button>
            ))}
          </div>
        </header>
        
        <div className="space-y-3 overflow-y-auto pr-2 flex-1 scrollbar-hide">
          {produtosFiltrados.length === 0 && <p className="text-white/30 text-center py-10 uppercase font-black text-xs tracking-widest">Nenhum artigo encontrado nestes filtros.</p>}
          
          {produtosFiltrados.map(p => (
            <div key={p.id} className="bg-white/5 hover:bg-white/10 transition-colors p-5 rounded-2xl border border-white/5 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
              <div>
                <p className="font-black text-sm uppercase">{p.nome}</p>
                <p className="text-[10px] text-blue-300 font-bold uppercase tracking-widest mt-1">Cat: {p.categoria || 'Geral'} | Local: {p.local}</p>
                <p className="text-[10px] text-gray-400 font-bold uppercase mt-1">
                  Stock: <span className="text-amber-400 mr-4">{p.quantidade} un.</span> 
                  Custo Unt: <span className="text-green-400">{p.preco ? `${p.preco.toFixed(2)}€` : '0.00€'}</span>
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => { setArtigoEmEdicao(p); setNovaCatEditar(false); setNovoLocEditar(false); }} className="px-5 py-3 bg-blue-500/20 text-blue-300 hover:bg-blue-500 hover:text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all">Editar</button>
                <button onClick={() => apagarArtigo(p.id, p.nome)} className="px-5 py-3 bg-red-500/20 text-red-300 hover:bg-red-500 hover:text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all">Apagar</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* --- MODAL CRIAR ARTIGO --- */}
      {modalCriar && (
        <div className="fixed inset-0 bg-[#0f172a]/90 backdrop-blur-sm flex items-center justify-center z-[60] p-6">
          <div className="bg-white rounded-[3.5rem] p-12 w-full max-w-xl shadow-2xl border-4 border-amber-500 relative">
             <h2 className="text-2xl font-black text-[#0f172a] mb-2 uppercase italic tracking-tighter">Criar <span className="text-amber-500">Novo Artigo</span></h2>
             <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-8 pb-4 border-b border-gray-100">Adicionar manualmente ao inventário</p>
             
             <form onSubmit={criarArtigo} className="space-y-6">
                <div>
                  <label className="text-[9px] font-black text-gray-400 uppercase block mb-2 px-1 tracking-widest">Nome do Artigo</label>
                  <input required type="text" value={novoArtigo.nome} onChange={e => setNovoArtigo({...novoArtigo, nome: e.target.value})} className="input-gourmet w-full border-gray-200" placeholder="Ex: Caderno A4 Pautado" />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[9px] font-black text-gray-400 uppercase block mb-2 px-1 tracking-widest">Categoria</label>
                    {novaCat ? (
                      <div className="flex gap-2">
                        <input autoFocus required type="text" value={novoArtigo.categoria} onChange={e => setNovoArtigo({...novoArtigo, categoria: e.target.value})} className="input-gourmet w-full bg-amber-50 border-amber-200" placeholder="Nova..." />
                        <button type="button" onClick={() => { setNovaCat(false); setNovoArtigo({...novoArtigo, categoria: categoriasUnicas[0]}) }} className="px-4 py-3 bg-gray-100 text-gray-500 rounded-xl font-black hover:bg-gray-200">X</button>
                      </div>
                    ) : (
                      <select required value={novoArtigo.categoria} onChange={e => {
                        if (e.target.value === "NOVA") { setNovaCat(true); setNovoArtigo({...novoArtigo, categoria: ""}); }
                        else { setNovoArtigo({...novoArtigo, categoria: e.target.value}); }
                      }} className="input-gourmet w-full bg-white border-gray-200 font-bold text-[#1e3a8a]">
                        {categoriasUnicas.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                        <option value="NOVA" className="bg-amber-100 font-bold">➕ Alterar para Nova...</option>
                      </select>
                    )}
                  </div>

                  <div>
                    <label className="text-[9px] font-black text-gray-400 uppercase block mb-2 px-1 tracking-widest">Localização</label>
                    {novoLoc ? (
                      <div className="flex gap-2">
                        <input autoFocus required type="text" value={novoArtigo.local} onChange={e => setNovoArtigo({...novoArtigo, local: e.target.value})} className="input-gourmet w-full bg-amber-50 border-amber-200" placeholder="Novo..." />
                        <button type="button" onClick={() => { setNovoLoc(false); setNovoArtigo({...novoArtigo, local: locaisUnicos[0]}) }} className="px-4 py-3 bg-gray-100 text-gray-500 rounded-xl font-black hover:bg-gray-200">X</button>
                      </div>
                    ) : (
                      <select required value={novoArtigo.local} onChange={e => {
                        if (e.target.value === "NOVA") { setNovoLoc(true); setNovoArtigo({...novoArtigo, local: ""}); }
                        else { setNovoArtigo({...novoArtigo, local: e.target.value}); }
                      }} className="input-gourmet w-full bg-white border-gray-200 font-bold text-[#1e3a8a]">
                        {locaisUnicos.map(local => <option key={local} value={local}>{local}</option>)}
                        <option value="NOVA" className="bg-amber-100 font-bold">➕ Alterar para Novo...</option>
                      </select>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[9px] font-black text-amber-500 uppercase block mb-2 px-1 tracking-widest">Stock Inicial</label>
                    <input type="number" min="0" value={novoArtigo.quantidade} onChange={e => setNovoArtigo({...novoArtigo, quantidade: parseInt(e.target.value) || 0})} className="input-gourmet w-full bg-amber-50 border-amber-200 text-amber-900 font-black text-lg" />
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-green-600 uppercase block mb-2 px-1 tracking-widest">Custo Unitário (€)</label>
                    <input type="number" step="0.01" min="0" value={novoArtigo.preco} onChange={e => setNovoArtigo({...novoArtigo, preco: parseFloat(e.target.value) || 0})} className="input-gourmet w-full bg-green-50 border-green-200 text-green-900 font-black text-lg" />
                  </div>
                </div>
                
                <div className="flex gap-4 pt-6">
                  <button type="button" onClick={() => setModalCriar(false)} className="flex-1 py-5 bg-gray-100 text-gray-500 rounded-3xl font-black uppercase text-[10px] tracking-widest hover:bg-gray-200 transition-colors">Cancelar</button>
                  <button type="submit" className="flex-[2] py-5 bg-amber-500 text-[#0f172a] rounded-3xl font-black uppercase text-[10px] tracking-widest shadow-xl hover:bg-amber-400 transition-all">Registar no Catálogo</button>
                </div>
             </form>
          </div>
        </div>
      )}

      {/* --- MODAL EDITAR ARTIGO --- */}
      {artigoEmEdicao && (
        <div className="fixed inset-0 bg-[#0f172a]/90 backdrop-blur-sm flex items-center justify-center z-[60] p-6">
          <div className="bg-white rounded-[3.5rem] p-12 w-full max-w-xl shadow-2xl border-4 border-amber-500 relative">
             <h2 className="text-2xl font-black text-[#0f172a] mb-2 uppercase italic tracking-tighter">Editar <span className="text-amber-500">Artigo</span></h2>
             <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-8 pb-4 border-b border-gray-100">Atualizar dados no Catálogo Oficial</p>
             
             <form onSubmit={guardarEdicao} className="space-y-6">
                <div>
                  <label className="text-[9px] font-black text-gray-400 uppercase block mb-2 px-1 tracking-widest">Nome do Artigo</label>
                  <input required type="text" value={artigoEmEdicao.nome} onChange={e => setArtigoEmEdicao({...artigoEmEdicao, nome: e.target.value})} className="input-gourmet w-full border-gray-200" />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[9px] font-black text-gray-400 uppercase block mb-2 px-1 tracking-widest">Categoria</label>
                    {novaCatEditar ? (
                      <div className="flex gap-2">
                        <input autoFocus required type="text" value={artigoEmEdicao.categoria} onChange={e => setArtigoEmEdicao({...artigoEmEdicao, categoria: e.target.value})} className="input-gourmet w-full bg-amber-50 border-amber-200" placeholder="Nova..." />
                        <button type="button" onClick={() => { setNovaCatEditar(false); setArtigoEmEdicao({...artigoEmEdicao, categoria: categoriasUnicas[0]}) }} className="px-4 py-3 bg-gray-100 text-gray-500 rounded-xl font-black hover:bg-gray-200">X</button>
                      </div>
                    ) : (
                      <select required value={artigoEmEdicao.categoria} onChange={e => {
                        if (e.target.value === "NOVA") { setNovaCatEditar(true); setArtigoEmEdicao({...artigoEmEdicao, categoria: ""}); }
                        else { setArtigoEmEdicao({...artigoEmEdicao, categoria: e.target.value}); }
                      }} className="input-gourmet w-full bg-white border-gray-200 font-bold text-[#1e3a8a]">
                        {!categoriasUnicas.includes(artigoEmEdicao.categoria) && <option value={artigoEmEdicao.categoria}>{artigoEmEdicao.categoria} (Atual)</option>}
                        {categoriasUnicas.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                        <option value="NOVA" className="bg-amber-100 font-bold">➕ Alterar para Nova...</option>
                      </select>
                    )}
                  </div>

                  <div>
                    <label className="text-[9px] font-black text-gray-400 uppercase block mb-2 px-1 tracking-widest">Localização</label>
                    {novoLocEditar ? (
                      <div className="flex gap-2">
                        <input autoFocus required type="text" value={artigoEmEdicao.local} onChange={e => setArtigoEmEdicao({...artigoEmEdicao, local: e.target.value})} className="input-gourmet w-full bg-amber-50 border-amber-200" placeholder="Novo..." />
                        <button type="button" onClick={() => { setNovoLocEditar(false); setArtigoEmEdicao({...artigoEmEdicao, local: locaisUnicos[0]}) }} className="px-4 py-3 bg-gray-100 text-gray-500 rounded-xl font-black hover:bg-gray-200">X</button>
                      </div>
                    ) : (
                      <select required value={artigoEmEdicao.local} onChange={e => {
                        if (e.target.value === "NOVA") { setNovoLocEditar(true); setArtigoEmEdicao({...artigoEmEdicao, local: ""}); }
                        else { setArtigoEmEdicao({...artigoEmEdicao, local: e.target.value}); }
                      }} className="input-gourmet w-full bg-white border-gray-200 font-bold text-[#1e3a8a]">
                        {!locaisUnicos.includes(artigoEmEdicao.local) && <option value={artigoEmEdicao.local}>{artigoEmEdicao.local} (Atual)</option>}
                        {locaisUnicos.map(local => <option key={local} value={local}>{local}</option>)}
                        <option value="NOVA" className="bg-amber-100 font-bold">➕ Alterar para Novo...</option>
                      </select>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[9px] font-black text-amber-500 uppercase block mb-2 px-1 tracking-widest">Correção de Stock Físico</label>
                    <input type="number" min="0" value={artigoEmEdicao.quantidade} onChange={e => setArtigoEmEdicao({...artigoEmEdicao, quantidade: parseInt(e.target.value) || 0})} className="input-gourmet w-full bg-amber-50 border-amber-200 text-amber-900 font-black text-lg" />
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-green-600 uppercase block mb-2 px-1 tracking-widest">Custo Unitário (€)</label>
                    <input type="number" step="0.01" min="0" value={artigoEmEdicao.preco || 0} onChange={e => setArtigoEmEdicao({...artigoEmEdicao, preco: parseFloat(e.target.value) || 0})} className="input-gourmet w-full bg-green-50 border-green-200 text-green-900 font-black text-lg" />
                  </div>
                </div>
                
                <div className="flex gap-4 pt-6">
                  <button type="button" onClick={() => setArtigoEmEdicao(null)} className="flex-1 py-5 bg-gray-100 text-gray-500 rounded-3xl font-black uppercase text-[10px] tracking-widest hover:bg-gray-200 transition-colors">Cancelar</button>
                  <button type="submit" className="flex-[2] py-5 bg-amber-500 text-[#0f172a] rounded-3xl font-black uppercase text-[10px] tracking-widest shadow-xl hover:bg-amber-400 transition-all">Gravar Alterações</button>
                </div>
             </form>
          </div>
        </div>
      )}
    </>
  );
}