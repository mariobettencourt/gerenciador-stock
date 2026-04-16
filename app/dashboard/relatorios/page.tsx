"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function RelatoriosPage() {
  const [aCarregar, setACarregar] = useState(true);
  const [exportando, setExportando] = useState<string | null>(null);
  
  // Estados para KPIs
  const [totalProdutos, setTotalProdutos] = useState(0);
  const [totalEntregue, setTotalEntregue] = useState(0);
  const [topSaidas, setTopSaidas] = useState<any[]>([]);
  const [stockCritico, setStockCritico] = useState<any[]>([]);

  useEffect(() => {
    const gerarRelatorios = async () => {
      const { data: produtos } = await supabase.from("produtos").select("*");
      if (produtos) {
        setTotalProdutos(produtos.length);
        const criticos = produtos.filter(p => p.quantidade > 0 && p.quantidade <= 5).sort((a, b) => a.quantidade - b.quantidade).slice(0, 5);
        setStockCritico(criticos);
      }

      const { data: movimentos } = await supabase.from("movimentos").select(`quantidade, produtos (nome, categoria)`).eq("tipo", "Saída");
      if (movimentos) {
        const somaEntregues = movimentos.reduce((acc, m) => acc + Math.abs(m.quantidade), 0);
        setTotalEntregue(somaEntregues);

        const contagem: Record<string, { nome: string; categoria: string; qtd: number }> = {};
        movimentos.forEach(m => {
          const nomeProd = m.produtos?.nome || "Artigo Apagado";
          const catProd = m.produtos?.categoria || "Geral";
          const quantidadeSaida = Math.abs(m.quantidade);
          if (!contagem[nomeProd]) contagem[nomeProd] = { nome: nomeProd, categoria: catProd, qtd: 0 };
          contagem[nomeProd].qtd += quantidadeSaida;
        });

        const top5 = Object.values(contagem).sort((a, b) => b.qtd - a.qtd).slice(0, 5);
        setTopSaidas(top5);
      }
      setACarregar(false);
    };
    gerarRelatorios();
  }, []);

  // --- MOTOR DE EXPORTAÇÃO PARA EXCEL (CSV) ---
  const descarregarExcel = (dados: any[], nomeFicheiro: string) => {
    if (dados.length === 0) return alert("Não há dados para exportar neste momento.");
    
    const separador = ";"; // Ponto e vírgula é o standard do Excel em Portugal
    const chaves = Object.keys(dados[0]);
    const cabecalho = chaves.map(c => c.toUpperCase()).join(separador);
    
    const linhas = dados.map(row => {
      return chaves.map(k => {
        let valor = row[k];
        if (valor === null || valor === undefined) valor = "";
        // Limpa quebras de linha e aspas para não quebrar o Excel
        valor = valor.toString().replace(/"/g, '""').replace(/\n/g, ' ');
        return `"${valor}"`;
      }).join(separador);
    });

    const csv = [cabecalho, ...linhas].join("\n");
    // O \uFEFF avisa o Excel que o ficheiro usa acentos em PT-PT (UTF-8)
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }); 
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `${nomeFicheiro}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- FUNÇÕES DE CADA RELATÓRIO ---
  const exportarQuantidadesInventario = async () => {
    setExportando("quantidades");
    const { data } = await supabase.from("produtos").select("nome, categoria, local, quantidade").order("categoria");
    if (data) descarregarExcel(data, "Relatorio_Inventario_Quantidades");
    setExportando(null);
  };

  const exportarCustosInventario = async () => {
    setExportando("custos");
    const { data } = await supabase.from("produtos").select("nome, categoria, quantidade, preco").order("categoria");
    if (data) {
      const dadosFormatados = data.map(p => ({
        Artigo: p.nome,
        Categoria: p.categoria,
        Stock_Atual: p.quantidade,
        Custo_Unitario_Eur: p.preco || 0,
        Custo_Total_Eur: (p.quantidade * (p.preco || 0)).toFixed(2)
      }));
      descarregarExcel(dadosFormatados, "Relatorio_Inventario_Valor_Euros");
    }
    setExportando(null);
  };

  const exportarHistoricoQuantidades = async () => {
    setExportando("hist_quant");
    const { data } = await supabase.from("movimentos").select("created_at, tipo, quantidade, utilizador, produtos(nome)").order("created_at", { ascending: false });
    if (data) {
      const dadosFormatados = data.map(m => ({
        Data: new Date(m.created_at).toLocaleDateString('pt-PT'),
        Hora: new Date(m.created_at).toLocaleTimeString('pt-PT'),
        Movimento: m.tipo,
        Artigo: m.produtos?.nome || "Artigo Apagado",
        Quantidade: Math.abs(m.quantidade),
        Operador: m.utilizador
      }));
      descarregarExcel(dadosFormatados, "Historico_Movimentos_Quantidades");
    }
    setExportando(null);
  };

  const exportarHistoricoCustos = async () => {
    setExportando("hist_custos");
    const { data } = await supabase.from("movimentos").select("created_at, tipo, quantidade, produtos(nome, preco)").order("created_at", { ascending: false });
    if (data) {
      const dadosFormatados = data.map(m => ({
        Data: new Date(m.created_at).toLocaleDateString('pt-PT'),
        Movimento: m.tipo,
        Artigo: m.produtos?.nome || "Artigo Apagado",
        Quantidade: Math.abs(m.quantidade),
        Preco_Unitario_Ref: m.produtos?.preco || 0,
        Valor_Total_Movimento_Eur: (Math.abs(m.quantidade) * (m.produtos?.preco || 0)).toFixed(2)
      }));
      descarregarExcel(dadosFormatados, "Historico_Movimentos_Custos");
    }
    setExportando(null);
  };

  if (aCarregar) return <main className="flex-1 p-12 h-screen flex justify-center items-center font-black uppercase text-[#1e3a8a] animate-pulse">A calcular estatísticas...</main>;

  return (
    <main className="flex-1 p-12 overflow-y-auto h-screen relative">
      <header className="mb-12">
        <h1 className="text-4xl font-black text-[#0f172a] uppercase italic leading-none tracking-tighter">
          Relatórios & <span className="text-amber-500">Estatísticas</span>
        </h1>
        <div className="h-1.5 w-24 bg-amber-500 rounded-full mt-3 mb-2"></div>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Análise de consumos e inventário em tempo real</p>
      </header>

      {/* CARTÕES DE RESUMO (KPIs) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
        <div className="bg-white rounded-[2rem] p-8 shadow-xl border-4 border-white flex flex-col justify-center">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Total de Referências</p>
          <p className="text-5xl font-black text-[#0f172a]">{totalProdutos}</p>
        </div>
        <div className="bg-gradient-to-br from-[#1e3a8a] to-[#0f172a] rounded-[2rem] p-8 shadow-xl text-white flex flex-col justify-center">
          <p className="text-[10px] font-black text-blue-300 uppercase tracking-widest mb-2">Unidades Expedidas</p>
          <p className="text-5xl font-black text-white">{totalEntregue}</p>
        </div>
        <div className="bg-amber-500 rounded-[2rem] p-8 shadow-xl text-[#0f172a] flex flex-col justify-center border-4 border-amber-400">
          <p className="text-[10px] font-black text-amber-900 uppercase tracking-widest mb-2">Stock Crítico</p>
          <p className="text-5xl font-black">{stockCritico.length}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-12 mb-12">
        {/* RELATÓRIO 1: O QUE SAI MAIS */}
        <div className="bg-white rounded-[3rem] p-10 shadow-2xl">
          <div className="flex justify-between items-center mb-8 border-b border-gray-100 pb-4">
            <h2 className="text-xl font-black text-[#1e3a8a] uppercase italic tracking-tighter">🔥 Top 5: Mais Requisitados</h2>
          </div>
          <div className="space-y-6">
            {topSaidas.length === 0 ? <p className="text-gray-400 text-xs italic">Sem dados suficientes.</p> : (
              topSaidas.map((item, index) => {
                const maxQtd = topSaidas[0].qtd;
                const percentagem = Math.round((item.qtd / maxQtd) * 100);
                return (
                  <div key={index} className="relative">
                    <div className="flex justify-between items-end mb-2">
                      <div>
                        <span className="text-gray-300 font-black text-lg mr-3">#{index + 1}</span>
                        <span className="font-black text-sm text-[#0f172a] uppercase">{item.nome}</span>
                      </div>
                      <span className="font-black text-lg text-[#1e3a8a]">{item.qtd} <span className="text-xs text-gray-400">un.</span></span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-3 ml-7 max-w-[90%]">
                      <div className="bg-amber-500 h-3 rounded-full" style={{ width: `${percentagem}%` }}></div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RELATÓRIO 2: STOCK CRÍTICO */}
        <div className="bg-[#0f172a] rounded-[3rem] p-10 shadow-2xl text-white">
          <div className="flex justify-between items-center mb-8 border-b border-white/10 pb-4">
            <h2 className="text-xl font-black uppercase italic tracking-tighter">⚠️ Alerta de Ruptura</h2>
          </div>
          <div className="space-y-4">
            {stockCritico.length === 0 ? <p className="text-gray-400 text-xs italic text-center py-10 font-bold uppercase tracking-widest">O inventário está perfeito.</p> : (
              stockCritico.map((item, index) => (
                <div key={index} className="bg-white/5 p-5 rounded-2xl border border-white/10 flex justify-between items-center">
                  <div>
                    <p className="font-black text-sm uppercase">{item.nome}</p>
                    <p className="text-[10px] text-gray-400 font-medium mt-1">Local: {item.local}</p>
                  </div>
                  <div className="bg-red-500/20 border border-red-500/50 rounded-xl px-4 py-3 text-center min-w-[80px]">
                    <p className="text-[9px] font-black text-red-300 uppercase tracking-widest mb-1">Stock</p>
                    <p className="font-black text-xl text-white leading-none">{item.quantidade}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* --- NOVA SECÇÃO DE EXPORTAÇÃO EXCEL --- */}
      <div className="bg-white rounded-[3rem] p-10 shadow-2xl border-4 border-green-50">
        <div className="flex justify-between items-center mb-8 border-b border-gray-100 pb-4">
          <div>
            <h2 className="text-xl font-black text-green-700 uppercase italic tracking-tighter flex items-center gap-2">
              <span>📗</span> Exportação de Dados
            </h2>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Descarregar listagens em formato Excel (CSV)</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Categoria Geral */}
          <div className="space-y-4">
            <h3 className="text-xs font-black text-gray-800 uppercase border-l-4 border-amber-500 pl-3">Inventário Geral</h3>
            
            <button 
              onClick={exportarQuantidadesInventario} disabled={exportando !== null}
              className="w-full flex justify-between items-center bg-gray-50 hover:bg-green-50 border border-gray-200 hover:border-green-300 p-5 rounded-2xl transition-all group"
            >
              <div className="text-left">
                <p className="font-black text-sm text-[#0f172a] uppercase group-hover:text-green-700">📦 Quantidades em Inventário</p>
                <p className="text-[10px] text-gray-500 font-bold mt-1">Listagem completa do stock físico atual</p>
              </div>
              <span className="text-xl">{exportando === "quantidades" ? "⏳" : "⬇️"}</span>
            </button>

            <button 
              onClick={exportarCustosInventario} disabled={exportando !== null}
              className="w-full flex justify-between items-center bg-gray-50 hover:bg-green-50 border border-gray-200 hover:border-green-300 p-5 rounded-2xl transition-all group"
            >
              <div className="text-left">
                <p className="font-black text-sm text-[#0f172a] uppercase group-hover:text-green-700">💶 Custos do Inventário</p>
                <p className="text-[10px] text-gray-500 font-bold mt-1">Valorização em euros do stock armazenado</p>
              </div>
              <span className="text-xl">{exportando === "custos" ? "⏳" : "⬇️"}</span>
            </button>
          </div>

          {/* Categoria Itens/Histórico */}
          <div className="space-y-4">
            <h3 className="text-xs font-black text-gray-800 uppercase border-l-4 border-blue-500 pl-3">Histórico de Movimentos</h3>
            
            <button 
              onClick={exportarHistoricoQuantidades} disabled={exportando !== null}
              className="w-full flex justify-between items-center bg-gray-50 hover:bg-green-50 border border-gray-200 hover:border-green-300 p-5 rounded-2xl transition-all group"
            >
              <div className="text-left">
                <p className="font-black text-sm text-[#0f172a] uppercase group-hover:text-green-700">📈 Histórico de Quantidades</p>
                <p className="text-[10px] text-gray-500 font-bold mt-1">Registo temporal de entradas e saídas (Un.)</p>
              </div>
              <span className="text-xl">{exportando === "hist_quant" ? "⏳" : "⬇️"}</span>
            </button>

            <button 
              onClick={exportarHistoricoCustos} disabled={exportando !== null}
              className="w-full flex justify-between items-center bg-gray-50 hover:bg-green-50 border border-gray-200 hover:border-green-300 p-5 rounded-2xl transition-all group"
            >
              <div className="text-left">
                <p className="font-black text-sm text-[#0f172a] uppercase group-hover:text-green-700">📉 Histórico de Custos</p>
                <p className="text-[10px] text-gray-500 font-bold mt-1">Impacto financeiro por movimento registado</p>
              </div>
              <span className="text-xl">{exportando === "hist_custos" ? "⏳" : "⬇️"}</span>
            </button>
          </div>

        </div>
      </div>
    </main>
  );
}