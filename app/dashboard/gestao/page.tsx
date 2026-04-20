"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function GestaoStock() {
  const router = useRouter();
  const [produtos, setProdutos] = useState<any[]>([]);
  const [selecionado, setSelecionado] = useState<any>(null);
  const [quantidade, setQuantidade] = useState(0);
  const [tipo, setTipo] = useState("Entrada");
  
  // CORREÇÃO: Guardar o UUID do utilizador para a Auditoria
  const [userId, setUserId] = useState<string | null>(null);

  // Estados para os Filtros
  const [pesquisa, setPesquisa] = useState("");
  const [categoriaSelecionada, setCategoriaSelecionada] = useState("Todas");

  // NOVO: Estados para Criar Artigo
  const [modalCriar, setModalCriar] = useState(false);
  const [novoArtigo, setNovoArtigo] = useState({ nome: "", categoria: "Geral", local: "Sede", quantidade: 0, preco: 0 });
  const [novaCat, setNovaCat] = useState(false);
  const [novoLoc, setNovoLoc] = useState(false);

  useEffect(() => {
    const carregar = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id); // Guardar o ID real para a auditoria não falhar
      }
      
      const { data } = await supabase.from("produtos").select("*").order("nome");
      setProdutos(data || []);
    };
    carregar();
  }, []);

  const carregarProdutos = async () => {
    const { data } = await supabase.from("produtos").select("*").order("nome");
    setProdutos(data || []);
  };

  // --- LÓGICA DE REGISTO DE ENTRADA/SAÍDA (CORRIGIDA) ---
  const submeter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selecionado || quantidade <= 0) return;
    
    try {
      const valorFinal = tipo === "Entrada" ? quantidade : -quantidade;
      const novaQtd = (selecionado.quantidade || 0) + valorFinal;
      
      if (novaQtd < 0) return alert("Erro: Stock físico insuficiente para esta saída!");

      // 1. Atualizar Stock do Produto
      const { error: errorUpdate } = await supabase.from("produtos").update({ quantidade: novaQtd }).eq("id", selecionado.id);
      if (errorUpdate) throw errorUpdate;

      // 2. Registar Movimento na Auditoria com o ID correto
      const { error: errorAudit } = await supabase.from("movimentos").insert([{
        produto_id: selecionado.id,
        quantidade: valorFinal,
        tipo: tipo,
        utilizador: userId, // <-- AQUI ESTAVA O BUG!
        observacao: `Lançamento manual de ${tipo.toLowerCase()} no POS Operacional.`
      }]);

      if (errorAudit) {
        console.error("Erro na Auditoria:", errorAudit);
        alert("Atenção: O stock foi atualizado, mas houve uma falha ao gravar a auditoria.");
      } else {
        alert(`✅ ${tipo} registada com sucesso!`);
      }
      
      setQuantidade(0);
      carregarProdutos();
      
      // Atualiza o item selecionado para refletir o novo stock no ecrã imediatamente
      setSelecionado({ ...selecionado, quantidade: novaQtd });

    } catch (err) {
      alert("Erro ao processar a operação na base de dados.");
    }
  };

  // --- LÓGICA DE CRIAÇÃO DE NOVO ARTIGO ---
  const criarArtigo = async (e: React.FormEvent) => {
    e.preventDefault();
    
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
      // Regista a criação na Auditoria
      await supabase.from("movimentos").insert({
        tipo: "Criação",
        utilizador: userId,
        produto_id: produtoCriado.id,
        quantidade: novoArtigo.quantidade,
        observacao: `Adicionou o artigo "${novoArtigo.nome}" pelo POS Operacional.`
      });

      setModalCriar(false);
      setNovoArtigo({ nome: "", categoria: "Geral", local: "Sede", quantidade: 0, preco: 0 });
      setNovaCat(false); setNovoLoc(false);
      carregarProdutos();
    }
  };

  // Lógica de Filtragem (Categorias Automáticas + Pesquisa)
  const categoriasUnicas = ["Todas", ...Array.from(new Set(produtos.map(p => p.categoria || "Sem Categoria")))];
  const locaisUnicos = Array.from(new Set(produtos.map(p => p.local).filter(Boolean)));
  
  const produtosFiltrados = produtos.filter(p => {
    const correspondeTexto = p.nome.toLowerCase().includes(pesquisa.toLowerCase());
    const correspondeCategoria = categoriaSelecionada === "Todas" || (p.categoria || "Sem Categoria") === categoriaSelecionada;
    return correspondeTexto && correspondeCategoria;
  });

  return (
    <div className="flex h-screen bg-[#f8fafc] font-sans">
      <main className="flex-1 p-8 md:p-12 overflow-y-auto grid grid-cols-1 lg:grid-cols-2 gap-12">
        
        {/* COLUNA ESQUERDA: SELEÇÃO COM FILTROS E CRIAÇÃO */}
        <div className="bg-white rounded-[2.5rem] shadow-xl shadow-blue-900/[0.03] flex flex-col overflow-hidden border border-white h-full max-h-[calc(100vh-6rem)]">
          <div className="p-8 bg-[#f8fafc] border-b space-y-5">
            <div className="flex justify-between items-center">
              <div className="font-black text-[10px] uppercase text-[#1e3a8a] tracking-[0.2em] flex items-center gap-2">
                <span>1. Selecionar Material</span>
                <span className="bg-blue-100 text-[#1e3a8a] px-2 py-0.5 rounded-md">{produtosFiltrados.length}</span>
              </div>
              <button 
                onClick={() => setModalCriar(true)}
                className="bg-[#1e3a8a] text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-md hover:bg-blue-800 transition-colors"
              >
                + Novo Artigo
              </button>
            </div>
            
            {/* Barra de Pesquisa */}
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
              <input 
                type="text" placeholder="Pesquisar artigo..." value={pesquisa} onChange={(e) => setPesquisa(e.target.value)}
                className="w-full pl-12 pr-5 py-4 rounded-2xl bg-white border border-gray-200 outline-none focus:border-[#1e3a8a] focus:ring-2 focus:ring-blue-50 text-xs font-bold transition-all shadow-sm text-slate-700"
              />
            </div>

            {/* Categorias */}
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {categoriasUnicas.map(cat => (
                <button
                  key={cat} onClick={() => setCategoriaSelecionada(cat)}
                  className={`px-5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${
                    categoriaSelecionada === cat ? 'bg-[#1e3a8a] text-white shadow-md' : 'bg-white border border-gray-200 text-gray-400 hover:text-[#1e3a8a] hover:bg-blue-50'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-y-auto flex-1 divide-y divide-slate-50 p-2">
            {produtosFiltrados.length === 0 ? (
              <div className="p-12 text-center text-gray-300 font-bold uppercase text-[10px] tracking-widest border-4 border-dashed border-slate-50 m-4 rounded-3xl">
                Nenhum material encontrado.
              </div>
            ) : (
              produtosFiltrados.map(p => (
                <button 
                  key={p.id} onClick={() => { setSelecionado(p); setQuantidade(0); }} 
                  className={`w-full text-left p-6 rounded-2xl hover:bg-blue-50/50 transition-all group my-1 ${selecionado?.id === p.id ? 'bg-blue-50 ring-2 ring-[#1e3a8a] shadow-sm' : ''}`}
                >
                  <span className="block font-black text-[#0f172a] text-sm uppercase tracking-tighter group-hover:text-[#1e3a8a]">{p.nome}</span>
                  <span className="text-[10px] text-gray-400 uppercase font-bold tracking-widest mt-2 flex items-center justify-between">
                    <span>{p.categoria || "Geral"} | 📍 {p.local}</span>
                    <span className="bg-white px-3 py-1 rounded-lg border border-slate-100 shadow-sm text-slate-500">
                      Stock: <span className={`font-black ${p.quantidade <= 5 ? 'text-red-500' : 'text-[#1e3a8a]'}`}>{p.quantidade}</span>
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>

        {/* COLUNA DIREITA: FORMULÁRIO DE LANÇAMENTO */}
        <div className="bg-white rounded-[3rem] shadow-2xl p-12 flex flex-col justify-center border border-white relative overflow-hidden h-full">
          <div className="absolute top-0 right-0 p-12 opacity-[0.02] text-9xl font-black italic -rotate-12 select-none pointer-events-none text-blue-900 uppercase">
            {tipo}
          </div>

          {selecionado ? (
            <form onSubmit={submeter} className="space-y-10 text-center relative z-10">
              <div>
                <span className="text-[10px] font-black text-blue-500 uppercase tracking-[0.3em]">Operação em curso:</span>
                <h2 className="text-4xl font-black text-[#0f172a] uppercase italic tracking-tighter mt-2">{selecionado.nome}</h2>
                <p className="text-xs font-bold text-slate-400 uppercase mt-2">Stock atual: {selecionado.quantidade} un.</p>
                <div className="h-1.5 w-16 bg-[#1e3a8a] rounded-full mx-auto mt-4"></div>
              </div>

              <div className="flex bg-[#f1f5f9] p-2 rounded-[2rem] max-w-sm mx-auto shadow-inner">
                <button 
                  type="button" onClick={() => setTipo("Entrada")} 
                  className={`flex-1 py-4 rounded-[1.5rem] font-black text-[10px] uppercase tracking-widest transition-all ${tipo === "Entrada" ? 'bg-green-500 text-white shadow-lg shadow-green-500/30' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  📥 Entrada
                </button>
                <button 
                  type="button" onClick={() => setTipo("Saída")} 
                  className={`flex-1 py-4 rounded-[1.5rem] font-black text-[10px] uppercase tracking-widest transition-all ${tipo === "Saída" ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  📦 Saída
                </button>
              </div>

              <div className="space-y-2 bg-slate-50 p-8 rounded-[2rem] border border-slate-100 max-w-sm mx-auto">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">QTD a Processar</label>
                <input 
                  type="number" min="1" value={quantidade === 0 ? '' : quantidade} onChange={e => setQuantidade(Number(e.target.value))} 
                  placeholder="0"
                  className="w-full text-7xl font-black text-center text-[#1e3a8a] bg-transparent outline-none focus:scale-105 transition-transform placeholder-slate-200"
                />
              </div>

              <button 
                type="submit" 
                className={`w-full max-w-sm mx-auto py-6 rounded-[2rem] font-black text-white shadow-2xl uppercase tracking-[0.2em] text-[10px] transition-all active:scale-95 flex items-center justify-center gap-3 ${
                  tipo === "Entrada" ? 'bg-[#1e3a8a] hover:bg-blue-800 shadow-blue-900/20' : 'bg-amber-500 hover:bg-amber-600 shadow-amber-900/20'
                }`}
              >
                {tipo === "Entrada" ? "Confirmar Entrada de Material" : "Confirmar Saída de Material"}
              </button>
            </form>
          ) : (
            <div className="text-center space-y-6">
              <div className="w-24 h-24 bg-blue-50 rounded-[2.5rem] flex items-center justify-center mx-auto text-4xl shadow-inner border border-blue-100">📦</div>
              <div className="space-y-2">
                <p className="text-[#0f172a] font-black uppercase text-sm tracking-tighter">Nenhum Material Selecionado</p>
                <p className="text-slate-400 font-bold uppercase text-[9px] tracking-widest leading-relaxed">
                  Selecione um item na lista à esquerda <br/> para gerir entradas ou saídas de stock
                </p>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* --- MODAL CRIAR ARTIGO --- */}
      {modalCriar && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[60] p-6">
          <div className="bg-white rounded-[3.5rem] p-12 w-full max-w-xl shadow-2xl animate-in fade-in zoom-in duration-200 border-4 border-white">
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
                        <button type="button" onClick={() => { setNovaCat(false); setNovoArtigo({...novoArtigo, categoria: categoriasUnicas[1] || "Geral"}) }} className="px-4 bg-slate-100 text-slate-500 rounded-xl font-black hover:bg-slate-200">X</button>
                      </div>
                    ) : (
                      <select required value={novoArtigo.categoria} onChange={e => {
                        if (e.target.value === "NOVA") { setNovaCat(true); setNovoArtigo({...novoArtigo, categoria: ""}); }
                        else { setNovoArtigo({...novoArtigo, categoria: e.target.value}); }
                      }} className="w-full p-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:bg-white transition-all outline-none font-bold text-sm text-[#1e3a8a]">
                        {categoriasUnicas.filter(c => c !== "Todas").map(cat => <option key={cat} value={cat}>{cat}</option>)}
                        <option value="NOVA" className="bg-blue-100 text-blue-800">➕ Nova Categoria...</option>
                      </select>
                    )}
                  </div>

                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase block mb-1.5 px-1 tracking-widest">Localização</label>
                    {novoLoc ? (
                      <div className="flex gap-2">
                        <input autoFocus required type="text" value={novoArtigo.local} onChange={e => setNovoArtigo({...novoArtigo, local: e.target.value})} className="w-full p-4 rounded-2xl bg-blue-50 border-2 border-transparent outline-none font-bold text-sm" placeholder="Novo..." />
                        <button type="button" onClick={() => { setNovoLoc(false); setNovoArtigo({...novoArtigo, local: locaisUnicos[0] || "Sede"}) }} className="px-4 bg-slate-100 text-slate-500 rounded-xl font-black hover:bg-slate-200">X</button>
                      </div>
                    ) : (
                      <select required value={novoArtigo.local} onChange={e => {
                        if (e.target.value === "NOVA") { setNovoLoc(true); setNovoArtigo({...novoArtigo, local: ""}); }
                        else { setNovoArtigo({...novoArtigo, local: e.target.value}); }
                      }} className="w-full p-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:bg-white transition-all outline-none font-bold text-sm text-[#1e3a8a]">
                        {locaisUnicos.map(local => <option key={local} value={local}>{local}</option>)}
                        <option value="NOVA" className="bg-blue-100 text-blue-800">➕ Novo Local...</option>
                      </select>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase block mb-1.5 px-1 tracking-widest">Stock Inicial</label>
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