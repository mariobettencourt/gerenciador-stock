"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function ContactosPage() {
  const [aCarregar, setACarregar] = useState(true);
  const [contactos, setContactos] = useState<any[]>([]);
  const [pesquisa, setPesquisa] = useState("");
  
  // Estados de Permissões e Utilizador
  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Estados de Modais e Formulários
  const [contactoEmEdicao, setContactoEmEdicao] = useState<any>(null);
  const [modalCriarAberto, setModalCriarAberto] = useState(false);
  const [novoContacto, setNovoContacto] = useState({ nome: "", departamento: "", email: "", telefone: "" });

  useEffect(() => {
    const inicializar = async () => {
      await carregarContactos();
      
      // Verifica quem está logado e o seu nível de acesso
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        
        const { data: perfil } = await supabase
          .from("perfis")
          .select("nivel_acesso, cargo")
          .eq("id", user.id)
          .single();

        const eAdmin = perfil?.nivel_acesso === "admin" || perfil?.cargo === "Administrador";
        setIsAdmin(eAdmin);
      }
      setACarregar(false);
    };

    inicializar();
  }, []);

  const carregarContactos = async () => {
    const { data, error } = await supabase.from("contactos").select("*").order("nome");
    if (!error && data) setContactos(data);
  };

  // --- AÇÃO 1: CRIAR CONTACTO ---
  const criarContacto = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data, error } = await supabase.from("contactos").insert([novoContacto]).select().single();

    if (!error) {
      await supabase.from("movimentos").insert({
        tipo: "Criação",
        utilizador: userId,
        quantidade: 0,
        observacao: `Criou novo contacto: ${novoContacto.nome} (${novoContacto.departamento || 'Geral'})`
      });
      setModalCriarAberto(false);
      setNovoContacto({ nome: "", departamento: "", email: "", telefone: "" });
      carregarContactos();
    } else {
      alert("Erro ao criar contacto.");
    }
  };

  // --- AÇÃO 2: GUARDAR EDIÇÃO ---
  const guardarEdicao = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase
      .from("contactos")
      .update({
        nome: contactoEmEdicao.nome,
        departamento: contactoEmEdicao.departamento,
        email: contactoEmEdicao.email,
        telefone: contactoEmEdicao.telefone
      })
      .eq("id", contactoEmEdicao.id);

    if (!error) {
      await supabase.from("movimentos").insert({
        tipo: "Edição",
        utilizador: userId,
        quantidade: 0,
        observacao: `Editou o contacto: ${contactoEmEdicao.nome} (${contactoEmEdicao.departamento || 'Geral'})`
      });
      setContactoEmEdicao(null);
      carregarContactos();
    } else {
      alert("Erro ao editar.");
    }
  };

  // --- AÇÃO 3: APAGAR CONTACTO (APENAS ADMIN) ---
  const apagarContacto = async (id: number, nome: string) => {
    if (!isAdmin) return;
    if (!confirm(`Confirmas a remoção permanente de "${nome}"?`)) return;

    const { error } = await supabase.from("contactos").delete().eq("id", id);
    if (!error) {
      await supabase.from("movimentos").insert({
        tipo: "Remoção",
        utilizador: userId,
        quantidade: 0,
        observacao: `Removeu permanentemente o contacto: ${nome}`
      });
      carregarContactos();
    }
  };

  const contactosFiltrados = contactos.filter(c => 
    c.nome.toLowerCase().includes(pesquisa.toLowerCase()) || 
    (c.departamento && c.departamento.toLowerCase().includes(pesquisa.toLowerCase()))
  );

  if (aCarregar) return <div className="p-12 text-center text-amber-500 font-black uppercase animate-pulse h-screen flex items-center justify-center">A validar acessos...</div>;

  return (
    <main className="flex-1 p-12 overflow-y-auto h-screen relative">
      
      {/* CABEÇALHO */}
      <header className="mb-12 flex flex-col md:flex-row justify-between md:items-end gap-6">
        <div>
          <h1 className="text-4xl font-black text-[#0f172a] uppercase italic leading-none tracking-tighter">
            Diretório de <span className="text-amber-500">Contactos</span>
          </h1>
          <div className="h-1.5 w-24 bg-amber-500 rounded-full mt-3"></div>
        </div>

        <div className="flex gap-4 items-center w-full md:w-auto">
          <div className="relative flex-1 md:w-80">
            <input 
              type="text" placeholder="Pesquisar..." value={pesquisa} onChange={e => setPesquisa(e.target.value)}
              className="w-full pl-6 pr-5 py-4 bg-white rounded-2xl shadow-sm font-bold text-sm text-[#1e3a8a] outline-none border-2 border-transparent focus:border-amber-500 transition-all"
            />
          </div>
          <button 
            onClick={() => setModalCriarAberto(true)}
            className="px-8 py-4 bg-[#1e3a8a] text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl hover:bg-blue-800 transition-all whitespace-nowrap"
          >
            + Novo Contacto
          </button>
        </div>
      </header>

      {/* GRELHA DE CARTÕES */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {contactosFiltrados.map((contacto) => (
          <div key={contacto.id} className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100 hover:shadow-xl transition-all group relative overflow-hidden flex flex-col justify-between min-h-[220px]">
            <div>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="font-black text-lg text-[#0f172a] uppercase leading-tight mb-1">{contacto.nome}</h2>
                  <span className="inline-block bg-slate-100 text-slate-500 text-[9px] px-3 py-1 rounded-full font-black uppercase tracking-widest">
                    📍 {contacto.departamento || "Geral"}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setContactoEmEdicao(contacto)} className="w-10 h-10 bg-slate-50 text-slate-400 rounded-xl hover:bg-blue-50 hover:text-blue-600 transition-all flex items-center justify-center text-xs">✏️</button>
                  {isAdmin && (
                    <button onClick={() => apagarContacto(contacto.id, contacto.nome)} className="w-10 h-10 bg-slate-50 text-slate-400 rounded-xl hover:bg-red-50 hover:text-red-600 transition-all flex items-center justify-center text-xs">🗑️</button>
                  )}
                </div>
              </div>

              <div className="space-y-2 mt-6">
                <p className="flex items-center gap-3 text-xs font-bold text-slate-500">
                  <span className="w-6 h-6 rounded-lg bg-blue-50 text-blue-500 flex items-center justify-center text-[10px]">✉️</span>
                  {contacto.email || "---"}
                </p>
                <p className="flex items-center gap-3 text-xs font-bold text-slate-500">
                  <span className="w-6 h-6 rounded-lg bg-green-50 text-green-500 flex items-center justify-center text-[10px]">📞</span>
                  {contacto.telefone || "---"}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* MODAL CRIAR */}
      {modalCriarAberto && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm flex items-center justify-center z-[60] p-6">
          <div className="bg-white rounded-[3rem] p-12 w-full max-w-lg shadow-2xl animate-in fade-in zoom-in duration-200">
             <h2 className="text-2xl font-black text-[#0f172a] mb-8 uppercase italic tracking-tighter">Registar <span className="text-amber-500">Contacto</span></h2>
             <form onSubmit={criarContacto} className="space-y-5">
                <input required type="text" placeholder="Nome da Unidade/Pessoa" value={novoContacto.nome} onChange={e => setNovoContacto({...novoContacto, nome: e.target.value})} className="w-full p-5 rounded-2xl bg-slate-50 border-none font-bold text-sm" />
                <input type="text" placeholder="Departamento / Localização" value={novoContacto.departamento} onChange={e => setNovoContacto({...novoContacto, departamento: e.target.value})} className="w-full p-5 rounded-2xl bg-slate-50 border-none font-bold text-sm" />
                <input type="email" placeholder="Email (Opcional)" value={novoContacto.email} onChange={e => setNovoContacto({...novoContacto, email: e.target.value})} className="w-full p-5 rounded-2xl bg-slate-50 border-none font-bold text-sm" />
                <input type="text" placeholder="Telefone / Extensão" value={novoContacto.telefone} onChange={e => setNovoContacto({...novoContacto, telefone: e.target.value})} className="w-full p-5 rounded-2xl bg-slate-50 border-none font-bold text-sm" />
                <div className="flex gap-4 pt-4">
                  <button type="button" onClick={() => setModalCriarAberto(false)} className="flex-1 py-5 bg-slate-100 text-slate-500 rounded-3xl font-black uppercase text-[10px]">Cancelar</button>
                  <button type="submit" className="flex-[2] py-5 bg-[#1e3a8a] text-white rounded-3xl font-black uppercase text-[10px] tracking-widest shadow-xl">Confirmar Registo</button>
                </div>
             </form>
          </div>
        </div>
      )}

      {/* MODAL EDITAR */}
      {contactoEmEdicao && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm flex items-center justify-center z-[60] p-6">
          <div className="bg-white rounded-[3rem] p-12 w-full max-w-lg shadow-2xl animate-in fade-in zoom-in duration-200 border-t-8 border-amber-500">
             <h2 className="text-2xl font-black text-[#0f172a] mb-8 uppercase italic tracking-tighter">Atualizar <span className="text-amber-500">Contacto</span></h2>
             <form onSubmit={guardarEdicao} className="space-y-5">
                <input required type="text" value={contactoEmEdicao.nome} onChange={e => setContactoEmEdicao({...contactoEmEdicao, nome: e.target.value})} className="w-full p-5 rounded-2xl bg-slate-50 border-none font-bold text-sm" />
                <input type="text" value={contactoEmEdicao.departamento || ""} onChange={e => setContactoEmEdicao({...contactoEmEdicao, departamento: e.target.value})} className="w-full p-5 rounded-2xl bg-slate-50 border-none font-bold text-sm" />
                <input type="email" value={contactoEmEdicao.email || ""} onChange={e => setContactoEmEdicao({...contactoEmEdicao, email: e.target.value})} className="w-full p-5 rounded-2xl bg-slate-50 border-none font-bold text-sm" />
                <input type="text" value={contactoEmEdicao.telefone || ""} onChange={e => setContactoEmEdicao({...contactoEmEdicao, telefone: e.target.value})} className="w-full p-5 rounded-2xl bg-slate-50 border-none font-bold text-sm" />
                <div className="flex gap-4 pt-4">
                  <button type="button" onClick={() => setContactoEmEdicao(null)} className="flex-1 py-5 bg-slate-100 text-slate-500 rounded-3xl font-black uppercase text-[10px]">Voltar</button>
                  <button type="submit" className="flex-[2] py-5 bg-amber-500 text-white rounded-3xl font-black uppercase text-[10px] tracking-widest shadow-xl">Gravar Alterações</button>
                </div>
             </form>
          </div>
        </div>
      )}

    </main>
  );
}