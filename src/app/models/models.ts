// src/app/models/models.ts

export interface CartItem {
    id: number;
    categoria: string;
    nombre: string;
    precio: number;
    quantity: number;
    image: string;
    descripcion: string;
  }
  
  export interface Product {
    id: number;
    categoria: string;
    nombre: string;
    descripcion: string;
    precio: number;
    stock: number;
    image: string;
  }
  
  export interface ComprasRealizadas {
    id: number; // ID de la compra
    correo: string; // Correo del usuario
    nombre: string; // Nombre del usuario
    totalAmount: number; // Monto total
    items: CartItem[]; // Lista de productos comprados
  }
  