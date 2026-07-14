export interface Perfil {
  id: string;
  nome: string;
  cargo?: string;
  email?: string;
}

export interface Contacto {
  id: number;
  nome: string;
  departamento: string;
  email?: string;
}

export interface Produto {
  id: number;
  nome: string;
  categoria?: string;
  quantidade: number;
  local?: string;
  preco?: number;
  stock_minimo?: number;
  created_at?: string;
}

export interface Pedido {
  id: number;
  requisitante: string;
  contacto_id: number;
  observacao?: string;
  estado: 'Pendente' | 'Processado' | 'Concluído';
  created_at: string;
  contactos?: Contacto;
}

export interface Movimento {
  id: number;
  produto_id: number;
  quantidade: number;
  tipo: 'Entrada' | 'Saída' | 'Criação' | 'Edição';
  utilizador?: string;
  pedido_id?: number;
  custo_unitario?: number;
  quantidade_restante?: number;
  observacao?: string;
  created_at: string;
  produtos?: Produto;
}

export interface LogPedido {
  id: number;
  pedido_id: number;
  acao: string;
  detalhes: string;
  utilizador: string;
  created_at: string;
}
