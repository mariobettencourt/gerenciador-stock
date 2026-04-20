"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function PerfilPessoal() {
  const [aCarregar, setACarregar] = useState(true);
  const [utilizadorAuth, setUtilizadorAuth] = useState<any>(null);
  
  // Estados do Formulário
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [cargo, setCargo] = useState("");
  const [novaPassword, setNovaPassword] = useState("");
  const [confirmarPassword, setConfirmarPassword] = useState("");
  
  // Estados de Feedback
  const [aGuardar, setAGuardar] = useState(false);
  const [mensagem, setMensagem] = useState({ tipo: "", texto: "" });

  useEffect(() => {
    carregarPerfil();
  }, []);

  const carregarPerfil = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      setUtilizadorAuth(user);
      setEmail(user.email || "");
      
      const { data: perfil } = await supabase
        .from("perfis")
        .select("nome, cargo")
        .eq("id", user.id)
        .single();
        
      if (perfil) {
        setNome(perfil.nome || "");
        setCargo(perfil.cargo || "Colaborador");
      }
    }
    setACarregar(false);
  };

  const guardarAlteracoes = async (e: React.FormEvent) => {
    e.preventDefault();
    setAGuardar(true);
    setMensagem({ tipo: "", texto: "" });

    // 1. Atualizar Password no Supabase Auth (se preenchida)
    if (novaPassword || confirmarPassword) {
      if (novaPassword !== confirmarPassword) {
        setMensagem({ tipo: "erro", texto: "As passwords não coincidem." });
        setAGuardar(false);
        return;
      }
      if (novaPassword.length < 6) {
        setMensagem({ tipo: "erro", texto: "A password deve ter pelo menos 6 caracteres." });
        setAGuardar(false);
        return;
      }

      const { error: authError } = await supabase.auth.updateUser({
        password: novaPassword
      });

      if (authError) {
        setMensagem({ tipo: "erro", texto: "Erro ao atualizar password: " + authError.message });
        setAGuardar(false);
        return;
      }
    }

    // 2. Atualizar Nome na tabela 'perfis'
    if (utilizadorAuth && nome) {
      const { error: dbError } = await supabase
        .from("perfis")
        .update({ nome: nome })
        .eq("id", utilizadorAuth.id);

      if (dbError) {
        setMensagem({ tipo: "erro", texto: "Erro ao atualizar o nome no perfil." });
        setAGuardar(false);
        return;
      }
    }

    // Limpa os campos de password após gravar
    setNovaPassword("");
    setConfirmarPassword("");
    setMensagem({ tipo: "sucesso", texto: "Perfil atualizado com sucesso!" });
    setAGuardar(false);
    
    // Remove a mensagem de sucesso ao fim de 4 segundos
    setTimeout(() => setMensagem({ tipo: "", texto: "" }), 4000);
  };

  if (aCarregar) return <div className="p-12 text-center text-[#1e3a8a] font-black uppercase animate-pulse h-screen flex items-center justify-center">A carregar dados de perfil...</div>;

  return (
    <main className="flex-1 p-8 md:p-12 overflow-y-auto h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto">
        
        <header className="mb-10 flex flex-col md:flex-row justify-between md:items-end gap-6">
          <div>
            <h1 className="text-4xl font-black text-[#0f172a] uppercase italic leading-none tracking-tighter">
              A Minha <span className="text-[#1e3a8a]">Conta</span>
            </h1>
            <div className="h-1.5 w-24 bg-[#1e3a8a] rounded-full mt-3 mb-2"></div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Gestão de Perfil e Segurança</p>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* COLUNA ESQUERDA: INFORMAÇÃO READ-ONLY */}
          <div className="bg-[#0f172a] rounded-[3rem] p-10 shadow-xl text-white h-fit relative overflow-hidden">
            <div className="absolute -right-10 -top-10 text-9xl opacity-5 select-none pointer-events-none">👤</div>
            <div className="relative z-10">
              <div className="w-20 h-20 bg-[#1e3a8a] rounded-[1.5rem] flex items-center justify-center text-3xl mb-8 shadow-inner">
                {cargo === "Administrador" ? "👑" : "💼"}
              </div>
              
              <div className="space-y-6">
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Nível de Acesso</p>
                  <span className="inline-block bg-blue-500/20 text-blue-300 px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border border-blue-500/30">
                    {cargo}
                  </span>
                </div>
                
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Email Corporativo</p>
                  <p className="text-sm font-bold text-slate-200">{email}</p>
                </div>
                
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Entidade</p>
                  <p className="text-sm font-bold text-slate-200 uppercase">Lotaçor S.A.</p>
                </div>
              </div>
            </div>
          </div>

          {/* COLUNA DIREITA: FORMULÁRIO DE EDIÇÃO */}
          <div className="lg:col-span-2 bg-white rounded-[3rem] p-10 shadow-sm border border-slate-100">
            <h2 className="text-xl font-black text-[#1e3a8a] mb-8 uppercase italic tracking-tighter border-b border-slate-50 pb-4">
              Atualizar Dados Pessoais
            </h2>
            
            {mensagem.texto && (
              <div className={`p-4 rounded-2xl mb-8 text-[10px] font-black uppercase tracking-widest text-center transition-all ${mensagem.tipo === 'sucesso' ? 'bg-green-50 text-green-600 border border-green-100' : 'bg-red-50 text-red-600 border border-red-100'}`}>
                {mensagem.texto}
              </div>
            )}

            <form onSubmit={guardarAlteracoes} className="space-y-8">
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase block mb-1.5 px-1 tracking-widest">Nome de Apresentação</label>
                <input 
                  type="text" 
                  required 
                  value={nome} 
                  onChange={e => setNome(e.target.value)} 
                  className="w-full p-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-[#1e3a8a]/20 focus:bg-white transition-all outline-none font-bold text-sm text-[#0f172a]" 
                />
              </div>

              <div className="pt-6 border-t border-slate-50">
                <h3 className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-4">Segurança (Opcional)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase block mb-1.5 px-1 tracking-widest">Nova Password</label>
                    <input 
                      type="password" 
                      value={novaPassword} 
                      onChange={e => setNovaPassword(e.target.value)} 
                      className="w-full p-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-amber-500/30 focus:bg-white transition-all outline-none font-bold text-sm text-[#0f172a]" 
                      placeholder="Deixar em branco para manter" 
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase block mb-1.5 px-1 tracking-widest">Confirmar Password</label>
                    <input 
                      type="password" 
                      value={confirmarPassword} 
                      onChange={e => setConfirmarPassword(e.target.value)} 
                      className="w-full p-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-amber-500/30 focus:bg-white transition-all outline-none font-bold text-sm text-[#0f172a]" 
                      placeholder="Repetir nova password" 
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <button 
                  type="submit" 
                  disabled={aGuardar} 
                  className="w-full py-5 bg-[#1e3a8a] text-white rounded-3xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-blue-900/10 hover:bg-[#152a66] transition-all active:scale-95 disabled:opacity-50"
                >
                  {aGuardar ? "A Processar..." : "Gravar Alterações"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}