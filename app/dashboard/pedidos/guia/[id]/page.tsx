"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabase";

export default function GuiaTransporte() {
  const { id } = useParams();
  const router = useRouter();
  const [pedido, setPedido] = useState<any>(null);
  const [aCarregar, setACarregar] = useState(true);

  useEffect(() => {
    const carregarGuia = async () => {
      const { data, error } = await supabase
        .from("pedidos")
        .select("*, contactos(nome, departamento)")
        .eq("id", id)
        .single();

      if (data) setPedido(data);
      setACarregar(false);
    };
    carregarGuia();
  }, [id]);

  if (aCarregar) return <p className="p-10 text-center font-bold uppercase text-xs">A gerar guia...</p>;
  if (!pedido) return <p className="p-10 text-center text-red-600 font-bold">Guia não encontrada.</p>;

  return (
    <div className="min-h-screen bg-white p-10 font-sans text-black">
      {/* BOTÕES DE CONTROLO (Escondidos na impressão) */}
      <div className="mb-10 flex gap-4 print:hidden">
        <button onClick={() => router.back()} className="bg-gray-100 px-4 py-2 rounded font-bold text-xs uppercase">← Voltar</button>
        <button onClick={() => window.print()} className="bg-[#1e3a8a] text-white px-6 py-2 rounded font-bold text-xs uppercase shadow-lg">🖨️ Imprimir Guia</button>
      </div>

      {/* CABEÇALHO DA GUIA */}
      <div className="border-b-4 border-[#1e3a8a] pb-6 mb-8 flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-black italic text-[#1e3a8a]">LOTAÇOR, S.A.</h1>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Serviço de Economato e Logística</p>
        </div>
        <div className="text-right">
          <h2 className="text-xl font-black uppercase">Guia de Transporte</h2>
          <p className="text-sm font-bold">N.º {pedido.id.toString().padStart(6, '0')}</p>
          <p className="text-xs text-gray-500">{new Date(pedido.created_at).toLocaleDateString('pt-PT')}</p>
        </div>
      </div>

      {/* DADOS DE DESTINO */}
      <div className="grid grid-cols-2 gap-12 mb-10">
        <div className="bg-gray-50 p-6 rounded-xl border border-gray-100">
          <h3 className="text-[10px] font-black text-gray-400 uppercase mb-2">Destinatário / Lota</h3>
          <p className="text-lg font-black text-[#1e3a8a] uppercase">{pedido.contactos?.nome}</p>
          <p className="text-sm font-bold text-gray-600 uppercase">Departamento: {pedido.contactos?.departamento}</p>
        </div>
        <div className="p-6">
          <h3 className="text-[10px] font-black text-gray-400 uppercase mb-2">Requisitante</h3>
          <p className="text-lg font-black uppercase">{pedido.requisitante}</p>
          <p className="text-xs font-bold text-gray-500 uppercase">Tipo de Pedido: {pedido.tipo}</p>
        </div>
      </div>

      {/* LISTA DE MATERIAL */}
      <div className="mb-12">
        <h3 className="text-xs font-black uppercase border-b-2 border-gray-200 pb-2 mb-4">Material Fornecido</h3>
        <div className="min-h-[200px] border-2 border-gray-50 p-6 rounded-xl italic text-gray-700 whitespace-pre-wrap">
          {pedido.observacao}
        </div>
      </div>

      {/* RODAPÉ E ASSINATURAS */}
      <div className="mt-24 grid grid-cols-2 gap-20 text-center">
        <div>
          <div className="border-t-2 border-black pt-2">
            <p className="text-[10px] font-black uppercase">Responsável pelo Economato</p>
          </div>
        </div>
        <div>
          <div className="border-t-2 border-black pt-2">
            <p className="text-[10px] font-black uppercase">Recebido por (Assinatura/Carimbo)</p>
          </div>
        </div>
      </div>

      <div className="mt-20 text-center">
        <p className="text-[9px] text-gray-400 uppercase font-bold">Documento gerado eletronicamente pelo Sistema de Gestão Lotaçor - Economato</p>
      </div>
    </div>
  );
}