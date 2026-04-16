"use client";

import Sidebar from "@/app/components/Sidebar";
import { usePathname } from "next/navigation";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  // Deteta se o URL tem a palavra "guia"
  const isModoImpressao = pathname.includes("/guia/");

  // Se for para imprimir, devolve APENAS a página, sem a Sidebar
  if (isModoImpressao) {
    return (
      <div className="min-h-screen font-sans bg-gray-200">
        {children}
      </div>
    );
  }

  // Comportamento normal para o resto do sistema
  return (
    <div className="flex h-screen bg-[#f8fafc] font-sans overflow-hidden">
      <Sidebar />
      {children}
    </div>
  );
}