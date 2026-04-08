"use client"; // Esta linha é crucial no Next.js para permitir interatividade (cliques, formulários)

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase"; // Importamos a nossa ligação ao Supabase

export default function Login() {
  // Variáveis para guardar o que o utilizador escreve
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [erro, setErro] = useState("");
  const [aCarregar, setACarregar] = useState(false);
  const router = useRouter();

  // Função que é executada quando clicamos em "Entrar"
  const fazerLogin = async (e: React.FormEvent) => {
    e.preventDefault(); // Evita que a página recarregue do zero
    setErro("");
    setACarregar(true);

    // Pedimos ao Supabase para verificar as credenciais
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });

    if (error) {
      setErro("Credenciais inválidas. Tente novamente.");
      setACarregar(false);
    } else {
      router.push("/dashboard");
      setACarregar(false);
      // No próximo passo, vamos trocar este alerta por um redirecionamento para o Dashboard!
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-cover bg-center"
      style={{ backgroundImage: "url('https://images.unsplash.com/photo-1534444535384-5690b21e89c6?q=80&w=1920&auto=format&fit=crop')" }}
    >
      <div className="bg-white p-10 rounded-xl shadow-2xl w-full max-w-md mx-4">
        
        <div className="flex flex-col items-center mb-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-14 border-2 border-[#1e3a8a] rounded-b-full flex items-center justify-center bg-blue-50">
               <span className="text-[#1e3a8a] text-xl">🐟</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-bold text-[#1e3a8a] leading-tight">CONTROLO</span>
              <span className="text-xl font-bold text-[#1e3a8a] leading-tight">DE STOCK</span>
              <span className="text-xs text-gray-500 tracking-widest mt-1">ECONOMATO</span>
            </div>
          </div>
        </div>
        
        {/* Alterámos para onSubmit */}
        <form onSubmit={fazerLogin} className="space-y-6">
          
          {/* Mostrar mensagem de erro se houver */}
          {erro && (
            <div className="bg-red-50 text-red-500 p-3 rounded-md text-sm text-center">
              {erro}
            </div>
          )}

          <div>
            <label className="block text-sm font-serif text-gray-800 mb-1">Email (Utilizador):</label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-gray-400">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                </svg>
              </span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10 block w-full px-4 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]"
                placeholder="exemplo@economato.pt"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-serif text-gray-800 mb-1">Password:</label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-gray-400">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                </svg>
              </span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10 block w-full px-4 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]"
              />
            </div>
          </div>
          
          <button
            type="submit"
            disabled={aCarregar}
            className="w-full flex justify-center py-2.5 px-4 border border-[#1e3a8a] shadow-sm text-sm font-medium text-white bg-[#1e3a8a] hover:bg-blue-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#1e3a8a] transition-colors mt-4 disabled:bg-gray-400"
          >
            {aCarregar ? "A verificar..." : "Entrar"}
          </button>
        </form>

      </div>
    </div>
  );
}