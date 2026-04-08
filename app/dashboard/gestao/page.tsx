"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function GestaoStock() {
  const router = useRouter();
  const [produtos, setProdutos] = useState<any[]>([]);
  const [selecionado, setSelecionado] = useState<any>(null);
  const [quantidade, setQuantidade] = useState(0);
  const [tipo, setTipo] = useState("Entrada");
  const [cargo, setCargo] = useState<string | null>(null);
  const [emailUtilizador, setEmailUtilizador] = useState("");

  useEffect(() => {
    const carregar = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setEmailUtilizador(user.email || "");
        const { data: perfil } = await supabase.from("perfis").select("cargo").eq("email", user.email).single();
        if (perfil) setCargo(perfil.cargo);
      }
      const { data } = await supabase.from("produtos").select("*").order("nome");
      setProdutos(data || []);
    };
    carregar();
  }, []);

  const submeter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selecionado || quantidade <= 0) return;
    
    try {
      const valorFinal = tipo === "Entrada" ? quantidade : -quantidade;
      const novaQtd = (selecionado.quantidade || 0) + valorFinal;
      
      if (novaQtd < 0) return alert("Erro: Stock insuficiente para esta saída!");

      // 1. Atualizar Stock
      const { error: errorUpdate } = await supabase.from("produtos").update({ quantidade: novaQtd }).eq("id", selecionado.id);
      if (errorUpdate) throw errorUpdate;

      // 2. Registar Movimento
      await supabase.from("movimentos").insert([{
        produto_id: selecionado.id,
        quantidade: valorFinal,
        tipo: tipo,
        origem: selecionado.local,
        utilizador: emailUtilizador
      }]);

      alert("Lançamento registado com sucesso!");
      window.location.reload();
    } catch (err) {
      alert("Erro ao processar a operação.");
    }
  };

  return (
    <div className="flex h-screen bg-[#f8fafc] font-sans">
      {/* SIDEBAR GOURMET - VOLTAR ATRÁS INTEGRADO */}
      <aside className="w-72 bg-gradient-to-b from-[#0f172a] to-[#1e3a8a] text-white flex flex-col shadow-xl">
        <div className="p-8 mb-4 flex items-center gap-3">
          <div className="bg-white/10 p-2 rounded-xl backdrop-blur-md border border-white/20 text-2xl font-bold italic">🧊</div>
          <div>
            <h1 className="text-xl font-black tracking-tighter leading-none italic uppercase font-sans">Lotaçor</h1>
            <p className="text-[9px] font-bold text-blue-300 tracking-[0.3em] uppercase">Economato</p>
          </div>
        </div>
        <nav className="flex-1 px-4 space-y-1">
          <button onClick={() => router.push("/dashboard")} className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl text-blue-100 hover:bg-white/10 transition-all uppercase text-[11px] tracking-widest text-left"><span>🏠</span> Inventário</button>
          <button onClick={() => router.push("/dashboard/gestao")} className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl bg-white text-[#1e3a8a] shadow-lg font-bold uppercase text-[11px] tracking-widest text-left"><span>📦</span> Gestão Stock</button>
          <button onClick={() => router.push("/dashboard/pedidos")} className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl text-blue-100 hover:bg-white/10 transition-all uppercase text-[11px] tracking-widest text-left"><span>📋</span> Pedidos</button>
          <button onClick={() => router.push("/dashboard/contactos")} className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl text-blue-100 hover:bg-white/10 transition-all uppercase text-[11px] tracking-widest text-left"><span>📇</span> Contactos</button>
          <button onClick={() => router.push("/dashboard/movimentos")} className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl text-blue-100 hover:bg-white/10 transition-all uppercase text-[11px] tracking-widest text-left"><span>🔄</span> Movimentos</button>
        </nav>
        <div className="m-6 p-4 bg-white/5 border border-white/10 rounded-[2rem] text-[10px]">
          <p className="font-black text-blue-300 uppercase mb-1 tracking-widest leading-none">{cargo || "Carregando..."}</p>
          <p className="opacity-70 truncate mb-4 font-medium">{emailUtilizador}</p>
          <button onClick={async () => { await supabase.auth.signOut(); router.push("/"); }} className="w-full py-3 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white rounded-xl font-black uppercase transition-all duration-300">Sair</button>
        </div>
      </aside>

      {/* ÁREA DE OPERAÇÃO */}
      <main className="flex-1 p-12 overflow-y-auto grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* COLUNA ESQUERDA: SELEÇÃO */}
        <div className="bg-white rounded-[2.5rem] shadow-xl shadow-blue-900/[0.03] flex flex-col overflow-hidden border border-white">
          <div className="p-6 bg-[#f8fafc] border-b font-black text-[10px] uppercase text-[#1e3a8a] tracking-[0.2em] flex justify-between items-center">
            <span>1. Selecionar Material</span>
            <span className="bg-blue-100 text-[#1e3a8a] px-3 py-1 rounded-full">{produtos.length} Itens</span>
          </div>
          <div className="overflow-y-auto flex-1 divide-y divide-gray-50">
            {produtos.map(p => (
              <button 
                key={p.id} 
                onClick={() => { setSelecionado(p); setQuantidade(0); }} 
                className={`w-full text-left p-6 hover:bg-blue-50/50 transition-all group ${selecionado?.id === p.id ? 'bg-blue-50 border-l-8 border-[#1e3a8a]' : ''}`}
              >
                <span className="block font-black text-[#0f172a] text-sm uppercase tracking-tighter group-hover:text-[#1e3a8a]">{p.nome}</span>
                <span className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">{p.local} | Stock Atual: <span className="text-[#1e3a8a]">{p.quantidade}</span></span>
              </button>
            ))}
          </div>
        </div>

        {/* COLUNA DIREITA: FORMULÁRIO */}
        <div className="bg-white rounded-[3rem] shadow-2xl p-12 flex flex-col justify-center border border-white relative overflow-hidden">
          <div className="absolute top-0 right-0 p-12 opacity-[0.03] text-9xl font-black italic -rotate-12 select-none pointer-events-none text-blue-900 uppercase">
            {tipo}
          </div>

          {selecionado ? (
            <form onSubmit={submeter} className="space-y-10 text-center relative z-10">
              <div>
                <span className="text-[10px] font-black text-blue-500 uppercase tracking-[0.3em]">Operação em curso:</span>
                <h2 className="text-4xl font-black text-[#0f172a] uppercase italic tracking-tighter mt-2">{selecionado.nome}</h2>
                <div className="h-1.5 w-16 bg-[#1e3a8a] rounded-full mx-auto mt-4"></div>
              </div>

              <div className="flex bg-[#f1f5f9] p-2 rounded-[2rem] max-w-sm mx-auto">
                <button 
                  type="button" 
                  onClick={() => setTipo("Entrada")} 
                  className={`flex-1 py-4 rounded-[1.5rem] font-black text-[10px] uppercase tracking-widest transition-all ${tipo === "Entrada" ? 'bg-green-600 text-white shadow-xl' : 'text-gray-400'}`}
                >
                  Entrada
                </button>
                <button 
                  type="button" 
                  onClick={() => setTipo("Saída")} 
                  className={`flex-1 py-4 rounded-[1.5rem] font-black text-[10px] uppercase tracking-widest transition-all ${tipo === "Saída" ? 'bg-red-600 text-white shadow-xl' : 'text-gray-400'}`}
                >
                  Saída
                </button>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Quantidade a Processar</label>
                <input 
                  type="number" 
                  min="1"
                  value={quantidade} 
                  onChange={e => setQuantidade(Number(e.target.value))} 
                  className="w-full text-8xl font-black text-center text-[#1e3a8a] bg-transparent outline-none focus:scale-105 transition-transform"
                />
              </div>

              <button 
                type="submit" 
                className={`w-full py-6 rounded-[2rem] font-black text-white shadow-2xl uppercase tracking-[0.2em] text-xs transition-all active:scale-95 ${
                  tipo === "Entrada" ? 'bg-green-600 shadow-green-900/20' : 'bg-red-600 shadow-red-900/20'
                }`}
              >
                Confirmar Lançamento de {tipo}
              </button>
            </form>
          ) : (
            <div className="text-center space-y-6">
              <div className="w-24 h-24 bg-blue-50 rounded-[2rem] flex items-center justify-center mx-auto text-4xl shadow-inner">📦</div>
              <div className="space-y-2">
                <p className="text-[#0f172a] font-black uppercase text-sm tracking-tighter">Nenhum Material Selecionado</p>
                <p className="text-gray-400 font-bold uppercase text-[9px] tracking-widest">Selecione um item na lista à esquerda <br/> para gerir entradas ou saídas</p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}