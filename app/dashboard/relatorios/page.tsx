"use client";

import { useRouter } from "next/navigation";

export default function MenuRelatorios() {
  const router = useRouter();

  const submenus = [
    {
      titulo: "Valor de Inventário",
      descricao: "Consulta o valor real do armazém baseado nos lotes FIFO ativos.",
      rota: "/dashboard/relatorios/inventario",
      icon: "💰",
      cor: "border-emerald-500"
    },
    {
      titulo: "Consumos e Gastos",
      descricao: "Análise de quanto cada unidade ou departamento está a consumir.",
      rota: "/dashboard/relatorios/consumos",
      icon: "📉",
      cor: "border-blue-500"
    },
    {
      titulo: "Estudo de Artigo",
      descricao: "Histórico detalhado de entradas, saídas e flutuação de preço de um item.",
      rota: "/dashboard/relatorios/artigos",
      icon: "🔍",
      cor: "border-amber-500"
    },
    // ... dentro do array submenus no ficheiro app/dashboard/relatorios/page.tsx
    {
  titulo: "Histórico de Compras",
  descricao: "Análise da evolução de preços e volume de entradas de material.",
  rota: "/dashboard/relatorios/compras",
  icon: "🛒",
  cor: "border-purple-500"
    },
    
  ];

  return (
    <main className="flex-1 p-8 md:p-12 bg-slate-50 h-screen overflow-y-auto">
      <header className="mb-12">
        <h1 className="text-4xl font-black text-[#0f172a] tracking-tighter uppercase italic leading-none">
          Centro de <span className="text-[#1e3a8a]">Relatórios</span>
        </h1>
        <div className="h-1.5 w-24 bg-[#1e3a8a] rounded-full mt-3"></div>
        <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-4">
          Business Intelligence Lotaçor S.A.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {submenus.map((item, index) => (
          <div 
            key={index}
            onClick={() => router.push(item.rota)}
            className={`bg-white p-8 rounded-[2.5rem] shadow-sm border-b-8 ${item.cor} hover:shadow-xl hover:-translate-y-2 transition-all cursor-pointer group`}
          >
            <div className="text-4xl mb-6 group-hover:scale-110 transition-transform">{item.icon}</div>
            <h2 className="text-xl font-black text-slate-800 uppercase mb-3">{item.titulo}</h2>
            <p className="text-sm text-slate-500 font-medium leading-relaxed">
              {item.descricao}
            </p>
            <div className="mt-6 flex items-center text-[#1e3a8a] font-black text-[10px] uppercase tracking-widest">
              Aceder Relatório →
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}