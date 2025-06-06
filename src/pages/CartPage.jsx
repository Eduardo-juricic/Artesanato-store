// src/pages/CartPage.jsx
import React, { useState } from "react";
import { useCart } from "../context/CartContext";
import { Link as RouterLink } from "react-router-dom";
import { getFunctions, httpsCallable } from "firebase/functions";
import { db } from "../FirebaseConfig";
import {
  collection,
  addDoc,
  serverTimestamp,
  doc,
  updateDoc,
} from "firebase/firestore";

function CartPage() {
  const {
    cartItems,
    updateQuantity,
    removeItem,
    getTotal,
    clearCart,
    updateItemObservation,
  } = useCart();

  // Novos estados para frete
  const [cep, setCep] = useState("");
  const [shippingOptions, setShippingOptions] = useState([]);
  const [selectedShipping, setSelectedShipping] = useState(null);
  const [loadingShipping, setLoadingShipping] = useState(false);
  const [shippingError, setShippingError] = useState("");

  // Estados existentes
  const [loadingPayment, setLoadingPayment] = useState(false);
  const [cliente, setCliente] = useState({
    nomeCompleto: "",
    email: "",
    telefone: "",
    cpf: "",
    cep: "",
    logradouro: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "",
    estado: "",
  });
  const [formErrors, setFormErrors] = useState({});

  const functionsInstance = getFunctions(undefined, "southamerica-east1");
  const createPreferenceCallable = httpsCallable(
    functionsInstance,
    "createPaymentPreference"
  );
  // Nova callable para frete
  const calculateShippingCallable = httpsCallable(
    functionsInstance,
    "calculateShipping"
  );

  const handleQuantityChange = (productId, quantity) => {
    const newQuantity = Math.max(1, parseInt(quantity, 10) || 1);
    updateQuantity(productId, newQuantity);
    // Reseta o frete se a quantidade mudar
    setShippingOptions([]);
    setSelectedShipping(null);
  };

  const handleRemoveItem = (productId) => {
    removeItem(productId);
    setShippingOptions([]);
    setSelectedShipping(null);
  };

  const handleCalculateShipping = async () => {
    if (!/^\d{8}$/.test(cep.replace(/\D/g, ""))) {
      setShippingError("Por favor, insira um CEP válido com 8 dígitos.");
      return;
    }

    setLoadingShipping(true);
    setShippingError("");
    setSelectedShipping(null);
    setShippingOptions([]);

    const itemsPayload = cartItems.map((item) => ({
      id: item.id,
      largura: item.largura,
      altura: item.altura,
      comprimento: item.comprimento,
      peso: item.peso,
      quantity: item.quantity,
      precoUnitario: parseFloat(
        item.preco_promocional &&
          Number(item.preco_promocional) < Number(item.preco)
          ? item.preco_promocional
          : item.preco
      ),
    }));

    try {
      const result = await calculateShippingCallable({
        cep_destino: cep,
        items: itemsPayload,
      });
      if (result.data && result.data.length > 0) {
        setShippingOptions(result.data);
      } else {
        setShippingError("Nenhuma opção de frete encontrada para este CEP.");
      }
    } catch (error) {
      console.error("Erro ao calcular frete:", error);
      setShippingError(
        error.message || "Não foi possível calcular o frete. Tente novamente."
      );
    } finally {
      setLoadingShipping(false);
    }
  };

  const handleClienteChange = (e) => {
    const { name, value } = e.target;
    setCliente((prev) => ({ ...prev, [name]: value }));
    if (formErrors[name]) {
      setFormErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  const handleItemObservationChange = (itemId, value) => {
    updateItemObservation(itemId, value);
    const errorKey = `itemObservation-${itemId}`;
    if (formErrors[errorKey]) {
      setFormErrors((prev) => ({ ...prev, [errorKey]: null }));
    }
  };

  const validateForm = () => {
    const errors = {};
    // Validações do cliente
    if (!cliente.nomeCompleto.trim())
      errors.nomeCompleto = "Nome completo é obrigatório.";
    else if (cliente.nomeCompleto.trim().split(" ").length < 2)
      errors.nomeCompleto = "Por favor, insira nome e sobrenome.";
    if (!cliente.email.trim()) errors.email = "Email é obrigatório.";
    else if (!/\S+@\S+\.\S+/.test(cliente.email))
      errors.email = "Email inválido.";
    if (!cliente.telefone.trim()) errors.telefone = "Telefone é obrigatório.";
    else if (!/^\d{10,11}$/.test(cliente.telefone.replace(/\D/g, "")))
      errors.telefone = "Telefone inválido (com DDD, 10 ou 11 dígitos).";
    if (!cliente.cpf.trim()) errors.cpf = "CPF é obrigatório.";
    else if (!/^\d{11}$/.test(cliente.cpf.replace(/\D/g, "")))
      errors.cpf = "CPF inválido (11 dígitos).";

    // Validações do endereço
    if (!cliente.cep.trim()) errors.cep = "CEP é obrigatório.";
    else if (!/^\d{5}-?\d{3}$/.test(cliente.cep.replace(/\D/g, "")))
      errors.cep = "CEP inválido.";
    if (!cliente.logradouro.trim())
      errors.logradouro = "Logradouro é obrigatório.";
    if (!cliente.numero.trim()) errors.numero = "Número é obrigatório.";
    if (!cliente.bairro.trim()) errors.bairro = "Bairro é obrigatório.";
    if (!cliente.cidade.trim()) errors.cidade = "Cidade é obrigatória.";
    if (!cliente.estado.trim()) errors.estado = "Estado é obrigatório.";
    else if (!/^[A-Z]{2}$/i.test(cliente.estado))
      errors.estado = "Estado inválido (sigla com 2 letras).";

    // Validação da observação de cada item
    cartItems.forEach((item) => {
      const itemObsKey = `itemObservation-${item.id}`;
      if (!item.itemObservation || !item.itemObservation.trim()) {
        errors[
          itemObsKey
        ] = `Detalhes da personalização para "${item.nome}" são obrigatórios.`;
      } else if (item.itemObservation.trim().length < 5) {
        errors[
          itemObsKey
        ] = `Forneça mais detalhes para "${item.nome}" (mín. 5 caracteres).`;
      }
    });

    // Validação do frete
    if (!selectedShipping) {
      errors.shipping = "Por favor, calcule e selecione uma opção de frete.";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCheckout = async (e) => {
    e.preventDefault();
    if (!validateForm()) {
      alert(
        "Por favor, corrija os erros no formulário, incluindo a seleção do frete, antes de prosseguir."
      );
      return;
    }
    setLoadingPayment(true);
    let orderId = null;

    const totalComFrete = total + parseFloat(selectedShipping.price);

    try {
      const newOrderRef = await addDoc(collection(db, "pedidos"), {
        cliente: {
          nomeCompleto: cliente.nomeCompleto,
          email: cliente.email,
          telefone: cliente.telefone.replace(/\D/g, ""),
          cpf: cliente.cpf.replace(/\D/g, ""),
          endereco: {
            cep: cliente.cep.replace(/\D/g, ""),
            logradouro: cliente.logradouro,
            numero: cliente.numero,
            complemento: cliente.complemento,
            bairro: cliente.bairro,
            cidade: cliente.cidade,
            estado: cliente.estado.toUpperCase(),
          },
        },
        items: cartItems.map((item) => ({
          id: item.id,
          nome: item.nome,
          quantity: item.quantity,
          precoUnitario: parseFloat(
            item.preco_promocional &&
              Number(item.preco_promocional) < Number(item.preco)
              ? item.preco_promocional
              : item.preco
          ),
          observacaoProduto: item.itemObservation || "",
        })),
        totalAmount: totalComFrete, // Salva o total com frete
        subtotalAmount: total, // Salva o subtotal
        shippingDetails: {
          // Salva detalhes do frete
          carrier: selectedShipping.name,
          price: parseFloat(selectedShipping.price),
          deliveryTime: selectedShipping.delivery_time,
          cep: cep,
        },
        statusPedido: "pendente_pagamento",
        statusPagamentoMP: "pendente",
        dataCriacao: serverTimestamp(),
      });
      orderId = newOrderRef.id;
    } catch (error) {
      console.error("Erro ao criar pedido no Firestore:", error);
      alert("Não foi possível registrar seu pedido. Tente novamente.");
      setLoadingPayment(false);
      return;
    }

    // Adiciona o item de frete ao payload do Mercado Pago
    const itemsParaPagamento = [
      ...cartItems.map((item) => ({
        id: item.id,
        title: item.nome,
        description: item.descricao || item.nome,
        quantity: item.quantity,
        unit_price: parseFloat(
          item.preco_promocional &&
            Number(item.preco_promocional) < Number(item.preco)
            ? item.preco_promocional
            : item.preco
        ),
      })),
      {
        id: "shipping_cost",
        title: `Frete - ${selectedShipping.name}`,
        description: "Custo de envio do pedido",
        quantity: 1,
        unit_price: parseFloat(selectedShipping.price),
      },
    ];

    const nomeArray = cliente.nomeCompleto.trim().split(" ");
    const payerInfoPayload = {
      name: nomeArray[0],
      surname: nomeArray.slice(1).join(" "),
      email: cliente.email,
    };
    const baseUrl = window.location.origin;
    const webhookUrl = import.meta.env.VITE_MERCADO_PAGO_WEBHOOK_URL;

    try {
      const result = await createPreferenceCallable({
        items: itemsParaPagamento,
        payerInfo: payerInfoPayload,
        externalReference: orderId,
        backUrls: {
          success: `${baseUrl}/pagamento/sucesso?order_id=${orderId}`,
          failure: `${baseUrl}/pagamento/falha?order_id=${orderId}`,
          pending: `${baseUrl}/pagamento/pendente?order_id=${orderId}`,
        },
        notificationUrl: webhookUrl,
      });
      if (result.data && result.data.init_point) {
        clearCart(); // Limpa o carrinho ao ser redirecionado para o pagamento
        window.location.href = result.data.init_point;
      } else {
        alert("Não foi possível iniciar o pagamento.");
      }
    } catch (error) {
      alert("Ocorreu um erro ao tentar processar seu pedido.");
    } finally {
      setLoadingPayment(false);
    }
  };

  const total = getTotal();
  const totalComFrete = selectedShipping
    ? total + parseFloat(selectedShipping.price)
    : total;

  if (cartItems.length === 0) {
    return (
      <div className="container mx-auto px-4 py-20 text-center ...">
        {/* ... (código para carrinho vazio) ... */}
      </div>
    );
  }

  // O resto do JSX segue abaixo, com as novas seções de frete
  return (
    // ... (código JSX principal) ...
    <div className="container mx-auto px-4 py-16">
      <h2 className="text-3xl font-extrabold mb-8 text-gray-900 border-b pb-4">
        Seu Carrinho de Compras
      </h2>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow-md">
          <ul className="divide-y divide-gray-200">
            {cartItems.map((item) => {
              const caracteristicas = item.destaque_curto
                ? item.destaque_curto
                    .split(";")
                    .map((c) => c.trim())
                    .filter((c) => c !== "")
                : [];
              const itemObsErrorKey = `itemObservation-${item.id}`;
              return (
                <li key={item.id} className="flex flex-col sm:flex-row py-6">
                  {/* ... (código de cada item do carrinho, sem alterações) ... */}
                  {/* ... igual ao seu código original ... */}
                  <div className="ml-0 sm:ml-4 flex flex-1 flex-col justify-between mt-4 sm:mt-0">
                    {/* ... */}
                    <textarea
                      id={itemObsErrorKey}
                      value={item.itemObservation || ""}
                      onChange={(e) =>
                        handleItemObservationChange(item.id, e.target.value)
                      }
                      // ...
                    ></textarea>
                    {/* ... */}
                  </div>
                </li>
              );
            })}
          </ul>

          <form onSubmit={handleCheckout} id="checkout-form" noValidate>
            {/* ... (todos os seus inputs de cliente aqui) ... */}
          </form>
        </div>

        {/* --- COLUNA DE RESUMO DO PEDIDO --- */}
        <div className="lg:col-span-1 bg-white p-6 rounded-lg shadow-md h-fit sticky top-24">
          <h3 className="text-2xl font-bold text-gray-900 mb-4">
            Resumo do Pedido
          </h3>
          {/* ... (resumo de subtotal) ... */}

          {/* --- NOVA SEÇÃO DE FRETE --- */}
          <div className="mt-6 pt-4 border-t">
            <h4 className="text-lg font-semibold text-gray-800 mb-3">
              Calcular Frete
            </h4>
            <div className="flex items-start gap-2">
              <input
                type="text"
                placeholder="Seu CEP"
                value={cep}
                onChange={(e) => setCep(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md shadow-sm"
              />
              <button
                onClick={handleCalculateShipping}
                disabled={loadingShipping}
                className="bg-gray-700 text-white px-5 py-2 rounded-md hover:bg-gray-800 disabled:opacity-50"
              >
                {loadingShipping ? "..." : "OK"}
              </button>
            </div>
            {shippingError && (
              <p className="text-red-500 text-xs mt-2">{shippingError}</p>
            )}

            {/* Opções de Frete */}
            {shippingOptions.length > 0 && (
              <div className="mt-4 space-y-3">
                {shippingOptions.map((option) => (
                  <label
                    key={option.id}
                    className="flex items-center p-3 border rounded-md cursor-pointer hover:bg-gray-50"
                  >
                    <input
                      type="radio"
                      name="shipping"
                      checked={selectedShipping?.id === option.id}
                      onChange={() => setSelectedShipping(option)}
                      className="h-4 w-4 text-emerald-600 border-gray-300 focus:ring-emerald-500"
                    />
                    <div className="ml-3 text-sm flex-grow">
                      <p className="font-semibold text-gray-800">
                        {option.name}
                      </p>
                      <p className="text-gray-600">
                        Prazo: {option.delivery_time} dias
                      </p>
                    </div>
                    <p className="font-bold text-gray-900">
                      R$ {parseFloat(option.price).toFixed(2).replace(".", ",")}
                    </p>
                  </label>
                ))}
              </div>
            )}
            {formErrors.shipping && (
              <p className="text-red-500 text-xs mt-2">{formErrors.shipping}</p>
            )}
          </div>

          <div className="flex justify-between items-center text-gray-700 text-lg mb-2 mt-4 border-t pt-4">
            <span>Subtotal:</span>
            <span>R$ {total.toFixed(2).replace(".", ",")}</span>
          </div>

          {selectedShipping && (
            <div className="flex justify-between items-center text-gray-700 text-lg mb-2">
              <span>Frete ({selectedShipping.name}):</span>
              <span>
                R${" "}
                {parseFloat(selectedShipping.price)
                  .toFixed(2)
                  .replace(".", ",")}
              </span>
            </div>
          )}

          <div className="flex justify-between items-center text-xl font-extrabold text-gray-900 border-t pt-4 mt-4">
            <span>Total:</span>
            <span>R$ {totalComFrete.toFixed(2).replace(".", ",")}</span>
          </div>

          <button
            type="submit"
            form="checkout-form"
            disabled={loadingPayment || cartItems.length === 0}
            className="w-full mt-6 bg-emerald-600 ..."
          >
            {loadingPayment ? "Processando..." : "Finalizar Compra e Pagar"}
          </button>
          <div className="mt-4 text-center">
            <RouterLink to="/" className="text-emerald-600 ...">
              Continuar Comprando
            </RouterLink>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CartPage;
