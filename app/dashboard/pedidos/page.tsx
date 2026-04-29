"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation"; 
import { supabase } from "@/lib/supabase";
import toast, { Toaster } from 'react-hot-toast';
import { gerarDocumentoPDF, enviarPedidoPorEmail, estornarEPagarPedido } from "@/lib/pedido-logic";

export default function PedidosTickets() {
  const router = useRouter(); 
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [listaContatos, setListaContatos] = useState<any[]>([]);
  const [aCarregar, setACarregar] = useState(true);
  
  // Limite de Memória (Paginação)
  const [limitePedidos, setLimitePedidos] = useState(50);
  const [carregandoMais, setCarregandoMais] = useState(false);
  
  // Estados de UI (Explorador e Modais)
  const [modalAberto, setModalAberto] = useState(false);
  const [exploradorAberto, setExploradorAberto] = useState(false);
  const [origemExplorador, setOrigemExplorador] = useState<"novo" | "editar">("novo");
  
  const [pesquisaCont, setPesquisaCont] = useState("");
  const [catAtiva, setCatAtiva] = useState("Todas");

  const [modalEmail, setModalEmail] = useState<{ aberto: boolean; pedido: any }>({ aberto: false, pedido: null });
  const [modalEliminar, setModalEliminar] = useState<{ aberto: boolean; id: number | null }>({ aberto: false, id: null });
  const [emailInput, setEmailInput] = useState("");

  // NOVOS MODAIS: Editar e Histórico
  const [modalEditar, setModalEditar] = useState<{ aberto: boolean; form: any }>({ aberto: false, form: null });
  const [modalHistorico, setModalHistorico] = useState<{ aberto: boolean; id: number | null; logs: any[]; aCarregar: boolean }>({ aberto: false, id: null, logs: [], aCarregar: false });

  // Filtros Globais e Pesquisa
  const [filtroEstado, setFiltroEstado] = useState("Todos");
  const [filtroData, setFiltroData] = useState("");
  const [pesquisaGeral, setPesquisaGeral] = useState(""); // Nova Barra de Pesquisa
  const [nomeOperador, setNomeOperador] = useState("Sistema"); 

  const [formulario, setFormulario] = useState({ quem_pede: "", texto_pedido: "", contacto: null as any });

  useEffect(() => { 
    const carregarTudo = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { data: perfil } = await supabase.from('perfis').select('nome').eq('id', user.id).single();
            setNomeOperador(perfil?.nome || user.email?.split('@')[0]);
        }
        await carregarDados(50);
    };
    carregarTudo();
  }, []);

  const carregarDados = async (limite: number) => {
    setACarregar(true);
    const { data: conts } = await supabase.from("contactos").select("id, nome, departamento, email").order("nome");
    setListaContatos(conts || []);
    
    // LIMITAMOS PARA POUPAR MEMÓRIA
    const { data: peds } = await supabase.from("pedidos").select(`*, contactos!contacto_id (nome, departamento, email)`).order("created_at", { ascending: false }).limit(limite);
    
    const pedsFormatados = peds?.map(p => ({
        ...p, contactos: Array.isArray(p.contactos) ? p.contactos[0] : p.contactos
    }));
    
    setPedidos(pedsFormatados || []);
    setACarregar(false);
    setCarregandoMais(false);
  };

  // FUNÇÃO PARA GRAVAR O RASTO DE AUDITORIA
  const registarLog = async (pedidoId: number, acao: string, detalhes: string) => {
    await supabase.from("logs_pedidos").insert({
      pedido_id: pedidoId,
      acao: acao,
      detalhes: detalhes,
      utilizador: nomeOperador
    });
  };

  const carregarMaisAntigos = () => {
    setCarregandoMais(true);
    const novoLimite = limitePedidos + 50;
    setLimitePedidos(novoLimite);
    carregarDados(novoLimite);
  };

  const abrirModalHistorico = async (id: number) => {
    setModalHistorico({ aberto: true, id, logs: [], aCarregar: true });
    const { data } = await supabase.from("logs_pedidos").select("*").eq("pedido_id", id).order("created_at", { ascending: false });
    setModalHistorico({ aberto: true, id, logs: data || [], aCarregar: false });
  };

  const guardarEdicao = async () => {
    if (!modalEditar.form.contacto) return toast.error("Falta o destino!");
    const loadingId = toast.loading("A guardar...");
    const { error } = await supabase.from("pedidos").update({
      requisitante: modalEditar.form.quem_pede,
      contacto_id: modalEditar.form.contacto.id,
      observacao: modalEditar.form.texto_pedido
    }).eq("id", modalEditar.form.id);

    if (!error) {
      // REGISTAR LOG DA EDIÇÃO
      await registarLog(modalEditar.form.id, "EDITADO", "Informações do requisitante/destino atualizadas.");
      
      toast.success("Pedido atualizado!", { id: loadingId });
      setModalEditar({ aberto: false, form: null });
      carregarDados(limitePedidos);
    } else {
      toast.error("Erro ao atualizar.", { id: loadingId });
    }
  };

  const handleImprimir = async (pedido: any) => {
    const { data: movs } = await supabase.from("movimentos").select("*").eq("pedido_id", pedido.id).eq("tipo", "Saída");
    if (!movs?.length) return toast.error("Pedido sem itens processados.");
    const doc = await gerarDocumentoPDF(pedido, movs);
    window.open(URL.createObjectURL(doc.output('blob')), '_blank');
  };

  const handleConfirmarEliminar = async () => {
    if (!modalEliminar.id) return;
    const pedidoAlvo = pedidos.find(p => p.id === modalEliminar.id);
    
    if (pedidoAlvo?.estado === "Pendente") {
      const { error } = await supabase.from("pedidos").delete().eq("id", modalEliminar.id);
      if (!error) { toast.success("Pedido eliminado."); carregarDados(limitePedidos); } 
      else toast.error("Erro ao eliminar pedido.");
    } else {
      const sucesso = await estornarEPagarPedido(modalEliminar.id, supabase);
      if (sucesso) carregarDados(limitePedidos);
    }
    setModalEliminar({ aberto: false, id: null });
  };

  const getCoresEstado = (estado: string) => {
    if (estado === 'Pendente') return { badge: 'bg-amber-50 text-amber-600 border-amber-200', barra: 'bg-amber-400' };
    if (estado === 'Processado') return { badge: 'bg-blue-50 text-[#1e3a8a] border-blue-200', barra: 'bg-[#1e3a8a]' };
    return { badge: 'bg-emerald-50 text-emerald-600 border-emerald-200', barra: 'bg-emerald-500' };
  };

  // LÓGICA DE FILTRAGEM
  const pedidosMostrados = pedidos.filter(p => {
    const matchEstado = filtroEstado === "Todos" || p.estado === filtroEstado;
    const matchData = !filtroData || p.created_at.includes(filtroData);
    const termo = pesquisaGeral.toLowerCase();
    const matchPesquisa = !termo || 
        p.id.toString().includes(termo) || 
        p.requisitante?.toLowerCase().includes(termo) || 
        p.contactos?.nome?.toLowerCase().includes(termo) ||
        p.contactos?.departamento?.toLowerCase().includes(termo);

    return matchEstado && matchData && matchPesquisa;
  });

  const categorias = ["Todas", ...Array.from(new Set(listaContatos.map(c => c.departamento).filter(Boolean)))].sort();
  const contactosFiltrados = listaContatos.filter(c => 
    c.nome.toLowerCase().includes(pesquisaCont.toLowerCase()) && (catAtiva === "Todas" || c.departamento === catAtiva)
  );

  const tabsEstado = [
    { id: "Todos", label: "Todos os Estados" },
    { id: "Pendente", label: "Pendentes" },
    { id: "Processado", label: "Processados (Por Entregar)" },
    { id: "Concluído", label: "Concluídos" }
  ];

  return (
    <main className="flex-1 p-8 md:p-12 bg-slate-50 min-h-screen overflow-y-auto font-sans">
      <Toaster position="top-center" />

      {/* HEADER E TABS */}
      <header className="mb-10 flex flex-col gap-6">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
          <div>
            <h1 className="text-4xl font-black text-[#0f172a] tracking-tighter uppercase italic leading-none">
              Gestão de <span className="text-[#1e3a8a]">Pedidos</span>
            </h1>
            <div className="h-1.5 w-24 bg-[#1e3a8a] rounded-full mt-3"></div>
          </div>

          <div className="flex flex-wrap gap-4 items-center w-full lg:w-auto">
            {/* NOVA BARRA DE PESQUISA */}
            <div className="relative w-full md:w-64">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
                <input 
                  type="text" placeholder="Pesquisar tickets..." value={pesquisaGeral} onChange={e => setPesquisaGeral(e.target.value)} 
                  className="w-full bg-white pl-10 pr-4 py-4 rounded-2xl shadow-sm border border-slate-200 text-xs font-bold outline-none focus:ring-2 ring-[#1e3a8a]/20 transition-all text-slate-600" 
                />
            </div>
            <input 
              type="date" value={filtroData} onChange={e => setFiltroData(e.target.value)} 
              className="w-full md:w-auto bg-white px-5 py-4 rounded-2xl shadow-sm border border-slate-200 text-xs font-bold outline-none focus:ring-2 ring-[#1e3a8a]/20 transition-all text-slate-500" 
            />
            <button 
              onClick={() => { setFormulario({ quem_pede: "", texto_pedido: "", contacto: null }); setModalAberto(true); }} 
              className="w-full md:w-auto px-8 py-4 bg-[#1e3a8a] text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-blue-900/20 hover:bg-[#0f172a] hover:-translate-y-0.5 transition-all"
            >
              + Novo Pedido
            </button>
          </div>
        </div>

        {/* BARRA DE TABS */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide pt-2">
          {tabsEstado.map(tab => (
            <button 
              key={tab.id} onClick={() => setFiltroEstado(tab.id)}
              className={`px-6 py-3 rounded-full font-black uppercase text-[9px] tracking-widest transition-all whitespace-nowrap ${
                filtroEstado === tab.id ? 'bg-[#1e3a8a] text-white shadow-lg shadow-blue-900/20' : 'bg-white text-slate-400 border border-slate-200 hover:bg-slate-100 hover:text-slate-600'
              }`}
            >
              {tab.label}
              {tab.id !== "Todos" && (
                <span className={`ml-2 px-2 py-0.5 rounded-md text-[8px] ${filtroEstado === tab.id ? 'bg-white/20' : 'bg-slate-200 text-slate-500'}`}>
                  {pedidos.filter(p => p.estado === tab.id && (!filtroData || p.created_at.includes(filtroData))).length}
                </span>
              )}
            </button>
          ))}
        </div>
      </header>

      {/* LISTAGEM EM GRELHA (GRID) */}
      <div className="min-h-[50vh]">
        {aCarregar && limitePedidos === 50 ? (
            <div className="text-center py-32 flex flex-col items-center justify-center">
                <div className="w-12 h-12 border-4 border-blue-200 border-t-[#1e3a8a] rounded-full animate-spin mb-4"></div>
                <p className="font-black text-slate-400 uppercase tracking-widest text-[10px]">A sincronizar com Lotaçor...</p>
            </div>
        ) : pedidosMostrados.length === 0 ? (
            <div className="bg-white rounded-[3rem] p-16 text-center border-4 border-dashed border-slate-100 flex flex-col items-center justify-center">
                <span className="text-5xl opacity-20 mb-4">📭</span>
                <p className="font-black text-slate-400 uppercase tracking-widest text-xs">Nenhum pedido encontrado nos filtros selecionados.</p>
            </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-6">
            {pedidosMostrados.map((p) => {
              const cores = getCoresEstado(p.estado);
              return (
                <div key={p.id} className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100 hover:shadow-xl transition-all relative overflow-hidden flex flex-col justify-between min-h-[260px] group">
                  <div className={`absolute top-0 left-0 w-full h-2 ${cores.barra} opacity-80 group-hover:opacity-100 transition-opacity`} />
                  
                  <div>
                    <div className="flex justify-between items-start mb-6">
                      <span className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border ${cores.badge}`}>
                        {p.estado}
                      </span>
                      <div className="flex items-center gap-2">
                        {/* BOTÃO HISTÓRICO / LOGS */}
                        <button onClick={() => abrirModalHistorico(p.id)} className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-[#1e3a8a] hover:bg-blue-50 transition-colors" title="Ver Histórico">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        </button>
                        <div className="text-right ml-2">
                          <span className="block text-[10px] font-black text-slate-300 tracking-widest">TICKET</span>
                          <span className="text-lg font-black text-slate-800">#{p.id}</span>
                        </div>
                      </div>
                    </div>
                    
                    <h3 className="text-xl font-black text-[#0f172a] uppercase tracking-tighter leading-tight mb-2 truncate" title={p.contactos?.nome}>
                        {p.contactos?.nome || "DESTINATÁRIO REMOVIDO"}
                    </h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide flex flex-col gap-1">
                        <span><span className="text-amber-500 font-black mr-1">📍</span> {p.contactos?.departamento || "Geral"}</span>
                        <span><span className="text-slate-300 font-black mr-1">👤</span> {p.requisitante}</span>
                    </p>
                  </div>

                  <div className="flex gap-2 items-center mt-8 pt-6 border-t border-slate-50">
                    {p.estado === 'Pendente' && (
                      <>
                        <button onClick={() => router.push(`/dashboard/pedidos/processar/${p.id}`)} className="flex-[2] bg-[#1e3a8a] text-white px-4 py-4 rounded-xl font-black text-[9px] uppercase tracking-widest shadow-md hover:bg-[#0f172a] transition-all flex justify-center items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"></path></svg>
                          Processar
                        </button>
                        {/* BOTÃO EDITAR */}
                        <button onClick={() => setModalEditar({ aberto: true, form: { id: p.id, quem_pede: p.requisitante, texto_pedido: p.observacao, contacto: p.contactos } })} className="flex-1 bg-amber-50 text-amber-600 px-2 py-4 rounded-xl font-black text-[9px] uppercase flex justify-center items-center gap-1 hover:bg-amber-100 transition-all border border-amber-100">
                           <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                           Editar
                        </button>
                      </>
                    )}
                    
                    {p.estado === 'Processado' && (
                      <>
                        <button onClick={() => handleImprimir(p)} className="flex-1 bg-slate-50 text-slate-500 border border-slate-200 px-2 py-4 rounded-xl font-black text-[9px] uppercase hover:bg-slate-100 flex justify-center items-center gap-1 transition-all">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
                          Guia
                        </button>
                        <button onClick={async () => { 
                          // REGISTAR LOG DE ENTREGUE AQUI
                          await supabase.from("pedidos").update({ estado: "Concluído" }).eq("id", p.id); 
                          await registarLog(p.id, "ENTREGUE", "Material confirmado e entregue ao destino.");
                          carregarDados(limitePedidos); 
                          toast.success("Entregue!"); 
                        }} className="flex-1 bg-emerald-500 text-white px-2 py-4 rounded-xl font-black text-[9px] uppercase shadow-md hover:bg-emerald-600 flex justify-center items-center gap-1 transition-all">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                          Entregar
                        </button>
                      </>
                    )}
                    
                    {p.estado === 'Concluído' && (
                      <>
                        <button onClick={() => handleImprimir(p)} className="flex-1 bg-white text-slate-500 border border-slate-200 px-2 py-4 rounded-xl font-black text-[9px] uppercase hover:bg-slate-50 flex justify-center items-center gap-1 transition-all">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
                          Cópia
                        </button>
                        <button onClick={async () => {
                            if (p.contactos?.email) await enviarPedidoPorEmail(p, p.contactos.email, nomeOperador);
                            else { setModalEmail({ aberto: true, pedido: p }); setEmailInput(""); }
                        }} className="flex-1 bg-blue-50 text-blue-600 px-2 py-4 rounded-xl font-black text-[9px] uppercase flex justify-center items-center gap-1 hover:bg-blue-100 transition-all border border-blue-100">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                          Email
                        </button>
                      </>
                    )}
                    
                    <button onClick={() => setModalEliminar({ aberto: true, id: p.id })} className="w-12 h-[42px] flex items-center justify-center text-slate-300 hover:bg-red-50 hover:text-red-500 rounded-xl transition-all shrink-0">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* BOTÃO CARREGAR MAIS (PAGINAÇÃO) */}
        {!aCarregar && pedidos.length >= limitePedidos && (
            <div className="flex justify-center mt-10 mb-6">
                <button 
                  onClick={carregarMaisAntigos} 
                  disabled={carregandoMais}
                  className="px-8 py-4 bg-white border-2 border-slate-200 text-slate-500 rounded-full font-black uppercase text-[10px] tracking-widest hover:border-[#1e3a8a] hover:text-[#1e3a8a] transition-all flex items-center gap-2"
                >
                    {carregandoMais ? "A procurar..." : "Carregar mais antigos ↓"}
                </button>
            </div>
        )}
      </div>

      {/* --- MODAL NOVO PEDIDO --- */}
      {modalAberto && (
        <div className="fixed inset-0 bg-[#0f172a]/90 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[3.5rem] p-10 md:p-14 w-full max-w-lg shadow-2xl animate-in zoom-in duration-200">
            <h2 className="text-3xl font-black text-[#1e3a8a] mb-8 uppercase italic tracking-tighter text-center">Abrir Novo Pedido</h2>
            <div className="space-y-6">
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Unidade de Destino</label>
                <button onClick={() => { setOrigemExplorador("novo"); setExploradorAberto(true); }} className="w-full p-5 bg-slate-50 rounded-2xl border-2 border-slate-100 hover:border-amber-500 flex justify-between items-center group transition-all">
                  <span className={`font-black text-sm uppercase ${formulario.contacto ? 'text-[#1e3a8a]' : 'text-slate-400'}`}>
                    {formulario.contacto ? formulario.contacto.nome : "-- ESCOLHER NO DIRETÓRIO --"}
                  </span>
                  <span className="text-xl group-hover:scale-110 transition-transform">📍</span>
                </button>
              </div>
              <input required value={formulario.quem_pede} className="w-full p-5 rounded-2xl bg-slate-50 border-2 border-transparent font-bold text-sm outline-none focus:border-blue-100 focus:bg-white transition-all" placeholder="Requisitante (Ex: João Silva)" onChange={e => setFormulario({...formulario, quem_pede: e.target.value})} />
              <textarea required value={formulario.texto_pedido} rows={3} className="w-full p-5 rounded-2xl bg-slate-50 border-2 border-transparent font-bold text-sm outline-none focus:border-blue-100 focus:bg-white transition-all resize-none" placeholder="Observações do pedido..." onChange={e => setFormulario({...formulario, texto_pedido: e.target.value})} />
              <div className="flex gap-3 pt-4">
                <button onClick={() => setModalAberto(false)} className="w-1/3 py-5 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-[10px] hover:bg-slate-200 transition-colors">Fechar</button>
                <button onClick={async () => {
                    if(!formulario.contacto) return toast.error("Selecione o destino!");
                    
                    // REGISTAR LOG DE CRIAÇÃO AQUI
                    const { data: novoPed, error } = await supabase.from("pedidos")
                        .insert({ requisitante: formulario.quem_pede, contacto_id: formulario.contacto.id, observacao: formulario.texto_pedido, estado: "Pendente" })
                        .select().single();

                    if(novoPed && !error) {
                        await registarLog(novoPed.id, "CRIADO", `Ticket aberto para ${formulario.contacto.nome}.`);
                        toast.success("Ticket Aberto!"); 
                        setModalAberto(false); 
                        carregarDados(limitePedidos);
                    } else {
                        toast.error("Erro ao criar ticket.");
                    }
                }} className="w-2/3 py-5 bg-[#1e3a8a] text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-blue-900/20 hover:bg-[#0f172a] transition-all">Criar Ticket</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL EDITAR PEDIDO PENDENTE --- */}
      {modalEditar.aberto && (
        <div className="fixed inset-0 bg-[#0f172a]/90 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-[3.5rem] p-10 md:p-14 w-full max-w-lg shadow-2xl animate-in zoom-in duration-200 border-4 border-amber-100">
            <h2 className="text-3xl font-black text-amber-500 mb-8 uppercase italic tracking-tighter text-center">Editar Pedido</h2>
            <div className="space-y-6">
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Unidade de Destino</label>
                <button onClick={() => { setOrigemExplorador("editar"); setExploradorAberto(true); }} className="w-full p-5 bg-slate-50 rounded-2xl border-2 border-slate-100 hover:border-amber-500 flex justify-between items-center group transition-all">
                  <span className={`font-black text-sm uppercase ${modalEditar.form.contacto ? 'text-[#1e3a8a]' : 'text-slate-400'}`}>
                    {modalEditar.form.contacto ? modalEditar.form.contacto.nome : "-- ESCOLHER NO DIRETÓRIO --"}
                  </span>
                  <span className="text-xl group-hover:scale-110 transition-transform">✏️</span>
                </button>
              </div>
              <input required value={modalEditar.form.quem_pede} className="w-full p-5 rounded-2xl bg-slate-50 border-2 border-transparent font-bold text-sm outline-none focus:border-amber-200 focus:bg-white transition-all" placeholder="Requisitante..." onChange={e => setModalEditar({ ...modalEditar, form: { ...modalEditar.form, quem_pede: e.target.value } })} />
              <textarea required value={modalEditar.form.texto_pedido} rows={3} className="w-full p-5 rounded-2xl bg-slate-50 border-2 border-transparent font-bold text-sm outline-none focus:border-amber-200 focus:bg-white transition-all resize-none" placeholder="Observações do pedido..." onChange={e => setModalEditar({ ...modalEditar, form: { ...modalEditar.form, texto_pedido: e.target.value } })} />
              <div className="flex gap-3 pt-4">
                <button onClick={() => setModalEditar({ aberto: false, form: null })} className="w-1/3 py-5 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-[10px] hover:bg-slate-200 transition-colors">Cancelar</button>
                <button onClick={guardarEdicao} className="w-2/3 py-5 bg-amber-500 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-amber-900/20 hover:bg-amber-600 transition-all">Guardar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL HISTÓRICO / LOGS --- */}
      {modalHistorico.aberto && (
        <div className="fixed inset-0 bg-[#0f172a]/80 backdrop-blur-md flex items-center justify-center z-[110] p-4">
          <div className="bg-white rounded-[3.5rem] p-10 w-full max-w-lg shadow-2xl animate-in slide-in-from-bottom-8 duration-300 flex flex-col max-h-[80vh]">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-black text-[#0f172a] uppercase italic tracking-tighter leading-none">Rasto do Ticket</h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Pedido #{modalHistorico.id}</p>
                </div>
                <button onClick={() => setModalHistorico({ aberto: false, id: null, logs: [], aCarregar: false })} className="w-10 h-10 bg-slate-100 text-slate-500 rounded-full font-black flex items-center justify-center hover:bg-slate-200">×</button>
            </div>
            
            <div className="flex-1 overflow-y-auto pr-2 space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
                {modalHistorico.aCarregar ? (
                    <div className="text-center py-10 font-bold text-slate-400 text-xs uppercase animate-pulse">A procurar arquivos...</div>
                ) : modalHistorico.logs.length === 0 ? (
                    <div className="text-center py-10 font-bold text-slate-400 text-xs uppercase">Sem histórico registado.</div>
                ) : (
                    modalHistorico.logs.map((log, i) => (
                        <div key={i} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                            <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white bg-blue-100 text-blue-600 shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm z-10 text-xs">
                                ⏱
                            </div>
                            <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-slate-50 p-4 rounded-2xl border border-slate-100 shadow-sm">
                                <div className="flex justify-between items-start mb-1">
                                    <span className="text-[9px] font-black text-[#1e3a8a] uppercase tracking-widest">{log.acao}</span>
                                    <span className="text-[8px] font-bold text-slate-400">{new Date(log.created_at).toLocaleDateString('pt-PT')} {new Date(log.created_at).toLocaleTimeString('pt-PT', {hour: '2-digit', minute:'2-digit'})}</span>
                                </div>
                                <p className="text-xs font-bold text-slate-600 mb-2">{log.detalhes}</p>
                                <p className="text-[9px] text-slate-400 uppercase text-right">Por: <span className="font-black text-slate-500">{log.utilizador || "Sistema"}</span></p>
                            </div>
                        </div>
                    ))
                )}
            </div>
          </div>
        </div>
      )}

      {/* EXPLORADOR VISUAL */}
      {exploradorAberto && (
        <div className="fixed inset-0 bg-[#0f172a]/95 backdrop-blur-md z-[120] flex items-center justify-center p-4 md:p-12">
          <div className="bg-white w-full max-w-6xl h-[85vh] rounded-[3.5rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-10 border-b flex flex-col md:flex-row justify-between items-center gap-8 bg-slate-50/50">
              <div>
                <h2 className="text-3xl font-black text-[#1e3a8a] uppercase italic tracking-tighter leading-none">Diretório de Unidades</h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">Selecione o destino do material</p>
              </div>
              <div className="flex items-center gap-4 w-full md:w-auto">
                <input type="text" placeholder="Procurar nome..." value={pesquisaCont} onChange={e => setPesquisaCont(e.target.value)} className="flex-1 md:w-80 p-4 bg-white border border-slate-200 rounded-2xl text-xs font-bold outline-none focus:ring-2 ring-amber-500 shadow-sm" />
                <button onClick={() => setExploradorAberto(false)} className="px-6 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black text-[10px] hover:bg-slate-200 transition-all uppercase tracking-widest">Voltar</button>
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
                  <button 
                    key={c.id} 
                    onClick={() => { 
                        if (origemExplorador === "novo") setFormulario({ ...formulario, contacto: c });
                        else setModalEditar({ ...modalEditar, form: { ...modalEditar.form, contacto: c } });
                        setExploradorAberto(false); 
                    }} 
                    className="p-8 border-2 border-slate-50 rounded-[2.5rem] text-left hover:border-amber-500 hover:bg-amber-50 transition-all group flex flex-col justify-between h-48 shadow-sm hover:shadow-md"
                  >
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

      {/* --- Restantes Modais (Email e Eliminar) --- */}
      {modalEmail.aberto && (
        <div className="fixed inset-0 bg-[#0f172a]/95 backdrop-blur-sm flex items-center justify-center z-[120] p-4">
          <div className="bg-white rounded-[3.5rem] p-12 w-full max-w-md shadow-2xl border-4 border-white">
            <h2 className="text-2xl font-black text-[#1e3a8a] mb-2 uppercase italic tracking-tighter">Falta de Email</h2>
            <p className="text-xs text-slate-500 font-bold mb-6 italic">Introduza o endereço de destino para: {modalEmail.pedido?.contactos?.nome}</p>
            <div className="space-y-4">
              <input type="email" required autoFocus value={emailInput} onChange={e => setEmailInput(e.target.value)} className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold text-sm outline-none focus:ring-2 ring-[#1e3a8a]" placeholder="email@lotacor.pt" />
              <div className="flex gap-3 pt-2">
                <button onClick={() => setModalEmail({ aberto: false, pedido: null })} className="flex-1 py-4 bg-slate-100 text-slate-400 rounded-2xl font-black uppercase text-[10px]">Cancelar</button>
                <button onClick={() => { if(emailInput) enviarPedidoPorEmail(modalEmail.pedido, emailInput, nomeOperador).then(()=>setModalEmail({aberto:false, pedido:null})) }} className="flex-[2] py-4 bg-[#1e3a8a] text-white rounded-2xl font-black uppercase text-[10px] shadow-xl">Enviar PDF</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {modalEliminar.aberto && (
        <div className="fixed inset-0 bg-[#0f172a]/95 backdrop-blur-md flex items-center justify-center z-[110] p-4 text-center">
          <div className="bg-white rounded-[3.5rem] p-12 w-full max-w-md shadow-2xl animate-in zoom-in duration-200">
            <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
            </div>
            <h2 className="text-2xl font-black text-[#0f172a] mb-2 uppercase italic tracking-tighter leading-none">Anular Pedido?</h2>
            <p className="text-xs text-slate-500 font-bold mb-8 leading-relaxed">O registo #{modalEliminar.id} será eliminado e o material devolvido ao stock.</p>
            <div className="flex gap-4">
              <button onClick={() => setModalEliminar({ aberto: false, id: null })} className="flex-1 py-5 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-[10px]">Voltar</button>
              <button onClick={handleConfirmarEliminar} className="flex-[2] py-5 bg-red-600 text-white rounded-2xl font-black uppercase text-[10px] shadow-lg shadow-red-200">Sim, Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}