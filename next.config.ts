/** @type {import('next').NextConfig} */
const nextConfig = {
  // O NextConfig não tem propriedade 'devServer'.
  // Para controlar o overlay de erros, usar onRecvError ou desligar via env var.
  images: { unoptimized: true } 
};

export default nextConfig;
