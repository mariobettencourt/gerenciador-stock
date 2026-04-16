"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function ProcessarPedido() {
  const { id } = useParams();
  const router = useRouter();
  
  const [pedido, setPedido] = useState<any>(null);
  const [catalogo, setCatalogo] = useState<any[]>([]);
  const [aCarregar, setACarregar] = useState(true);
  
  // ALTERAÇÃO: Agora guardamos o ID (UUID) em vez do email
  const [idUtilizador, setIdUtilizador] = useState("");

  const [linhas, setLinhas] = useState<any[]>([]);

  const [modalCatAberto, setModalCatAberto] = useState(false);
  const [pesquisa, setPesquisa] = useState("");
  const [categoriaAtiva, setCategoriaAtiva] = useState("Todas");

  useEffect(() => {
    const iniciar = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      // ALTERAÇÃO: Capturamos o ID único do utilizador
      if (user?.id) setIdUtilizador(user.id);

      const { data: ped } = await supabase.from("pedidos").select(`*, contatos!contacto_id (nome, departamento)`).eq("id", id).single();
      if (ped) setPedido(ped);

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

  const finalizarProcessamento = async (e: React.FormEvent) => {
    e.preventDefault();
    if (linhas.length === 0) return alert("Por favor, adicione pelo menos um artigo ao pedido.");

    try {
      for (const linha of linhas) {
        // ALTERAÇÃO: Enviamos o idUtilizador (UUID) para a tabela de movimentos
        const { error: erroMovimento } = await supabase.from("movimentos").insert({
          produto_id: parseInt(linha.produto_id),
          quantidade: -Math.abs(linha.quantidade), 
          tipo: "Saída",
          utilizador: idUtilizador, // UUID em vez de Email
          pedido_id: parseInt(id as string), 
          observacao: linha.observacao || ""
        });

        if (erroMovimento) {
          alert("ERRO DO SUPABASE (Movimentos): " + erroMovimento.message);
          return; 
        }

        const produtoAtual = catalogo.find(p => p.id === parseInt(linha.produto_id));
        if (produtoAtual) {
          const { error: erroStock } = await supabase.from("produtos").update({
            quantidade: produtoAtual.quantidade - Math.abs(linha.quantidade)
          }).eq("id", produtoAtual.id);

          if (erroStock) {
            alert("ERRO DO SUPABASE (Stock): " + erroStock.message);
            return;
          }
        }
      }

      await supabase.from("pedidos").update({ estado: "Processado" }).eq("id", id);
      alert("✅ Pedido processado com sucesso!");
      router.push("/dashboard/pedidos");

    } catch (err) {
      alert("Ocorreu um erro catastrófico ao processar o pedido.");
    }
  };

  if (aCarregar) return <main className="flex-1 p-12 h-screen flex justify-center items-center font-black uppercase text-[#1e3a8a] animate-pulse">A preparar sistema...</main>;

  return (
    <main className="flex-1 p-12 overflow-y-auto h-screen relative">
      <header className="flex justify-between items-center mb-12">
        <div>
          <h1 className="text-4xl font-black text-[#0f172a] tracking-tighter uppercase italic leading-none">
            Processar <span className="text-[#1e3a8a]">Pedido #{id}</span>
          </h1>
          <div className="h-1.5 w-24 bg-[#1e3a8a] rounded-full mt-3"></div>
        </div>
        <button onClick={() => router.push("/dashboard/pedidos")} className="px-6 py-3 bg-white text-gray-600 rounded-xl font-black uppercase text-xs shadow-sm hover:bg-gray-50 border border-gray-200">
          Cancelar
        </button>
      </header>

      {pedido && (
        <div className="bg-blue-50 border-l-4 border-[#1e3a8a] p-6 rounded-2xl mb-8 flex justify-between items-center shadow-sm">
          <div>
            <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest">A aviar para:</p>
            <p className="font-black text-lg text-[#0f172a] uppercase">{pedido.contatos?.nome}</p>
            <p className="text-xs text-gray-600 italic mt-1">Requisitado por: {pedido.requisitante}</p>
          </div>
          <div className="text-right max-w-sm">
            <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Nota original do pedido:</p>
            <p className="text-sm font-bold text-gray-800">"{pedido.observacao}"</p>
          </div>
        </div>
      )}

      <form onSubmit={finalizarProcessamento} className="bg-white rounded-[3rem] p-10 shadow-2xl border-4 border-white flex flex-col min-h-[500px]">
        <h2 className="text-xl font-black uppercase italic tracking-tighter mb-6 flex justify-between items-center border-b border-gray-100 pb-4">
          <span>Artigos a Enviar</span>
          <button type="button" onClick={() => setModalCatAberto(true)} className="px-5 py-3 bg-[#1e3a8a] text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl hover:bg-blue-800 transition-all active:scale-95">
            + Pesquisar Catálogo
          </button>
        </h2>
        
        <div className="space-y-4 mb-8 flex-1">
          {linhas.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-gray-200 rounded-3xl bg-gray-50/50">
              <span className="text-3xl mb-2 grayscale opacity-50">📦</span>
              <p className="text-xs font-black uppercase text-gray-400 tracking-widest">Caixa de envio vazia.</p>
              <p className="text-[10px] font-bold text-gray-400 mt-1">Clique em "Pesquisar Catálogo" para adicionar material.</p>
            </div>
          ) : (
            linhas.map((linha, index) => (
              <div key={index} className="flex gap-4 items-center bg-gray-50 p-4 rounded-2xl border border-gray-100">
                <div className="flex-[2]">
                  <p className="font-black text-sm text-[#0f172a] uppercase">{linha.nome}</p>
                  <p className="text-[10px] text-gray-500 font-bold tracking-widest mt-1 uppercase">Local: <span className="text-[#1e3a8a]">{linha.local}</span> | Em Stock: {linha.stockMax} un.</p>
                </div>
                
                <div className="w-24 shrink-0">
                  <label className="text-[9px] font-black text-gray-400 uppercase block mb-1 px-1 tracking-widest text-center">A Enviar</label>
                  <input 
                    required type="number" min="1" max={linha.stockMax} 
                    value={linha.quantidade} 
                    onChange={e => atualizarLinha(index, "quantidade", parseInt(e.target.value) || 1)} 
                    className="input-gourmet w-full text-center py-3 font-black text-lg text-blue-600 bg-white" 
                  />
                </div>

                <div className="flex-[2]">
                  <label className="text-[9px] font-black text-gray-400 uppercase block mb-1 px-1 tracking-widest">Notas na Guia (Opcional)</label>
                  <input type="text" value={linha.observacao} onChange={e => atualizarLinha(index, "observacao", e.target.value)} className="input-gourmet w-full bg-white py-3 text-xs" placeholder="Ex: Últimas unidades..." />
                </div>

                <div className="pt-5 pl-2">
                  <button type="button" onClick={() => removerLinha(index)} className="w-10 h-10 flex items-center justify-center bg-red-50 text-red-400 hover:bg-red-500 hover:text-white rounded-xl transition-all font-black text-lg" title="Remover da caixa">
                    ×
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex justify-between items-center pt-6 border-t border-gray-100 mt-auto">
          <p className="text-[10px] font-black text-gray-400 tracking-widest uppercase">
            Total de Itens: <span className="text-[#1e3a8a] text-sm">{linhas.reduce((acc, l) => acc + l.quantidade, 0)}</span>
          </p>

          <button type="submit" disabled={linhas.length === 0} className={`px-10 py-5 rounded-3xl font-black uppercase text-xs tracking-widest shadow-xl transition-all ${linhas.length > 0 ? 'bg-amber-500 text-[#0f172a] hover:bg-amber-400 active:scale-95' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>
            ✓ Fechar Caixa e Abater Stock
          </button>
        </div>
      </form>

      {modalCatAberto && (
        <div className="fixed inset-0 bg-[#0f172a]/80 backdrop-blur-md flex items-center justify-center z-50 p-6">
          <div className="bg-white rounded-[3rem] p-8 w-full max-w-4xl shadow-2xl h-[80vh] flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-black text-[#1e3a8a] uppercase italic tracking-tighter">Catálogo Virtual</h2>
              <button onClick={() => setModalCatAberto(false)} className="w-10 h-10 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-full font-black flex items-center justify-center transition-colors">×</button>
            </div>

            <div className="mb-6 relative">
              <span className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400 text-lg">🔍</span>
              <input 
                type="text" autoFocus placeholder="Escreva o nome do artigo..." 
                value={pesquisa} onChange={e => setPesquisa(e.target.value)}
                className="w-full bg-gray-50 border-2 border-gray-100 rounded-3xl py-4 pl-14 pr-6 font-bold text-gray-800 outline-none focus:border-blue-500 focus:bg-white transition-all shadow-inner"
              />
            </div>

            <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide mb-2 border-b border-gray-100">
              {categoriasUnicas.map(cat => (
                <button 
                  key={cat} onClick={() => setCategoriaAtiva(cat)}
                  className={`px-4 py-2 rounded-full font-black uppercase text-[9px] tracking-widest whitespace-nowrap transition-colors ${categoriaAtiva === cat ? 'bg-[#1e3a8a] text-white shadow-md' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto pr-2 grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 content-start">
              {catalogoFiltrado.length === 0 ? (
                <div className="col-span-full text-center py-12 text-gray-400 font-bold uppercase text-[10px] tracking-widest">Nenhum artigo encontrado com esses filtros.</div>
              ) : (
                catalogoFiltrado.map(p => (
                  <div key={p.id} onClick={() => adicionarArtigoAoPedido(p)} className="p-5 border-2 border-gray-100 rounded-2xl hover:border-blue-400 hover:shadow-lg cursor-pointer transition-all flex justify-between items-center group bg-white">
                    <div>
                      <p className="font-black text-sm text-[#0f172a] uppercase group-hover:text-blue-600 transition-colors">{p.nome}</p>
                      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-1">{p.categoria || "Geral"}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${p.quantidade > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                        Em Stock: {p.quantidade}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}