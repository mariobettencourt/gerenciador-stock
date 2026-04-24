"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import toast, { Toaster } from "react-hot-toast";

export default function AdminContas() {
  const [utilizadores, setUtilizadores] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [novaConta, setNovaConta] = useState({ 
    email: "", 
    password: "", 
    nome: "", 
    cargo: "Administrativo" 
  });
  
  const [utilizadorParaEditar, setUtilizadorParaEditar] = useState<any>(null);
  const [mostrarModal, setMostrarModal] = useState(false);

  useEffect(() => { carregarUtilizadores(); }, []);

  const carregarUtilizadores = async () => {
    const { data, error } = await supabase.from("perfis").select("*").order("nome");
    if (error) toast.error("Erro ao sincronizar equipa.");
    else setUtilizadores(data || []);
  };

  // Mapeamento de Nível de Acesso
  const getLevel = (cargo: string) => {
    if (cargo === "Administrador") return "admin";
    if (cargo === "Auditor") return "auditor";
    return "user";
  };

  const criarConta = async (e: React.FormEvent) => {
    e.preventDefault();
    const tId = toast.loading("A gerar credenciais e perfis...");
    setCarregando(true);

    try {
      const response = await fetch('/api/admin/criar-utilizador', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            ...novaConta,
            nivel_acesso: getLevel(novaConta.cargo)
        }),
      });
      
      const resultado = await response.json();
      
      if (resultado.error) {
        toast.error("Erro: " + resultado.error, { id: tId });
      } else {
        toast.success("Acesso criado! Convite enviado para o e-mail.", { id: tId });
        setNovaConta({ email: "", password: "", nome: "", cargo: "Administrativo" });
        carregarUtilizadores();
      }
    } catch (err) {
      toast.error("Erro crítico de ligação.", { id: tId });
    } finally { setCarregando(false); }
  };

  const guardarEdicao = async () => {
    const tId = toast.loading("A atualizar permissões...");
    const { error } = await supabase
      .from("perfis")
      .update({
        nome: utilizadorParaEditar.nome,
        cargo: utilizadorParaEditar.cargo,
        nivel_acesso: getLevel(utilizadorParaEditar.cargo)
      })
      .eq("id", utilizadorParaEditar.id);

    if (error) {
      toast.error("Erro na atualização.", { id: tId });
    } else {
      toast.success("Perfil atualizado com sucesso!", { id: tId });
      setMostrarModal(false);
      carregarUtilizadores();
    }
  };

  const eliminarUtilizador = async (id: string, nome: string) => {
    if (!confirm(`Confirmar REVOGAÇÃO TOTAL de acesso para: ${nome}?`)) return;
    
    const tId = toast.loading("A eliminar registos de segurança...");
    try {
      const response = await fetch('/api/admin/eliminar-utilizador', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      
      const resultado = await response.json();
      
      if (resultado.error) {
        toast.error("Erro: " + resultado.error, { id: tId });
      } else {
        toast.success("Acesso removido definitivamente.", { id: tId });
        carregarUtilizadores();
      }
    } catch (err) {
      toast.error("Erro na comunicação com a API.", { id: tId });
    }
  };

  const copiarEmail = (email: string) => {
    navigator.clipboard.writeText(email);
    toast.success("E-mail copiado!");
  };

  return (
    <main className="p-6 md:p-10 bg-slate-50 min-h-screen font-sans">
      <Toaster position="top-right" />
      
      <header className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-4xl font-black text-[#0f172a] uppercase italic tracking-tighter leading-none">
            Gestão de <span className="text-[#1e3a8a]">Acessos</span>
          </h1>
          <div className="h-1.5 w-24 bg-[#1e3a8a] rounded-full mt-3"></div>
        </div>
        <div className="bg-white px-6 py-3 rounded-2xl shadow-sm border border-slate-200 text-right">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Equipa Ativa Lotaçor</p>
          <p className="text-2xl font-black text-[#1e3a8a]">{utilizadores.length} <span className="text-xs text-slate-300">Membros</span></p>
        </div>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-8">
        
        {/* COLUNA FORMULÁRIO */}
        <div className="xl:col-span-2 bg-white rounded-[2.5rem] p-8 shadow-xl shadow-slate-200/50 border border-slate-100 h-fit">
          <div className="flex items-center gap-3 mb-8">
             <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-[#1e3a8a]">👤</div>
             <h2 className="text-lg font-black text-[#0f172a] uppercase italic tracking-tighter">Registar Colaborador</h2>
          </div>

          <form onSubmit={criarConta} className="space-y-5">
            <div className="space-y-4">
              <div className="group">
                <label className="text-[10px] font-black text-slate-400 uppercase block mb-1.5 px-1 group-focus-within:text-[#1e3a8a] transition-colors">Nome Completo</label>
                <input required type="text" value={novaConta.nome} onChange={e => setNovaConta({...novaConta, nome: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-[#1e3a8a]/20 focus:bg-white transition-all outline-none font-bold text-sm text-[#1e3a8a]" placeholder="Ex: Mário Bettencourt" />
              </div>
              
              <div className="group">
                <label className="text-[10px] font-black text-slate-400 uppercase block mb-1.5 px-1 group-focus-within:text-[#1e3a8a] transition-colors">Email Corporativo</label>
                <input required type="email" value={novaConta.email} onChange={e => setNovaConta({...novaConta, email: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-[#1e3a8a]/20 focus:bg-white transition-all outline-none font-bold text-sm text-[#1e3a8a]" placeholder="mario.bettencourt@lotacor.pt" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="group">
                  <label className="text-[10px] font-black text-slate-400 uppercase block mb-1.5 px-1">Password Inicial</label>
                  <input required type="password" value={novaConta.password} onChange={e => setNovaConta({...novaConta, password: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-[#1e3a8a]/20 focus:bg-white transition-all outline-none font-bold text-sm" placeholder="******" />
                </div>
                <div className="group">
                  <label className="text-[10px] font-black text-slate-400 uppercase block mb-1.5 px-1">Cargo / Perfil</label>
                  <select value={novaConta.cargo} onChange={e => setNovaConta({...novaConta, cargo: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-100 border-none font-black text-[10px] uppercase tracking-widest text-[#1e3a8a] focus:ring-2 ring-blue-100">
                    <option value="Administrativo">Administrativo</option>
                    <option value="Administrador">Administrador</option>
                    <option value="Auditor">Auditor (Consulta)</option>
                  </select>
                </div>
              </div>
            </div>

            <button type="submit" disabled={carregando} className="w-full py-5 bg-[#1e3a8a] text-white rounded-[2rem] font-black uppercase text-[10px] tracking-[0.2em] shadow-lg shadow-blue-900/20 hover:bg-[#0f172a] transition-all active:scale-95 disabled:opacity-50 mt-4">
              {carregando ? "A Sincronizar..." : "Ativar Novo Acesso"}
            </button>
          </form>
        </div>

        {/* COLUNA LISTA */}
        <div className="xl:col-span-3 bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-200 flex flex-col h-[700px]">
          <div className="flex justify-between items-center mb-8 px-2">
            <h2 className="text-sm font-black uppercase text-slate-400 tracking-[0.3em]">Lista de Permissões</h2>
            <div className="flex gap-2">
                <span className="w-3 h-3 rounded-full bg-blue-500" title="Admin"></span>
                <span className="w-3 h-3 rounded-full bg-emerald-500" title="User"></span>
                <span className="w-3 h-3 rounded-full bg-purple-500" title="Auditor"></span>
            </div>
          </div>

          <div className="space-y-3 overflow-y-auto pr-2 flex-1 custom-scrollbar">
            {utilizadores.map(u => (
              <div key={u.id} className="bg-white hover:bg-slate-50 transition-all p-5 rounded-3xl border border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 group shadow-sm hover:shadow-md">
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl shadow-inner transition-transform group-hover:scale-105 ${
                    u.cargo === 'Administrador' ? 'bg-blue-50' : 
                    u.cargo === 'Auditor' ? 'bg-purple-50' : 'bg-emerald-50'
                  }`}>
                    {u.cargo === 'Administrador' ? '🛡️' : u.cargo === 'Auditor' ? '🔍' : '👤'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                        <p className="font-black text-sm uppercase text-[#0f172a]">{u.nome || "Utilizador"}</p>
                        <span className={`text-[8px] font-black px-2 py-0.5 rounded-md uppercase tracking-widest ${
                            u.cargo === 'Administrador' ? 'bg-blue-100 text-blue-600' : 
                            u.cargo === 'Auditor' ? 'bg-purple-100 text-purple-600' : 'bg-emerald-100 text-emerald-600'
                        }`}>
                            {u.cargo}
                        </span>
                    </div>
                    <button onClick={() => copiarEmail(u.email)} className="text-[10px] text-slate-400 font-bold hover:text-[#1e3a8a] transition-colors flex items-center gap-1">
                        {u.email} <span className="text-[8px]">📋</span>
                    </button>
                  </div>
                </div>
                
                <div className="flex gap-2 w-full sm:w-auto">
                  <button onClick={() => { setUtilizadorParaEditar(u); setMostrarModal(true); }} className="flex-1 sm:flex-none px-4 py-3 bg-slate-50 text-[9px] font-black uppercase text-[#1e3a8a] rounded-xl hover:bg-[#1e3a8a] hover:text-white transition-all">
                    Ajustar
                  </button>
                  <button onClick={() => eliminarUtilizador(u.id, u.nome)} className="flex-1 sm:flex-none px-4 py-3 bg-red-50 text-[9px] font-black uppercase text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all">
                    Revogar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* MODAL DE EDIÇÃO */}
      {mostrarModal && (
        <div className="fixed inset-0 bg-[#0f172a]/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] p-10 max-w-sm w-full shadow-2xl border border-white/20 animate-in fade-in zoom-in duration-200">
            <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest text-center mb-2">Editor de Perfil</p>
            <h2 className="text-2xl font-black text-[#0f172a] mb-8 uppercase italic tracking-tighter text-center leading-none">Alterar Credenciais</h2>
            
            <div className="space-y-6">
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase block mb-1.5 px-1">Nome de Exibição</label>
                <input type="text" value={utilizadorParaEditar.nome} onChange={e => setUtilizadorParaEditar({...utilizadorParaEditar, nome: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold text-sm text-[#1e3a8a] focus:ring-2 ring-blue-100 transition-all" />
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase block mb-1.5 px-1">Cargo e Nível de Acesso</label>
                <select value={utilizadorParaEditar.cargo} onChange={e => setUtilizadorParaEditar({...utilizadorParaEditar, cargo: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-none font-black text-[10px] uppercase tracking-widest text-[#1e3a8a] focus:ring-2 ring-blue-100">
                  <option value="Administrativo">Administrativo</option>
                  <option value="Administrador">Administrador</option>
                  <option value="Auditor">Auditor (Consulta)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-6">
                <button onClick={() => setMostrarModal(false)} className="py-4 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-[9px] tracking-widest hover:bg-slate-200 transition-all">Cancelar</button>
                <button onClick={guardarEdicao} className="py-4 bg-[#1e3a8a] text-white rounded-2xl font-black uppercase text-[9px] tracking-widest hover:bg-[#0f172a] shadow-lg shadow-blue-200 transition-all">Confirmar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}