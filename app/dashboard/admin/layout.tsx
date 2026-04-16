"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [aCarregar, setACarregar] = useState(true);

  // Verifica se estamos na página principal do Admin para esconder o menu superior
  const estaNaPaginaPrincipal = pathname === "/dashboard/admin";

  useEffect(() => {
    const verificarAcesso = async () => {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
          router.push("/");
          return;
        }

        const { data: perfil, error: dbError } = await supabase
          .from("perfis")
          .select("*")
          .eq("id", user.id)
          .single();

        if (dbError) {
          console.error("ERRO BASE DE DADOS:", dbError.message);
          setACarregar(false);
          return;
        }

        const eAdmin = 
          perfil?.cargo?.toLowerCase().includes("admin") || 
          perfil?.nivel_acesso === "admin";

        if (!eAdmin) {
          router.push("/dashboard");
        } else {
          setACarregar(false);
        }

      } catch (err) {
        console.error("ERRO INESPERADO:", err);
        setACarregar(false);
      }
    };

    verificarAcesso();
  }, [router]);

  if (aCarregar) return (
    <main className="flex-1 flex items-center justify-center font-black uppercase tracking-widest text-[#1e3a8a] animate-pulse h-screen">
      A validar permissões Admin...
    </main>
  );

  return (
    <main className="flex-1 p-12 overflow-y-auto h-screen relative bg-slate-50">
      <header className="mb-12">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-4xl font-black text-[#0f172a] uppercase italic leading-none">
              Painel <span className="text-amber-500">Administrador</span>
            </h1>
            <div className="h-1.5 w-24 bg-amber-500 rounded-full mt-3 mb-8"></div>
          </div>
          
          {/* Botão para Voltar ao Menu Principal se não estivermos nele */}
          {!estaNaPaginaPrincipal && (
            <button 
              onClick={() => router.push("/dashboard/admin")}
              className="bg-slate-900 text-white px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-500 transition-colors shadow-lg"
            >
              ← Voltar ao Menu
            </button>
          )}
        </div>

        {/* NAVEGAÇÃO INTERNA: Só aparece se NÃO estivermos na página principal */}
        {!estaNaPaginaPrincipal && (
          <div className="flex gap-4 border-b border-gray-200 pb-px overflow-x-auto scrollbar-hide animate-in fade-in duration-500">
            <button 
              onClick={() => router.push("/dashboard/admin/inventarioadmin")}
              className={`pb-4 px-4 text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${pathname === "/dashboard/admin/inventarioadmin" ? "border-b-4 border-amber-500 text-[#0f172a]" : "text-gray-400 hover:text-gray-600"}`}
            >
              📦 Inventário
            </button>
            <button 
              onClick={() => router.push("/dashboard/admin/auditoria")}
              className={`pb-4 px-4 text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${pathname === "/dashboard/admin/auditoria" ? "border-b-4 border-amber-500 text-[#0f172a]" : "text-gray-400 hover:text-gray-600"}`}
            >
              🕵️ Auditoria
            </button>
            <button 
              onClick={() => router.push("/dashboard/admin/contas")}
              className={`pb-4 px-4 text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${pathname === "/dashboard/admin/contas" ? "border-b-4 border-amber-500 text-[#0f172a]" : "text-gray-400 hover:text-gray-600"}`}
            >
              👥 Contas
            </button>
            <button 
              onClick={() => router.push("/dashboard/admin/importar")}
              className={`pb-4 px-4 text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${pathname === "/dashboard/admin/importar" ? "border-b-4 border-amber-500 text-[#0f172a]" : "text-gray-400 hover:text-gray-600"}`}
            >
              📥 Importação
            </button>
          </div>
        )}
      </header>

      {/* As páginas específicas carregam aqui dentro! */}
      <div className="min-h-[calc(100vh-250px)]">
        {children}
      </div>
    </main>
  );
}