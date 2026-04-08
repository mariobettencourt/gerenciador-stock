"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/app/components/Sidebar"; // Caminho absoluto para evitar erros
import { supabase } from "@/lib/supabase";

export default function LivroContactos() {
  const [contactos, setContactos] = useState<any[]>([]);
  const [pesquisa, setPesquisa] = useState("");
  const [aCarregar, setACarregar] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [cargo, setCargo] = useState<string | null>(null);
  const [emailUtilizador, setEmailUtilizador] = useState<string>("");

  // Estado do formulário
  const [formulario, setFormulario] = useState({ 
    nome: "", 
    departamento: "Lota", 
    email: "" 
  });

  const carregarDados = async () => {
    setACarregar(true);
    // 1. Obter Utilizador
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.email) {
      setEmailUtilizador(user.email);
      const { data: perfil } = await supabase.from("perfis").select("cargo").eq("email", user.email).single();
      if (perfil) setCargo(perfil.cargo);
    }
    // 2. Obter Contactos
    const { data, error } = await supabase.from("contactos").select("*").order("nome");
    if (error) console.error("Erro ao carregar contactos:", error);
    setContactos(data || []);
    setACarregar(false);
  };

  useEffect(() => { carregarDados(); }, []);

  // FUNÇÃO DE ADIÇÃO (Corrigida)
  const guardarContacto = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from("contactos").insert([formulario]);
      
      if (error) {
        alert("Erro ao guardar: " + error.message);
      } else {
        setModalAberto(false); // Fecha o modal
        setFormulario({ nome: "", departamento: "Lota", email: "" }); // Limpa campos
        carregarDados(); // Atualiza a lista
      }
    } catch (err) {
      console.error("Erro inesperado:", err);
    }
  };

  const contactosFiltrados = contactos.filter(c => 
    c.nome.toLowerCase().includes(pesquisa.toLowerCase())
  );

  return (
    <div className="flex h-screen bg-[#f8fafc] font-sans overflow-hidden">
      <Sidebar cargo={cargo} email={emailUtilizador} />

      <main className="flex-1 p-12 overflow-y-auto">
        <header className="flex justify-between items-center mb-12">
          <div>
            <h1 className="text-4xl font-black text-[#0f172a] tracking-tighter uppercase italic">
              Livro de <span className="text-[#1e3a8a]">Contactos</span>
            </h1>
            <div className="h-1.5 w-24 bg-[#1e3a8a] rounded-full mt-2"></div>
          </div>
          
          <div className="flex gap-4">
            <input 
              type="text" 
              placeholder="Pesquisar..." 
              value={pesquisa}
              onChange={(e) => setPesquisa(e.target.value)}
              className="input-gourmet w-64 shadow-sm"
            />
            <button 
              onClick={() => setModalAberto(true)} 
              className="btn-gourmet bg-[#1e3a8a] text-white"
            >
              + Adicionar Destino
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          {aCarregar ? (
            <div className="col-span-full text-center p-20 font-black text-gray-300 uppercase animate-pulse italic">
              Sincronizando livro Lotaçor...
            </div>
          ) : contactosFiltrados.map((c) => (
            <div key={c.id} className="card-gourmet flex justify-between items-center group">
              <div className="flex items-center gap-6">
                <div className="w-20 h-20 bg-blue-50 rounded-[2rem] flex items-center justify-center text-3xl group-hover:bg-[#1e3a8a] group-hover:text-white transition-all duration-500 shadow-inner">
                  {c.departamento === 'Lota' ? '🏢' : '📍'}
                </div>
                <div>
                  <p className="text-[9px] font-black text-blue-500 uppercase tracking-[0.3em] mb-1">{c.departamento}</p>
                  <h3 className="text-2xl font-black text-[#0f172a] uppercase tracking-tighter leading-none mb-2">{c.nome}</h3>
                  <p className="text-xs font-bold text-gray-400 italic">{c.email || 'geral@lotacor.pt'}</p>
                </div>
              </div>
              <button 
                onClick={async () => { if(confirm("Remover?")) await supabase.from("contactos").delete().eq("id", c.id); carregarDados(); }}
                className="opacity-0 group-hover:opacity-100 p-3 hover:bg-red-50 rounded-2xl text-red-400 transition-all"
              >
                🗑️
              </button>
            </div>
          ))}
        </div>
      </main>

      {/* MODAL ADICIONAR DESTINO */}
      {modalAberto && (
        <div className="fixed inset-0 bg-[#0f172a]/80 backdrop-blur-md flex items-center justify-center z-50 p-6">
          <div className="bg-white rounded-[3.5rem] p-12 w-full max-w-md shadow-2xl border-4 border-white relative">
             <h2 className="text-2xl font-black text-[#1e3a8a] mb-8 uppercase italic tracking-tighter">Novo Registo</h2>
             
             <form onSubmit={guardarContacto} className="space-y-6">
                <div>
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-2 px-1">Nome da Unidade / Lota</label>
                  <input 
                    required 
                    type="text" 
                    value={formulario.nome} 
                    onChange={e => setFormulario({...formulario, nome: e.target.value})} 
                    className="input-gourmet w-full"
                    placeholder="EX: LOTA DE ANGRA" 
                  />
                </div>

                <div>
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-2 px-1">Tipo de Unidade</label>
                  <select 
                    value={formulario.departamento} 
                    onChange={e => setFormulario({...formulario, departamento: e.target.value})} 
                    className="input-gourmet w-full bg-white"
                  >
                    <option value="Lota">Lota</option>
                    <option value="Delegação">Delegação</option>
                    <option value="Posto de Recolha">Posto de Recolha</option>
                    <option value="Serviços Centrais">Serviços Centrais</option>
                  </select>
                </div>

                <div>
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-2 px-1">Email Interno</label>
                  <input 
                    type="email" 
                    value={formulario.email} 
                    onChange={e => setFormulario({...formulario, email: e.target.value})} 
                    className="input-gourmet w-full"
                    placeholder="exemplo@lotacor.pt" 
                  />
                </div>

                <div className="flex gap-4 pt-6">
                  <button 
                    type="button" 
                    onClick={() => setModalAberto(false)} 
                    className="flex-1 py-5 bg-gray-100 text-gray-400 rounded-[2rem] font-black uppercase text-[10px] tracking-widest hover:bg-gray-200 transition-colors"
                  >
                    Voltar
                  </button>
                  <button 
                    type="submit" 
                    className="flex-1 py-5 bg-[#1e3a8a] text-white rounded-[2rem] font-black uppercase text-[10px] tracking-widest shadow-2xl shadow-blue-900/20"
                  >
                    Confirmar
                  </button>
                </div>
             </form>
          </div>
        </div>
      )}
    </div>
  );
}