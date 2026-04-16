import nodemailer from 'nodemailer';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    // 1. AQUI ESTAVA O ERRO: Faltava incluir o "itens" na desestruturação
    const { pedidoId, emailDestino, nomeUtilizador, itens, pdfAnexo } = await req.json();

    // 2. Configura a ligação ao servidor de email (Lotaçor)
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true', 
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    // 3. Criar uma lista simples para o corpo do email (caso o PDF não abra)
    const resumoItens = itens && itens.length > 0 
      ? itens.map((i: any) => `<li>${i.nome} - ${i.quantidade} un.</li>`).join('')
      : "Consulte o anexo para ver os detalhes.";

// 4. Enviar o email com o PDF em anexo e o Logotipo
    await transporter.sendMail({
      from: `"Lotaçor - Sistemas" <${process.env.SMTP_USER}>`,
      to: emailDestino,
      subject: `Guia de Pedido #${pedidoId} - Lotaçor SA`,
      html: `
        <div style="font-family: sans-serif; color: #333;">
          
          <img 
            src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTJNXUHunEvbIRhg-gbpEE4f_FROP_gL-QbvQ&s" 
            alt="Lotaçor SA" 
            style="max-height: 60px; margin-bottom: 20px; display: block;" 
          />
          
          <p>Olá <strong>${nomeUtilizador}</strong>,</p>
          <p>Confirmamos que o teu pedido <strong>#${pedidoId}</strong> foi processado.</p>
          <p>Segue em anexo o documento oficial em PDF.</p>
          <hr />
          <p style="font-size: 12px; color: #666;">Resumo rápido:</p>
          <ul style="font-size: 12px; color: #666;">${resumoItens}</ul>

      <p style="margin-top: 30px; font-size: 12px; color: #94a3b8; text-align: center;">
            Este é um email automático do Sistema de Gestão Economato. Por favor não respondas.
          </p>
        </div>
      `,
      attachments: [
        {
          filename: `Guia_Pedido_${pedidoId}.pdf`,
          content: pdfAnexo,
          encoding: 'base64'
        }
      ]
    });

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("Erro na API de Email:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}