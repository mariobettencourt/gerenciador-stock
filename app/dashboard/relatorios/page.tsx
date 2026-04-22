"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function RelatoriosPage() {
  const router = useRouter();
  const [abaAtiva, setAbaAtiva] = useState<"global" | "artigo">("global");
  const [aCarregar, setACarregar] = useState(true);
  const [exportando, setExportando] = useState<string | null>(null);
  
  // --- ESTADOS GERAIS ---
  const [produtosAtuais, setProdutosAtuais] = useState<any[]>([]);
  const [todosMovimentos, setTodosMovimentos] = useState<any[]>([]);
  const [anosDisponiveis, setAnosDisponiveis] = useState<number[]>([]);
  const [anoSelecionado, setAnoSelecionado] = useState<number>(new Date().getFullYear());
  
  // --- DADOS PROCESSADOS (VISÃO GLOBAL) ---
  const [dadosMensais, setDadosMensais] = useState<{ mes: string; total: number }[]>([]);
  const [topSaidasGlobal, setTopSaidasGlobal] = useState<any[]>([]);
  const [dadosCategorias, setDadosCategorias] = useState<{ categoria: string; total: number }[]>([]);
  const [resumoFinanceiro, setResumoFinanceiro] = useState({ totalAno: 0, mediaMensal: 0, mesTopo: "", totalUnidades: 0 });

  // --- ESTADOS PARA ESTUDO DE ARTIGO ---
  const [artigoSelecionadoId, setArtigoSelecionadoId] = useState<string>("");
  const [estudoArtigo, setEstudoArtigo] = useState<any>(null);

  useEffect(() => {
    inicializarRelatorios();
  }, []);

  useEffect(() => {
    if (todosMovimentos.length > 0) {
      processarDadosBI(anoSelecionado, todosMovimentos);
      if (abaAtiva === "artigo" && artigoSelecionadoId) {
        processarEstudoArtigo(artigoSelecionadoId, anoSelecionado, todosMovimentos);
      }
    }
  }, [anoSelecionado, todosMovimentos, artigoSelecionadoId, abaAtiva]);

  const inicializarRelatorios = async () => {
    setACarregar(true);
    
    try {
      // 1. Carregar Catálogo
      const { data: produtos } = await supabase.from("produtos").select("*").order("nome");
      if (produtos) setProdutosAtuais(produtos);

      // 2. Carregar Movimentos e Produtos (Join simples que sabemos que funciona)
      const { data: movs, error: errMovs } = await supabase
        .from("movimentos")
        .select(`*, produtos (id, nome, categoria, preco)`)
        .order("created_at", { ascending: true });

      if (errMovs) throw errMovs;

      // 3. Carregar Pedidos e Contactos separadamente (Para evitar erro de Join complexo)
      const { data: peds, error: errPeds } = await supabase
        .from("pedidos")
        .select(`id, requisitante, contatos!contacto_id (nome)`);

      // 4. "Fundir" os dados manualmente (Merging)
      const movsCompletos = movs?.map(m => ({
        ...m,
        pedidos: peds?.find(p => p.id === m.pedido_id) || null
      })) || [];

      setTodosMovimentos(movsCompletos);

      // 5. Gerir anos disponíveis
      const anos = Array.from(new Set(movsCompletos.map(m => new Date(m.created_at).getFullYear()))).sort((a, b) => b - a);
      if (anos.length > 0) {
        setAnosDisponiveis(anos);
        if (!anos.includes(anoSelecionado)) setAnoSelecionado(anos[0]);
      } else {
        setAnosDisponiveis([new Date().getFullYear()]);
      }

    } catch (error: any) {
      console.error("ERRO CRÍTICO NO CARREGAMENTO:", error);
      alert("Houve uma falha na comunicação com a base de dados. Verifique a consola.");
    } finally {
      setACarregar(false);
    }
  };

  const processarDadosBI = (ano: number, movimentos: any[]) => {
    const mesesNomes = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    const gastosPorMes = Array(12).fill(0);
    const categorias: Record<string, number> = {};
    const contagemItens: Record<string, { nome: string; qtd: number; custo: number }> = {};
    
    let totalAno = 0;
    let unidadesAno = 0;

    movimentos.filter(m => {
      const dataAno = new Date(m.created_at).getFullYear();
      const tipoNorm = m.tipo?.trim().toLowerCase();
      return dataAno === ano && (tipoNorm === "saída" || tipoNorm === "saida");
    }).forEach(m => {
      const mesIndex = new Date(m.created_at).getMonth();
      const precoH = m.custo_unitario ?? m.produtos?.preco ?? 0;
      const qtd = Math.abs(m.quantidade);
      const custoFinal = precoH * qtd;
      const cat = m.produtos?.categoria || "Geral";
      const nome = m.produtos?.nome || "Artigo s/ Nome";

      gastosPorMes[mesIndex] += custoFinal;
      totalAno += custoFinal;
      unidadesAno += qtd;

      categorias[cat] = (categorias[cat] || 0) + custoFinal;
      if (!contagemItens[nome]) contagemItens[nome] = { nome, qtd: 0, custo: 0 };
      contagemItens[nome].qtd += qtd;
      contagemItens[nome].custo += custoFinal;
    });

    const valorMax = Math.max(...gastosPorMes);
    setResumoFinanceiro({
      totalAno,
      mediaMensal: totalAno / (gastosPorMes.filter(v => v > 0).length || 1),
      mesTopo: valorMax > 0 ? mesesNomes[gastosPorMes.indexOf(valorMax)] : "---",
      totalUnidades: unidadesAno
    });
    setDadosMensais(mesesNomes.map((mes, i) => ({ mes, total: gastosPorMes[i] })));
    setDadosCategorias(Object.entries(categorias).map(([categoria, total]) => ({ categoria, total })).sort((a, b) => b.total - a.total));
    setTopSaidasGlobal(Object.values(contagemItens).sort((a, b) => b.qtd - a.qtd));
  };

  const processarEstudoArtigo = (idProd: string, ano: number, movimentos: any[]) => {
    const movs = movimentos.filter(m => m.produtos?.id?.toString() === idProd && new Date(m.created_at).getFullYear() === ano);
    const meses = Array(12).fill(0);
    const requisitantes: Record<string, number> = {};
    const historicoPrecos: { data: string, valor: number }[] = [];

    let totalGasto = 0;
    let totalUnidades = 0;

    movs.forEach(m => {
      const data = new Date(m.created_at);
      const preco = m.custo_unitario ?? m.produtos?.preco ?? 0;
      const tipoL = m.tipo?.trim().toLowerCase();

      if (tipoL === "saída" || tipoL === "saida") {
        const qtd = Math.abs(m.quantidade);
        meses[data.getMonth()] += qtd;
        totalUnidades += qtd;
        totalGasto += (qtd * preco);

        const nomeReq = m.pedidos?.contatos?.nome || m.pedidos?.requisitante || "Lançamento Manual";
        requisitantes[nomeReq] = (requisitantes[nomeReq] || 0) + qtd;
      }

      if (preco > 0) {
        historicoPrecos.push({ data: data.toLocaleDateString('pt-PT'), valor: preco });
      }
    });

    const mesesNomes = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    const picoIdx = meses.indexOf(Math.max(...meses));

    // Pegar apenas variações únicas de preço para o histórico
    const precosUnicos = [...new Map(historicoPrecos.map(item => [item.valor, item])).values()].reverse().slice(0, 5);

    setEstudoArtigo({
      totalGasto,
      totalUnidades,
      precoMedio: totalUnidades > 0 ? totalGasto / totalUnidades : 0,
      mesPico: Math.max(...meses) > 0 ? mesesNomes[picoIdx] : "---",
      topRequisitante: Object.entries(requisitantes).sort((a, b) => b[1] - a[1])[0] || ["Manual", 0],
      graficoSazonal: meses,
      variacoesPreco: precosUnicos
    });
  };

  // --- EXPORTAÇÕES ---
  const gerarPDFFinanceiro = () => {
    setExportando("pdf_fin");
    const doc = new jsPDF();
    doc.text("RELATÓRIO FINANCEIRO " + anoSelecionado, 15, 20);
    autoTable(doc, {
      startY: 30,
      head: [['Indicador', 'Valor']],
      body: [
        ['Investimento Total do Ano', `${resumoFinanceiro.totalAno.toFixed(2)}€`],
        ['Unidades Expedidas', `${resumoFinanceiro.totalUnidades} un.`]
      ]
    });
    window.open(doc.output('bloburl'), '_blank');
    setExportando(null);
  };

  if (aCarregar) return <div className="p-20 text-center font-black animate-pulse text-[#1e3a8a] text-xl h-screen flex items-center justify-center bg-slate-50">SINCRONIZANDO DADOS DO ARMAZÉM...</div>;

  return (
    <main className="flex-1 p-8 md:p-12 overflow-y-auto h-screen bg-slate-50 w-full">
      <div className="max-w-[1400px] mx-auto">
        
        <header className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div>
            <h1 className="text-4xl font-black text-[#0f172a] uppercase italic leading-none tracking-tighter">
              Relatórios <span className="text-[#1e3a8a]">Lotaçor</span>
            </h1>
            <div className="h-1.5 w-24 bg-[#1e3a8a] rounded-full mt-3 mb-2"></div>
          </div>

          <div className="flex bg-white p-1.5 rounded-2xl shadow-sm border border-slate-200">
            <button 
              onClick={() => setAbaAtiva("global")}
              className={`px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${abaAtiva === "global" ? 'bg-[#1e3a8a] text-white shadow-lg' : 'text-slate-400 hover:text-[#1e3a8a]'}`}
            >
              Visão Global
            </button>
            <button 
              onClick={() => setAbaAtiva("artigo")}
              className={`px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${abaAtiva === "artigo" ? 'bg-[#1e3a8a] text-white shadow-lg' : 'text-slate-400 hover:text-[#1e3a8a]'}`}
            >
              Estudo de Artigo
            </button>
          </div>
        </header>

        {abaAtiva === "global" ? (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center gap-3 bg-white p-4 rounded-2xl shadow-sm border border-slate-200 w-fit mb-10">
              <span className="text-[10px] font-black text-slate-400 uppercase">Ano Fiscal:</span>
              <select value={anoSelecionado} onChange={e => setAnoSelecionado(Number(e.target.value))} className="font-black text-xl text-[#1e3a8a] bg-transparent outline-none">
                {anosDisponiveis.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
              <div className="bg-[#1e3a8a] p-8 rounded-[2.5rem] shadow-lg text-white">
                <p className="text-[10px] font-black text-blue-300 uppercase mb-1">Total Faturado</p>
                <p className="text-5xl font-black italic">{resumoFinanceiro.totalAno.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}</p>
              </div>
              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col justify-center">
                <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Total Saídas</p>
                <p className="text-4xl font-black text-[#0f172a]">{resumoFinanceiro.totalUnidades} un.</p>
              </div>
              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col justify-center">
                <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Pico Mensal</p>
                <p className="text-4xl font-black text-amber-500 uppercase">{resumoFinanceiro.mesTopo}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 mb-12">
              <div className="xl:col-span-2 bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100">
                <h2 className="text-lg font-black text-[#0f172a] uppercase italic mb-8">Evolução Mensal</h2>
                <div className="h-64 flex items-end justify-between gap-2">
                  {dadosMensais.map((d, i) => {
                    const max = Math.max(...dadosMensais.map(m => m.total));
                    const height = max > 0 ? (d.total / max) * 100 : 0;
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-2 group relative">
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 text-white text-[9px] font-bold px-2 py-1 rounded absolute -top-8 whitespace-nowrap z-10">{d.total.toFixed(2)}€</div>
                        <div className="w-full bg-slate-50 rounded-t-xl h-full flex items-end border border-slate-100">
                          <div style={{ height: `${height}%` }} className="w-full bg-[#1e3a8a] rounded-t-xl transition-all group-hover:bg-amber-500"></div>
                        </div>
                        <span className="text-[9px] font-black text-slate-400 uppercase">{d.mes}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="bg-[#0f172a] p-10 rounded-[3rem] shadow-lg text-white">
                <h2 className="text-lg font-black uppercase italic mb-6 text-amber-500">🏆 Top 4</h2>
                <div className="space-y-6">
                  {topSaidasGlobal.slice(0, 4).map((item, i) => (
                    <div key={i} className="relative">
                      <div className="flex justify-between items-end mb-1">
                        <span className="font-black text-sm uppercase truncate pr-4">{item.nome}</span>
                        <span className="font-black text-amber-400 text-sm">{item.qtd}</span>
                      </div>
                      <div className="w-full bg-white/10 rounded-full h-1.5">
                        <div className="bg-amber-500 h-1.5 rounded-full" style={{ width: `${Math.round((item.qtd / (topSaidasGlobal[0]?.qtd || 1)) * 100)}%` }}></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col md:flex-row gap-6">
              <div className="flex-1">
                <label className="text-[9px] font-black text-slate-400 uppercase mb-2 block ml-2">Produto a Estudar:</label>
                <select 
                  value={artigoSelecionadoId} onChange={e => setArtigoSelecionadoId(e.target.value)}
                  className="w-full p-4 bg-slate-50 border-none rounded-2xl font-black text-[#1e3a8a] text-lg outline-none focus:ring-2 ring-blue-100"
                >
                  <option value="">Selecione um artigo...</option>
                  {produtosAtuais.map(p => <option key={p.id} value={p.id}>{p.nome.toUpperCase()}</option>)}
                </select>
              </div>
              <div className="md:w-48">
                <label className="text-[9px] font-black text-slate-400 uppercase mb-2 block ml-2">Ano:</label>
                <select value={anoSelecionado} onChange={e => setAnoSelecionado(Number(e.target.value))} className="w-full p-4 bg-slate-50 border-none rounded-2xl font-black text-lg outline-none">
                  {anosDisponiveis.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
            </div>

            {estudoArtigo ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="bg-[#1e3a8a] p-8 rounded-[2.5rem] text-white shadow-xl">
                    <p className="text-[9px] font-black text-blue-200 uppercase mb-1">Gasto Total</p>
                    <p className="text-3xl font-black italic">{estudoArtigo.totalGasto.toFixed(2)}€</p>
                  </div>
                  <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col justify-center">
                    <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Volume Saída</p>
                    <p className="text-3xl font-black text-[#0f172a]">{estudoArtigo.totalUnidades} un.</p>
                  </div>
                  <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col justify-center">
                    <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Pico Mensal</p>
                    <p className="text-2xl font-black text-amber-500 uppercase">{estudoArtigo.mesPico}</p>
                  </div>
                  <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col justify-center">
                    <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Preço Médio Real</p>
                    <p className="text-3xl font-black text-[#0f172a]">{estudoArtigo.precoMedio.toFixed(2)}€</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                  <div className="xl:col-span-2 bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm">
                    <h3 className="text-sm font-black uppercase italic mb-8 border-l-4 border-amber-500 pl-4">Consumo por Mês</h3>
                    <div className="h-64 flex items-end justify-between gap-2">
                      {estudoArtigo.graficoSazonal.map((qtd: number, i: number) => {
                        const max = Math.max(...estudoArtigo.graficoSazonal);
                        const height = max > 0 ? (qtd / max) * 100 : 0;
                        const nomes = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
                        return (
                          <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
                            <div className="w-full bg-slate-50 rounded-t-xl h-full flex items-end border border-slate-100">
                                <div style={{ height: `${height}%` }} className="w-full bg-[#1e3a8a] rounded-t-xl transition-all group-hover:bg-amber-500"></div>
                            </div>
                            <span className="text-[9px] font-black text-slate-400 uppercase">{nomes[i]}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="bg-[#0f172a] p-10 rounded-[3rem] text-white shadow-xl flex flex-col justify-center text-center">
                    <h3 className="text-sm font-black uppercase italic mb-8 text-amber-500">Maior Consumidor</h3>
                    <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center text-3xl mx-auto mb-4">👤</div>
                    <p className="text-2xl font-black uppercase">{estudoArtigo.topRequisitante[0]}</p>
                    <p className="text-blue-400 font-bold uppercase text-[10px] mt-4 tracking-widest">Responsável por {estudoArtigo.topRequisitante[1]} un.</p>
                  </div>
                </div>

                <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm">
                  <h3 className="text-sm font-black text-[#0f172a] uppercase italic mb-6">📈 Evolução de Preços</h3>
                  <table className="w-full text-left">
                    <thead><tr className="text-[10px] font-black text-slate-400 uppercase border-b"><th className="pb-4">Data</th><th className="pb-4">Custo Unitário</th></tr></thead>
                    <tbody className="divide-y divide-slate-50">
                      {estudoArtigo.variacoesPreco.map((p: any, i: number) => (
                        <tr key={i}><td className="py-4 text-sm font-bold text-slate-600">{p.data}</td><td className="py-4 text-lg font-black text-[#1e3a8a]">{p.valor.toFixed(2)}€</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="py-20 text-center border-4 border-dashed border-slate-200 rounded-[3rem]">
                <p className="text-4xl mb-4 opacity-20">🔎</p>
                <p className="text-slate-400 font-black uppercase text-xs">Selecione um artigo acima para ver os dados detalhados.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}