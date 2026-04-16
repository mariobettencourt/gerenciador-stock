"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function NecessidadesReposicao() {
  const [aCarregar, setACarregar] = useState(true);
  const [dadosNecessidades, setDadosNecessidades] = useState<any[]>([]);
  const [totalArtigos, setTotalArtigos] = useState(0);

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    const { data: produtos } = await supabase.from("produtos").select("*").order("categoria");
    if (produtos) {
      const emFalta = produtos.filter(p => (p.quantidade || 0) <= (p.stock_minimo || 5));
      setDadosNecessidades(emFalta);
      setTotalArtigos(emFalta.length);
    }
    setACarregar(false);
  };

  const gerarPDFProfissional = () => {
    const doc = new jsPDF();
    const dataHoje = new Date().toLocaleDateString('pt-PT');

    // 1. CABEÇALHO DO PDF
    doc.setFillColor(30, 58, 138); // Azul Lotaçor (#1e3a8a)
    doc.rect(0, 0, 210, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text("GUIA DE REPOSIÇÃO", 15, 22);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("ECONOMATO INTERNO - LOTAÇOR", 15, 30);
    doc.text(`DATA: ${dataHoje}`, 160, 30);

    // 2. AGRUPAR E GERAR TABELAS POR CATEGORIA
    const categorias = Array.from(new Set(dadosNecessidades.map(p => p.categoria || "Geral"))).sort();
    let currentY = 50;

    categorias.forEach((cat) => {
      const itensDaCategoria = dadosNecessidades.filter(p => (p.categoria || "Geral") === cat);

      // Título da Categoria
      doc.setTextColor(30, 58, 138);
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text(cat.toUpperCase(), 15, currentY);
      
      // Tabela da Categoria
      autoTable(doc, {
        startY: currentY + 5,
        head: [['Artigo', 'Localização', 'Stock Atual', 'Min.', 'Pedir']],
        body: itensDaCategoria.map(p => [
          p.nome, 
          p.local, 
          p.quantidade.toString(), 
          (p.stock_minimo || 5).toString(),
          "" // Espaço em branco para o FileDoc
        ]),
        theme: 'striped',
        headStyles: { fillStyle: 'f', fillColor: [245, 158, 11], textColor: [15, 23, 42] }, // Âmbar
        styles: { fontSize: 9, cellPadding: 3 },
        margin: { left: 15, right: 15 },
        didDrawPage: (data) => {
          currentY = data.cursor?.y || 50;
        }
      });

      currentY += 15; // Espaço entre categorias
    });

    // 3. RODAPÉ
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`Página ${i} de ${pageCount} - Gerado automaticamente pelo Sistema de Economato Lotaçor`, 105, 285, { align: "center" });
    }

    doc.save(`Necessidades_Reposicao_${dataHoje.replace(/\//g, '-')}.pdf`);
  };

  if (aCarregar) return <div className="p-12 text-center text-amber-500 font-black uppercase animate-pulse">A analisar inventário...</div>;

  return (
    <main className="flex-1 p-12 overflow-y-auto h-screen relative">
      <header className="mb-12 flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-black text-[#0f172a] uppercase italic leading-none tracking-tighter">
            Necessidades de <span className="text-amber-500">Reposição</span>
          </h1>
          <div className="h-1.5 w-24 bg-amber-500 rounded-full mt-3 mb-2"></div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Preparação de dados para requisição</p>
        </div>
        
        <button 
          onClick={gerarPDFProfissional} disabled={totalArtigos === 0}
          className="px-8 py-4 bg-[#1e3a8a] text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl hover:bg-blue-800 transition-all flex items-center gap-3 disabled:opacity-50"
        >
          <span>📄</span> Descarregar PDF de Encomenda
        </button>
      </header>

      <div className="grid grid-cols-1 gap-6">
        {totalArtigos === 0 ? (
          <div className="bg-white rounded-[3rem] p-20 text-center shadow-xl">
             <p className="text-gray-300 font-black uppercase tracking-widest">Tudo em conformidade. Não há artigos abaixo do stock mínimo.</p>
          </div>
        ) : (
          <div className="bg-white rounded-[3rem] p-10 shadow-2xl">
            <p className="mb-6 text-xs font-bold text-amber-600 uppercase">Foram detetados {totalArtigos} artigos com necessidade de reposição:</p>
            <div className="space-y-4">
               {dadosNecessidades.map(p => (
                 <div key={p.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl border border-gray-100">
                    <div>
                      <p className="font-black text-sm uppercase text-[#0f172a]">{p.nome}</p>
                      <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">{p.categoria} • Local: {p.local}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] font-black text-red-500 uppercase">Stock: {p.quantidade}</p>
                      <p className="text-[9px] font-black text-gray-400 uppercase">Mínimo: {p.stock_minimo || 5}</p>
                    </div>
                 </div>
               ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}