"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import * as XLSX from "xlsx";

export default function AdminImportar() {
  const [aCarregar, setACarregar] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const adicionarLog = (mensagem: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString('pt-PT')}] ${mensagem}`]);
  };

  // --- LÓGICA DE IMPORTAÇÃO DE PRODUTOS (EXCEL & CSV) ---
  const processarFicheiroProdutos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setACarregar(true);
    setLogs([]);
    adicionarLog(`A ler ficheiro Excel/CSV: ${file.name}...`);

    const reader = new FileReader();
    
    // Agora lemos o ficheiro como um ArrayBuffer (Formato que o Excel exige)
    reader.onload = async (evento) => {
      try {
        const data = new Uint8Array(evento.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Pega na primeira folha (sheet) do Excel
        const nomePrimeiraFolha = workbook.SheetNames[0];
        const folha = workbook.Sheets[nomePrimeiraFolha];
        
        // Converte a folha de Excel para um array de arrays (linhas e colunas)
        const linhas: any[][] = XLSX.utils.sheet_to_json(folha, { header: 1 });
        
        // Limpa linhas vazias
        const linhasValidas = linhas.filter(l => l.length > 0);
        
        if (linhasValidas.length === 0) throw new Error("O ficheiro parece estar vazio.");

        // O Excel pode ter a tal linha "Filtros: Nenhum", por isso detetamos o cabeçalho real
        let cabecalhoIndex = 0;
        if (String(linhasValidas[0][0] || "").includes("Filtros:")) {
          cabecalhoIndex = 1;
        }
        
        const cabecalhos = linhasValidas[cabecalhoIndex].map(h => String(h || "").trim());
        adicionarLog("Cabeçalhos detetados. A mapear colunas...");

        // Procurar os índices das colunas que queremos (Exatamente os nomes do teu Excel)
        const idxNome = cabecalhos.indexOf("Nome Único");
        const idxCategoria = cabecalhos.indexOf("Categorias");
        const idxLocal = cabecalhos.indexOf("Localização da Recompra");
        const idxQuantidade = cabecalhos.indexOf("Saldo Disponível");
        const idxPreco = cabecalhos.indexOf("Último Custo");

        if (idxNome === -1) {
          throw new Error("Não foi possível encontrar a coluna 'Nome Único' no cabeçalho do ficheiro.");
        }

        const produtosAInserir = [];
        
        // Começa a ler os dados logo abaixo do cabeçalho
        for (let i = cabecalhoIndex + 1; i < linhasValidas.length; i++) {
          const colunas = linhasValidas[i];
          if (!colunas || !colunas[idxNome]) continue; // Salta linhas sem nome de produto

          // Limpa a quantidade e o preço para garantir que o Supabase aceita números puros
          let quantidadeFormatada = 0;
          if (idxQuantidade !== -1 && colunas[idxQuantidade] !== undefined) {
            quantidadeFormatada = Math.max(0, parseInt(String(colunas[idxQuantidade]).replace(',', '')) || 0);
          }

          let precoFormatado = 0;
          if (idxPreco !== -1 && colunas[idxPreco] !== undefined) {
            precoFormatado = parseFloat(String(colunas[idxPreco]).replace(',', '.')) || 0;
          }

          produtosAInserir.push({
            nome: String(colunas[idxNome]).trim(),
            categoria: idxCategoria !== -1 && colunas[idxCategoria] ? String(colunas[idxCategoria]).trim() : "Geral",
            local: idxLocal !== -1 && colunas[idxLocal] ? String(colunas[idxLocal]).trim() : "Sede",
            quantidade: quantidadeFormatada,
            preco: precoFormatado
          });
        }

        if (produtosAInserir.length === 0) {
          throw new Error("Nenhum produto válido encontrado para importar.");
        }

        adicionarLog(`Mapeamento concluído: ${produtosAInserir.length} artigos encontrados.`);
        adicionarLog("A enviar para a base de dados (Supabase)...");

        // Envio em massa para o Supabase
const { error } = await supabase.from("produtos").upsert(produtosAInserir, { onConflict: 'nome, local' });
        if (error) {
          throw new Error(error.message);
        }

        adicionarLog("✅ Importação de Produtos concluída com sucesso!");
        alert(`Sucesso! Foram adicionados ${produtosAInserir.length} artigos ao catálogo.`);

      } catch (err: any) {
        adicionarLog(`❌ ERRO: ${err.message}`);
        alert("Ocorreu um erro. Verifique a caixa de registos.");
      } finally {
        setACarregar(false);
        e.target.value = ''; // Limpa o input para poder importar outro a seguir
      }
    };
    
    // Lê como ArrayBuffer (Magia para Excels e CSVs)
    reader.readAsArrayBuffer(file);
  };

 // --- LÓGICA DE IMPORTAÇÃO DE CONTACTOS (EXCEL & CSV) ---
  const processarFicheiroContactos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setACarregar(true);
    setLogs([]);
    adicionarLog(`A ler ficheiro de Contactos: ${file.name}...`);

    const reader = new FileReader();
    
    reader.onload = async (evento) => {
      try {
        const data = new Uint8Array(evento.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        const nomePrimeiraFolha = workbook.SheetNames[0];
        const folha = workbook.Sheets[nomePrimeiraFolha];
        
        const linhas: any[][] = XLSX.utils.sheet_to_json(folha, { header: 1 });
        const linhasValidas = linhas.filter(l => l.length > 0);
        
        if (linhasValidas.length === 0) throw new Error("O ficheiro de contactos parece estar vazio.");

        // Deteta se tem a linha "Filtros: Nenhum" e avança para o cabeçalho real
        let cabecalhoIndex = 0;
        if (String(linhasValidas[0][0] || "").includes("Filtros:")) {
          cabecalhoIndex = 1;
        }
        
        const cabecalhos = linhasValidas[cabecalhoIndex].map(h => String(h || "").trim());
        adicionarLog("Cabeçalhos detetados. A mapear colunas...");

        // Procurar os índices das colunas exatas do teu ficheiro
        const idxNome = cabecalhos.indexOf("Nome");
        const idxEndereco = cabecalhos.indexOf("Endereço");
        const idxEmail = cabecalhos.indexOf("Email");
        const idxTelefone = cabecalhos.indexOf("Telefone");

        if (idxNome === -1) {
          throw new Error("Não foi possível encontrar a coluna 'Nome' no cabeçalho do ficheiro.");
        }

        const contactosAInserir = [];
        
        for (let i = cabecalhoIndex + 1; i < linhasValidas.length; i++) {
          const colunas = linhasValidas[i];
          if (!colunas || !colunas[idxNome]) continue; // Salta linhas sem nome

          contactosAInserir.push({
            nome: String(colunas[idxNome]).trim(),
            // Se não tiver endereço, colocamos 'Geral'
            departamento: idxEndereco !== -1 && colunas[idxEndereco] ? String(colunas[idxEndereco]).trim() : "Geral",
            email: idxEmail !== -1 && colunas[idxEmail] ? String(colunas[idxEmail]).trim() : null,
            telefone: idxTelefone !== -1 && colunas[idxTelefone] ? String(colunas[idxTelefone]).trim() : null
          });
        }

        if (contactosAInserir.length === 0) {
          throw new Error("Nenhum contacto válido encontrado para importar.");
        }

        adicionarLog(`Mapeamento concluído: ${contactosAInserir.length} contactos encontrados.`);
        adicionarLog("A enviar para a base de dados (Supabase)...");

       const { error } = await supabase.from("contactos").upsert(contactosAInserir, { onConflict: 'nome' });

        if (error) {
          throw new Error(error.message);
        }

        adicionarLog("✅ Importação de Contactos concluída com sucesso!");
        alert(`Sucesso! Foram adicionados ${contactosAInserir.length} contactos à lista.`);

      } catch (err: any) {
        adicionarLog(`❌ ERRO: ${err.message}`);
        alert("Ocorreu um erro. Verifique a caixa de registos.");
      } finally {
        setACarregar(false);
        e.target.value = ''; 
      }
    };
    
    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-12 mt-8">
      
      {/* PAINEL DE CARREGAMENTO */}
      <div className="space-y-8">
        
        {/* Bloco Importar Produtos */}
        <div className="bg-white rounded-[3rem] p-10 shadow-2xl border-4 border-amber-50 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-bl-[100px] -z-10 transition-transform group-hover:scale-110"></div>
          
          <h2 className="text-xl font-black text-[#1e3a8a] mb-2 uppercase italic tracking-tighter flex items-center gap-2">
            <span>📦</span> Importar Catálogo (Produtos)
          </h2>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-8">Ficheiro EXCEL ou CSV</p>
          
          <div className="border-2 border-dashed border-gray-200 hover:border-amber-500 transition-colors rounded-3xl p-8 text-center bg-gray-50/50">
            <span className="text-4xl mb-4 block grayscale opacity-60 group-hover:grayscale-0 transition-all">📊</span>
            <p className="font-black text-sm text-[#0f172a] uppercase mb-1">Selecione o ficheiro EXCEL</p>
            <p className="text-[10px] text-gray-400 font-bold mb-6">Assegure-se que inclui a coluna "Nome Único"</p>
            
            <label className="cursor-pointer bg-[#1e3a8a] hover:bg-blue-800 text-white px-8 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all shadow-xl inline-block">
              Procurar Ficheiro
              <input 
                type="file" 
                accept=".xlsx, .xls, .csv" 
                className="hidden" 
                onChange={processarFicheiroProdutos}
                disabled={aCarregar}
              />
            </label>
          </div>
        </div>

        {/* Bloco Importar Contactos */}
        <div className="bg-white rounded-[3rem] p-10 shadow-2xl border-4 border-blue-50 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#1e3a8a]/5 rounded-bl-[100px] -z-10 transition-transform group-hover:scale-110"></div>
          
          <h2 className="text-xl font-black text-[#1e3a8a] mb-2 uppercase italic tracking-tighter flex items-center gap-2">
            <span>📇</span> Importar Unidades / Contactos
          </h2>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-8">Carregar nova lista de destinos (EXCEL)</p>
          
          <div className="border-2 border-dashed border-gray-200 hover:border-[#1e3a8a] transition-colors rounded-3xl p-8 text-center bg-gray-50/50">
            <span className="text-4xl mb-4 block grayscale opacity-60 group-hover:grayscale-0 transition-all">👥</span>
            <p className="font-black text-sm text-[#0f172a] uppercase mb-6">Selecione o ficheiro EXCEL</p>
            
            <label className="cursor-pointer bg-white border-2 border-[#1e3a8a] text-[#1e3a8a] hover:bg-blue-50 px-8 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all shadow-sm inline-block">
              Procurar Ficheiro
              <input 
                type="file" 
                accept=".xlsx, .xls, .csv" 
                className="hidden" 
                onChange={processarFicheiroContactos}
                disabled={aCarregar}
              />
            </label>
          </div>
        </div>
      </div>

      {/* CONSOLA DE REGISTOS (LOGS) */}
      <div className="bg-[#0f172a] rounded-[3rem] p-10 shadow-2xl text-white flex flex-col h-[600px] xl:h-auto">
        <h2 className="text-xl font-black uppercase italic tracking-tighter mb-6 border-b border-white/10 pb-4 flex items-center gap-2">
          <span>🖥️</span> Consola de Processamento
        </h2>
        
        <div className="flex-1 bg-black/40 rounded-2xl p-6 font-mono text-xs overflow-y-auto space-y-2 border border-white/5">
          {logs.length === 0 ? (
            <p className="text-gray-500 italic">O sistema está pronto. Aguardando ficheiro EXCEL/CSV...</p>
          ) : (
            logs.map((log, index) => (
              <p key={index} className={`${log.includes('❌') ? 'text-red-400' : log.includes('✅') ? 'text-green-400' : 'text-blue-200'}`}>
                {log}
              </p>
            ))
          )}
          {aCarregar && (
            <p className="text-amber-400 animate-pulse mt-4">A analisar o Excel e a enviar para a BD...</p>
          )}
        </div>
      </div>

    </div>
  );
}