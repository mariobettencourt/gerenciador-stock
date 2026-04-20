"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useRouter } from "next/navigation";

export default function NecessidadesReposicao() {
  const router = useRouter();
  const [aCarregar, setACarregar] = useState(true);
  const [dadosNecessidades, setDadosNecessidades] = useState<any[]>([]);
  const [totalArtigos, setTotalArtigos] = useState(0);

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    const { data: produtos } = await supabase.from("produtos").select("*").order("categoria");
    if (produtos) {
      // Filtra apenas os que têm a quantidade abaixo ou igual ao stock mínimo
      const emFalta = produtos.filter(p => (p.quantidade || 0) <= (p.stock_minimo || 5));
      setDadosNecessidades(emFalta);
      setTotalArtigos(emFalta.length);
    }
    setACarregar(false);
  };

  // --- LÓGICA DO PDF PROFISSIONAL COM LOGÓTIPO ---
  const gerarPDFProfissional = async () => {
    const doc = new jsPDF();
    const dataHoje = new Date().toLocaleDateString('pt-PT');

    // 1. CARREGAR LOGÓTIPO
    const carregarLogo = (): Promise<HTMLImageElement | null> => {
      return new Promise((resolve) => {
        const img = new Image();
        img.src = '/logo.jpg'; // Certifica-te que o logo está na pasta public
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
      });
    };

    const logoImg = await carregarLogo();
    if (logoImg) {
      doc.addImage(logoImg, 'JPEG', 15, 10, 85, 25);
    }

    // 2. CABEÇALHO DIREITO
    doc.setTextColor(30, 58, 138); 
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text("LISTA DE REPOSIÇÃO", 195, 22, { align: 'right' });
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    doc.text(`GERADO A: ${dataHoje}`, 195, 28, { align: 'right' });

    // Linha separadora
    doc.setDrawColor(30, 58, 138);
    doc.setLineWidth(0.8);
    doc.line(15, 38, 195, 38);

    // 3. AGRUPAR E GERAR TABELAS POR CATEGORIA
    const categorias = Array.from(new Set(dadosNecessidades.map(p => p.categoria || "Geral"))).sort();
    let currentY = 50;

    categorias.forEach((cat) => {
      const itensDaCategoria = dadosNecessidades.filter(p => (p.categoria || "Geral") === cat);

      // Título da Categoria
      doc.setTextColor(30, 58, 138);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(cat.toUpperCase(), 15, currentY);
      
      // Tabela da Categoria
      autoTable(doc, {
        startY: currentY + 4,
        head: [['Artigo / Referência', 'Localização', 'Stock', 'Mínimo', 'A Encomendar']],
        body: itensDaCategoria.map(p => [
          p.nome.toUpperCase(), 
          p.local, 
          p.quantidade.toString(), 
          (p.stock_minimo || 5).toString(),
          "" // Espaço em branco para a pessoa escrever à mão
        ]),
        theme: 'plain',
        headStyles: { textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 9, borderBottom: { color: [0, 0, 0], width: 0.1 } },
        styles: { fontSize: 8, cellPadding: 3, lineColor: [230, 230, 230], lineWidth: 0.1 },
        columnStyles: { 
          2: { halign: 'center', fontStyle: 'bold', textColor: [220, 38, 38] }, // Stock atual em vermelho
          3: { halign: 'center' },
          4: { cellWidth: 35 } // Coluna de preencher maior
        },
        didDrawPage: (data) => {
          currentY = data.cursor?.y || 50;
        }
      });

      currentY += 12; // Espaço entre categorias
    });

    // 4. RODAPÉ
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setDrawColor(30, 58, 138); 
      doc.setLineWidth(0.5);
      doc.line(15, 280, 195, 280);
      doc.setFontSize(8);
      doc.setTextColor(100);
      doc.setFont("helvetica", "normal");
      doc.text(`Página ${i} de ${pageCount} - Documento de apoio interno ao Economato Lotaçor S.A.`, 105, 285, { align: "center" });
    }

    // Abre o PDF num novo separador em vez de apenas fazer download (Pronto a Imprimir!)
    window.open(doc.output('bloburl'), '_blank');
  };

  if (aCarregar) return (
    <div className="p-12 text-center text-red-500 font-black uppercase animate-pulse h-screen flex flex-col items-center justify-center bg-slate-50">
      <span className="text-4xl mb-4">🔍</span>
      A analisar falhas no inventário...
    </div>
  );

  return (
    <main className="flex-1 p-8 md:p-12 overflow-y-auto h-screen bg-slate-50 w-full">
      <div className="max-w-5xl mx-auto">
        
        <header className="mb-10 flex flex-col md:flex-row justify-between md:items-end gap-6">
          <div>
            <button onClick={() => router.push("/dashboard")} className="text-slate-400 hover:text-[#1e3a8a] transition-colors text-[10px] font-black uppercase tracking-widest flex items-center gap-2 mb-4">
              ← Voltar ao Centro de Comando
            </button>
            <h1 className="text-4xl font-black text-[#0f172a] uppercase italic leading-none tracking-tighter">
              Necessidades de <span className="text-red-500">Reposição</span>
            </h1>
            <div className="h-1.5 w-24 bg-red-500 rounded-full mt-3 mb-2"></div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Preparação de lista de compras / encomendas</p>
          </div>
          
          <button 
            onClick={gerarPDFProfissional} 
            disabled={totalArtigos === 0}
            className="w-full md:w-auto px-8 py-4 bg-red-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-red-600/20 hover:bg-red-700 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="text-lg leading-none">🖨️</span> Imprimir Lista de Faltas
          </button>
        </header>

        <div className="grid grid-cols-1 gap-6">
          {totalArtigos === 0 ? (
            <div className="bg-white rounded-[3rem] p-20 text-center shadow-sm border border-slate-100 flex flex-col items-center">
              <span className="text-6xl mb-4 opacity-50">🛡️</span>
              <p className="text-[#0f172a] font-black text-xl uppercase italic tracking-tighter mb-2">Inventário Controlado</p>
              <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Não existem artigos abaixo do stock mínimo definido.</p>
            </div>
          ) : (
            <div className="bg-white rounded-[2.5rem] p-8 md:p-10 shadow-sm border border-slate-100">
              <div className="flex items-center gap-3 mb-8">
                <span className="animate-ping w-2.5 h-2.5 bg-red-500 rounded-full"></span>
                <p className="text-xs font-black text-red-500 uppercase tracking-widest">
                  {totalArtigos} {totalArtigos === 1 ? 'Artigo necessita' : 'Artigos necessitam'} de reposição urgente
                </p>
              </div>
              
              <div className="space-y-3">
                 {dadosNecessidades.map(p => (
                   <div key={p.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-5 bg-slate-50/50 hover:bg-white rounded-2xl border border-slate-100 hover:shadow-md transition-all gap-4 group">
                     <div>
                       <p className="font-black text-sm uppercase text-[#0f172a] group-hover:text-red-600 transition-colors">{p.nome}</p>
                       <div className="flex gap-4 mt-1">
                         <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest flex items-center gap-1">
                           <span className="opacity-50">📂</span> {p.categoria || 'Geral'}
                         </p>
                         <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest flex items-center gap-1">
                           <span className="opacity-50">📍</span> {p.local}
                         </p>
                       </div>
                     </div>
                     <div className="flex items-center gap-6 bg-white sm:bg-transparent p-3 sm:p-0 rounded-xl sm:rounded-none border sm:border-none border-slate-100">
                       <div className="text-center sm:text-right flex-1 sm:flex-auto border-r sm:border-r-0 border-slate-100 pr-4 sm:pr-0">
                         <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Mínimo</p>
                         <p className="text-sm font-black text-slate-600">{p.stock_minimo || 5}</p>
                       </div>
                       <div className="text-center sm:text-right flex-1 sm:flex-auto">
                         <p className="text-[9px] font-black text-red-500 uppercase tracking-widest mb-0.5">Stock Atual</p>
                         <p className="text-2xl font-black text-red-500 leading-none">{p.quantidade}</p>
                       </div>
                     </div>
                   </div>
                 ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}