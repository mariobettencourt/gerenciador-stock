"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function GuiaTransportePDF() {
  const { id } = useParams();
  const router = useRouter();
  
  const [pedido, setPedido] = useState<any>(null);
  const [itens, setItens] = useState<any[]>([]);
  const [aCarregar, setACarregar] = useState(true);

  useEffect(() => {
    const carregarGuia = async () => {
      // 1. Carrega os dados gerais do pedido
      const { data: ped } = await supabase
        .from("pedidos")
        .select(`*, contatos!contacto_id (*)`)
        .eq("id", id)
        .single();

      if (ped) {
        setPedido(ped);
        
        // 2. FORÇAMOS O ID A SER UM NÚMERO (parseInt)
        const idNumerico = parseInt(id as string);

        const { data: itensDB, error } = await supabase
          .from("movimentos")
          .select(`
            quantidade,
            observacao,
            produtos (nome, local)
          `)
          .eq("pedido_id", idNumerico); 

        if (error) {
          // SE A GUIA FALHAR, ELA VAI AVISAR-TE NO ECRÃ
          alert("Erro ao ler artigos da Guia: " + error.message);
        }

        if (itensDB && itensDB.length > 0) {
          const itensFormatados = itensDB.map((item: any, index: number) => ({
            id: index,
            nome: item.produtos?.nome || "Artigo Desconhecido (Apagado)",
            local: item.produtos?.local || "Geral",
            obs: item.observacao || "",
            qtd: Math.abs(item.quantidade || 0) 
          }));
          setItens(itensFormatados);
        } else {
          setItens([]);
        }
      }
      setACarregar(false);
    };
    
    carregarGuia();
  }, [id]);

  if (aCarregar) return <div className="flex h-screen items-center justify-center font-black uppercase tracking-widest text-[#1e3a8a] animate-pulse">A gerar documento...</div>;
  if (!pedido) return <div className="p-12 text-center text-red-500 font-bold">Pedido não encontrado.</div>;

  const totalItens = itens.reduce((acc, item) => acc + item.qtd, 0);

  return (
    <div className="min-h-screen py-10 print:py-0 w-full flex flex-col items-center bg-gray-200 print:bg-white">
      
      {/* BARRA DE CONTROLOS (Escondida ao imprimir) */}
      <div className="w-full max-w-[210mm] mb-6 flex justify-between items-center print:hidden px-4">
        <button onClick={() => window.close()} className="px-6 py-3 bg-white text-gray-600 rounded-xl font-black uppercase text-xs shadow-sm hover:bg-gray-50 border border-gray-200">
          ✕ Fechar Separador
        </button>
        <button onClick={() => window.print()} className="px-6 py-3 bg-[#1e3a8a] text-white rounded-xl font-black uppercase text-xs shadow-xl hover:bg-blue-800 transition-all flex items-center gap-2">
          🖨️ Imprimir Pedido
        </button>
      </div>

      {/* PÁGINA A4 (Visual no ecrã vs Visual na Impressora) */}
      <div className="w-full max-w-[210mm] min-h-[297mm] print:min-h-0 print:h-auto bg-white p-12 shadow-2xl print:shadow-none print:p-0 relative flex flex-col">
        
        {/* CABEÇALHO MELHORADO COM LOGO */}
        <header className="flex justify-between items-center mb-10 border-b-2 border-gray-200 pb-6">
          <div className="flex flex-col">
            <img 
              src="https://contratos.lotacor.pt/img/logo.png" 
              alt="Lotaçor S.A." 
              className="h-16 object-contain mb-2 print:h-14" 
            />
            <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Serviço de Lotas dos Açores, S.A.</p>
          </div>
          <div className="text-right">
            <h1 className="text-3xl font-black text-gray-800 uppercase tracking-tighter">Pedido</h1>
            <p className="text-sm font-bold text-[#1e3a8a] uppercase mt-1">Nº {pedido.id}</p>
          </div>
        </header>

        {/* INFORMAÇÃO GERAL */}
        <div className="grid grid-cols-2 gap-8 mb-10 bg-gray-50 print:bg-transparent p-6 print:p-0 rounded-2xl">
          <div className="space-y-4">
            <div>
              <h3 className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Para Unidade:</h3>
              <p className="font-black text-sm text-[#0f172a] uppercase">{pedido.contatos?.nome || "Unidade Desconhecida"}</p>
              <p className="text-xs text-gray-600">{pedido.contatos?.departamento}</p>
              <div className="mt-2 text-xs text-gray-500 flex gap-4">
                {pedido.contatos?.contato && <span>📞 {pedido.contatos.contato}</span>}
                {pedido.contatos?.email && <span>📧 {pedido.contatos.email}</span>}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <h3 className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Detalhes do Pedido:</h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <p className="text-gray-500">Data:</p>
                <p className="font-bold text-gray-800">{new Date(pedido.created_at).toLocaleDateString('pt-PT')}</p>
                
                <p className="text-gray-500">Requisitante:</p>
                <p className="font-bold text-gray-800">{pedido.requisitante}</p>
                
                <p className="text-gray-500">Urgência:</p>
                <p className={`font-black uppercase ${pedido.tipo === 'Urgente' ? 'text-red-600' : 'text-gray-800'}`}>{pedido.tipo}</p>
              </div>
            </div>
          </div>

          {/* O comentário ganha destaque se existir */}
          <div className="col-span-2 pt-4 border-t border-gray-200 print:border-gray-300">
             <h3 className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Observações do Pedido original:</h3>
             <p className="text-sm text-gray-700 italic">{pedido.observacao || "Sem observações adicionais registadas."}</p>
          </div>
        </div>

        {/* TABELA DE ITENS REAIS */}
        <div className="flex-1 mb-8">
          <table className="w-full text-left border-collapse">
            <thead className="border-b-2 border-gray-800 text-[#0f172a] text-[10px] uppercase tracking-widest font-black">
              <tr>
                <th className="py-3 px-2">Material / Artigo</th>
                <th className="py-3 px-2">Local de Saída</th>
                <th className="py-3 px-2">Notas da Expedição</th>
                <th className="py-3 px-2 text-center">Qtd</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {itens.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-gray-400 font-bold text-xs uppercase tracking-widest italic">
                    Nenhum artigo processado neste pedido.
                  </td>
                </tr>
              ) : (
                itens.map((item, idx) => (
                  <tr key={idx} className="text-xs">
                    <td className="py-4 px-2 font-black text-gray-800 uppercase">{item.nome}</td>
                    <td className="py-4 px-2 text-gray-600">{item.local}</td>
                    <td className="py-4 px-2 text-gray-500 italic">{item.obs || "-"}</td>
                    <td className="py-4 px-2 text-center font-black text-lg text-[#1e3a8a]">{item.qtd}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* RODAPÉ */}
        <footer className="mt-auto pt-6 border-t-2 border-[#1e3a8a] flex justify-between items-end print:break-inside-avoid">
          <div className="text-[9px] text-gray-500 font-medium leading-relaxed">
            <p className="text-[#1e3a8a] text-[10px] font-black mb-1 uppercase tracking-widest">Lotaçor S.A.</p>
            <p>Rua Eng. Abel Ferín Coutinho, n.º 15 | Ponta Delgada 9500-191 | Portugal</p>
            <div className="mt-1 flex gap-4">
              <span>T: 296 302 580</span>
              <span>www.lotacor.pt</span>
              <span>economato@lotacor.pt</span>
              <span className="font-bold text-gray-800">NIF: 512 013 322</span>
            </div>
          </div>

          <div className="text-right bg-gray-50 print:bg-transparent p-4 rounded-xl border border-gray-100 print:border-none">
            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Entregue</p>
            <p className="text-3xl font-black text-[#1e3a8a] leading-none">{totalItens} <span className="text-sm font-medium text-gray-500">un.</span></p>
          </div>
        </footer>

      </div>
    </div>
  );
}