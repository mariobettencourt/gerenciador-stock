"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AdminContas() {
  const [utilizadores, setUtilizadores] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [novaConta, setNovaConta] = useState({ email: "", password: "", nome: "", cargo: "Administrativo" });
  
  // Estados para Edição
  const [utilizadorParaEditar, setUtilizadorParaEditar] = useState<any>(null);
  const [mostrarModal, setMostrarModal] = useState(false);

  useEffect(() => { carregarUtilizadores(); }, []);

  const carregarUtilizadores = async () => {
    const { data } = await supabase.from("perfis").select("*").order("nome");
    setUtilizadores(data || []);
  };

  const criarConta = async (e: React.FormEvent) => {
    e.preventDefault();
    setCarregando(true);
    try {
      const response = await fetch('/api/admin/criar-utilizador', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(novaConta),
      });
      const resultado = await response.json();
      
      if (resultado.error) {
        alert("Erro: " + resultado.error);
      } else {
        alert("Conta de colaborador gerada com sucesso!");
        setNovaConta({ email: "", password: "", nome: "", cargo: "Administrativo" });
        carregarUtilizadores();
      }
    } catch (err) {
      alert("Erro na ligação ao servidor.");
    } finally { setCarregando(false); }
  };

  const guardarEdicao = async () => {
    const { error } = await supabase
      .from("perfis")
      .update({
        nome: utilizadorParaEditar.nome,
        cargo: utilizadorParaEditar.cargo,
        nivel_acesso: utilizadorParaEditar.cargo === "Administrador" ? "admin" : "user"
      })
      .eq("id", utilizadorParaEditar.id);

    if (error) {
      alert("Erro ao atualizar!");
    } else {
      setMostrarModal(false);
      carregarUtilizadores();
    }
  };

  const eliminarUtilizador = async (id: string, nome: string) => {
    if (!confirm(`Tem a certeza que deseja remover o acesso de ${nome}?`)) return;
    
    // Remove o perfil da base de dados
    const { error } = await supabase.from("perfis").delete().eq("id", id);
    if (!error) {
      carregarUtilizadores();
    } else {
      alert("Erro ao remover o perfil.");
    }
  };

  return (
    <main className="p-8 md:p-12 bg-slate-50 min-h-screen">
      <header className="mb-10 flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-black text-[#0f172a] uppercase italic tracking-tighter leading-none">
            Gestão de <span className="text-[#1e3a8a]">Acessos</span>
          </h1>
          <div className="h-1.5 w-24 bg-[#1e3a8a] rounded-full mt-3"></div>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total de Colaboradores</p>
          <p className="text-2xl font-black text-[#1e3a8a]">{utilizadores.length}</p>
        </div>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-12">
        {/* FORMULÁRIO DE CRIAÇÃO */}
        <div className="bg-white rounded-[3rem] p-10 shadow-sm border border-slate-100 h-fit">
          <h2 className="text-xl font-black text-[#1e3a8a] mb-8 uppercase italic tracking-tighter">
            Registar Novo Utilizador
          </h2>
          <form onSubmit={criarConta} className="space-y-6">
            <div className="space-y-4">
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase block mb-1.5 px-1">Nome Completo</label>
                <input required type="text" value={novaConta.nome} onChange={e => setNovaConta({...novaConta, nome: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-[#1e3a8a]/10 focus:bg-white transition-all outline-none font-bold text-sm" placeholder="Ex: Maria João" />
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase block mb-1.5 px-1">Email Corporativo</label>
                <input required type="email" value={novaConta.email} onChange={e => setNovaConta({...novaConta, email: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-[#1e3a8a]/10 focus:bg-white transition-all outline-none font-bold text-sm" placeholder="exemplo@lotacor.pt" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase block mb-1.5 px-1">Password</label>
                  <input required type="password" value={novaConta.password} onChange={e => setNovaConta({...novaConta, password: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-[#1e3a8a]/10 focus:bg-white transition-all outline-none font-bold text-sm" placeholder="******" />
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase block mb-1.5 px-1">Cargo</label>
                  <select value={novaConta.cargo} onChange={e => setNovaConta({...novaConta, cargo: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-[#1e3a8a]/10 focus:bg-white transition-all outline-none font-bold text-sm text-[#1e3a8a]">
                    <option value="Administrativo">Administrativo</option>
                    <option value="Administrador">Administrador</option>
                  </select>
                </div>
              </div>
            </div>
            <button type="submit" disabled={carregando} className="w-full py-5 bg-[#1e3a8a] text-white rounded-3xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-blue-900/10 hover:bg-[#152a66] transition-all active:scale-95 disabled:opacity-50">
              {carregando ? "A Gerar Acesso..." : "Confirmar e Gerar Acesso"}
            </button>
          </form>
        </div>

        {/* LISTA DE EQUIPA ATIVA */}
        <div className="bg-white rounded-[3rem] p-10 shadow-sm border border-slate-100 flex flex-col h-[650px]">
          <h2 className="text-xl font-black uppercase italic mb-8 text-[#0f172a] border-b border-slate-50 pb-4">
            Equipa <span className="text-[#1e3a8a]">Lotaçor</span>
          </h2>
          <div className="space-y-3 overflow-y-auto pr-2 flex-1 scrollbar-hide">
            {utilizadores.map(u => (
              <div key={u.id} className="bg-slate-50/50 hover:bg-white hover:shadow-xl hover:shadow-slate-200/50 transition-all p-5 rounded-[2rem] border border-slate-100 flex justify-between items-center group">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-inner ${u.cargo === 'Administrador' ? 'bg-amber-50' : 'bg-blue-50'}`}>
                    {u.cargo === 'Administrador' ? '👑' : '💼'}
                  </div>
                  <div>
                    <p className="font-black text-sm uppercase text-slate-800">{u.nome || "Utilizador"}</p>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">{u.email}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => { setUtilizadorParaEditar(u); setMostrarModal(true); }}
                    className="p-3 bg-white border border-slate-100 rounded-xl text-[9px] font-black uppercase text-[#1e3a8a] hover:bg-blue-50 transition-all"
                  >
                    Editar
                  </button>
                  <button 
                    onClick={() => eliminarUtilizador(u.id, u.nome)}
                    className="p-3 bg-white border border-slate-100 rounded-xl text-[9px] font-black uppercase text-red-400 hover:bg-red-50 hover:text-red-600 transition-all"
                  >
                    Remover
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* MODAL DE EDIÇÃO SIMPLIFICADO */}
      {mostrarModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] p-10 max-w-sm w-full shadow-2xl animate-in fade-in zoom-in duration-200">
            <h2 className="text-xl font-black text-[#1e3a8a] mb-6 uppercase italic tracking-tighter text-center">Atualizar Perfil</h2>
            
            <div className="space-y-5">
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase block mb-1 px-1">Nome</label>
                <input type="text" value={utilizadorParaEditar.nome} onChange={e => setUtilizadorParaEditar({...utilizadorParaEditar, nome: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold text-sm" />
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase block mb-1 px-1">Nível de Acesso</label>
                <select value={utilizadorParaEditar.cargo} onChange={e => setUtilizadorParaEditar({...utilizadorParaEditar, cargo: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold text-sm text-[#1e3a8a]">
                  <option value="Administrativo">Administrativo</option>
                  <option value="Administrador">Administrador</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-4">
                <button onClick={() => setMostrarModal(false)} className="py-4 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-[9px] tracking-widest hover:bg-slate-200">Voltar</button>
                <button onClick={guardarEdicao} className="py-4 bg-[#1e3a8a] text-white rounded-2xl font-black uppercase text-[9px] tracking-widest hover:bg-[#152a66] shadow-lg shadow-blue-200">Gravar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}