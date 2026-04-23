import nodemailer from 'nodemailer';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    // 1. Incluímos o 'preheader' na desestruturação vinda do frontend
    const { pedidoId, emailDestino, nomeUtilizador, itens, pdfAnexo, preheader } = await req.json();

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true', 
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const resumoItens = itens && itens.length > 0 
      ? itens.map((i: any) => `<li>${i.nome} - ${i.quantidade} un.</li>`).join('')
      : "Consulte o anexo para ver os detalhes.";

    await transporter.sendMail({
      from: `"Lotaçor - Sistemas" <${process.env.SMTP_USER}>`,
      to: emailDestino,
      subject: `Pedido #${pedidoId} - Lotaçor SA`,
      html: `
        <div style="display: none; max-height: 0px; overflow: hidden; font-size: 1px; line-height: 1px; color: #fff;">
          ${preheader}
        </div>
        <div style="display: none; max-height: 0px; overflow: hidden;">
          &nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;
        </div>

        <div style="font-family: sans-serif; color: #333; max-width: 600px;">
          <img 
            src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTJNXUHunEvbIRhg-gbpEE4f_FROP_gL-QbvQ&s" 
            alt="Lotaçor SA" 
            style="max-height: 60px; margin-bottom: 20px; display: block;" 
          />
          
          <p>Olá <strong>${nomeUtilizador}</strong>,</p>
          <p>Confirmamos que o pedido <strong>#${pedidoId}</strong> foi processado com sucesso.</p>
          <p>Segue em anexo o documento oficial em formato PDF.</p>
          
          <div style="background-color: #f8fafc; padding: 20px; border-radius: 15px; margin: 20px 0; border: 1px solid #e2e8f0;">
            <p style="font-size: 12px; color: #64748b; font-weight: bold; text-transform: uppercase; margin-bottom: 10px;">Resumo dos Itens:</p>
            <ul style="font-size: 13px; color: #334155; margin: 0; padding-left: 20px;">
              ${resumoItens}
            </ul>
          </div>

          <p style="margin-top: 30px; font-size: 11px; color: #94a3b8; text-align: center; border-top: 1px solid #eee; pt: 20px;">
            Este é um email automático do Sistema de Gestão Economato Lotaçor. Por favor, não responda a esta mensagem.
          </p>
        </div>
      `,
      attachments: [
        {
          filename: `Pedido_Lotacor_${pedidoId}.pdf`,
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