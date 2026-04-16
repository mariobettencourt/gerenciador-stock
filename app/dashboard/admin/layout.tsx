"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [aCarregar, setACarregar] = useState(true);

useEffect(() => {
  const verificarAcesso = async () => {
    console.log("--- INÍCIO DA VALIDAÇÃO ---");
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        console.error("ERRO AUTH:", authError);
        router.push("/");
        return;
      }
      
      console.log("Utilizador logado:", user.email, "ID:", user.id);

      // Procuramos o perfil
      const { data: perfil, error: dbError } = await supabase
        .from("perfis")
        .select("*")
        .eq("id", user.id)
        .single();

      if (dbError) {
        console.error("ERRO BASE DE DADOS:", dbError.message, dbError.details);
        alert(`Erro de Base de Dados: ${dbError.message}. Verifica se a tabela 'perfis' tem o teu ID.`);
        setACarregar(false); // Libertamos para ver o erro no ecrã
        return;
      }

      console.log("Dados do Perfil encontrados:", perfil);

      const eAdmin = 
        perfil?.cargo?.toLowerCase().includes("admin") || 
        perfil?.nivel_acesso === "admin";

      console.log("É administrador?", eAdmin);

      if (!eAdmin) {
        console.warn("ACESSO NEGADO: Cargo detetado ->", perfil?.cargo);
        alert(`Acesso Negado. O teu cargo atual é: ${perfil?.cargo}`);
        router.push("/dashboard");
      } else {
        console.log("ACESSO CONCEDIDO! Bem-vindo.");
        setACarregar(false);
      }

    } catch (err) {
      console.error("ERRO INESPERADO:", err);
      setACarregar(false);
    }
  };

  verificarAcesso();
}, [router]);

  if (aCarregar) return <main className="flex-1 flex items-center justify-center font-black uppercase tracking-widest text-[#1e3a8a] animate-pulse h-screen">A validar permissões Admin...</main>;

  return (
    <main className="flex-1 p-12 overflow-y-auto h-screen relative">
      <header className="mb-12">
        <h1 className="text-4xl font-black text-[#0f172a] uppercase italic leading-none">
          Painel <span className="text-amber-500">Administrador</span>
        </h1>
        <div className="h-1.5 w-24 bg-amber-500 rounded-full mt-3 mb-8"></div>

        {/* NAVEGAÇÃO INTERNA DO ADMIN */}
        <div className="flex gap-4 border-b border-gray-200 pb-px overflow-x-auto scrollbar-hide">
          <button 
            onClick={() => router.push("/dashboard/admin")}
            className={`pb-4 px-4 text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${pathname === "/dashboard/admin" ? "border-b-4 border-amber-500 text-[#0f172a]" : "text-gray-400 hover:text-gray-600"}`}
          >
            📦 Inventário (Editar/Apagar)
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
          
          {/* NOVO BOTÃO DE IMPORTAÇÃO AQUI */}
          <button 
            onClick={() => router.push("/dashboard/admin/importar")}
            className={`pb-4 px-4 text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${pathname === "/dashboard/admin/importar" ? "border-b-4 border-amber-500 text-[#0f172a]" : "text-gray-400 hover:text-gray-600"}`}
          >
            📥 Importação
          </button>
          
        </div>
      </header>

      {/* As páginas específicas carregam aqui dentro! */}
      {children}
    </main>
  );
}