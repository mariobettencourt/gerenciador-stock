"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation"; 
import { supabase } from "@/lib/supabase";
import toast, { Toaster } from 'react-hot-toast';
// Importação da nova função de estorno
import { gerarDocumentoPDF, enviarPedidoPorEmail, estornarEPagarPedido } from "@/lib/pedido-logic";

export default function PedidosTickets() {
  const router = useRouter(); 
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [listaContatos, setListaContatos] = useState<any[]>([]);
  const [aCarregar, setACarregar] = useState(true);
  
  const [modalAberto, setModalAberto] = useState(false);
  const [exploradorAberto, setExploradorAberto] = useState(false);
  const [contSelecionado, setContSelecionado] = useState<any>(null);
  const [pesquisaCont, setPesquisaCont] = useState("");
  const [catAtiva, setCatAtiva] = useState("Todas");

  const [modalEmail, setModalEmail] = useState<{ aberto: boolean; pedido: any }>({ aberto: false, pedido: null });
  const [emailInput, setEmailInput] = useState("");
  const [modalEliminar, setModalEliminar] = useState<{ aberto: boolean; id: number | null }>({ aberto: false, id: null });

  const [filtroEstado, setFiltroEstado] = useState("Todos");
  const [filtroData, setFiltroData] = useState("");
  const [nomeOperador, setNomeOperador] = useState("Sistema"); 

  const [formulario, setFormulario] = useState({ quem_pede: "", texto_pedido: "" });

  useEffect(() => { 
    const carregarTudo = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { data: perfil } = await supabase.from('perfis').select('nome').eq('id', user.id).single();
            setNomeOperador(perfil?.nome || user.email?.split('@')[0]);
        }
        await carregarDados();
    };
    carregarTudo();
  }, []);

  const carregarDados = async () => {
    setACarregar(true);
    const { data: conts } = await supabase.from("contactos").select("id, nome, departamento, email").order("nome");
    setListaContatos(conts || []);
    const { data: peds } = await supabase.from("pedidos").select(`*, contactos!contacto_id (nome, departamento, email)`).order("created_at", { ascending: false });
    setPedidos(peds || []);
    setACarregar(false);
  };

  const categorias = ["Todas", ...Array.from(new Set(listaContatos.map(c => c.departamento).filter(Boolean)))].sort();
  const contactosFiltrados = listaContatos.filter(c => 
    c.nome.toLowerCase().includes(pesquisaCont.toLowerCase()) && (catAtiva === "Todas" || c.departamento === catAtiva)
  );

  const handleImprimir = async (pedido: any) => {
    const { data: movs } = await supabase.from("movimentos").select("*").eq("pedido_id", pedido.id).eq("tipo", "Saída");
    if (!movs?.length) return toast.error("Pedido sem itens processados.");
    const doc = await gerarDocumentoPDF(pedido, movs);
    window.open(URL.createObjectURL(doc.output('blob')), '_blank');
  };

  // --- NOVA FUNÇÃO DE ELIMINAÇÃO COM ESTORNO ---
  const handleConfirmarEliminar = async () => {
    if (!modalEliminar.id) return;

    const pedidoAlvo = pedidos.find(p => p.id === modalEliminar.id);
    
    if (pedidoAlvo?.estado === "Pendente") {
      // Se for pendente, apaga direto (não houve mexida no stock)
      const { error } = await supabase.from("pedidos").delete().eq("id", modalEliminar.id);
      if (!error) {
        toast.success("Pedido eliminado.");
        carregarDados();
      } else {
        toast.error("Erro ao eliminar pedido.");
      }
    } else {
      // Se for Processado ou Concluído, corre a função de Reversão FIFO
      const sucesso = await estornarEPagarPedido(modalEliminar.id, supabase);
      if (sucesso) carregarDados();
    }

    setModalEliminar({ aberto: false, id: null });
  };

  return (
    <main className="flex-1 p-8 md:p-12 bg-slate-50 min-h-screen overflow-y-auto font-sans">
      <Toaster position="top-center" />

      {/* HEADER */}
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-12 gap-6">
        <div>
          <h1 className="text-4xl font-black text-[#0f172a] tracking-tighter uppercase italic leading-none">
            Fluxo de <span className="text-[#1e3a8a]">Pedidos</span>
          </h1>
          <div className="h-1.5 w-24 bg-[#1e3a8a] rounded-full mt-3"></div>
        </div>

        <div className="flex flex-wrap gap-4 items-center w-full lg:w-auto">
          <input type="date" value={filtroData} onChange={e => setFiltroData(e.target.value)} className="bg-white px-5 py-3 rounded-2xl shadow-sm border border-slate-200 text-xs font-bold outline-none focus:ring-2 ring-blue-100" />
          <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)} className="bg-white px-5 py-3 rounded-2xl shadow-sm border border-slate-200 text-xs font-bold outline-none uppercase cursor-pointer">
            <option value="Todos">Todos os Estados</option>
            <option value="Pendente">Pendentes</option>
            <option value="Processado">Processados</option>
            <option value="Concluído">Entregues</option>
          </select>
          <button onClick={() => setModalAberto(true)} className="px-8 py-4 bg-[#1e3a8a] text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl hover:bg-blue-900 transition-all active:scale-95">
            + Novo Pedido
          </button>
        </div>
      </header>

      {/* LISTAGEM */}
      <div className="space-y-5">
        {aCarregar ? (
            <div className="text-center py-20 font-black text-slate-300 animate-pulse uppercase italic tracking-widest">Acedendo aos servidores Lotaçor...</div>
        ) : (
          pedidos.filter(p => (filtroEstado === "Todos" || p.estado === filtroEstado) && (!filtroData || p.created_at.includes(filtroData))).map((p) => (
            <div key={p.id} className={`bg-white p-8 rounded-[2.5rem] shadow-sm flex flex-col md:flex-row justify-between items-center border-l-[12px] transition-all hover:shadow-md ${
              p.estado === 'Pendente' ? 'border-amber-400' : p.estado === 'Concluído' ? 'border-emerald-500' : 'border-[#1e3a8a]'
            }`}>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                    p.estado === 'Pendente' ? 'bg-amber-50 text-amber-600' : p.estado === 'Concluído' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'
                  }`}>● {p.estado}</span>
                  <span className="text-[10px] font-bold text-slate-300 tracking-widest">PEDIDO #{p.id}</span>
                </div>
                <h3 className="text-2xl font-black text-[#0f172a] uppercase tracking-tighter leading-none">{p.contactos?.nome}</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase mt-2">{p.contactos?.departamento} | Requisitado por: <span className="text-slate-600">{p.requisitante}</span></p>
              </div>

              <div className="flex flex-wrap gap-3 mt-6 md:mt-0">
                {p.estado === 'Pendente' && (
                  <button onClick={() => router.push(`/dashboard/pedidos/processar/${p.id}`)} className="bg-[#1e3a8a] text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase shadow-lg hover:bg-blue-900 transition-all">Processar Pedido</button>
                )}
                {p.estado === 'Processado' && (
                  <>
                    <button onClick={() => handleImprimir(p)} className="bg-slate-50 text-slate-600 border border-slate-200 px-6 py-4 rounded-2xl font-black text-[10px] uppercase hover:bg-slate-100">🖨️ Guia</button>
                    <button onClick={async () => { await supabase.from("pedidos").update({ estado: "Concluído" }).eq("id", p.id); carregarDados(); toast.success("Pedido Entregue!"); }} className="bg-emerald-600 text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase shadow-lg">Confirmar Entrega</button>
                  </>
                )}
                {p.estado === 'Concluído' && (
                  <>
                    <button onClick={() => handleImprimir(p)} className="bg-emerald-50 text-emerald-600 border border-emerald-100 px-6 py-4 rounded-2xl font-black text-[10px] uppercase">🖨️ Re-imprimir</button>
                    <button onClick={async () => {
                        const { data: c } = await supabase.from("contactos").select("email").eq("id", p.contacto_id).single();
                        if (c?.email) await enviarPedidoPorEmail(p, c.email, nomeOperador);
                        else { setModalEmail({ aberto: true, pedido: p }); setEmailInput(""); }
                    }} className="bg-blue-50 text-blue-600 border border-blue-100 px-6 py-4 rounded-2xl font-black text-[10px] uppercase flex items-center gap-2">✉️ Enviar PDF</button>
                  </>
                )}
                <button onClick={() => setModalEliminar({ aberto: true, id: p.id })} className="text-red-200 hover:text-red-500 text-[9px] font-black uppercase px-4 transition-colors">Eliminar</button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* MODAL NOVO PEDIDO */}
      {modalAberto && (
        <div className="fixed inset-0 bg-[#0f172a]/90 backdrop-blur-sm flex items-center justify-center z-50 p-6">
          <div className="bg-white rounded-[3.5rem] p-12 w-full max-w-lg shadow-2xl animate-in zoom-in duration-200 border-4 border-white">
            <h2 className="text-3xl font-black text-[#1e3a8a] mb-8 uppercase italic tracking-tighter text-center">Abrir Novo Pedido</h2>
            <div className="space-y-6">
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Contacto</label>
                <button 
                  onClick={() => setExploradorAberto(true)}
                  className="w-full p-5 bg-slate-50 rounded-2xl border-2 border-transparent hover:border-amber-500 flex justify-between items-center group transition-all"
                >
                  <span className={`font-black text-sm uppercase ${contSelecionado ? 'text-[#1e3a8a]' : 'text-slate-300'}`}>
                    {contSelecionado ? contSelecionado.nome : "-- ESCOLHER NO DIRETÓRIO --"}
                  </span>
                  <span className="text-xl group-hover:scale-125 transition-transform">📍</span>
                </button>
              </div>
              <input required className="w-full p-5 rounded-2xl bg-slate-50 border-none font-bold text-sm outline-none focus:ring-2 ring-blue-500/20" placeholder="Quem faz a requisição?" onChange={e => setFormulario({...formulario, quem_pede: e.target.value})} />
              <textarea required rows={3} className="w-full p-5 rounded-2xl bg-slate-50 border-none font-bold text-sm outline-none focus:ring-2 ring-blue-500/20" placeholder="O que é necessário?" onChange={e => setFormulario({...formulario, texto_pedido: e.target.value})} />
              <div className="flex gap-4 pt-4">
                <button onClick={() => setModalAberto(false)} className="flex-1 py-5 bg-slate-100 text-slate-500 rounded-[2rem] font-black uppercase text-[10px]">Fechar</button>
                <button onClick={async () => {
                    if(!contSelecionado) return toast.error("Selecione o destino!");
                    await supabase.from("pedidos").insert({ requisitante: formulario.quem_pede, contacto_id: contSelecionado.id, observacao: formulario.texto_pedido, estado: "Pendente" });
                    toast.success("Ticket Aberto!"); setModalAberto(false); carregarDados();
                }} className="flex-[2] py-5 bg-[#1e3a8a] text-white rounded-[2rem] font-black uppercase text-[10px] tracking-widest shadow-xl shadow-blue-900/20">Criar Ticket</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EXPLORADOR DE CONTACTOS */}
      {exploradorAberto && (
        <div className="fixed inset-0 bg-[#0f172a]/95 backdrop-blur-md z-[100] flex items-center justify-center p-4 md:p-12">
          <div className="bg-white w-full max-w-6xl h-[85vh] rounded-[3.5rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-10 border-b flex flex-col md:flex-row justify-between items-center gap-8 bg-slate-50/50">
              <div>
                <h2 className="text-3xl font-black text-[#1e3a8a] uppercase italic tracking-tighter leading-none">Contactos</h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">Selecione o destino do material</p>
              </div>
              <div className="flex items-center gap-4 w-full md:w-auto">
                <input type="text" placeholder="Procurar nome..." value={pesquisaCont} onChange={e => setPesquisaCont(e.target.value)} className="flex-1 md:w-80 p-4 bg-white border border-slate-200 rounded-2xl text-xs font-bold outline-none focus:ring-2 ring-amber-500" />
                <button onClick={() => setExploradorAberto(false)} className="px-6 py-4 bg-red-50 text-red-500 rounded-2xl font-black text-[10px] hover:bg-red-500 hover:text-white transition-all uppercase tracking-widest">Sair</button>
              </div>
            </div>
            <div className="flex-1 flex overflow-hidden">
              <div className="w-56 bg-slate-50 border-r p-6 space-y-2 overflow-y-auto hidden md:block">
                {categorias.map(cat => (
                  <button key={cat} onClick={() => setCatAtiva(cat)} className={`w-full text-left px-5 py-4 rounded-2xl text-[10px] font-black uppercase transition-all ${catAtiva === cat ? 'bg-[#1e3a8a] text-white shadow-xl' : 'text-slate-400 hover:bg-slate-200'}`}>{cat}</button>
                ))}
              </div>
              <div className="flex-1 p-10 bg-white overflow-y-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {contactosFiltrados.map(c => (
                  <button key={c.id} onClick={() => { setContSelecionado(c); setExploradorAberto(false); }} className="p-8 border-2 border-slate-50 rounded-[2.5rem] text-left hover:border-amber-500 hover:bg-amber-50 transition-all group flex flex-col justify-between h-48 shadow-sm hover:shadow-md">
                    <div>
                      <p className="text-[9px] font-black text-amber-500 uppercase mb-2 tracking-widest">{c.departamento}</p>
                      <h4 className="font-black text-[#0f172a] uppercase text-sm leading-tight mb-2">{c.nome}</h4>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-lg border ${c.email ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-100 text-slate-400 border-slate-200'}`}>
                        {c.email ? '✉️ Email Ativo' : '✉️ Sem Email'}
                      </span>
                      <span className="text-xl opacity-0 group-hover:opacity-100 transition-opacity text-amber-500 font-black">➔</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ELIMINAR COM LÓGICA DE ESTORNO */}
      {modalEliminar.aberto && (
        <div className="fixed inset-0 bg-[#0f172a]/95 backdrop-blur-md flex items-center justify-center z-[110] p-6 text-center">
          <div className="bg-white rounded-[3.5rem] p-12 w-full max-w-md shadow-2xl animate-in zoom-in duration-200">
            <div className="text-4xl mb-4">⚠️</div>
            <h2 className="text-2xl font-black text-red-600 mb-2 uppercase italic tracking-tighter leading-none">Anular Pedido</h2>
            <p className="text-xs text-slate-400 font-bold mb-8 uppercase tracking-widest leading-relaxed">
              Deseja apagar o registo #{modalEliminar.id}?<br/>
              <span className="text-red-500">O stock será devolvido automaticamente aos lotes.</span>
            </p>
            <div className="flex gap-4">
              <button onClick={() => setModalEliminar({ aberto: false, id: null })} className="flex-1 py-5 bg-slate-100 text-slate-500 rounded-[2rem] font-black uppercase text-[10px]">Voltar</button>
              {/* CHAMADA À NOVA FUNÇÃO NO CLIQUE */}
              <button onClick={handleConfirmarEliminar} className="flex-1 py-5 bg-red-600 text-white rounded-[2rem] font-black uppercase text-[10px] shadow-lg shadow-red-200">Sim, Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}