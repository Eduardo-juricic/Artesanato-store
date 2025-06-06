// src/context/CartContext.jsx
import React, { createContext, useState, useContext, useEffect } from "react";

const CartContext = createContext();

export const useCart = () => useContext(CartContext);

export const CartProvider = ({ children }) => {
  const [cartItems, setCartItems] = useState(() => {
    const localData = localStorage.getItem("cartItems");
    return localData ? JSON.parse(localData) : [];
  });

  useEffect(() => {
    localStorage.setItem("cartItems", JSON.stringify(cartItems));
  }, [cartItems]);

  const addToCart = (productToAdd) => {
    setCartItems((prevItems) => {
      const existingItem = prevItems.find(
        (item) => item.id === productToAdd.id
      );
      if (existingItem) {
        return prevItems.map((item) =>
          item.id === productToAdd.id
            ? {
                ...item,
                quantity: item.quantity + (productToAdd.quantity || 1),
              }
            : item
        );
      }
      // AO ADICIONAR, INICIALIZA A OBSERVAÇÃO DO ITEM E ADICIONA AS IMAGENS DA GALERIA
      return [
        ...prevItems,
        {
          ...productToAdd,
          quantity: productToAdd.quantity || 1,
          itemObservation: "", // Campo para observação específica do item
          galeriaImagens: productToAdd.galeriaImagens || [], // <--- ADIÇÃO AQUI: Passa as imagens da galeria para o carrinho
        },
      ];
    });
  };

  const updateQuantity = (productId, quantity) => {
    setCartItems((prevItems) =>
      prevItems.map((item) =>
        item.id === productId
          ? { ...item, quantity: Math.max(1, quantity) }
          : item
      )
    );
  };

  // NOVA FUNÇÃO PARA ATUALIZAR A OBSERVAÇÃO DE UM ITEM ESPECÍFICO
  const updateItemObservation = (productId, observation) => {
    setCartItems((prevItems) =>
      prevItems.map((item) =>
        item.id === productId ? { ...item, itemObservation: observation } : item
      )
    );
  };

  const removeItem = (productId) => {
    setCartItems((prevItems) =>
      prevItems.filter((item) => item.id !== productId)
    );
  };

  const getTotal = () => {
    return cartItems.reduce((total, item) => {
      const price =
        item.preco_promocional &&
        Number(item.preco_promocional) < Number(item.preco)
          ? Number(item.preco_promocional)
          : Number(item.preco);
      return total + price * item.quantity;
    }, 0);
  };

  const clearCart = () => {
    setCartItems([]);
  };

  return (
    <CartContext.Provider
      value={{
        cartItems,
        addToCart,
        updateQuantity,
        removeItem,
        getTotal,
        clearCart,
        updateItemObservation, // Expor a nova função
      }}
    >
      {children}
    </CartContext.Provider>
  );
};
