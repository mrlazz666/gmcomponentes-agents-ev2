import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { ProductService } from './product.service';
import { Product } from '../models/models';
import { ProductLite } from '../models/ai-core.models';

@Injectable({
  providedIn: 'root'
})
export class CatalogContextService {
  constructor(private productService: ProductService) {}

  getCatalog(): Observable<ProductLite[]> {
    return this.productService.getProducts().pipe(
      map((products: Product[]) =>
        products.map(product => ({
          id: product.id,
          categoria: product.categoria,
          nombre: product.nombre,
          descripcion: product.descripcion,
          precio: product.precio,
          stock: product.stock,
          image: product.image,
          marca: (product as Product & { marca?: string }).marca
        }))
      )
    );
  }
}
