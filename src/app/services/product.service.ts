// src/app/services/product.service.ts

import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, forkJoin, throwError } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { Product, CartItem } from '../models/models'; // Importar interfaces
import { ComprasRealizadas } from '../models/models';

@Injectable({
  providedIn: 'root'
})
export class ProductService {
  private apiUrl = 'https://gmcomponents.onrender.com/backend/products/';
  private historyUrl = 'https://gmcomponents.onrender.com/backend/ComprasRealizadas/'; // URL para el historial de compras

  constructor(private http: HttpClient) { }

  // Obtener todos los productos (opcional, según necesidades)
  getProducts(): Observable<Product[]> {
    return this.http.get<Product[]>(this.apiUrl)
      .pipe(catchError(this.handleError));
  }

  // Actualizar el stock de un producto específico
  updateProductStock(product: Product, quantityPurchased: number): Observable<Product> {
    const updatedStock = product.stock - quantityPurchased;
    return this.http.patch<Product>(`${this.apiUrl}/${product.id}/`, { stock: updatedStock })
      .pipe(catchError(this.handleError));
  }

  // Procesar la compra: verificar y actualizar el stock de todos los productos en el carrito
  processPurchase(cartItems: CartItem[]): Observable<any> {
    const verificationRequests = cartItems.map(item => 
      this.http.get<Product>(`${this.apiUrl}/${item.id}/`).pipe(
        catchError(this.handleError),
        map(product => {
          if (!product) {
            throw new Error( `Producto con ID ${item.id} no encontrado.`);
          }
          if (product.stock < item.quantity) {
            throw new Error(`Stock insuficiente para el producto ${product.nombre}.`);
          }
          return product;
        })
      )
    );

    return forkJoin(verificationRequests).pipe(
      switchMap(products => {
        const updateRequests = products.map(product => {
          const cartItem = cartItems.find(item => item.id === product.id);
          if (!cartItem) {
            throw new Error(`Carrito inconsistente: producto con ID ${product.id} no encontrado.`);
          }
          return this.updateProductStock(product, cartItem.quantity).pipe(
            catchError((error) => {
              console.error(`Error al actualizar el stock del producto con ID ${product.id}:`, error);
              return throwError(new Error(` actualizar el stock del producto con ID ${product.id}.`));
            })
          );
        });
        return forkJoin(updateRequests);
      }),
      catchError((error) => {
        console.error('Error en la verificación de productos o actualización de stock:', error);
        return throwError(new Error('actualización de stock.'));
      })
    );
  }
  

  // Guardar historial de compras
  savePurchaseHistory(purchaseData: any): Observable<any> {
    return this.http.post<any>(this.historyUrl, purchaseData)
      .pipe(catchError(this.handleError));
  }

  // Manejo de errores
  private handleError(error: HttpErrorResponse) {
    console.error('Error en el ProductService:', error);
    let errorMessage = 'Ocurrió un error desconocido.';
    if (error.error instanceof ErrorEvent) {
      errorMessage = `Error: ${error.error.message}`;
    } else if (error.error && error.error.message) {
      errorMessage = error.error.message;
    } else if (error.message) {
      errorMessage = error.message;
    }
    return throwError(() => new Error(errorMessage));
  }
  

  getComprasPorCorreo(correo: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.historyUrl}?correo=${correo}`).pipe(
      catchError(this.handleError)
    );
  }
    
  // Limpiar el carrito (opcional, si prefieres manejarlo aquí)
  clearCart() {
    localStorage.removeItem('cart');
    localStorage.removeItem('totalAmount');
  }
}
