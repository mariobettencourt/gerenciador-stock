"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function RelatoriosPage() {
  const router = useRouter();
  const [aCarregar, setACarregar] = useState(true);
  const [exportando, setExportando] = useState<string | null>(null);
  
  // --- ESTADOS PARA ANÁLISE TEMPORAL E INVENTÁRIO ---
  const [produtosAtuais, setProdutosAtuais] = useState<any[]>([]);
  const [todosMovimentos, setTodosMovimentos] = useState<any[]>([]);
  const [anosDisponiveis, setAnosDisponiveis] = useState<number[]>([]);
  const [anoSelecionado, setAnoSelecionado] = useState<number>(new Date().getFullYear());
  
  // --- DADOS PROCESSADOS PARA O ANO ---
  const [dadosMensais, setDadosMensais] = useState<{ mes: string; total: number }[]>([]);
  const [topSaidas, setTopSaidas] = useState<any[]>([]);
  const [dadosCategorias, setDadosCategorias] = useState<{ categoria: string; total: number }[]>([]);
  const [resumoFinanceiro, setResumoFinanceiro] = useState({ totalAno: 0, mediaMensal: 0, mesTopo: "", totalUnidades: 0 });

  useEffect(() => {
    inicializarRelatorios();
  }, []);

  useEffect(() => {
    if (todosMovimentos.length > 0) {
      processarDadosDoAno(anoSelecionado, todosMovimentos);
    }
  }, [anoSelecionado, todosMovimentos]);

  const inicializarRelatorios = async () => {
    setACarregar(true);
    
    // 1. Snapshot do Inventário Atual
    const { data: produtos } = await supabase.from("produtos").select("*").order("nome");
    if (produtos) setProdutosAtuais(produtos);

    // 2. Todos os Movimentos de Saída
    const { data: movimentos } = await supabase
      .from("movimentos")
      .select(`created_at, tipo, quantidade, produtos (nome, categoria, preco, local)`)
      .eq("tipo", "Saída");

    if (movimentos) {
      setTodosMovimentos(movimentos);
      const anos = Array.from(new Set(movimentos.map(m => new Date(m.created_at).getFullYear()))).sort((a, b) => b - a);
      setAnosDisponiveis(anos.length ? anos : [new Date().getFullYear()]);
    }
    
    setACarregar(false);
  };

  const processarDadosDoAno = (ano: number, movimentos: any[]) => {
    const mesesNomes = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    const gastosPorMes = Array(12).fill(0);
    const categorias: Record<string, number> = {};
    const contagemItens: Record<string, { nome: string; categoria: string; qtd: number; custo: number }> = {};
    
    let totalAno = 0;
    let unidadesAno = 0;

    movimentos.filter(m => new Date(m.created_at).getFullYear() === ano).forEach(m => {
      const mesIndex = new Date(m.created_at).getMonth();
      const precoUn = m.produtos?.preco || 0;
      const qtdSaida = Math.abs(m.quantidade);
      const custo = precoUn * qtdSaida;
      const cat = m.produtos?.categoria || "Geral";
      const nome = m.produtos?.nome || "Artigo Apagado";

      // Mensal
      gastosPorMes[mesIndex] += custo;
      totalAno += custo;
      unidadesAno += qtdSaida;

      // Categorias
      if (!categorias[cat]) categorias[cat] = 0;
      categorias[cat] += custo;

      // Itens (Top)
      if (!contagemItens[nome]) contagemItens[nome] = { nome, categoria: cat, qtd: 0, custo: 0 };
      contagemItens[nome].qtd += qtdSaida;
      contagemItens[nome].custo += custo;
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
    setTopSaidas(Object.values(contagemItens).sort((a, b) => b.qtd - a.qtd));
  };

  // --- MOTOR BASE DE PDF COM LOGO ---
  const inicializarPDF = async (titulo: string, subtitulo: string) => {
    const doc = new jsPDF();
    const dataHoje = new Date().toLocaleDateString('pt-PT');

    const carregarLogo = (): Promise<HTMLImageElement | null> => {
      return new Promise((resolve) => {
        const img = new Image();
        img.src = '/logo.jpg';
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
      });
    };

    const logoImg = await carregarLogo();
    if (logoImg) doc.addImage(logoImg, 'JPEG', 15, 10, 85, 25);

    doc.setTextColor(30, 58, 138); 
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text(titulo, 195, 22, { align: 'right' });
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    doc.text(subtitulo, 195, 28, { align: 'right' });

    doc.setDrawColor(30, 58, 138);
    doc.setLineWidth(0.8);
    doc.line(15, 38, 195, 38);

    return doc;
  };

  const adicionarRodape = (doc: jsPDF) => {
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setDrawColor(30, 58, 138); 
      doc.setLineWidth(0.5);
      doc.line(15, 280, 195, 280);
      doc.setFontSize(8);
      doc.setTextColor(100);
      doc.text(`Página ${i} de ${pageCount} - Lotaçor S.A. | Gerado a ${new Date().toLocaleDateString('pt-PT')} pelo Sistema de Economato`, 105, 285, { align: "center" });
    }
  };

  // --- 1. PDF FINANCEIRO ANUAL ---
  const gerarPDFFinanceiro = async () => {
    setExportando("pdf_fin");
    const doc = await inicializarPDF("RELATÓRIO FINANCEIRO", `ANO FISCAL: ${anoSelecionado}`);
    
    doc.setTextColor(0); doc.setFontSize(12); doc.setFont("helvetica", "bold");
    doc.text("RESUMO DE GASTOS ANUAIS", 15, 55);
    
    autoTable(doc, {
      startY: 60,
      head: [['Métrica Financeira', 'Valor Calculado']],
      body: [
        ['Total Faturado/Gasto (Saídas)', `${resumoFinanceiro.totalAno.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}`],
        ['Média de Custo Mensal', `${resumoFinanceiro.mediaMensal.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}`],
        ['Pico de Consumo (Mês)', resumoFinanceiro.mesTopo]
      ],
      theme: 'grid', headStyles: { fillColor: [30, 58, 138] }, styles: { fontSize: 10 }
    });

    doc.text("CUSTOS POR CATEGORIA", 15, (doc as any).lastAutoTable.finalY + 15);
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 20,
      head: [['Categoria de Artigos', 'Valor Total Gasto (€)']],
      body: dadosCategorias.map(d => [d.categoria, d.total.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })]),
      theme: 'striped', headStyles: { fillColor: [245, 158, 11] } // Amber
    });

    doc.text("EVOLUÇÃO MENSAL (CUSTOS)", 15, (doc as any).lastAutoTable.finalY + 15);
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 20,
      head: [['Mês', 'Gasto Total (€)']],
      body: dadosMensais.map(d => [d.mes, d.total.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })]),
      theme: 'plain', headStyles: { textColor: [0,0,0], fontStyle: 'bold' }
    });

    adicionarRodape(doc);
    window.open(doc.output('bloburl'), '_blank');
    setExportando(null);
  };

  // --- 2. PDF DE CONSUMO (SAÍDAS) ---
  const gerarPDFConsumo = async () => {
    setExportando("pdf_cons");
    const doc = await inicializarPDF("ANÁLISE DE CONSUMOS", `ANO FISCAL: ${anoSelecionado}`);
    
    doc.setTextColor(0); doc.setFontSize(12); doc.setFont("helvetica", "bold");
    doc.text(`TOTAL EXPEDIDO: ${resumoFinanceiro.totalUnidades} UNIDADES`, 15, 50);
    doc.setFontSize(10); doc.setFont("helvetica", "normal");
    doc.text("Listagem de artigos consumidos, ordenados por volume de saída.", 15, 56);

    autoTable(doc, {
      startY: 62,
      head: [['Artigo / Referência', 'Categoria', 'QTD Saída', 'Impacto Financeiro']],
      body: topSaidas.map(p => [
        p.nome.toUpperCase(), 
        p.categoria, 
        `${p.qtd} un.`, 
        p.custo.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })
      ]),
      theme: 'striped',
      headStyles: { fillColor: [30, 58, 138] },
      styles: { fontSize: 8 },
      columnStyles: { 2: { halign: 'center', fontStyle: 'bold' }, 3: { halign: 'right' } }
    });

    adicionarRodape(doc);
    window.open(doc.output('bloburl'), '_blank');
    setExportando(null);
  };

  // --- 3. PDF POSIÇÃO DE INVENTÁRIO (ATUAL) ---
  const gerarPDFInventario = async () => {
    setExportando("pdf_inv");
    const doc = await inicializarPDF("POSIÇÃO DE INVENTÁRIO", "FOTOGRAFIA ATUAL DO STOCK");
    
    const valorTotalArmazem = produtosAtuais.reduce((acc, p) => acc + (p.quantidade * (p.preco || 0)), 0);

    doc.setTextColor(0); doc.setFontSize(12); doc.setFont("helvetica", "bold");
    doc.text(`VALORIZAÇÃO DO ECONOMATO: ${valorTotalArmazem.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}`, 15, 50);
    doc.setFontSize(10); doc.setFont("helvetica", "normal");
    doc.text("Listagem completa do stock físico disponível nas instalações no momento da extração.", 15, 56);

    const categorias = Array.from(new Set(produtosAtuais.map(p => p.categoria || "Geral"))).sort();
    let currentY = 65;

    categorias.forEach((cat) => {
      const itens = produtosAtuais.filter(p => (p.categoria || "Geral") === cat);
      
      doc.setTextColor(30, 58, 138); doc.setFontSize(11); doc.setFont("helvetica", "bold");
      doc.text(cat.toUpperCase(), 15, currentY);
      
      autoTable(doc, {
        startY: currentY + 4,
        head: [['Artigo', 'Localização', 'Stock Físico', 'Custo Un.', 'Valor Total']],
        body: itens.map(p => [
          p.nome, 
          p.local, 
          p.quantidade.toString(), 
          `${(p.preco || 0).toFixed(2)}€`,
          `${(p.quantidade * (p.preco || 0)).toFixed(2)}€`
        ]),
        theme: 'plain', headStyles: { borderBottom: { color: [0,0,0], width: 0.1 } }, styles: { fontSize: 8 },
        columnStyles: { 2: { halign: 'center', fontStyle: 'bold' }, 3: { halign: 'right' }, 4: { halign: 'right', fontStyle: 'bold' } },
        didDrawPage: (data) => { currentY = data.cursor?.y || 50; }
      });
      currentY = (doc as any).lastAutoTable.finalY + 12;
    });

    adicionarRodape(doc);
    window.open(doc.output('bloburl'), '_blank');
    setExportando(null);
  };

  // --- EXCEL (RAW DATA) ---
  const descarregarExcelRaw = () => {
    const dados = todosMovimentos.filter(m => new Date(m.created_at).getFullYear() === anoSelecionado).map(m => ({
      Data: new Date(m.created_at).toLocaleDateString('pt-PT'),
      Artigo: m.produtos?.nome,
      Qtd_Saida: Math.abs(m.quantidade),
      Custo_Unitario: m.produtos?.preco || 0,
      Total_Euros: (Math.abs(m.quantidade) * (m.produtos?.preco || 0)).toFixed(2)
    }));
    
    if (dados.length === 0) return alert("Sem dados para este ano.");
    const chaves = Object.keys(dados[0]);
    const csv = [
      chaves.map(c => c.toUpperCase()).join(";"),
      ...dados.map(row => chaves.map(k => `"${row[k as keyof typeof row]?.toString().replace(/"/g, '""') || ""}"`).join(";"))
    ].join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }));
    link.download = `Dados_Brutos_Saidas_${anoSelecionado}.csv`;
    link.click();
  };

  if (aCarregar) return <div className="p-20 text-center font-black animate-pulse text-[#1e3a8a] text-xl h-screen flex items-center justify-center">A PROCESSAR INTELIGÊNCIA DE NEGÓCIO...</div>;

  const top3 = topSaidas.slice(0, 3);

  return (
    <main className="flex-1 p-8 md:p-12 overflow-y-auto h-screen bg-slate-50 w-full">
      <div className="max-w-[1400px] mx-auto">
        <header className="mb-10 flex flex-col md:flex-row justify-between md:items-end gap-6">
          <div>
            <h1 className="text-4xl font-black text-[#0f172a] uppercase italic leading-none tracking-tighter">
              Business <span className="text-[#1e3a8a]">Intelligence</span>
            </h1>
            <div className="h-1.5 w-24 bg-[#1e3a8a] rounded-full mt-3 mb-2"></div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Painel de Controlo e Relatórios Executivos</p>
          </div>
          
          <div className="flex items-center gap-3 bg-white p-2 pl-4 rounded-2xl shadow-sm border border-slate-200">
            <span className="text-[10px] font-black text-slate-400 uppercase">Analisar Ano:</span>
            <select value={anoSelecionado} onChange={e => setAnoSelecionado(Number(e.target.value))} className="font-black text-2xl text-[#1e3a8a] bg-transparent outline-none cursor-pointer">
              {anosDisponiveis.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        </header>

        {/* KPIs SUPERIORES */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="bg-[#1e3a8a] p-8 rounded-[2.5rem] shadow-lg text-white relative overflow-hidden group">
            <div className="relative z-10">
              <p className="text-[10px] font-black text-blue-300 uppercase tracking-widest mb-1">Custo Total de Operação</p>
              <p className="text-5xl font-black italic tracking-tight">{resumoFinanceiro.totalAno.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}</p>
            </div>
            <div className="absolute -right-4 -bottom-4 text-7xl opacity-[0.05] font-black rotate-12 group-hover:scale-110 transition-transform">€</div>
          </div>
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col justify-center">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Unidades Consumidas</p>
            <p className="text-4xl font-black text-[#0f172a]">{resumoFinanceiro.totalUnidades} <span className="text-sm text-slate-400">itens</span></p>
          </div>
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col justify-center">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Mês de Maior Consumo</p>
            <p className="text-4xl font-black text-amber-500 uppercase tracking-tighter">{resumoFinanceiro.mesTopo}</p>
          </div>
        </div>

        {/* GRÁFICOS VISUAIS */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 mb-12">
          <div className="xl:col-span-2 bg-white p-8 md:p-10 rounded-[3rem] shadow-sm border border-slate-100">
            <h2 className="text-lg font-black text-[#0f172a] uppercase italic mb-8">Evolução de Custos {anoSelecionado}</h2>
            <div className="h-64 flex items-end justify-between gap-1 md:gap-2">
              {dadosMensais.map((d, i) => {
                const max = Math.max(...dadosMensais.map(m => m.total));
                const height = max > 0 ? (d.total / max) * 100 : 0;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-2 group relative">
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 text-white text-[9px] font-bold px-2 py-1 rounded absolute -top-8 whitespace-nowrap pointer-events-none z-10">
                      {d.total.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}
                    </div>
                    <div className="w-full bg-slate-50 rounded-t-xl h-full relative flex items-end border border-slate-100">
                      <div style={{ height: `${height}%` }} className="w-full bg-[#1e3a8a] rounded-t-xl transition-all duration-700 group-hover:bg-amber-500"></div>
                    </div>
                    <span className="text-[9px] font-black text-slate-400 uppercase">{d.mes}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-[#0f172a] p-8 md:p-10 rounded-[3rem] shadow-lg text-white">
            <h2 className="text-lg font-black uppercase italic mb-6 text-amber-500">🔥 Top 3 Consumos</h2>
            <div className="space-y-6">
              {top3.map((item, i) => (
                <div key={i} className="relative">
                  <div className="flex justify-between items-end mb-1">
                    <span className="font-black text-sm uppercase truncate pr-4">{item.nome}</span>
                    <span className="font-black text-amber-400 text-sm shrink-0">{item.qtd} un.</span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-1.5">
                    <div className="bg-amber-500 h-1.5 rounded-full" style={{ width: `${Math.round((item.qtd / top3[0].qtd) * 100)}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CENTRAL DE RELATÓRIOS PDF */}
        <h2 className="text-xl font-black text-[#0f172a] uppercase italic mb-6">Central de Exportação</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          
          <button onClick={gerarPDFFinanceiro} disabled={exportando !== null} className="bg-white p-6 rounded-[2rem] shadow-sm border border-blue-100 hover:border-blue-500 hover:shadow-md transition-all text-left group">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform">💶</div>
            <h3 className="font-black text-sm text-[#0f172a] uppercase mb-1 group-hover:text-blue-600">Resumo Financeiro</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase">PDF • Custos Mensais e Anuais</p>
          </button>

          <button onClick={gerarPDFConsumo} disabled={exportando !== null} className="bg-white p-6 rounded-[2rem] shadow-sm border border-amber-100 hover:border-amber-500 hover:shadow-md transition-all text-left group">
            <div className="w-12 h-12 bg-amber-50 text-amber-500 rounded-xl flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform">📦</div>
            <h3 className="font-black text-sm text-[#0f172a] uppercase mb-1 group-hover:text-amber-500">Relatório de Saídas</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase">PDF • Volume de consumos</p>
          </button>

          <button onClick={gerarPDFInventario} disabled={exportando !== null} className="bg-white p-6 rounded-[2rem] shadow-sm border border-emerald-100 hover:border-emerald-500 hover:shadow-md transition-all text-left group">
            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform">🏛️</div>
            <h3 className="font-black text-sm text-[#0f172a] uppercase mb-1 group-hover:text-emerald-600">Posição de Inventário</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase">PDF • Foto atual do armazém</p>
          </button>

          <button onClick={descarregarExcelRaw} className="bg-slate-900 p-6 rounded-[2rem] shadow-sm hover:bg-slate-800 transition-all text-left group">
            <div className="w-12 h-12 bg-white/10 text-white rounded-xl flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform">📊</div>
            <h3 className="font-black text-sm text-white uppercase mb-1">Dados Brutos</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase">EXCEL • Exportação CSV (PT)</p>
          </button>

        </div>
      </div>
    </main>
  );
}