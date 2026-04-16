"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function ContactosPage() {
  const [aCarregar, setACarregar] = useState(true);
  const [contactos, setContactos] = useState<any[]>([]);
  const [pesquisa, setPesquisa] = useState("");

  useEffect(() => {
    carregarContactos();
  }, []);

  const carregarContactos = async () => {
    // Vai buscar os contactos e ordena por nome
    const { data, error } = await supabase.from("contactos").select("*").order("nome");
    if (!error && data) {
      setContactos(data);
    }
    setACarregar(false);
  };

  // Filtra por nome ou por departamento (local)
  const contactosFiltrados = contactos.filter(c => 
    c.nome.toLowerCase().includes(pesquisa.toLowerCase()) || 
    (c.departamento && c.departamento.toLowerCase().includes(pesquisa.toLowerCase()))
  );

  if (aCarregar) return <div className="p-12 text-center text-amber-500 font-black uppercase animate-pulse h-screen flex items-center justify-center">A carregar lista de contactos...</div>;

  return (
    <main className="flex-1 p-12 overflow-y-auto h-screen relative">
      
      {/* CABEÇALHO */}
      <header className="mb-12 flex flex-col md:flex-row justify-between md:items-end gap-6">
        <div>
          <h1 className="text-4xl font-black text-[#0f172a] uppercase italic leading-none tracking-tighter">
            Diretório de <span className="text-amber-500">Contactos</span>
          </h1>
          <div className="h-1.5 w-24 bg-amber-500 rounded-full mt-3 mb-2"></div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Unidades, Direções e Lotas da Lotaçor</p>
        </div>

        {/* BARRA DE PESQUISA */}
        <div className="relative w-full md:w-96">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
          <input 
            type="text" 
            placeholder="Pesquisar por nome ou local..." 
            value={pesquisa} 
            onChange={e => setPesquisa(e.target.value)}
            className="w-full pl-12 pr-5 py-4 bg-white rounded-2xl shadow-xl font-bold text-sm text-[#1e3a8a] outline-none border-2 border-transparent focus:border-amber-500 transition-all placeholder-gray-300"
          />
        </div>
      </header>

      {/* GRELHA DE CARTÕES (CARTÕES DE VISITA) */}
      {contactosFiltrados.length === 0 ? (
        <div className="bg-white rounded-[3rem] p-20 text-center shadow-xl border-4 border-gray-50">
           <span className="text-6xl mb-4 block grayscale opacity-30">📇</span>
           <p className="text-gray-400 font-black uppercase tracking-widest text-sm">Nenhum contacto encontrado com esses filtros.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {contactosFiltrados.map((contacto) => (
            <div key={contacto.id} className="bg-white rounded-3xl p-8 shadow-lg border border-gray-100 hover:shadow-2xl hover:border-amber-200 transition-all group relative overflow-hidden">
              
              {/* Efeito Visual no Canto */}
              <div className="absolute -top-6 -right-6 w-24 h-24 bg-gradient-to-br from-[#1e3a8a]/5 to-[#1e3a8a]/10 rounded-full group-hover:scale-150 transition-transform duration-500"></div>

              {/* DADOS PRINCIPAIS */}
              <div className="relative z-10 mb-6 border-b border-gray-100 pb-4">
                <h2 className="font-black text-lg text-[#0f172a] uppercase leading-tight mb-1 pr-8">
                  {contacto.nome}
                </h2>
                <span className="inline-block bg-amber-100 text-amber-800 text-[9px] px-3 py-1 rounded-full font-black uppercase tracking-widest">
                  📍 {contacto.departamento || "Geral"}
                </span>
              </div>

              {/* CONTACTOS (Email / Telefone) */}
              <div className="relative z-10 space-y-3">
                {contacto.email ? (
                  <a href={`mailto:${contacto.email}`} className="flex items-center gap-3 text-sm font-bold text-gray-500 hover:text-[#1e3a8a] transition-colors group/link">
                    <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center group-hover/link:bg-[#1e3a8a] group-hover/link:text-white transition-colors">
                      ✉️
                    </div>
                    <span className="truncate">{contacto.email}</span>
                  </a>
                ) : (
                  <div className="flex items-center gap-3 text-sm font-bold text-gray-300">
                    <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center grayscale opacity-50">✉️</div>
                    <span className="italic text-xs">Sem email registado</span>
                  </div>
                )}

                {contacto.telefone ? (
                  <a href={`tel:${contacto.telefone}`} className="flex items-center gap-3 text-sm font-bold text-gray-500 hover:text-green-600 transition-colors group/link">
                    <div className="w-8 h-8 rounded-full bg-green-50 text-green-600 flex items-center justify-center group-hover/link:bg-green-600 group-hover/link:text-white transition-colors">
                      📞
                    </div>
                    <span>{contacto.telefone}</span>
                  </a>
                ) : (
                  <div className="flex items-center gap-3 text-sm font-bold text-gray-300">
                    <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center grayscale opacity-50">📞</div>
                    <span className="italic text-xs">Sem telefone registado</span>
                  </div>
                )}
              </div>

            </div>
          ))}
        </div>
      )}

    </main>
  );
}