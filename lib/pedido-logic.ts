// @/lib/pedido-logic.ts
import { supabase } from "@/lib/supabase";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import toast from 'react-hot-toast';


// Adicionar ao @/lib/pedido-logic.ts

export const estornarEPagarPedido = async (pedidoId: number) => {
  const toastId = toast.loading("A reverter stock e lotes...");

  try {
    // 1. Ir buscar todos os movimentos de SAÍDA deste pedido
    const { data: movimentosSaida, error: errMovs } = await supabase
      .from("movimentos")
      .select("*")
      .eq("pedido_id", pedidoId)
      .eq("tipo", "Saída");

    if (errMovs) throw errMovs;

    // 2. Para cada produto que saiu, devolver ao stock
    if (movimentosSaida && movimentosSaida.length > 0) {
      for (const mov of movimentosSaida) {
        let qtdARepor = Math.abs(mov.quantidade);
        const produtoId = mov.produto_id;

        // A. Procurar lotes que foram consumidos (onde restante < total)
        // Ordenamos por created_at DESC para repor primeiro nos lotes que foram os últimos a ser mexidos
        const { data: lotes, error: errLotes } = await supabase
          .from("movimentos")
          .select("*")
          .eq("produto_id", produtoId)
          .in("tipo", ["Entrada", "Criação", "Edição"])
          .order("created_at", { ascending: false });

        if (lotes) {
          for (const lote of lotes) {
            if (qtdARepor <= 0) break;

            const espacoNoLote = (lote.quantidade || 0) - (lote.quantidade_restante || 0);
            if (espacoNoLote > 0) {
              const aDevolver = Math.min(qtdARepor, espacoNoLote);
              
              await supabase
                .from("movimentos")
                .update({ quantidade_restante: (lote.quantidade_restante || 0) + aDevolver })
                .eq("id", lote.id);
              
              qtdARepor -= aDevolver;
            }
          }
        }

        // B. Se ainda sobrar Qtd (ex: lotes foram apagados), criamos um lote de ajuste ou ignoramos
        // C. Atualizar o Stock Global na tabela produtos
        const { data: prodAtual } = await supabase.from("produtos").select("quantidade").eq("id", produtoId).single();
        if (prodAtual) {
          await supabase
            .from("produtos")
            .update({ quantidade: prodAtual.quantidade + Math.abs(mov.quantidade) })
            .eq("id", produtoId);
        }
      }

      // 3. Eliminar os movimentos de saída para limpar o histórico
      await supabase.from("movimentos").delete().eq("pedido_id", pedidoId).eq("tipo", "Saída");
    }

    // 4. Finalmente, eliminar o pedido
    const { error: errDelPedido } = await supabase.from("pedidos").delete().eq("id", pedidoId);
    if (errDelPedido) throw errDelPedido;

    toast.success("Pedido anulado e stock reposto!", { id: toastId });
    return true;

  } catch (error: any) {
    console.error("Erro no Estorno:", error);
    toast.error("Erro ao reverter stock.", { id: toastId });
    return false;
  }
};




// --- A TUA GUIA PDF (INTOCÁVEL) ---
export const gerarDocumentoPDF = async (pedido: any, movimentos: any[]) => {
    const doc = new jsPDF();
    const dataHoje = new Date().toLocaleDateString('pt-PT');
    const dataPedido = new Date(pedido.created_at).toLocaleDateString('pt-PT');

    const carregarLogo = (): Promise<HTMLImageElement | null> => {
      return new Promise((resolve) => {
        const img = new Image(); img.src = '/logo.jpg';
        img.onload = () => resolve(img); img.onerror = () => resolve(null);
      });
    };

    const logoImg = await carregarLogo();
    if (logoImg) doc.addImage(logoImg, 'JPEG', 15, 12, 55, 16);

    doc.setTextColor(15, 23, 42); doc.setFont("helvetica", "bold"); doc.setFontSize(28);
    doc.text("Pedido", 195, 22, { align: 'right' });
    doc.setFontSize(10); doc.setTextColor(100);
    doc.text(`DOC. INTERNO Nº ${pedido.id}`, 195, 28, { align: 'right' });

    doc.setDrawColor(30, 58, 138); doc.setLineWidth(1.5); doc.line(15, 35, 195, 35);
    doc.setFillColor(248, 250, 252); doc.roundedRect(15, 42, 90, 32, 3, 3, 'F');
    
    doc.setTextColor(100); doc.setFontSize(7); doc.setFont("helvetica", "bold");
    doc.text("Destinatário", 22, 49);
    doc.setTextColor(15, 23, 42); doc.setFontSize(11);
    doc.text(pedido.contactos?.nome?.toUpperCase() || "GERAL", 22, 57);
    doc.setFontSize(8); doc.setFont("helvetica", "normal");
    doc.text("Lotaçor - Serviço de Lotas dos Açores, S.A.", 22, 63);

    doc.setFillColor(15, 23, 42); doc.roundedRect(110, 42, 85, 32, 3, 3, 'F');
    doc.setTextColor(150, 150, 150); doc.setFontSize(7); doc.setFont("helvetica", "bold");
    doc.text("DETALHES DO REGISTO", 116, 49);
    doc.setTextColor(255, 255, 255); doc.setFontSize(8);
    doc.text(`EMISSÃO:  ${dataHoje}`, 116, 57);
    doc.text(`PEDIDO:   ${dataPedido}`, 116, 63);
    doc.text(`POR:       ${pedido.requisitante?.toUpperCase()}`, 116, 69);

    if (pedido.observacao) {
      doc.setFillColor(254, 252, 232); doc.setDrawColor(254, 240, 138); doc.roundedRect(15, 78, 180, 12, 2, 2, 'FD');
      doc.setTextColor(161, 98, 7); doc.setFontSize(7); doc.setFont("helvetica", "bold");
      doc.text("OBSERVAÇÕES DO PEDIDO:", 20, 85);
      doc.setTextColor(0); doc.setFontSize(8); doc.setFont("helvetica", "italic");
      doc.text(pedido.observacao, 58, 85, { maxWidth: 130 });
    }

    const corpoTabela = await Promise.all(movimentos.map(async (m) => {
      const { data: prod } = await supabase.from("produtos").select("nome, local").eq("id", m.produto_id).single();
      return [prod?.nome?.toUpperCase() || "ARTIGO #" + m.produto_id, prod?.local || "---", m.observacao || "---", Math.abs(m.quantidade || 0).toString()];
    }));

    autoTable(doc, {
      startY: pedido.observacao ? 95 : 82,
      head: [['MATERIAL / ARTIGO', 'LOCALIZAÇÃO', 'OBSERVAÇÕES', 'QTD']],
      body: corpoTabela,
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
      styles: { fontSize: 8, cellPadding: 4, lineColor: [220, 220, 220], lineWidth: 0.1 },
      columnStyles: { 3: { halign: 'center', fontStyle: 'bold', cellWidth: 15 } }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 12;
    doc.setFontSize(10); doc.setTextColor(30, 58, 138); doc.setFont("helvetica", "bold");
    const totalQtd = movimentos.reduce((acc, curr) => acc + Math.abs(curr.quantidade || 0), 0);
    doc.text(`TOTAL: ${totalQtd} UNIDADES`, 195, finalY, { align: 'right' });

    const sigY = finalY + 30; doc.setDrawColor(200); doc.setLineWidth(0.2);
    doc.line(15, sigY, 85, sigY); doc.line(125, sigY, 195, sigY);
    doc.setFontSize(7); doc.setTextColor(120); doc.setFont("helvetica", "bold");
    doc.text("RESPONSÁVEL ECONOMATO", 15, sigY + 5);
    doc.text("CONFIRMAÇÃO DE RECEÇÃO", 125, sigY + 5);

    const fY = 285; doc.setDrawColor(30, 58, 138); doc.setLineWidth(0.8); doc.line(15, fY, 195, fY);
    doc.setFontSize(7); doc.setTextColor(0); doc.text("LOTAÇOR S.A. | Rua Eng. Abel Ferin Coutinho, 15 | 9500-191 Ponta Delgada", 15, fY + 6);
    
    return doc;
};

// --- A TUA LÓGICA DE EMAIL (INTOCÁVEL) ---
export const enviarPedidoPorEmail = async (pedido: any, emailDestino: string, nomeOperador: string) => {
    const loadingId = toast.loading("A processar envio...");
    try {
        const { data: movimentos } = await supabase.from("movimentos").select(`quantidade, produto_id, observacao, produtos (nome)`).eq("pedido_id", pedido.id).eq("tipo", "Saída");
        if (!movimentos?.length) throw new Error("Sem movimentos.");

        const doc = await gerarDocumentoPDF(pedido, movimentos);
        const pdfBase64 = doc.output('datauristring').split(',')[1];
// Localiza o map dentro da função enviarPedidoPorEmail
const itensFormatados = movimentos.map(m => ({ 
    // Corrigimos aqui para verificar se é um array antes de aceder ao nome
    nome: Array.isArray(m.produtos) 
        ? m.produtos[0]?.nome 
        : (m.produtos as any)?.nome || "Artigo", 
    quantidade: Math.abs(m.quantidade || 0) 
}));
        const resposta = await fetch('/api/enviar-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                pedidoId: pedido.id,
                emailDestino,
                nomeUtilizador: nomeOperador,
                pdfAnexo: pdfBase64,
                itens: itensFormatados
            })
        });

        const res = await resposta.json();
        if (res.success) toast.success("E-mail enviado!", { id: loadingId });
        else throw new Error(res.error);
        return true;
    } catch (err: any) {
        toast.error("Falha: " + err.message, { id: loadingId });
        return false;
    }
};