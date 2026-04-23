"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation"; 
import { supabase } from "@/lib/supabase";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import toast, { Toaster } from 'react-hot-toast';

export default function PedidosTickets() {
  const router = useRouter(); 
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [listaContatos, setListaContatos] = useState<any[]>([]);
  const [aCarregar, setACarregar] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  
  const [modalEmail, setModalEmail] = useState<{ aberto: boolean; pedido: any }>({ aberto: false, pedido: null });
  const [modalEliminar, setModalEliminar] = useState<{ aberto: boolean; id: number | null }>({ aberto: false, id: null });
  const [emailInput, setEmailInput] = useState("");
  
  const [gerandoPDF, setGerandoPDF] = useState<number | null>(null);
  const [aEnviarEmail, setAEnviarEmail] = useState<number | null>(null);

  const [filtroEstado, setFiltroEstado] = useState("Todos");
  const [filtroData, setFiltroData] = useState("");

  // --- NOVO ESTADO: Guarda o nome de quem está a usar o sistema ---
  const [nomeOperador, setNomeOperador] = useState("Sistema"); 

  const [formulario, setFormulario] = useState({
    quem_pede: "",          
    id_destino: "",       
    prioridade: "Normal", 
    texto_pedido: ""      
  });

  // --- NOVA FUNÇÃO: Vai buscar o utilizador autenticado ao Supabase ---
  const carregarSessao = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        // Tenta ir buscar o nome à tabela de perfis (caso a tenhas)
        const { data: perfil } = await supabase.from('perfis').select('nome').eq('id', user.id).single();
        
        if (perfil?.nome) {
          setNomeOperador(perfil.nome);
        } else if (user.user_metadata?.nome) {
          // Se não houver tabela perfis, tenta ler dos metadados do login
          setNomeOperador(user.user_metadata.nome);
        } else {
          // Em último caso, usa o email sem o domínio (ex: mario.bettencourt@lotacor.pt -> mario.bettencourt)
          setNomeOperador(user.email?.split('@')[0] || "Operador Logado");
        }
      }
    } catch (error) {
      console.error("Erro ao verificar sessão ativa:", error);
    }
  };

  // --- ATUALIZADO: Agora usa o nomeOperador dinâmico ---
  const registarLog = async (pedidoId: number | null, acao: string, detalhes: string) => {
    try {
      await supabase.from('logs_pedidos').insert({
        pedido_id: pedidoId,
        acao: acao,
        detalhes: detalhes,
        utilizador: nomeOperador // <--- A MAGIA ACONTECE AQUI
      });
    } catch (e) {
      console.error("Aviso: Falha ao registar log de auditoria.", e);
    }
  };

  const carregarDados = async () => {
    setACarregar(true);
    
    const { data: conts } = await supabase.from("contactos").select("id, nome").order("nome");
    setListaContatos(conts || []);

    const { data: peds, error } = await supabase
      .from("pedidos")
      .select(`*, contactos!contacto_id (nome)`)
      .order("created_at", { ascending: false });
    
    if (error) console.error("ERRO NO SUPABASE:", error.message);
    
    setPedidos(peds || []);
    setACarregar(false);
  };

  // Carrega os dados E a sessão assim que a página abre
  useEffect(() => { 
    carregarSessao();
    carregarDados(); 
  }, []);

  const mudarEstado = async (id: number, novoEstado: string) => {
    const { error } = await supabase.from("pedidos").update({ estado: novoEstado }).eq("id", id);
    if (!error) {
      toast.success(`Estado atualizado para: ${novoEstado}`);
      await registarLog(id, "ALTERAÇÃO DE ESTADO", `Documento passou para ${novoEstado}`);
      carregarDados();
    } else {
      toast.error("Erro ao atualizar o fluxo.");
    }
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
        img.src = '/logo.jpg';
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
      });
    };

    const logoImg = await carregarLogo();
    
    if (logoImg) doc.addImage(logoImg, 'JPEG', 15, 12, 55, 16);

    doc.setTextColor(15, 23, 42); 
    doc.setFont("helvetica", "bold");
    doc.setFontSize(28);
    doc.italic;
    doc.text("Pedido", 195, 22, { align: 'right' });
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`DOC. INTERNO Nº ${pedido.id}`, 195, 28, { align: 'right' });

    doc.setDrawColor(30, 58, 138);
    doc.setLineWidth(1.5);
    doc.line(15, 35, 195, 35);
    
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(15, 42, 90, 32, 3, 3, 'F');
    
    doc.setTextColor(100); doc.setFontSize(7); doc.setFont("helvetica", "bold");
    doc.text("Destinatário", 22, 49);
    doc.setTextColor(15, 23, 42); doc.setFontSize(11);
    doc.text(pedido.contactos?.nome?.toUpperCase() || "GERAL", 22, 57);
    doc.setFontSize(8); doc.setFont("helvetica", "normal");
    doc.text("Lotaçor - Serviço de Lotas dos Açores, S.A.", 22, 63);

    doc.setFillColor(15, 23, 42);
    doc.roundedRect(110, 42, 85, 32, 3, 3, 'F');
    
    doc.setTextColor(150, 150, 150); doc.setFontSize(7); doc.setFont("helvetica", "bold");
    doc.text("DETALHES DO REGISTO", 116, 49);
    
    doc.setTextColor(255, 255, 255); doc.setFontSize(8);
    doc.text(`EMISSÃO:  ${dataHoje}`, 116, 57);
    doc.text(`PEDIDO:   ${dataPedido}`, 116, 63);
    doc.text(`POR:      ${pedido.requisitante?.toUpperCase()}`, 116, 69);

    if (pedido.observacao) {
      doc.setFillColor(254, 252, 232);
      doc.setDrawColor(254, 240, 138);
      doc.roundedRect(15, 78, 180, 12, 2, 2, 'FD');
      doc.setTextColor(161, 98, 7); doc.setFontSize(7); doc.setFont("helvetica", "bold");
      doc.text("OBSERVAÇÕES DO PEDIDO:", 20, 85);
      doc.setTextColor(0); doc.setFontSize(8); doc.setFont("helvetica", "italic");
      doc.text(pedido.observacao, 58, 85, { maxWidth: 130 });
    }

    const corpoTabela = await Promise.all(movimentos.map(async (m) => {
      const { data: prod } = await supabase.from("produtos").select("nome, local").eq("id", m.produto_id).single();
      return [
        prod?.nome?.toUpperCase() || "ARTIGO #" + m.produto_id,
        prod?.local || "---",
        m.observacao || "---",
        Math.abs(m.quantidade || 0).toString(),
        "[  ]" 
      ];
    }));

    autoTable(doc, {
      startY: pedido.observacao ? 95 : 82,
      head: [['MATERIAL / ARTIGO', 'LOCALIZAÇÃO', 'OBSERVAÇÕES', 'QTD', 'CONF.']],
      body: corpoTabela,
      theme: 'grid',
      headStyles: { 
        fillColor: [15, 23, 42], 
        textColor: [255, 255, 255],
        fontSize: 8, 
        fontStyle: 'bold',
        halign: 'left'
      },
      styles: { 
        fontSize: 8, 
        cellPadding: 4, 
        lineColor: [220, 220, 220], 
        lineWidth: 0.1 
      },
      columnStyles: { 
        3: { halign: 'center', fontStyle: 'bold', cellWidth: 15 },
        4: { halign: 'center', cellWidth: 15 } 
      }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 12;
    
    doc.setFontSize(10); doc.setTextColor(30, 58, 138); doc.setFont("helvetica", "bold");
    const totalQtd = movimentos.reduce((acc, curr) => acc + Math.abs(curr.quantidade || 0), 0);
    doc.text(`TOTAL: ${totalQtd} UNIDADES`, 195, finalY, { align: 'right' });

    const sigY = finalY + 30;
    doc.setDrawColor(200); doc.setLineWidth(0.2);
    doc.line(15, sigY, 85, sigY); doc.line(125, sigY, 195, sigY);
    
    doc.setFontSize(7); doc.setTextColor(120); doc.setFont("helvetica", "bold");
    doc.text("RESPONSÁVEL ECONOMATO", 15, sigY + 5);
    doc.text("CONFIRMAÇÃO DE RECEÇÃO", 125, sigY + 5);

    const fY = 285;
    doc.setDrawColor(30, 58, 138); doc.setLineWidth(0.8); doc.line(15, fY, 195, fY);
    doc.setFontSize(7); doc.setTextColor(0); doc.setFont("helvetica", "bold");
    doc.text("LOTAÇOR S.A.", 15, fY + 6);
    doc.setFont("helvetica", "normal"); doc.setTextColor(120);
    doc.text("Rua Eng. Abel Ferin Coutinho, 15 | 9500-191 Ponta Delgada", 15, fY + 10);
    doc.text("economato@lotacor.pt | 296 302 580", 195, fY + 10, { align: 'right' });

    return doc;
  };

  const iniciarEnvioEmail = async (pedido: any) => {
    setAEnviarEmail(pedido.id);
    const { data: contacto } = await supabase.from("contactos").select("email").eq("id", pedido.contacto_id).single();
    
    if (contacto?.email) {
      processarEnvioEmail(pedido, contacto.email);
    } else {
      setModalEmail({ aberto: true, pedido: pedido });
      setEmailInput("");
      setAEnviarEmail(null);
    }
  };

  const processarEnvioEmail = async (pedido: any, emailDestino: string) => {
    setAEnviarEmail(pedido.id);
    const loadingId = toast.loading("A enviar documento...");
    
    try {
      const { data: movimentos } = await supabase
        .from("movimentos")
        .select(`quantidade, produto_id, observacao, produtos (nome)`)
        .eq("pedido_id", pedido.id)
        .eq("tipo", "Saída");

      if (!movimentos?.length) { 
        toast.error("Sem movimentos para enviar.", { id: loadingId }); 
        setAEnviarEmail(null); 
        return; 
      }

      const itensFormatados = movimentos.map(m => ({
        nome: m.produtos?.nome || "Artigo",
        quantidade: Math.abs(m.quantidade || 0)
      }));

      const doc = await gerarDocumentoPDF(pedido, movimentos);
      const pdfBase64 = doc.output('datauristring').split(',')[1];

      const totalQtd = itensFormatados.reduce((acc, i) => acc + i.quantidade, 0);
      const resumoRapido = `Pedido #${pedido.id} para ${pedido.contactos?.nome || 'Unidade'}. Total: ${totalQtd} un.`;

      const resposta = await fetch('/api/enviar-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pedidoId: pedido.id,
          emailDestino,
          nomeUtilizador: pedido.requisitante,
          pdfAnexo: pdfBase64,
          preheader: resumoRapido,
          itens: itensFormatados
        })
      });

      const resultado = await resposta.json();
      
      if (resultado.success) {
        toast.success(`PDF enviado com sucesso para ${emailDestino}`, { id: loadingId });
        await registarLog(pedido.id, "ENVIO DE EMAIL", `Cópia digital enviada para ${emailDestino}`);
        setModalEmail({ aberto: false, pedido: null });
      } else {
        toast.error("Erro no envio: " + resultado.error, { id: loadingId });
      }
    } catch (err) { 
      console.error("Erro no envio:", err);
      toast.error("Erro ao processar o envio do email.", { id: loadingId }); 
    } finally { 
      setAEnviarEmail(null); 
    }
  };

  const gerarGuiaPDF = async (pedido: any) => {
    setGerandoPDF(pedido.id);
    try {
      const { data: movimentos } = await supabase.from("movimentos").select("*").eq("pedido_id", pedido.id).eq("tipo", "Saída");
      if (!movimentos?.length) { 
        toast.error("Pedido sem itens processados."); 
        return; 
      }
      
      const doc = await gerarDocumentoPDF(pedido, movimentos);
      
      const pdfBlob = doc.output('blob');
      const url = URL.createObjectURL(pdfBlob);
      window.open(url, '_blank'); 
      doc.save(`Pedido_Lotacor_${pedido.id}.pdf`);
      
      await registarLog(pedido.id, "RE-IMPRESSÃO", "Documento PDF gerado pelo sistema");
      toast.success("Guia gerada com sucesso!");
    } finally { setGerandoPDF(null); }
  };

  const criarTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data, error } = await supabase.from("pedidos").insert({
        requisitante: formulario.quem_pede,
        contacto_id: formulario.id_destino,
        tipo: formulario.prioridade,
        observacao: formulario.texto_pedido,
        estado: "Pendente"
      }).select().single();
      
      if (error) throw error;
      
      await registarLog(data.id, "CRIADO", `Novo ticket aberto por ${formulario.quem_pede}`);
      toast.success("Pedido criado com sucesso!");
      setModalAberto(false);
      setFormulario({ quem_pede: "", id_destino: "", prioridade: "Normal", texto_pedido: "" });
      carregarDados();
    } catch (err) { toast.error("Erro ao criar pedido."); }
  };

  const confirmarApagarPedido = async () => {
    if (!modalEliminar.id) return;
    
    await registarLog(modalEliminar.id, "ELIMINADO", "O registo do pedido foi destruído.");
    
    const { error } = await supabase.from("pedidos").delete().eq("id", modalEliminar.id);
    if (!error) {
      toast.success("Pedido eliminado da base de dados.");
      carregarDados();
    } else {
      toast.error("Erro ao eliminar o pedido.");
    }
    setModalEliminar({ aberto: false, id: null });
  };

  return (
    <main className="flex-1 p-8 md:p-12 overflow-y-auto h-screen bg-slate-50 relative">
      <Toaster position="top-center" reverseOrder={false} toastOptions={{ duration: 3000, style: { background: '#1e293b', color: '#fff', borderRadius: '1rem', fontSize: '12px', fontWeight: 'bold' } }} />

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
                <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">{p.contactos?.nome || "Destinatário: "}</h3>
                <p className="text-xs text-slate-400 font-bold uppercase mt-1">Requisitado por: <span className="text-slate-600">{p.requisitante}</span></p>
              </div>

              <div className="flex flex-wrap gap-2 items-center">
                {p.estado === 'Pendente' && (
                  <button onClick={() => router.push(`/dashboard/pedidos/processar/${p.id}`)} className="bg-[#1e3a8a] text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase shadow-lg">Processar Pedido</button>
                )}
                {p.estado === 'Processado' && (
                  <>
                    <button onClick={() => gerarGuiaPDF(p)} disabled={gerandoPDF === p.id} className="bg-slate-100 text-slate-600 px-6 py-4 rounded-2xl font-black text-[10px] uppercase hover:bg-slate-200">🖨️ Guia</button>
                    <button onClick={() => mudarEstado(p.id, "Concluído")} className="bg-green-600 text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase shadow-lg">Entregar</button>
                  </>
                )}
                {p.estado === 'Concluído' && (
                  <>
                    <button onClick={() => gerarGuiaPDF(p)} disabled={gerandoPDF === p.id} className="bg-green-50 text-green-600 border border-green-200 px-6 py-4 rounded-2xl font-black text-[10px] uppercase hover:bg-green-100 transition-colors">🖨️ Re-imprimir</button>
                    <button onClick={() => iniciarEnvioEmail(p)} disabled={aEnviarEmail === p.id} className="bg-blue-50 text-blue-600 border border-blue-200 px-6 py-4 rounded-2xl font-black text-[10px] uppercase flex items-center gap-2">
                      {aEnviarEmail === p.id ? "..." : "✉️ Enviar PDF"}
                    </button>
                  </>
                )}
                <button onClick={() => { 
                   if (p.estado !== "Pendente") return toast.error("Apenas pedidos pendentes podem ser eliminados.");
                   setModalEliminar({ aberto: true, id: p.id });
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

      {modalEmail.aberto && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm flex items-center justify-center z-50 p-6 font-sans">
          <div className="bg-white rounded-[3rem] p-10 w-full max-w-md shadow-2xl border-4 border-white animate-in zoom-in duration-200">
            <h2 className="text-2xl font-black text-[#1e3a8a] mb-2 uppercase italic tracking-tighter">Email em Falta</h2>
            <p className="text-xs text-slate-500 font-bold mb-6">Insira o email para <strong>{modalEmail.pedido?.contactos?.nome}</strong></p>
            <div className="space-y-4">
              <input type="email" required autoFocus value={emailInput} onChange={e => setEmailInput(e.target.value)} className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold text-sm outline-none ring-blue-500 focus:ring-2" placeholder="exemplo@lotacor.pt" />
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setModalEmail({ aberto: false, pedido: null })} className="flex-1 py-4 bg-slate-100 text-slate-400 rounded-2xl font-black uppercase text-[10px]">Cancelar</button>
                <button onClick={() => { if(emailInput) processarEnvioEmail(modalEmail.pedido, emailInput); }} className="flex-1 py-4 bg-[#1e3a8a] text-white rounded-2xl font-black uppercase text-[10px] shadow-lg">Enviar PDF</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {modalEliminar.aberto && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm flex items-center justify-center z-50 p-6 font-sans">
          <div className="bg-white rounded-[3rem] p-10 w-full max-w-md shadow-2xl border-4 border-white animate-in zoom-in duration-200 text-center">
            <h2 className="text-2xl font-black text-red-600 mb-2 uppercase italic tracking-tighter">Eliminar Pedido</h2>
            <p className="text-xs text-slate-500 font-bold mb-6">Tem a certeza que deseja eliminar o pedido #{modalEliminar.id}? Esta ação é irreversível.</p>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setModalEliminar({ aberto: false, id: null })} className="flex-1 py-4 bg-slate-100 text-slate-400 rounded-2xl font-black uppercase text-[10px]">Cancelar</button>
              <button onClick={confirmarApagarPedido} className="flex-1 py-4 bg-red-600 text-white rounded-2xl font-black uppercase text-[10px] shadow-lg">Sim, Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}