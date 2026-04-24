/** @type {import('next').NextConfig} */
const nextConfig = {
  // Forçar o HMR a aceitar o IP da rede
  devServer: {
    client: {
      overlay: false,
      logging: 'none',
    },
  },
  // Se estiveres a usar a versão mais recente (v13/14/15)
  // podes precisar disto para evitar o erro de WebSocket
  images: { unoptimized: true } 
};

export default nextConfig;