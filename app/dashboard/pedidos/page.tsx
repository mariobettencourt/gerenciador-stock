"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function PedidosTickets() {
  const router = useRouter();
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [contactos, setContactos] = useState<any[]>([]);
  const [aCarregar, setACarregar] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [cargo, setCargo] = useState<string | null>(null);
  const [emailUtilizador, setEmailUtilizador] = useState<string>("");

  const [formulario, setFormulario] = useState({
    requisitante: "",
    contacto_id: "",
    tipo: "Normal",
    observacao: ""
  });

  const carregarDados = async () => {
    setACarregar(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.email) {
      setEmailUtilizador(user.email);
      const { data: perfil } = await supabase.from("perfis").select("cargo").eq("email", user.email).single();
      if (perfil) setCargo(perfil.cargo);
    }

    const { data: conts } = await supabase.from("contactos").select("*").order("nome");
    setContactos(conts || []);

    const { data: peds } = await supabase
      .from("pedidos")
      .select("*, contactos(nome, departamento)")
      .order("created_at", { ascending: false });
    setPedidos(peds || []);
    setACarregar(false);
  };

  useEffect(() => { carregarDados(); }, []);

  const criarTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formulario.contacto_id) return alert("Selecione um destino!");
    await supabase.from("pedidos").insert([formulario]);
    setModalAberto(false);
    setFormulario({ requisitante: "", contacto_id: "", tipo: "Normal", observacao: "" });
    carregarDados();
  };

  const mudarEstado = async (id: number, novoEstado: string) => {
    await supabase.from("pedidos").update({ estado: novoEstado }).eq("id", id);
    carregarDados();
  };

  return (
    <div className="flex h-screen bg-[#f8fafc] font-sans">
      {/* SIDEBAR GOURMET */}
      <aside className="w-72 bg-gradient-to-b from-[#0f172a] to-[#1e3a8a] text-white flex flex-col shadow-xl">
        <div className="p-8 mb-4 flex items-center gap-3">
          <div className="bg-white/10 p-2 rounded-xl backdrop-blur-md border border-white/20 text-2xl">🧊</div>
          <div>
            <h1 className="text-xl font-black tracking-tighter leading-none italic uppercase">Lotaçor</h1>
            <p className="text-[9px] font-bold text-blue-300 tracking-[0.3em] uppercase">Economato</p>
          </div>
        </div>
        <nav className="flex-1 px-4 space-y-1">
          <button onClick={() => router.push("/dashboard")} className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl text-blue-100 hover:bg-white/10 transition-all uppercase text-[11px] tracking-widest text-left"><span>🏠</span> Inventário</button>
          <button onClick={() => router.push("/dashboard/gestao")} className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl text-blue-100 hover:bg-white/10 transition-all uppercase text-[11px] tracking-widest text-left"><span>📦</span> Gestão Stock</button>
          <button onClick={() => router.push("/dashboard/pedidos")} className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl bg-white text-[#1e3a8a] shadow-lg font-bold uppercase text-[11px] tracking-widest text-left"><span>📋</span> Pedidos</button>
          <button onClick={() => router.push("/dashboard/contactos")} className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl text-blue-100 hover:bg-white/10 transition-all uppercase text-[11px] tracking-widest text-left"><span>📇</span> Contactos</button>
          <button onClick={() => router.push("/dashboard/movimentos")} className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl text-blue-100 hover:bg-white/10 transition-all uppercase text-[11px] tracking-widest text-left"><span>🔄</span> Movimentos</button>
        </nav>
        <div className="m-6 p-4 bg-white/5 border border-white/10 rounded-[2rem] text-xs">
          <p className="font-black text-blue-300 uppercase mb-1 tracking-widest">{cargo}</p>
          <p className="opacity-70 truncate mb-4">{emailUtilizador}</p>
          <button onClick={async () => { await supabase.auth.signOut(); router.push("/"); }} className="w-full py-3 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white rounded-xl font-black uppercase transition-all">Sair</button>
        </div>
      </aside>

      <main className="flex-1 p-12 overflow-y-auto">
        <header className="flex justify-between items-center mb-12">
          <div>
            <h1 className="text-4xl font-black text-[#0f172a] tracking-tighter">Gestão de <span className="text-[#1e3a8a] italic">Pedidos</span></h1>
            <div className="h-1.5 w-24 bg-[#1e3a8a] rounded-full mt-2"></div>
          </div>
          <button onClick={() => setModalAberto(true)} className="bg-[#1e3a8a] text-white px-10 py-5 rounded-[2rem] font-black uppercase text-[10px] tracking-widest shadow-2xl hover:-translate-y-1 transition-all">+ Novo Pedido</button>
        </header>

        <div className="grid grid-cols-1 gap-6">
          {aCarregar ? (
            <div className="text-center p-20 font-black text-gray-300 uppercase tracking-widest animate-pulse">Sincronizando pedidos...</div>
          ) : pedidos.length === 0 ? (
            <div className="bg-white rounded-[3rem] p-20 text-center border-4 border-dashed border-gray-100 text-gray-300 font-black uppercase tracking-widest">Sem pedidos registados</div>
          ) : pedidos.map((p) => (
            <div key={p.id} className="bg-white p-8 rounded-[2.5rem] shadow-xl shadow-blue-900/[0.03] border border-white flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 group hover:border-blue-100 transition-all">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-4">
                  <span className={`px-4 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${p.estado === 'Pendente' ? 'bg-orange-100 text-orange-600 shadow-sm shadow-orange-100' : 'bg-green-100 text-green-600 shadow-sm shadow-green-100'}`}>
                    {p.estado}
                  </span>
                  <span className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Prioridade: {p.tipo}</span>
                  <span className="text-[10px] text-gray-300 font-bold ml-auto lg:ml-0">GUIA #{p.id.toString().padStart(5, '0')}</span>
                </div>
                <h3 className="text-2xl font-black text-[#0f172a] uppercase tracking-tighter mb-1">{p.contactos?.nome}</h3>
                <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mb-4 italic">{p.contactos?.departamento}</p>
                
                <div className="bg-[#f8fafc] p-5 rounded-3xl border border-gray-100">
                  <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest mb-2 italic">Material Solicitado / Observações:</p>
                  <p className="text-sm text-gray-600 font-medium leading-relaxed leading-relaxed">
                    {p.observacao} <br/>
                    <span className="text-[#1e3a8a] font-black mt-2 inline-block">— {p.requisitante}</span>
                  </p>
                </div>
              </div>
              
              <div className="flex flex-col gap-3 min-w-[220px] w-full lg:w-auto">
                {p.estado === 'Pendente' ? (
                  <button 
                    onClick={() => mudarEstado(p.id, 'Completo')} 
                    className="w-full bg-[#1e3a8a] text-white py-5 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-blue-200 hover:bg-blue-800 transition-all active:scale-95"
                  >
                    Fechar Pedido
                  </button>
                ) : (
                  <button 
                    onClick={() => router.push(`/dashboard/pedidos/guia/${p.id}`)}
                    className="w-full bg-white border-4 border-[#1e3a8a] text-[#1e3a8a] py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-50 transition-all flex items-center justify-center gap-2"
                  >
                    📄 Ver Guia Transporte
                  </button>
                )}
                <button 
                  onClick={async () => { if(confirm("Eliminar?")) await supabase.from("pedidos").delete().eq("id", p.id); carregarDados(); }}
                  className="w-full py-3 text-red-300 hover:text-red-500 font-black text-[9px] uppercase tracking-widest transition-colors"
                >
                  Eliminar Registo
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* MODAL GOURMET */}
      {modalAberto && (
        <div className="fixed inset-0 bg-[#0f172a]/80 backdrop-blur-md flex items-center justify-center z-50 p-6">
          <div className="bg-white rounded-[3rem] p-10 w-full max-w-xl shadow-2xl border-4 border-white overflow-hidden relative">
             <div className="absolute top-0 right-0 p-8 opacity-10 text-8xl font-black italic select-none">TICKET</div>
             <h2 className="text-2xl font-black text-[#1e3a8a] mb-8 uppercase italic tracking-tighter relative">Novo Pedido Economato</h2>
             
             <form onSubmit={criarTicket} className="space-y-5 relative">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[9px] font-black text-gray-300 uppercase tracking-widest block mb-2">Pessoa Requisitante</label>
                    <input required type="text" value={formulario.requisitante} onChange={e => setFormulario({...formulario, requisitante: e.target.value})} className="w-full border-2 border-gray-50 p-4 rounded-2xl font-bold text-sm outline-none focus:border-[#1e3a8a]" placeholder="Ex: Eng. Silva" />
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-gray-300 uppercase tracking-widest block mb-2">Urgência</label>
                    <select value={formulario.tipo} onChange={e => setFormulario({...formulario, tipo: e.target.value})} className="w-full border-2 border-gray-50 p-4 rounded-2xl font-bold bg-white text-sm outline-none">
                      <option value="Normal">Normal</option>
                      <option value="Urgente">Urgente</option>
                      <option value="Reposição">Reposição</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[9px] font-black text-gray-300 uppercase tracking-widest block mb-2">Lota / Destino Final</label>
                  <select required value={formulario.contacto_id} onChange={e => setFormulario({...formulario, contacto_id: e.target.value})} className="w-full border-2 border-gray-50 p-4 rounded-2xl font-black text-sm bg-[#f8fafc] text-[#1e3a8a] outline-none">
                    <option value="">-- Selecionar Destino do Livro --</option>
                    {contactos.map(c => <option key={c.id} value={c.id}>{c.nome} ({c.departamento})</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-[9px] font-black text-gray-300 uppercase tracking-widest block mb-2">Descrição Detalhada do Material</label>
                  <textarea required rows={4} value={formulario.observacao} onChange={e => setFormulario({...formulario, observacao: e.target.value})} className="w-full border-2 border-gray-50 p-4 rounded-2xl font-bold text-sm outline-none focus:border-[#1e3a8a]" placeholder="Liste aqui as quantidades e nomes dos materiais..."></textarea>
                </div>

                <div className="flex gap-4 pt-4">
                  <button type="button" onClick={() => setModalAberto(false)} className="flex-1 py-4 bg-gray-50 text-gray-400 rounded-2xl font-black uppercase text-[10px] tracking-widest">Voltar</button>
                  <button type="submit" className="flex-1 py-4 bg-[#1e3a8a] text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-2xl shadow-blue-200">Emitir Pedido</button>
                </div>
             </form>
          </div>
        </div>
      )}
    </div>
  );
}