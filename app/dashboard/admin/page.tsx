"use client";

import { useRouter } from "next/navigation";

export default function LandingAdmin() {
  const router = useRouter();

  // Definimos os módulos para o menu principal
  const modulos = [
    {
      titulo: "Gestão de Stock",
      descricao: "Edição direta, ajuste de quantidades e remoção de material.",
      icone: "📦",
      rota: "/dashboard/admin/inventarioadmin",
      cor: "hover:border-amber-500"
    },
    {
      titulo: "Auditoria Total",
      descricao: "Histórico completo de quem fez o quê, quando e onde.",
      icone: "🕵️",
      rota: "/dashboard/admin/auditoria",
      cor: "hover:border-blue-600"
    },
    {
      titulo: "Utilizadores",
      descricao: "Gestão de perfis, cargos e permissões da Lotaçor.",
      icone: "👥",
      rota: "/dashboard/admin/contas",
      cor: "hover:border-purple-600"
    },
    {
      titulo: "Importação Dados",
      descricao: "Atualização massiva de inventário via ficheiros externos.",
      icone: "📥",
      rota: "/dashboard/admin/importar",
      cor: "hover:border-green-600"
    }
  ];

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Mensagem de Boas-vindas */}
      <div className="mb-10">
        <p className="text-sm font-bold text-gray-500 uppercase tracking-[0.2em]">Bem-vindo ao Centro de Controlo</p>
        <p className="text-xs text-gray-400 italic">Selecione uma área operacional para gerir o sistema.</p>
      </div>

      {/* GRELHA DE ATALHOS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {modulos.map((item, index) => (
          <button
            key={index}
            onClick={() => router.push(item.rota)}
            className={`group bg-white p-8 rounded-[2rem] border-2 border-slate-100 ${item.cor} shadow-sm hover:shadow-2xl transition-all duration-300 text-left flex flex-col h-full relative overflow-hidden`}
          >
            {/* Ícone de fundo decorativo */}
            <span className="absolute -right-4 -top-4 text-8xl opacity-[0.03] group-hover:opacity-[0.08] transition-opacity rotate-12">
              {item.icone}
            </span>

            <div className="text-4xl mb-6 group-hover:scale-110 transition-transform duration-300">
              {item.icone}
            </div>
            
            <h2 className="text-lg font-black text-[#0f172a] uppercase italic leading-tight mb-3">
              {item.titulo}
            </h2>
            
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-tight leading-relaxed flex-1">
              {item.descricao}
            </p>

            <div className="mt-8 flex items-center gap-2 text-[10px] font-black text-amber-600 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all transform translate-x-[-10px] group-hover:translate-x-0">
              Abrir Módulo <span>→</span>
            </div>
          </button>
        ))}
      </div>

      {/* STATUS RÁPIDO NO RODAPÉ */}
      <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900 rounded-[1.5rem] p-6 text-white flex items-center gap-4">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-[10px] font-black uppercase tracking-widest">Base de Dados Supabase: Ligada</span>
        </div>
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-[1.5rem] p-6 text-amber-700 flex items-center gap-4">
          <span className="text-lg">🛡️</span>
          <span className="text-[10px] font-black uppercase tracking-widest">Modo Administrador Ativo</span>
        </div>
      </div>
    </div>
  );
}