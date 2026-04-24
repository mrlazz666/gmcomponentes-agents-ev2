import { AiUserContext, ProductLite } from './ai-core.models';

export interface FaqRequest {
  mode: 'faq';
  usuario: AiUserContext;
  pregunta: string;
  productos: ProductLite[];
}

export interface FaqResponse {
  respuesta: string;
  sugerencias: string[];
  productoDestacado: ProductLite | null;
  productosRelacionados: ProductLite[];
}
