export type AiMode = 'recommendation' | 'faq';

export interface ProductLite {
  id: number;
  categoria: string;
  nombre: string;
  descripcion: string;
  precio: number;
  stock: number;
  image: string;
  marca?: string;
  specs?: string[];
  recommendationNote?: string;
  rankLabel?: string;
}

export interface AiUserContext {
  correo: string;
  nombre: string;
  rol?: 'cliente' | 'admin';
}
