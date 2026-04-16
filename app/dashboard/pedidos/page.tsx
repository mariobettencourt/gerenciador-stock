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

  // --- FILTROS E PESQUISA ---
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
    const { data: conts } = await supabase.from("contactos").select("id, nome").order("nome");
    setListaContatos(conts || []);

    const { data: peds } = await supabase
      .from("pedidos")
      .select(`*, contactos!contacto_id (nome)`)
      .order("created_at", { ascending: false });
    
    setPedidos(peds || []);
    setACarregar(false);
  };

  useEffect(() => { carregarDados(); }, []);

  // --- MUDANÇA DE ESTADO (CONCLUIR) ---
  const mudarEstado = async (id: number, novoEstado: string) => {
    const { error } = await supabase.from("pedidos").update({ estado: novoEstado }).eq("id", id);
    if (!error) carregarDados();
    else alert("Erro ao atualizar o fluxo.");
  };

  // --- LÓGICA DE FILTRAGEM ---
  const pedidosFiltrados = pedidos.filter(p => {
    const matchEstado = filtroEstado === "Todos" || p.estado === filtroEstado;
    const matchData = !filtroData || p.created_at.includes(filtroData);
    return matchEstado && matchData;
  });

  // --- DESIGN DA GUIA ATUALIZADO COM ASSINATURAS ---
  const gerarGuiaPDF = async (pedido: any) => {
    setGerandoPDF(pedido.id);
    
    try {
      const { data: movimentos, error: erroMov } = await supabase
        .from("movimentos")
        .select("*")
        .eq("pedido_id", pedido.id)
        .eq("tipo", "Saída");

      if (erroMov) throw erroMov;
      if (!movimentos || movimentos.length === 0) {
        alert("Este pedido ainda não tem itens processados.");
        setGerandoPDF(null);
        return;
      }

      const doc = new jsPDF();
      const dataHoje = new Date(pedido.created_at).toLocaleDateString('pt-PT');

      // --- LOGOTIPO ---
      const carregarLogo = (): Promise<HTMLImageElement | null> => {
        return new Promise((resolve) => {
          const img = new Image();
          img.src = '/logo.jpg';
          img.onload = () => resolve(img);
          img.onerror = () => resolve(null);
        });
      };

      const logoImg = await carregarLogo();
      if (logoImg) {
        doc.addImage(logoImg, 'JPEG', 15, 10, 85, 25);
      }

      // --- CABEÇALHO DIREITO ---
      doc.setTextColor(30, 58, 138); 
      doc.setFont("helvetica", "bold");
      doc.setFontSize(26);
      doc.text("Pedido", 195, 22, { align: 'right' });
      doc.setFontSize(12);
      doc.text(`nº ${pedido.id}`, 195, 28, { align: 'right' });

      doc.setDrawColor(30, 58, 138);
      doc.setLineWidth(0.8);
      doc.line(15, 38, 195, 38);

      // --- INFORMAÇÕES ---
      doc.setTextColor(100); doc.setFontSize(8); doc.setFont("helvetica", "normal");
      doc.text("PARA", 15, 48); doc.text("DATA", 145, 48);

      doc.setTextColor(0); doc.setFontSize(11); doc.setFont("helvetica", "bold");
      doc.text(pedido.contactos?.nome?.toUpperCase() || "UNIDADE DESTINO", 15, 54);
      doc.text(dataHoje, 145, 54);

      doc.setTextColor(100); doc.setFontSize(8); doc.setFont("helvetica", "normal");
      doc.text("REQUISITANTE", 15, 65);
      doc.setTextColor(0); doc.setFont("helvetica", "bold");
      doc.text(pedido.requisitante?.toUpperCase() || "---", 15, 71);

      if (pedido.observacao) {
        doc.setTextColor(100); doc.text("COMENTÁRIO", 145, 65);
        doc.setTextColor(0); doc.setFont("helvetica", "normal");
        doc.text(pedido.observacao, 145, 71, { maxWidth: 45 });
      }

      // --- TABELA ---
      const corpoTabela = await Promise.all(movimentos.map(async (m) => {
        const { data: prod } = await supabase.from("produtos").select("nome").eq("id", m.produto_id).single();
        return [
          prod?.nome?.toUpperCase() || "ARTIGO #" + m.produto_id,
          m.local || "Entreposto Ponta Delgada",
          m.observacoes || "",
          Math.abs(m.quantidade || 0).toString()
        ];
      }));

      autoTable(doc, {
        startY: 82,
        head: [['Material / Artigo', 'Local de Saída', 'Notas', 'QTD']],
        body: corpoTabela,
        theme: 'plain',
        headStyles: { textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 10, borderBottom: { color: [0, 0, 0], width: 0.1 } },
        styles: { fontSize: 9, cellPadding: 4, lineColor: [230, 230, 230], lineWidth: 0.1 },
        columnStyles: { 3: { halign: 'right', fontStyle: 'bold', cellWidth: 20 } }
      });

      // --- SOMA TOTAL ---
      const totalQtd = movimentos.reduce((acc, curr) => acc + Math.abs(curr.quantidade || 0), 0);
      const finalY = (doc as any).lastAutoTable.finalY + 12;
      doc.setFontSize(11); doc.setTextColor(30, 58, 138); doc.setFont("helvetica", "bold");
      doc.text(`TOTAL DE ITENS: ${totalQtd}`, 195, finalY, { align: 'right' });

      // --- ÁREAS DE ASSINATURA (NOVO) ---
      const sigY = finalY + 30;
      doc.setDrawColor(200);
      doc.setLineWidth(0.2);
      // Linha Esquerda (Entregue)
      doc.line(15, sigY, 90, sigY);
      // Linha Direita (Recebido)
      doc.line(120, sigY, 195, sigY);

      doc.setFontSize(8);
      doc.setTextColor(100);
      doc.setFont("helvetica", "normal");
      doc.text("ENTREGUE POR (ASSINATURA)", 15, sigY + 5);
      doc.text("RECEBIDO POR (ASSINATURA)", 120, sigY + 5);

      // --- RODAPÉ ---
      const fY = 270;
      doc.setDrawColor(30, 58, 138); doc.setLineWidth(0.5);
      doc.line(15, fY, 195, fY);
      doc.setFontSize(8); doc.setTextColor(0); doc.setFont("helvetica", "bold");
      doc.text("LOTAÇOR S.A", 15, fY + 7);
      doc.setFont("helvetica", "normal"); doc.setTextColor(100);
      doc.text("Rua Eng. Abel Ferin Coutinho, n.º 15 | Ponta Delgada | NIF: 512013322", 15, fY + 12);
      doc.text("T: 296 302 580 | economato@lotacor.pt", 140, fY + 12);

      doc.save(`Pedido_${pedido.id}.pdf`);
      window.open(doc.output('bloburl'), '_blank');

    } catch (err) {
      console.error(err);
      alert("Erro ao gerar PDF.");
    } finally {
      setGerandoPDF(null);
    }
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
    } catch (err) {
      alert("Erro ao criar pedido.");
    }
  };

  return (
    <main className="flex-1 p-8 md:p-12 overflow-y-auto h-screen bg-slate-50">
      {/* HEADER E FILTROS */}
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-10 gap-6">
        <div>
          <h1 className="text-4xl font-black text-[#0f172a] tracking-tighter uppercase italic leading-none">
            Fluxo de <span className="text-[#1e3a8a]">Pedidos</span>
          </h1>
          <div className="h-1.5 w-24 bg-[#1e3a8a] rounded-full mt-3"></div>
        </div>

        <div className="flex flex-wrap gap-3 items-center w-full lg:w-auto">
          <div className="flex bg-white px-4 py-2 rounded-2xl shadow-sm border border-slate-200 items-center">
            <span className="text-[9px] font-black text-slate-400 uppercase mr-3">Data:</span>
            <input type="date" value={filtroData} onChange={e => setFiltroData(e.target.value)} className="text-xs font-bold outline-none bg-transparent" />
          </div>
          <div className="flex bg-white px-4 py-2 rounded-2xl shadow-sm border border-slate-200 items-center">
            <span className="text-[9px] font-black text-slate-400 uppercase mr-3">Estado:</span>
            <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)} className="text-xs font-bold outline-none bg-transparent uppercase">
              <option value="Todos">Todos</option>
              <option value="Pendente">Pendentes</option>
              <option value="Processado">Processados</option>
              <option value="Concluído">Concluídos</option>
            </select>
          </div>
          <button onClick={() => setModalAberto(true)} className="px-6 py-3 bg-[#1e3a8a] text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg hover:scale-105 transition-all">+ Novo Pedido</button>
        </div>
      </header>

      {/* ESTATÍSTICAS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        {[
          { label: 'Pendentes', cor: 'border-amber-400', qtd: pedidos.filter(p => p.estado === 'Pendente').length, bg: 'text-amber-600' },
          { label: 'Aguardando Entrega', cor: 'border-blue-500', qtd: pedidos.filter(p => p.estado === 'Processado').length, bg: 'text-blue-600' },
          { label: 'Concluídos', cor: 'border-green-500', qtd: pedidos.filter(p => p.estado === 'Concluído').length, bg: 'text-green-600' }
        ].map((card, i) => (
          <div key={i} className={`bg-white p-6 rounded-[2rem] shadow-sm border-b-8 ${card.cor} flex justify-between items-end`}>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{card.label}</p>
              <p className={`text-4xl font-black ${card.bg}`}>{card.qtd}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-xl opacity-20">📊</div>
          </div>
        ))}
      </div>

      {/* LISTAGEM */}
      <div className="space-y-4">
        {aCarregar ? (
          <div className="text-center py-20 font-black text-slate-300 animate-pulse uppercase tracking-widest">Sincronizando...</div>
        ) : pedidosFiltrados.length === 0 ? (
          <div className="bg-white p-20 rounded-[3rem] text-center border-4 border-dashed border-slate-100 font-bold text-slate-300 uppercase text-xs">Nenhum pedido encontrado.</div>
        ) : (
          pedidosFiltrados.map((p) => (
            <div key={p.id} className={`bg-white p-8 rounded-[2.5rem] shadow-sm flex flex-col md:flex-row justify-between items-center border-l-8 transition-all hover:shadow-md ${
              p.estado === 'Pendente' ? 'border-amber-400' : p.estado === 'Concluído' ? 'border-green-500' : 'border-[#1e3a8a]'
            }`}>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase ${
                    p.estado === 'Pendente' ? 'bg-amber-100 text-amber-700' : p.estado === 'Concluído' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                  }`}>● {p.estado}</span>
                  <span className="text-[10px] font-bold text-slate-300 tracking-widest">REF: #{p.id}</span>
                  <span className="text-[10px] font-bold text-slate-300 italic">{new Date(p.created_at).toLocaleDateString('pt-PT')}</span>
                </div>
                <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">{p.contactos?.nome || "Unidade"}</h3>
                <p className="text-xs text-slate-400 font-bold uppercase mt-1">Requisitante: <span className="text-slate-600">{p.requisitante}</span></p>
              </div>

              <div className="flex flex-wrap gap-2 w-full md:w-auto justify-center">
                {p.estado === 'Pendente' && (
                  <button onClick={() => router.push(`/dashboard/pedidos/processar/${p.id}`)} className="bg-[#1e3a8a] text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase shadow-lg">Processar Stock</button>
                )}
                {p.estado === 'Processado' && (
                  <>
                    <button onClick={() => gerarGuiaPDF(p)} className="bg-slate-100 text-slate-600 px-6 py-4 rounded-2xl font-black text-[10px] uppercase hover:bg-slate-200">🖨️ Guia</button>
                    <button onClick={() => mudarEstado(p.id, "Concluído")} className="bg-green-600 text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase shadow-lg">Concluir Entrega</button>
                  </>
                )}
                {p.estado === 'Concluído' && (
                  <button onClick={() => gerarGuiaPDF(p)} className="bg-green-50 text-green-600 border border-green-200 px-8 py-4 rounded-2xl font-black text-[10px] uppercase italic">🖨️ Re-imprimir</button>
                )}
                <button onClick={async () => { if(confirm("Apagar?")) { await supabase.from("pedidos").delete().eq("id", p.id); carregarDados(); } }} className="text-red-200 hover:text-red-500 text-[9px] font-black uppercase ml-4 transition-colors">Eliminar</button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* MODAL NOVO PEDIDO */}
      {modalAberto && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm flex items-center justify-center z-50 p-6">
          <div className="bg-white rounded-[3rem] p-10 w-full max-w-lg shadow-2xl border-4 border-white">
            <h2 className="text-2xl font-black text-[#1e3a8a] mb-6 uppercase italic tracking-tighter">Novo Pedido Economato</h2>
            <form onSubmit={criarTicket} className="space-y-4">
              <select required value={formulario.id_destino} onChange={e => setFormulario({...formulario, id_destino: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold text-sm focus:ring-2 ring-blue-500">
                <option value="">-- Unidade de Destino --</option>
                {listaContatos.map(c => <option key={c.id} value={c.id}>{c.nome.toUpperCase()}</option>)}
              </select>
              <input required type="text" value={formulario.quem_pede} onChange={e => setFormulario({...formulario, quem_pede: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold text-sm" placeholder="Nome do Requisitante" />
              <textarea required rows={3} value={formulario.texto_pedido} onChange={e => setFormulario({...formulario, texto_pedido: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold text-sm" placeholder="O que é necessário?"></textarea>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setModalAberto(false)} className="flex-1 py-4 bg-slate-100 text-slate-400 rounded-2xl font-black uppercase text-[10px]">Cancelar</button>
                <button type="submit" className="flex-1 py-4 bg-[#1e3a8a] text-white rounded-2xl font-black uppercase text-[10px] shadow-lg">Emitir</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}