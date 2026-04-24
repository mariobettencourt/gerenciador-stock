"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase"; 
import toast, { Toaster } from 'react-hot-toast';

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [aCarregar, setACarregar] = useState(false);
  const router = useRouter();

  const fazerLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setACarregar(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });

    if (error) {
      if (error.message.includes("Email not confirmed")) {
        toast.error("O seu e-mail ainda não foi confirmado. Verifique a sua caixa de entrada!", {
          duration: 6000,
          icon: '📧',
        });
      } else if (error.message.includes("Invalid login credentials")) {
        toast.error("E-mail ou password incorretos. Tente novamente.");
      } else {
        toast.error("Erro no acesso: " + error.message);
      }
      setACarregar(false);
    } else {
      toast.success("Bem-vindo à Lotaçor!");
      router.push("/dashboard");
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-cover bg-center font-sans"
      style={{ backgroundImage: "url('https://images.unsplash.com/photo-1534444535384-5690b21e89c6?q=80&w=1920&auto=format&fit=crop')" }}
    >
      <Toaster position="top-center" />

      <div className="bg-white/95 backdrop-blur-sm p-10 rounded-[2.5rem] shadow-2xl w-full max-w-md mx-4 border-4 border-white">
        
        {/* HEADER COM LOGÓTIPO OFICIAL */}
        <div className="flex flex-col items-center mb-10 text-center">
          <img 
            src="/logo.jpg" 
            alt="Lotaçor Logótipo" 
            className="h-20 object-contain mb-4" 
          />
          <div className="h-px w-16 bg-slate-200 mb-4"></div>
          <span className="text-[11px] font-black text-[#1e3a8a] tracking-[0.3em] uppercase italic">
            Gestão de Economato
          </span>
        </div>
        
        <form onSubmit={fazerLogin} className="space-y-5">
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Email Institucional</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                </svg>
              </span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-12 pr-5 py-4 bg-slate-50 border-2 border-transparent rounded-2xl text-sm font-bold text-[#1e3a8a] focus:bg-white focus:border-blue-500/20 outline-none transition-all placeholder:text-gray-300 shadow-inner"
                placeholder="exemplo@lotacor.pt"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Password</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                </svg>
              </span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-12 pr-5 py-4 bg-slate-50 border-2 border-transparent rounded-2xl text-sm font-bold text-[#1e3a8a] focus:bg-white focus:border-blue-500/20 outline-none transition-all placeholder:text-gray-300 shadow-inner"
                placeholder="••••••••"
              />
            </div>
          </div>
          
          <button
            type="submit"
            disabled={aCarregar}
            className="w-full py-5 bg-[#1e3a8a] text-white rounded-3xl font-black uppercase text-[10px] tracking-[0.2em] shadow-xl shadow-blue-900/20 hover:bg-blue-900 transition-all active:scale-95 disabled:bg-slate-300 mt-4"
          >
            {aCarregar ? "A verificar credenciais..." : "Entrar no Sistema"}
          </button>
        </form>

        <p className="text-center mt-8 text-[9px] font-bold text-gray-300 uppercase tracking-[0.2em]">
          Lotaçor S.A. © 2026 | Praia da Vitória
        </p>

      </div>
    </div>
  );
}