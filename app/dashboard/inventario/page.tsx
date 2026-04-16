"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

export default function HistoricoMovimentos() {
  const router = useRouter();
  const [movimentos, setMovimentos] = useState<any[]>([]);
  const [aCarregar, setACarregar] = useState(true);

  const carregarMovimentos = async () => {
    try {
      setACarregar(true);
      // O "*" vai buscar tudo de movimentos, e o bloco seguinte busca o nome do produto associado
      const { data, error } = await supabase
        .from("movimentos")
        .select(`
          *,
          produtos:produto_id ( nome )
        `)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Erro detalhado do Supabase:", error);
        return;
      }
      
      setMovimentos(data || []);
    } catch (error) {
      console.error("Erro inesperado:", error);
    } finally {
      setACarregar(false);
    }
  };

  useEffect(() => {
    carregarMovimentos();
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 p-8 font-sans text-gray-800">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <button onClick={() => router.push("/dashboard")} className="text-[#1e3a8a] hover:underline text-sm font-bold flex items-center gap-1 mb-2">
              ← VOLTAR AO INVENTÁRIO
            </button>
            <h1 className="text-3xl font-bold text-[#1e3a8a]">Histórico de Movimentos</h1>
          </div>
          <button onClick={carregarMovimentos} className="bg-white border border-gray-300 px-4 py-2 rounded shadow-sm hover:bg-gray-50 font-bold text-xs uppercase">
            🔄 Atualizar
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#1e3a8a] text-white font-bold uppercase text-[10px] tracking-widest">
              <tr>
                <th className="p-4">Data / Hora</th>
                <th className="p-4">Produto</th>
                <th className="p-4">Tipo</th>
                <th className="p-4 text-center">Qtd</th>
                <th className="p-4">Fluxo (Origem ➔ Destino)</th>
                <th className="p-4">Utilizador</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {aCarregar ? (
                <tr><td colSpan={6} className="p-12 text-center text-gray-400 font-medium">A carregar registos do economato...</td></tr>
              ) : movimentos.length === 0 ? (
                <tr><td colSpan={6} className="p-12 text-center text-gray-400 font-medium">Ainda não existem movimentos registados.</td></tr>
              ) : (
                movimentos.map((m) => (
                  <tr key={m.id} className="hover:bg-blue-50/50 transition-colors">
                    <td className="p-4 text-gray-500 font-mono text-xs">
                      {new Date(m.created_at).toLocaleString('pt-PT')}
                    </td>
                    <td className="p-4 font-bold text-[#1e3a8a]">
                      {m.produtos?.nome || "Produto #" + m.produto_id}
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${
                        m.tipo === 'Entrada' ? 'bg-green-100 text-green-700' : 
                        m.tipo === 'Saída' ? 'bg-red-100 text-red-700' : 
                        m.tipo === 'Transferência' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                      }`}>
                        {m.tipo}
                      </span>
                    </td>
                    <td className={`p-4 text-center font-black ${m.quantidade > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {m.quantidade > 0 ? `+${m.quantidade}` : m.quantidade}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2 text-[11px] font-bold">
                        <span className="text-gray-600 uppercase">{m.origem}</span>
                        {m.destino && (
                          <>
                            <span className="text-blue-300">➔</span>
                            <span className="text-blue-600 uppercase">{m.destino}</span>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-gray-400 italic text-[10px] truncate max-w-[120px]">
                      {m.utilizador}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}