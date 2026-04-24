"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import toast, { Toaster } from 'react-hot-toast'; // 1. Importar o sistema moderno

export default function GestaoStock() {
  const [produtos, setProdutos] = useState<any[]>([]);
  const [selecionado, setSelecionado] = useState<any>(null);
  const [quantidade, setQuantidade] = useState(0);
  const [precoOperacao, setPrecoOperacao] = useState(0); 
  const [tipo, setTipo] = useState("Entrada");
  const [processando, setProcessando] = useState(false);
  
  const [userId, setUserId] = useState<string | null>(null);

  const [pesquisa, setPesquisa] = useState("");
  const [categoriaSelecionada, setCategoriaSelecionada] = useState("Todas");

  useEffect(() => {
    const carregar = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUserId(user.id);
      await carregarProdutos();
    };
    carregar();
  }, []);

  const carregarProdutos = async () => {
    const { data } = await supabase.from("produtos").select("*").order("nome");
    setProdutos(data || []);
  };

  // --- LÓGICA FIFO PARA SAÍDA ---
  const processarSaidaFIFO = async (idProd: number, qtdARetirar: number) => {
    const { data: lotes, error: errLotes } = await supabase
      .from("movimentos")
      .select("*")
      .eq("produto_id", idProd)
      .in("tipo", ["Entrada", "Criação"])
      .gt("quantidade_restante", 0)
      .order("created_at", { ascending: true });

    if (errLotes || !lotes || lotes.length === 0) throw new Error("Não foram encontrados lotes de stock para este artigo.");

    let restante = qtdARetirar;
    let custoTotalAcumulado = 0;

    for (const lote of lotes) {
      if (restante <= 0) break;

      const qtdDisponivel = lote.quantidade_restante;
      const qtdAbater = Math.min(qtdDisponivel, restante);

      const { error: errUp } = await supabase
        .from("movimentos")
        .update({ quantidade_restante: qtdDisponivel - qtdAbater })
        .eq("id", lote.id);

      if (errUp) throw errUp;

      custoTotalAcumulado += (qtdAbater * (lote.custo_unitario || 0));
      restante -= qtdAbater;
    }

    if (restante > 0) throw new Error("Stock insuficiente nos lotes!");

    return custoTotalAcumulado / qtdARetirar; 
  };

  // --- SUBMETER OPERAÇÃO ---
  const submeter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selecionado || quantidade <= 0 || processando) return;
    
    // Iniciar o processo com um Toast de loading (opcional, mas pro)
    const toastId = toast.loading(`A processar ${tipo.toLowerCase()}...`);
    setProcessando(true);
    
    try {
      let custoFinalParaBI = precoOperacao;

      if (tipo === "Saída") {
        if (selecionado.quantidade < quantidade) {
            toast.error("Stock insuficiente para realizar a saída!", { id: toastId });
            setProcessando(false);
            return;
        }
        custoFinalParaBI = await processarSaidaFIFO(selecionado.id, quantidade);
      }

      // 1. Atualizar Ficha do Produto
      const valorFinal = tipo === "Entrada" ? quantidade : -quantidade;
      const novaQtdGlobal = (selecionado.quantidade || 0) + valorFinal;

      const dadosUpdate: any = { quantidade: novaQtdGlobal };
      if (tipo === "Entrada") dadosUpdate.preco = precoOperacao; 

      const { error: errProd } = await supabase.from("produtos").update(dadosUpdate).eq("id", selecionado.id);
      if (errProd) throw errProd;

      // 2. Registar Movimento
      const { error: errAudit } = await supabase.from("movimentos").insert([{
        produto_id: selecionado.id,
        quantidade: valorFinal,
        tipo: tipo,
        utilizador: userId,
        custo_unitario: custoFinalParaBI,
        quantidade_restante: tipo === "Entrada" ? quantidade : 0, 
        observacao: `Movimento (${tipo}).`
      }]);

      if (errAudit) throw errAudit;

      // SUCESSO!
      toast.success(`${tipo} de ${quantidade} un. registada com sucesso!`, { id: toastId });
      
      setQuantidade(0);
      await carregarProdutos();
      setSelecionado(null);

    } catch (err: any) {
      toast.error("Erro: " + err.message, { id: toastId });
    } finally {
      setProcessando(false);
    }
  };

  const categoriasUnicas = ["Todas", ...Array.from(new Set(produtos.map(p => p.categoria || "Sem Categoria")))];
  const produtosFiltrados = produtos.filter(p => {
    const correspondeTexto = p.nome.toLowerCase().includes(pesquisa.toLowerCase());
    const correspondeCategoria = categoriaSelecionada === "Todas" || (p.categoria || "Sem Categoria") === categoriaSelecionada;
    return correspondeTexto && correspondeCategoria;
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-[calc(100vh-14rem)] min-h-[600px]">
      
      {/* 2. Colocar o contentor das notificações no topo */}
      <Toaster position="top-center" reverseOrder={false} />

      {/* PAINEL ESQUERDO: LISTA DE PRODUTOS */}
      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-200 flex flex-col overflow-hidden h-full">
        {/* ... Resto do código da lista (inalterado) ... */}
        <div className="p-8 bg-[#f8fafc] border-b space-y-5">
          <div className="font-black text-[10px] uppercase text-[#1e3a8a] tracking-[0.2em]">
            1. Escolher Material
          </div>
          
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
            <input 
              type="text" placeholder="Procurar artigo para movimentar..." value={pesquisa} onChange={(e) => setPesquisa(e.target.value)}
              className="w-full pl-12 pr-4 py-4 rounded-2xl bg-white border border-gray-200 outline-none focus:border-[#1e3a8a] text-xs font-bold transition-all shadow-sm placeholder-slate-300"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {categoriasUnicas.map(cat => (
              <button
                key={cat} onClick={() => setCategoriaSelecionada(cat)}
                className={`px-5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${
                  categoriaSelecionada === cat ? 'bg-[#1e3a8a] text-white shadow-md' : 'bg-white border border-gray-200 text-gray-400 hover:bg-slate-50'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-y-auto flex-1 divide-y divide-slate-50 p-2">
          {produtosFiltrados.length === 0 ? (
             <div className="p-10 text-center text-slate-400 font-bold text-xs uppercase">Nenhum material encontrado.</div>
          ) : (
            produtosFiltrados.map(p => (
              <button 
                key={p.id} 
                onClick={() => { 
                  setSelecionado(p); 
                  setQuantidade(0); 
                  setPrecoOperacao(p.preco || 0); 
                }} 
                className={`w-full text-left p-6 rounded-2xl transition-all group my-1 ${selecionado?.id === p.id ? 'bg-blue-50 ring-2 ring-[#1e3a8a]' : 'hover:bg-slate-50'}`}
              >
                <span className="block font-black text-[#0f172a] text-sm uppercase group-hover:text-[#1e3a8a]">{p.nome}</span>
                <span className="text-[10px] text-gray-400 uppercase font-bold mt-2 flex items-center justify-between">
                  <span>{p.categoria} | 📍 {p.local}</span>
                  <span className="bg-white px-3 py-1 rounded-lg border border-slate-100 text-slate-500">
                    Stock: <span className={`font-black ${p.quantidade <= 5 ? 'text-red-500' : 'text-[#1e3a8a]'}`}>{p.quantidade}</span>
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* PAINEL DIREITO: OPERAÇÃO */}
      <div className="bg-white rounded-[3rem] shadow-xl p-8 lg:p-12 flex flex-col justify-center border border-slate-200 relative overflow-hidden h-full">
        {/* ... Resto do código do formulário (inalterado) ... */}
        <div className="absolute top-0 right-0 p-12 opacity-[0.02] text-9xl font-black italic -rotate-12 select-none pointer-events-none text-blue-900 uppercase">{tipo}</div>

        {selecionado ? (
          <form onSubmit={submeter} className="space-y-8 text-center relative z-10">
            <div>
              <span className="text-[10px] font-black text-blue-500 uppercase tracking-[0.3em]">Operação para:</span>
              <h2 className="text-4xl font-black text-[#0f172a] uppercase italic tracking-tighter mt-2">{selecionado.nome}</h2>
              
              <div className="flex items-center justify-center gap-6 mt-3">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Stock Atual: <span className="text-[#0f172a] font-black">{selecionado.quantidade} un.</span></p>
                  <div className="w-1 h-1 bg-slate-200 rounded-full"></div>
                  <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">Preço Atual: <span className="text-[#0f172a] font-black">{selecionado.preco?.toFixed(2)}€</span></p>
              </div>
              <div className="h-1.5 w-16 bg-[#1e3a8a] rounded-full mx-auto mt-6"></div>
            </div>

            <div className="flex bg-[#f1f5f9] p-2 rounded-[2rem] max-w-sm mx-auto shadow-inner">
              <button type="button" onClick={() => setTipo("Entrada")} className={`flex-1 py-4 rounded-[1.5rem] font-black text-[10px] uppercase tracking-widest transition-all ${tipo === "Entrada" ? 'bg-green-500 text-white shadow-lg' : 'text-gray-400 hover:text-gray-600'}`}>📥 Entrada</button>
              <button type="button" onClick={() => setTipo("Saída")} className={`flex-1 py-4 rounded-[1.5rem] font-black text-[10px] uppercase tracking-widest transition-all ${tipo === "Saída" ? 'bg-amber-500 text-white shadow-lg' : 'text-gray-400 hover:text-gray-600'}`}>📦 Saída</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-md mx-auto">
              <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Quantidade</label>
                <input type="number" min="1" value={quantidade === 0 ? '' : quantidade} onChange={e => setQuantidade(Number(e.target.value))} placeholder="0" className="w-full text-4xl font-black text-center text-[#1e3a8a] bg-transparent outline-none placeholder-slate-200" />
              </div>
              <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Preço Unitário (€)</label>
                <input type="number" step="0.01" value={precoOperacao} onChange={e => setPrecoOperacao(Number(e.target.value))} className="w-full text-4xl font-black text-center text-[#1e3a8a] bg-transparent outline-none" />
              </div>
            </div>

            <button type="submit" disabled={processando} className={`w-full max-w-sm mx-auto py-6 rounded-[2rem] font-black text-white shadow-xl uppercase tracking-[0.2em] text-[10px] transition-all active:scale-95 ${tipo === "Entrada" ? 'bg-[#1e3a8a] hover:bg-blue-800' : 'bg-amber-500 hover:bg-amber-600'} ${processando ? 'opacity-50 cursor-not-allowed' : ''}`}>
              {processando ? "A PROCESSAR..." : (tipo === "Entrada" ? "Confirmar Entrada" : "Confirmar Saída")}
            </button>
          </form>
        ) : (
          <div className="text-center space-y-6">
            <div className="w-24 h-24 bg-blue-50 rounded-[2.5rem] flex items-center justify-center mx-auto text-4xl shadow-inner border border-blue-100">📦</div>
            <div className="space-y-2">
              <p className="text-[#0f172a] font-black uppercase text-sm tracking-tighter">Selecione um Material</p>
              <p className="text-slate-400 font-bold uppercase text-[9px] tracking-widest leading-relaxed">Selecione um item na lista à esquerda<br/>para registar entradas ou saídas.</p>
            </div>
          </div>
        )}
      </div>
      
    </div>
  );
}