"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation"; 
import { supabase } from "@/lib/supabase";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function PedidosTickets() {
  const router = useRouter(); 
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [listaContatos, setListaContatos] = useState<any[]>([]);
  const [aCarregar, setACarregar] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  
  const [gerandoPDF, setGerandoPDF] = useState<number | null>(null);
  const [aEnviarEmail, setAEnviarEmail] = useState<number | null>(null);

  const [filtroEstado, setFiltroEstado] = useState("Todos");
  const [filtroData, setFiltroData] = useState("");

  const [formulario, setFormulario] = useState({
    quem_pede: "",          
    id_destino: "",       
    prioridade: "Normal", 
    texto_pedido: ""      
  });

  const carregarDados = async () => {
    setACarregar(true);
    
    // 1. Corrigido para 'contactos' (com C)
    const { data: conts } = await supabase.from("contactos").select("id, nome").order("nome");
    setListaContatos(conts || []);

    // 2. Corrigido o Join para 'contactos'
    const { data: peds, error } = await supabase
      .from("pedidos")
      .select(`*, contactos!contacto_id (nome)`)
      .order("created_at", { ascending: false });
    
    if (error) {
      console.error("ERRO NO SUPABASE:", error.message);
    }
    
    setPedidos(peds || []);
    setACarregar(false);
  };

  useEffect(() => { carregarDados(); }, []);

  const mudarEstado = async (id: number, novoEstado: string) => {
    const { error } = await supabase.from("pedidos").update({ estado: novoEstado }).eq("id", id);
    if (!error) carregarDados();
    else alert("Erro ao atualizar o fluxo.");
  };

  const pedidosFiltrados = pedidos.filter(p => {
    const matchEstado = filtroEstado === "Todos" || p.estado === filtroEstado;
    const matchData = !filtroData || p.created_at.includes(filtroData);
    return matchEstado && matchData;
  });

 const gerarDocumentoPDF = async (pedido: any, movimentos: any[]) => {
    const doc = new jsPDF();
    const dataHoje = new Date().toLocaleDateString('pt-PT');
    const dataPedido = new Date(pedido.created_at).toLocaleDateString('pt-PT');

    const carregarLogo = (): Promise<HTMLImageElement | null> => {
      return new Promise((resolve) => {
        const img = new Image();
        img.src = '/logo.jpg'; // Mantendo o teu caminho original
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
      });
    };

    const logoImg = await carregarLogo();
    if (logoImg) doc.addImage(logoImg, 'JPEG', 15, 12, 60, 18);

    // --- CABEÇALHO ---
    doc.setTextColor(30, 58, 138); // Azul Lotaçor
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text("Pedido", 195, 22, { align: 'right' });
    
    doc.setFontSize(10);
    doc.setTextColor(150);
    doc.text(`Nº DOCUMENTO: ${pedido.id}`, 195, 28, { align: 'right' });

    doc.setDrawColor(30, 58, 138);
    doc.setLineWidth(0.8);
    doc.line(15, 35, 195, 35);

    // --- BLOCOS DE INFORMAÇÃO (Organizados para poupar espaço) ---
    // Destino
    doc.setFillColor(248, 250, 252);
    doc.rect(15, 42, 95, 25, 'F');
    doc.setTextColor(100); doc.setFontSize(7); doc.setFont("helvetica", "bold");
    doc.text("UNIDADE DESTINATÁRIA", 20, 48);
    doc.setTextColor(0); doc.setFontSize(10);
    doc.text(pedido.contactos?.nome?.toUpperCase() || "GERAL", 20, 55);
    
    // Detalhes do Pedido
    doc.setTextColor(100); doc.setFontSize(7);
    doc.text("DATA EMISSÃO", 120, 48);
    doc.text("DATA PEDIDO", 160, 48);
    doc.text("REQUISITANTE RESPONSÁVEL", 120, 58);

    doc.setTextColor(0); doc.setFontSize(9);
    doc.text(dataHoje, 120, 53);
    doc.text(dataPedido, 160, 53);
    doc.text(pedido.requisitante?.toUpperCase() || "---", 120, 63);

    // Notas (se existirem, aparecem num espaço reduzido)
    if (pedido.observacao) {
      doc.setTextColor(100); doc.setFontSize(7);
      doc.text("OBSERVAÇÕES", 15, 74);
      doc.setTextColor(0); doc.setFontSize(8); doc.setFont("helvetica", "italic");
      doc.text(pedido.observacao, 15, 79, { maxWidth: 180 });
    }

    // --- TABELA DE ITENS (Compacta para caber tudo numa folha) ---
    const corpoTabela = await Promise.all(movimentos.map(async (m) => {
      const { data: prod } = await supabase.from("produtos").select("nome, local").eq("id", m.produto_id).single();
      return [
        prod?.nome?.toUpperCase() || "ARTIGO #" + m.produto_id,
        prod?.local || "GERAL",
        m.observacao || "---",
        Math.abs(m.quantidade || 0).toString()
      ];
    }));

    autoTable(doc, {
      startY: pedido.observacao ? 85 : 75,
      head: [['MATERIAL / ARTIGO', 'LOCALIZAÇÃO', 'NOTAS EXPEDIÇÃO', 'QTD']],
      body: corpoTabela,
      theme: 'grid',
      headStyles: { 
        fillColor: [30, 58, 138], 
        fontSize: 8, 
        cellPadding: 3,
        fontStyle: 'bold' 
      },
      styles: { 
        fontSize: 8, 
        cellPadding: 3, 
        lineColor: [230, 230, 230], 
        lineWidth: 0.1 
      },
      columnStyles: { 
        3: { halign: 'center', fontStyle: 'bold', cellWidth: 15 } 
      },
      margin: { left: 15, right: 15 }
    });

    // --- TOTAIS E ASSINATURAS ---
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    
    // Total à direita
    doc.setFontSize(10); doc.setTextColor(30, 58, 138); doc.setFont("helvetica", "bold");
    const totalQtd = movimentos.reduce((acc, curr) => acc + Math.abs(curr.quantidade || 0), 0);
    doc.text(`TOTAL DE UNIDADES: ${totalQtd}`, 195, finalY, { align: 'right' });

    // Linhas de Assinatura (Mais compactas)
    const sigY = finalY + 25;
    doc.setDrawColor(200); 
    doc.line(15, sigY, 85, sigY); 
    doc.line(125, sigY, 195, sigY);
    
    doc.setFontSize(7); doc.setTextColor(150); doc.setFont("helvetica", "normal");
    doc.text("ASSINATURA ECONOMATO", 15, sigY + 5);
    doc.text("RESPONSÁVEL RECEPÇÃO", 125, sigY + 5);

    // --- RODAPÉ FIXO ---
    const fY = 282;
    doc.setDrawColor(30, 58, 138); doc.setLineWidth(0.5); doc.line(15, fY, 195, fY);
    doc.setFontSize(7); doc.setTextColor(0); doc.setFont("helvetica", "bold");
    doc.text("LOTAÇOR S.A. - Sistema de Gestão Economato", 15, fY + 5);
    doc.setFont("helvetica", "normal"); doc.setTextColor(120);
    doc.text("Rua Eng. Abel Ferin Coutinho, 15 | 9500-191 Ponta Delgada | NIF: 512013322", 15, fY + 9);
    doc.text("economato@lotacor.pt | 296 302 580", 195, fY + 9, { align: 'right' });

    return doc;
  };

const handleEnviarEmail = async (pedido: any) => {
    setAEnviarEmail(pedido.id);
    try {
      // 1. Procurar o email do contacto
      const { data: contacto } = await supabase
        .from("contactos")
        .select("email")
        .eq("id", pedido.contacto_id)
        .single();
        
      let emailDestino = contacto?.email;

      if (!emailDestino) {
        const emailManual = prompt(`Não existe email para "${pedido.contactos?.nome}". Introduza manualmente:`);
        if (!emailManual) { 
          setAEnviarEmail(null); 
          return; 
        }
        emailDestino = emailManual;
      }

      // 2. Obter movimentos com o JOIN dos produtos para o resumo do email
      const { data: movimentos } = await supabase
        .from("movimentos")
        .select(`
          quantidade,
          produto_id,
          observacao,
          produtos (nome)
        `)
        .eq("pedido_id", pedido.id)
        .eq("tipo", "Saída");

      if (!movimentos?.length) { 
        alert("Sem movimentos para enviar."); 
        setAEnviarEmail(null); 
        return; 
      }

      // 3. Formatar itens para o corpo do email
      const itensFormatados = movimentos.map(m => ({
        nome: m.produtos?.nome || "Artigo",
        quantidade: Math.abs(m.quantidade || 0)
      }));

      // 4. Gerar o PDF
      const doc = await gerarDocumentoPDF(pedido, movimentos);
      const pdfBase64 = doc.output('datauristring').split(',')[1];

      // 5. Criar o Preheader (Resumo Rápido)
      const totalQtd = itensFormatados.reduce((acc, i) => acc + i.quantidade, 0);
      const resumoRapido = `Pedido #${pedido.id} para ${pedido.contactos?.nome || 'Unidade'}. Total: ${totalQtd} un.`;

      // 6. Enviar para a API com todos os campos necessários
      const resposta = await fetch('/api/enviar-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pedidoId: pedido.id,
          emailDestino,
          nomeUtilizador: pedido.requisitante,
          pdfAnexo: pdfBase64,
          preheader: resumoRapido,
          itens: itensFormatados // Enviando a lista para o corpo do email
        })
      });

      const resultado = await resposta.json();
      
      if (resultado.success) {
        alert(`✅ PDF enviado com sucesso para ${emailDestino}`);
      } else {
        alert("❌ Erro no envio: " + resultado.error);
      }
    } catch (err) { 
      console.error("Erro no envio:", err);
      alert("❌ Erro ao processar o envio do email."); 
    } finally { 
      setAEnviarEmail(null); 
    }
  };

  const gerarGuiaPDF = async (pedido: any) => {
    setGerandoPDF(pedido.id);
    try {
      const { data: movimentos } = await supabase.from("movimentos").select("*").eq("pedido_id", pedido.id).eq("tipo", "Saída");
      if (!movimentos?.length) { alert("Pedido sem itens processados."); return; }
      
      const doc = await gerarDocumentoPDF(pedido, movimentos);
      
      // --- LOGICA PARA MOSTRAR NA ABA E FAZER DOWNLOAD ---
      const pdfBlob = doc.output('blob');
      const url = URL.createObjectURL(pdfBlob);
      window.open(url, '_blank'); // Abre noutra aba
      doc.save(`Pedido_Lotacor_${pedido.id}.pdf`); // Faz o download
      
    } finally { setGerandoPDF(null); }
  };

  const criarTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from("pedidos").insert({
        requisitante: formulario.quem_pede,
        contacto_id: formulario.id_destino,
        tipo: formulario.prioridade,
        observacao: formulario.texto_pedido,
        estado: "Pendente"
      });
      if (error) throw error;
      setModalAberto(false);
      setFormulario({ quem_pede: "", id_destino: "", prioridade: "Normal", texto_pedido: "" });
      carregarDados();
    } catch (err) { alert("Erro ao criar pedido."); }
  };

  return (
    <main className="flex-1 p-8 md:p-12 overflow-y-auto h-screen bg-slate-50">
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-10 gap-6">
        <div>
          <h1 className="text-4xl font-black text-[#0f172a] tracking-tighter uppercase italic leading-none">
            Fluxo de <span className="text-[#1e3a8a]">Pedidos</span>
          </h1>
          <div className="h-1.5 w-24 bg-[#1e3a8a] rounded-full mt-3"></div>
        </div>

        <div className="flex flex-wrap gap-3 items-center w-full lg:w-auto">
          <input type="date" value={filtroData} onChange={e => setFiltroData(e.target.value)} className="bg-white px-4 py-2 rounded-2xl shadow-sm border border-slate-200 text-xs font-bold outline-none" />
          <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)} className="bg-white px-4 py-2 rounded-2xl shadow-sm border border-slate-200 text-xs font-bold outline-none uppercase">
            <option value="Todos">Todos os Estados</option>
            <option value="Pendente">Pendentes</option>
            <option value="Processado">Processados (FIFO)</option>
            <option value="Concluído">Entregues</option>
          </select>
          <button onClick={() => setModalAberto(true)} className="px-6 py-3 bg-[#1e3a8a] text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg">+ Novo Pedido</button>
        </div>
      </header>

      <div className="space-y-4">
        {aCarregar ? (
          <div className="text-center py-20 font-black text-slate-300 animate-pulse uppercase tracking-widest italic">Acedendo aos servidores Lotaçor...</div>
        ) : (
          pedidosFiltrados.map((p) => (
            <div key={p.id} className={`bg-white p-8 rounded-[2.5rem] shadow-sm flex flex-col md:flex-row justify-between items-center border-l-8 transition-all ${
              p.estado === 'Pendente' ? 'border-amber-400' : p.estado === 'Concluído' ? 'border-green-500' : 'border-[#1e3a8a]'
            }`}>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase ${
                    p.estado === 'Pendente' ? 'bg-amber-100 text-amber-700' : p.estado === 'Concluído' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                  }`}>● {p.estado}</span>
                  <span className="text-[10px] font-bold text-slate-300 tracking-widest">ID: #{p.id}</span>
                </div>
                <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">{p.contactos?.nome || "Unidade Destino"}</h3>
                <p className="text-xs text-slate-400 font-bold uppercase mt-1">Requisitado por: <span className="text-slate-600">{p.requisitante}</span></p>
              </div>

              <div className="flex flex-wrap gap-2 items-center">
                {p.estado === 'Pendente' && (
                  <button onClick={() => router.push(`/dashboard/pedidos/processar/${p.id}`)} className="bg-[#1e3a8a] text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase shadow-lg">Processar Pedido</button>
                )}
                {p.estado === 'Processado' && (
                  <>
                    <button onClick={() => gerarGuiaPDF(p)} className="bg-slate-100 text-slate-600 px-6 py-4 rounded-2xl font-black text-[10px] uppercase hover:bg-slate-200">🖨️ Guia</button>
                    <button onClick={() => mudarEstado(p.id, "Concluído")} className="bg-green-600 text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase shadow-lg">Entregar</button>
                  </>
                )}
                {p.estado === 'Concluído' && (
                  <>
                    <button onClick={() => gerarGuiaPDF(p)} className="bg-green-50 text-green-600 border border-green-200 px-6 py-4 rounded-2xl font-black text-[10px] uppercase hover:bg-green-100 transition-colors">🖨️ Re-imprimir</button>
                    <button onClick={() => handleEnviarEmail(p)} disabled={aEnviarEmail === p.id} className="bg-blue-50 text-blue-600 border border-blue-200 px-6 py-4 rounded-2xl font-black text-[10px] uppercase flex items-center gap-2">
                      {aEnviarEmail === p.id ? "..." : "✉️ Enviar PDF"}
                    </button>
                  </>
                )}
                <button onClick={async () => {
                   if (p.estado !== "Pendente") return alert("Apenas pedidos pendentes podem ser eliminados.");
                   if(confirm("Confirmar eliminação?")) { await supabase.from("pedidos").delete().eq("id", p.id); carregarDados(); }
                }} className="text-red-200 hover:text-red-500 text-[9px] font-black uppercase ml-4">Eliminar</button>
              </div>
            </div>
          ))
        )}
      </div>

      {modalAberto && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm flex items-center justify-center z-50 p-6 font-sans">
          <div className="bg-white rounded-[3rem] p-10 w-full max-w-lg shadow-2xl border-4 border-white animate-in zoom-in duration-200">
            <h2 className="text-2xl font-black text-[#1e3a8a] mb-6 uppercase italic tracking-tighter">Novo Pedido Economato</h2>
            <form onSubmit={criarTicket} className="space-y-4">
              <select required value={formulario.id_destino} onChange={e => setFormulario({...formulario, id_destino: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold text-sm outline-none ring-blue-500 focus:ring-2">
                <option value="">-- Selecione o Destino --</option>
                {listaContatos.map(c => <option key={c.id} value={c.id}>{c.nome.toUpperCase()}</option>)}
              </select>
              <input required type="text" value={formulario.quem_pede} onChange={e => setFormulario({...formulario, quem_pede: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold text-sm outline-none" placeholder="Quem faz a requisição?" />
              <textarea required rows={3} value={formulario.texto_pedido} onChange={e => setFormulario({...formulario, texto_pedido: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold text-sm outline-none" placeholder="Descrição dos materiais necessários..."></textarea>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setModalAberto(false)} className="flex-1 py-4 bg-slate-100 text-slate-400 rounded-2xl font-black uppercase text-[10px]">Fechar</button>
                <button type="submit" className="flex-1 py-4 bg-[#1e3a8a] text-white rounded-2xl font-black uppercase text-[10px] shadow-lg">Criar Ticket</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}