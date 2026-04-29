"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import toast, { Toaster } from 'react-hot-toast';

export default function ProcessarPedido() {
  const { id } = useParams();
  const router = useRouter();
  
  const [pedido, setPedido] = useState<any>(null);
  const [catalogo, setCatalogo] = useState<any[]>([]);
  const [aCarregar, setACarregar] = useState(true);
  
  const [idUtilizador, setIdUtilizador] = useState("");
  const [nomeOperador, setNomeOperador] = useState("Sistema"); // NOVO: Estado para guardar o nome real
  const [linhas, setLinhas] = useState<any[]>([]);
  const [modalCatAberto, setModalCatAberto] = useState(false);
  const [pesquisa, setPesquisa] = useState("");
  const [categoriaAtiva, setCategoriaAtiva] = useState("Todas");

  useEffect(() => {
    const iniciar = async () => {
      // 1. NOVO: Buscar o ID e o Nome do Operador para os Logs ficarem bonitos
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.id) {
          setIdUtilizador(user.id);
          const { data: perfil } = await supabase.from('perfis').select('nome').eq('id', user.id).single();
          setNomeOperador(perfil?.nome || user.email?.split('@')[0] || "Sistema");
      }

      const { data: ped } = await supabase
        .from("pedidos")
        .select(`*, contactos!contacto_id (nome, departamento)`)
        .eq("id", id)
        .single();
      
      // Proteção de Array para o Destinatário (prevenir o erro do TypeScript)
      if (ped) {
          setPedido({
              ...ped,
              contactos: Array.isArray(ped.contactos) ? ped.contactos[0] : ped.contactos
          });
      }

      const { data: prods } = await supabase.from("produtos").select("*").order("nome");
      if (prods) setCatalogo(prods);

      setACarregar(false);
    };
    iniciar();
  }, [id]);

  const categoriasUnicas = ["Todas", ...Array.from(new Set(catalogo.map(p => p.categoria || "Geral"))).sort()];

  const catalogoFiltrado = catalogo.filter(p => {
    const bateCertoPesquisa = p.nome.toLowerCase().includes(pesquisa.toLowerCase());
    const bateCertoCategoria = categoriaAtiva === "Todas" || (p.categoria || "Geral") === categoriaAtiva;
    return bateCertoPesquisa && bateCertoCategoria;
  });

  const adicionarArtigoAoPedido = (produto: any) => {
    const indexExistente = linhas.findIndex(l => l.produto_id === produto.id);
    
    if (indexExistente >= 0) {
      const novasLinhas = [...linhas];
      novasLinhas[indexExistente].quantidade += 1;
      setLinhas(novasLinhas);
    } else {
      setLinhas([...linhas, { 
        produto_id: produto.id, 
        nome: produto.nome, 
        stockMax: produto.quantidade, 
        local: produto.local,
        quantidade: 1, 
        observacao: "" 
      }]);
    }
    toast.success(`${produto.nome} adicionado.`);
    setModalCatAberto(false);
    setPesquisa("");
  };

  const removerLinha = (index: number) => {
    setLinhas(linhas.filter((_, i) => i !== index));
  };

  const atualizarLinha = (index: number, campo: string, valor: any) => {
    const novasLinhas = [...linhas];
    novasLinhas[index] = { ...novasLinhas[index], [campo]: valor };
    setLinhas(novasLinhas);
  };

  // --- FUNÇÃO MESTRA: FINALIZAR COM LÓGICA FIFO E TOASTS ---
  const finalizarProcessamento = async (e: React.FormEvent) => {
    e.preventDefault();
    if (linhas.length === 0) return toast.error("Adicione pelo menos um artigo.");

    const toastId = toast.loading("A validar lotes e processar stock...");
    
    try {
      for (const linha of linhas) {
        let qtdNecessaria = Math.abs(linha.quantidade);
        let custoTotalAcumulado = 0;

        // 1. Procurar lotes disponíveis (FIFO)
        const { data: lotes, error: errLotes } = await supabase
          .from("movimentos")
          .select("*")
          .eq("produto_id", linha.produto_id)
          .in("tipo", ["Entrada", "Criação", "Edição"])
          .gt("quantidade_restante", 0)
          .order("created_at", { ascending: true });

        if (errLotes || !lotes || lotes.length === 0) {
          toast.error(`Sem stock disponível para: ${linha.nome}`, { id: toastId });
          return;
        }

        // 2. Consumir lotes
        for (const lote of lotes) {
          if (qtdNecessaria <= 0) break;

          const qtdDisponivelNoLote = lote.quantidade_restante;
          const qtdAConsumir = Math.min(qtdNecessaria, qtdDisponivelNoLote);

          const { error: errUpdateLote } = await supabase
            .from("movimentos")
            .update({ quantidade_restante: qtdDisponivelNoLote - qtdAConsumir })
            .eq("id", lote.id);

          if (errUpdateLote) throw errUpdateLote;

          custoTotalAcumulado += (qtdAConsumir * (lote.custo_unitario || 0));
          qtdNecessaria -= qtdAConsumir;
        }

        if (qtdNecessaria > 0) {
          toast.error(`Erro: Stock insuficiente nos lotes para ${linha.nome}`, { id: toastId });
          return;
        }

        // 3. Registar Saída
        const custoMedioReal = custoTotalAcumulado / Math.abs(linha.quantidade);
        const { error: erroMovSaida } = await supabase.from("movimentos").insert({
          produto_id: linha.produto_id,
          quantidade: -Math.abs(linha.quantidade), 
          tipo: "Saída",
          utilizador: idUtilizador,
          pedido_id: parseInt(id as string), 
          observacao: linha.observacao || "",
          custo_unitario: custoMedioReal,
          quantidade_restante: 0
        });

        if (erroMovSaida) throw erroMovSaida;

        // 4. Atualizar Stock Global
        const produtoNoCatalogo = catalogo.find(p => p.id === linha.produto_id);
        if (produtoNoCatalogo) {
          await supabase.from("produtos").update({
            quantidade: produtoNoCatalogo.quantidade - Math.abs(linha.quantidade)
          }).eq("id", linha.produto_id);
        }
      }

      // 5. Concluir Pedido
      await supabase.from("pedidos").update({ estado: "Processado" }).eq("id", id);
      
      // 6. NOVO: GRAVAR O HISTÓRICO (Rasto de Auditoria)
      await supabase.from("logs_pedidos").insert({
        pedido_id: parseInt(id as string),
        acao: "PROCESSADO",
        detalhes: `A separação de material foi concluída com ${linhas.length} artigo(s) diferente(s).`,
        utilizador: nomeOperador
      });

      toast.success("✅ Pedido processado e lotes atualizados!", { id: toastId });
      router.push("/dashboard/pedidos");

    } catch (err: any) {
      console.error(err);
      toast.error("Erro crítico no processamento.", { id: toastId });
    }
  };

  if (aCarregar) return <main className="flex-1 p-12 h-screen flex justify-center items-center font-black uppercase text-[#1e3a8a] animate-pulse italic">Acedendo aos arquivos de Armazém...</main>;

  return (
    <main className="flex-1 p-8 md:p-12 overflow-y-auto h-screen relative bg-slate-50">
      <Toaster position="top-center" />

      <header className="flex justify-between items-center mb-10">
        <div>
          <h1 className="text-4xl font-black text-[#0f172a] tracking-tighter uppercase italic leading-none">
            Processar <span className="text-[#1e3a8a]">Pedido #{id}</span>
          </h1>
          <div className="h-1.5 w-24 bg-[#1e3a8a] rounded-full mt-3"></div>
        </div>
        <button onClick={() => router.push("/dashboard/pedidos")} className="px-6 py-3 bg-white text-slate-400 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-sm hover:text-red-500 transition-all border border-slate-100">
          Cancelar
        </button>
      </header>

      {pedido && (
        <div className="bg-white border border-slate-100 p-8 rounded-[2.5rem] mb-8 flex flex-col md:flex-row justify-between items-start md:items-center shadow-sm gap-6">
          <div>
            <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em] mb-1">Destinatário</p>
            <p className="font-black text-xl text-[#0f172a] uppercase">{pedido.contactos?.nome}</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{pedido.contactos?.departamento} | Requisitado por: {pedido.requisitante}</p>
          </div>
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 max-w-md w-full">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Nota da Requisição:</p>
            <p className="text-xs font-bold text-slate-600 italic leading-relaxed">"{pedido.observacao || "Sem observações anexadas."}"</p>
          </div>
        </div>
      )}

      <form onSubmit={finalizarProcessamento} className="bg-white rounded-[3rem] p-10 shadow-xl border border-slate-100 flex flex-col min-h-[500px]">
        <h2 className="text-xl font-black uppercase italic tracking-tighter mb-8 flex justify-between items-center border-b border-slate-50 pb-6 text-[#0f172a]">
          <span>Itens para Saída</span>
          <button type="button" onClick={() => setModalCatAberto(true)} className="px-6 py-3 bg-[#1e3a8a] text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg hover:bg-blue-800 transition-all">
            + Adicionar Material
          </button>
        </h2>
        
        <div className="space-y-4 mb-8 flex-1">
          {linhas.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-slate-100 rounded-[2.5rem] bg-slate-50/30">
              <span className="text-4xl mb-4 opacity-20">📦</span>
              <p className="text-[10px] font-black uppercase text-slate-300 tracking-[0.2em]">O pedido está vazio</p>
            </div>
          ) : (
            linhas.map((linha, index) => (
              <div key={index} className="flex flex-col lg:flex-row gap-6 items-center bg-slate-50/50 p-6 rounded-[2rem] border border-slate-100 group hover:bg-white hover:shadow-md transition-all">
                <div className="flex-1 w-full">
                  <p className="font-black text-sm text-[#0f172a] uppercase group-hover:text-[#1e3a8a] transition-colors">{linha.nome}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[9px] font-black text-amber-600 uppercase bg-amber-50 px-2 py-0.5 rounded">📍 {linha.local}</span>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Disponível: {linha.stockMax} un.</span>
                  </div>
                </div>
                
                <div className="w-full lg:w-32 shrink-0">
                  <label className="text-[9px] font-black text-slate-400 uppercase block mb-1.5 px-1 tracking-widest text-center">Qtd. Saída</label>
                  <input 
                    required type="number" min="1" max={linha.stockMax} 
                    value={linha.quantidade} 
                    onChange={e => atualizarLinha(index, "quantidade", parseInt(e.target.value) || 1)} 
                    className="w-full text-center py-3 rounded-xl border-2 border-slate-200 font-black text-lg text-[#1e3a8a] outline-none focus:border-amber-500 bg-white" 
                  />
                </div>

                <div className="flex-1 w-full">
                  <label className="text-[9px] font-black text-slate-400 uppercase block mb-1.5 px-1 tracking-widest">Observação na Guia</label>
                  <input type="text" value={linha.observacao} onChange={e => atualizarLinha(index, "observacao", e.target.value)} className="w-full bg-white border-2 border-slate-100 rounded-xl py-3 px-4 text-xs font-bold outline-none focus:border-blue-500" placeholder="Ex: Urgente..." />
                </div>

                <button type="button" onClick={() => removerLinha(index)} className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all">
                   <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </div>
            ))
          )}
        </div>

        <div className="flex flex-col md:flex-row justify-between items-center pt-8 border-t border-slate-50 gap-6">
          <div>
            <p className="text-[10px] font-black text-slate-400 tracking-[0.2em] uppercase">Total de Artigos Selecionados</p>
            <p className="text-3xl font-black text-[#1e3a8a]">{linhas.reduce((acc, l) => acc + l.quantidade, 0)} <span className="text-sm text-slate-300">UNIDADES</span></p>
          </div>

          <button type="submit" disabled={linhas.length === 0} className={`w-full md:w-auto px-12 py-6 rounded-[2rem] font-black uppercase text-xs tracking-[0.2em] shadow-xl transition-all active:scale-95 ${linhas.length > 0 ? 'bg-amber-500 text-[#0f172a] hover:bg-amber-400' : 'bg-slate-100 text-slate-300 cursor-not-allowed'}`}>
            ✓ Finalizar e Abater Stock
          </button>
        </div>
      </form>

      {/* --- MODAL EXPLORADOR DE MATERIAIS (ESTILO CATÁLOGO) --- */}
      {modalCatAberto && (
        <div className="fixed inset-0 bg-[#0f172a]/90 backdrop-blur-md flex items-center justify-center z-[100] p-4 md:p-8">
          <div className="bg-white rounded-[3.5rem] p-8 w-full max-w-5xl h-[85vh] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-8 bg-slate-50/50 p-6 rounded-[2.5rem] border border-slate-100">
              <div>
                <h2 className="text-2xl font-black text-[#1e3a8a] uppercase italic tracking-tighter">Explorador de Armazém</h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Selecione os materiais para adicionar ao pedido</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="relative hidden md:block">
                   <span className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30">🔍</span>
                   <input type="text" autoFocus placeholder="Pesquisar..." value={pesquisa} onChange={e => setPesquisa(e.target.value)} className="w-64 bg-white border border-slate-200 rounded-2xl py-3 pl-10 pr-4 text-xs font-bold outline-none focus:ring-2 ring-amber-500" />
                </div>
                <button onClick={() => setModalCatAberto(false)} className="px-6 py-3 bg-red-50 text-red-500 rounded-xl font-black text-[10px] hover:bg-red-500 hover:text-white transition-all uppercase">Fechar</button>
              </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
               <div className="w-48 bg-slate-50 border-r p-4 space-y-2 overflow-y-auto hidden lg:block">
                  {categoriasUnicas.map(cat => (
                    <button key={cat} onClick={() => setCategoriaAtiva(cat)} className={`w-full text-left px-4 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${categoriaAtiva === cat ? 'bg-[#1e3a8a] text-white shadow-lg' : 'text-slate-400 hover:bg-slate-200'}`}>{cat}</button>
                  ))}
               </div>
               
               <div className="flex-1 p-6 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 content-start">
                  {catalogoFiltrado.map(p => (
                    <button key={p.id} onClick={() => adicionarArtigoAoPedido(p)} className="p-6 border-2 border-slate-50 rounded-[2.5rem] text-left hover:border-amber-500 hover:bg-amber-50 transition-all group shadow-sm flex flex-col justify-between h-44">
                      <div>
                         <p className="text-[9px] font-black text-amber-500 uppercase mb-1">{p.categoria}</p>
                         <h4 className="font-black text-[#0f172a] uppercase text-xs leading-tight group-hover:text-[#1e3a8a]">{p.nome}</h4>
                      </div>
                      <div className="flex items-center justify-between">
                         <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase ${p.quantidade > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>Stock: {p.quantidade}</span>
                         <span className="text-xl opacity-0 group-hover:opacity-100 transition-opacity">➕</span>
                      </div>
                    </button>
                  ))}
               </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}