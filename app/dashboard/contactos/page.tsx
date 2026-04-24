"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import toast, { Toaster } from "react-hot-toast";

export default function ContactosPage() {
  const [aCarregar, setACarregar] = useState(true);
  const [contactos, setContactos] = useState<any[]>([]);
  const [pesquisa, setPesquisa] = useState("");
  const [categoriaAtiva, setCategoriaAtiva] = useState("Todas");
  
  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const [contactoEmEdicao, setContactoEmEdicao] = useState<any>(null);
  const [modalCriarAberto, setModalCriarAberto] = useState(false);
  const [itemParaApagar, setItemParaApagar] = useState<any>(null);
  
  const [novoContacto, setNovoContacto] = useState({ 
    nome: "", departamento: "SEDE", email: "", telefone: "" 
  });
  
  const [novaCat, setNovaCat] = useState(false);

  useEffect(() => {
    const inicializar = async () => {
      await carregarContactos();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        const { data: perfil } = await supabase.from("perfis").select("nivel_acesso, cargo").eq("id", user.id).single();
        setIsAdmin(perfil?.nivel_acesso === "admin" || perfil?.cargo === "Administrador");
      }
      setACarregar(false);
    };
    inicializar();
  }, []);

  const carregarContactos = async () => {
    const { data, error } = await supabase.from("contactos").select("*").order("nome");
    if (!error && data) setContactos(data);
  };

  const categoriasBase = ["CA", "LOTAS", "SEDE", "LOTA PDL", "ENT PDL"];
  const categoriasExistentes = Array.from(new Set(contactos.map(c => c.departamento).filter(Boolean)));
  const todasCategorias = Array.from(new Set([...categoriasBase, ...categoriasExistentes])).sort();

  const criarContacto = async (e: React.FormEvent) => {
    e.preventDefault();
    const tId = toast.loading("A registar unidade/contacto...");
    const { error } = await supabase.from("contactos").insert([novoContacto]);

    if (!error) {
      toast.success("Contacto adicionado!", { id: tId });
      setModalCriarAberto(false);
      setNovoContacto({ nome: "", departamento: "SEDE", email: "", telefone: "" });
      setNovaCat(false);
      carregarContactos();
    } else {
      toast.error("Erro ao guardar.", { id: tId });
    }
  };

  const guardarEdicao = async (e: React.FormEvent) => {
    e.preventDefault();
    const tId = toast.loading("A atualizar dados...");
    
    // CORREÇÃO: Destruturar para não enviar o ID no corpo do update
    const { id, created_at, ...dadosParaAtualizar } = contactoEmEdicao;

    const { error } = await supabase
      .from("contactos")
      .update(dadosParaAtualizar)
      .eq("id", id);

    if (!error) {
      toast.success("Dados atualizados!", { id: tId });
      setContactoEmEdicao(null);
      setNovaCat(false);
      carregarContactos();
    } else {
      toast.error("Erro na atualização.", { id: tId });
    }
  };

  const confirmarRemocao = async () => {
    const tId = toast.loading("A remover contacto...");
    const { error } = await supabase.from("contactos").delete().eq("id", itemParaApagar.id);
    
    if (!error) {
      toast.success("Removido com sucesso.", { id: tId });
      setItemParaApagar(null);
      carregarContactos();
    } else {
      toast.error("Erro ao remover.", { id: tId });
    }
  };

  const contactosFiltrados = contactos.filter(c => {
    const matchPesquisa = c.nome.toLowerCase().includes(pesquisa.toLowerCase());
    const matchCategoria = categoriaAtiva === "Todas" || c.departamento === categoriaAtiva;
    return matchPesquisa && matchCategoria;
  });

  if (aCarregar) return <div className="p-12 text-center text-[#1e3a8a] font-black uppercase animate-pulse h-screen flex items-center justify-center italic">A carregar diretório...</div>;

  return (
    <main className="flex-1 p-8 md:p-12 overflow-y-auto h-screen bg-slate-50">
      <Toaster position="top-center" />
      
      <header className="mb-10 flex flex-col xl:flex-row justify-between xl:items-end gap-6">
        <div>
          <h1 className="text-4xl font-black text-[#0f172a] uppercase italic leading-none tracking-tighter">
            Diretório <span className="text-amber-500">Lotaçor</span>
          </h1>
          <div className="h-1.5 w-24 bg-[#1e3a8a] rounded-full mt-3"></div>
        </div>

        <div className="flex flex-col md:flex-row gap-4 items-center w-full xl:w-auto">
          <div className="relative w-full md:w-80">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30">🔍</span>
            <input 
              type="text" placeholder="Procurar nome ou departamento..." value={pesquisa} onChange={e => setPesquisa(e.target.value)}
              className="w-full pl-12 pr-5 py-4 bg-white rounded-2xl shadow-sm font-bold text-xs text-[#1e3a8a] outline-none border-2 border-transparent focus:border-amber-500 transition-all"
            />
          </div>
          <button onClick={() => setModalCriarAberto(true)} className="w-full md:w-auto px-8 py-4 bg-[#1e3a8a] text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl hover:bg-blue-900 transition-all">+ Novo Contacto</button>
        </div>
      </header>

      {/* FILTROS POR CATEGORIA */}
      <div className="flex gap-2 overflow-x-auto pb-6 scrollbar-hide">
        <button onClick={() => setCategoriaAtiva("Todas")} className={`px-6 py-3 rounded-full font-black uppercase text-[9px] tracking-widest transition-all ${categoriaAtiva === "Todas" ? 'bg-[#1e3a8a] text-white shadow-lg' : 'bg-white text-slate-400 border border-slate-200 hover:bg-slate-100'}`}>Todas</button>
        {todasCategorias.map(cat => (
          <button key={cat} onClick={() => setCategoriaAtiva(cat)} className={`px-6 py-3 rounded-full font-black uppercase text-[9px] tracking-widest transition-all whitespace-nowrap ${categoriaAtiva === cat ? 'bg-amber-500 text-white shadow-lg' : 'bg-white text-slate-400 border border-slate-200 hover:bg-slate-100'}`}>{cat}</button>
        ))}
      </div>

      {/* LISTAGEM */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
        {contactosFiltrados.map((c) => (
          <div key={c.id} className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100 hover:shadow-md transition-all flex flex-col justify-between group">
            <div>
              <div className="flex justify-between items-start mb-6">
                <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-xl shadow-inner group-hover:bg-amber-50 group-hover:text-amber-500 transition-colors">
                  {c.departamento === 'CA' ? '🏢' : '📍'}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setContactoEmEdicao(c)} className="w-8 h-8 flex items-center justify-center bg-slate-50 text-slate-400 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition-all text-xs">✏️</button>
                  {isAdmin && <button onClick={() => setItemParaApagar(c)} className="w-8 h-8 flex items-center justify-center bg-slate-50 text-slate-400 rounded-lg hover:bg-red-50 hover:text-red-600 transition-all text-xs">🗑️</button>}
                </div>
              </div>
              <h2 className="font-black text-sm text-[#0f172a] uppercase mb-1 tracking-tight">{c.nome}</h2>
              <p className="text-[9px] font-black text-amber-500 uppercase tracking-widest mb-6">{c.departamento || "Geral"}</p>
              
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-[11px] font-bold text-slate-500 bg-slate-50/50 p-3 rounded-xl border border-slate-50">
                  <span className="opacity-50">✉️</span> {c.email || "---"}
                </div>
                <div className="flex items-center gap-3 text-[11px] font-bold text-slate-500 bg-slate-50/50 p-3 rounded-xl border border-slate-50">
                  <span className="opacity-50">📞</span> {c.telefone || "---"}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* MODAL REMOVER */}
      {itemParaApagar && (
        <div className="fixed inset-0 bg-[#0f172a]/90 backdrop-blur-sm flex items-center justify-center z-[100] p-6">
          <div className="bg-white rounded-[3rem] p-10 w-full max-w-sm shadow-2xl text-center animate-in zoom-in duration-200">
            <div className="text-4xl mb-4">⚠️</div>
            <h2 className="text-xl font-black text-[#0f172a] mb-2 uppercase italic tracking-tighter">Remover Contacto</h2>
            <p className="text-xs text-slate-400 font-bold mb-8 uppercase">Remover <span className="text-red-500">"{itemParaApagar.nome}"</span>?</p>
            <div className="flex gap-3">
               <button onClick={() => setItemParaApagar(null)} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-[9px]">Cancelar</button>
               <button onClick={confirmarRemocao} className="flex-1 py-4 bg-red-500 text-white rounded-2xl font-black uppercase text-[9px] shadow-lg shadow-red-200">Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CRIAR / EDITAR (CORRIGIDO COM NULL SAFETY) */}
      {(modalCriarAberto || contactoEmEdicao) && (
        <div className="fixed inset-0 bg-[#0f172a]/90 backdrop-blur-sm flex items-center justify-center z-[90] p-6">
          <div className="bg-white rounded-[3rem] p-12 w-full max-w-lg shadow-2xl animate-in zoom-in duration-200">
            <h2 className="text-2xl font-black text-[#0f172a] mb-8 uppercase italic tracking-tighter">
              {modalCriarAberto ? "Novo" : "Editar"} <span className="text-amber-500">Contacto</span>
            </h2>
            <form onSubmit={modalCriarAberto ? criarContacto : guardarEdicao} className="space-y-5">
              <div className="space-y-4">
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase block mb-1.5 ml-1">Nome</label>
                  <input required type="text" value={(modalCriarAberto ? novoContacto.nome : contactoEmEdicao.nome) || ""} onChange={e => modalCriarAberto ? setNovoContacto({...novoContacto, nome: e.target.value}) : setContactoEmEdicao({...contactoEmEdicao, nome: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold text-sm text-[#1e3a8a]" />
                </div>
                
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase block mb-1.5 ml-1">Categoria / Departamento</label>
                  {novaCat ? (
                    <div className="flex gap-2">
                      <input autoFocus type="text" placeholder="Nova Categoria..." className="w-full p-4 rounded-2xl bg-amber-50 border-none font-bold text-sm" 
                        onChange={e => modalCriarAberto ? setNovoContacto({...novoContacto, departamento: e.target.value}) : setContactoEmEdicao({...contactoEmEdicao, departamento: e.target.value})}
                      />
                      <button type="button" onClick={() => setNovaCat(false)} className="px-4 bg-slate-100 rounded-xl font-black">X</button>
                    </div>
                  ) : (
                    <select 
                      value={(modalCriarAberto ? novoContacto.departamento : contactoEmEdicao.departamento) || "SEDE"} 
                      onChange={e => e.target.value === "NOVA" ? setNovaCat(true) : (modalCriarAberto ? setNovoContacto({...novoContacto, departamento: e.target.value}) : setContactoEmEdicao({...contactoEmEdicao, departamento: e.target.value}))}
                      className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold text-sm text-[#1e3a8a]"
                    >
                      {todasCategorias.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                      <option value="NOVA" className="font-black text-amber-600">+ Adicionar Nova...</option>
                    </select>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase block mb-1.5 ml-1">Email</label>
                    <input type="email" value={(modalCriarAberto ? novoContacto.email : contactoEmEdicao.email) || ""} onChange={e => modalCriarAberto ? setNovoContacto({...novoContacto, email: e.target.value}) : setContactoEmEdicao({...contactoEmEdicao, email: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold text-sm" />
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase block mb-1.5 ml-1">Telefone / Extensão</label>
                    <input type="text" value={(modalCriarAberto ? novoContacto.telefone : contactoEmEdicao.telefone) || ""} onChange={e => modalCriarAberto ? setNovoContacto({...novoContacto, telefone: e.target.value}) : setContactoEmEdicao({...contactoEmEdicao, telefone: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold text-sm" />
                  </div>
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => { setModalCriarAberto(false); setContactoEmEdicao(null); setNovaCat(false); }} className="flex-1 py-5 bg-slate-100 text-slate-500 rounded-3xl font-black uppercase text-[10px]">Cancelar</button>
                <button type="submit" className="flex-[2] py-5 bg-[#1e3a8a] text-white rounded-3xl font-black uppercase text-[10px] tracking-widest shadow-xl">
                  {modalCriarAberto ? "Confirmar Registo" : "Guardar Alterações"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}