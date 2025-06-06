// src/pages/CartPage.jsx
import React, { useState } from "react";
import { useCart } from "../context/CartContext";
import { Link as RouterLink } from "react-router-dom";
import { getFunctions, httpsCallable } from "firebase/functions";
import { db } from "../FirebaseConfig";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

function CartPage() {
  const {
    cartItems,
    updateQuantity,
    removeItem,
    getTotal,
    clearCart,
    updateItemObservation,
  } = useCart();

  // Novos estados para frete (do seu código atual)
  const [cep, setCep] = useState("");
  const [shippingOptions, setShippingOptions] = useState([]);
  const [selectedShipping, setSelectedShipping] = useState(null);
  const [loadingShipping, setLoadingShipping] = useState(false);
  const [shippingError, setShippingError] = useState("");

  // Estados existentes (do seu código original)
  const [loadingPayment, setLoadingPayment] = useState(false);
  const [cliente, setCliente] = useState({
    nomeCompleto: "",
    email: "",
    telefone: "",
    cpf: "",
    cep: "", // Este CEP será o do cliente, diferente do CEP para cálculo de frete
    logradouro: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "",
    estado: "",
  });
  const [formErrors, setFormErrors] = useState({});

  // Funções callable do Firebase (do seu código atual)
  const functionsInstance = getFunctions(undefined, "southamerica-east1");
  const createPreferenceCallable = httpsCallable(
    functionsInstance,
    "createPaymentPreference"
  );
  const calculateShippingCallable = httpsCallable(
    functionsInstance,
    "calculateShipping"
  );

  // Funções de quantidade e remoção (do seu código original, com ajuste para frete)
  const handleQuantityChange = (productId, quantity) => {
    const newQuantity = Math.max(1, parseInt(quantity, 10) || 1);
    updateQuantity(productId, newQuantity);
    // IMPORTANTE: Reseta o frete se a quantidade mudar, pois o peso/dimensões podem mudar
    setShippingOptions([]);
    setSelectedShipping(null);
  };

  const handleIncreaseQuantity = (productId, currentQuantity) => {
    updateQuantity(productId, currentQuantity + 1);
    // Reseta o frete
    setShippingOptions([]);
    setSelectedShipping(null);
  };

  const handleDecreaseQuantity = (productId, currentQuantity) => {
    const newQuantity = Math.max(1, currentQuantity - 1);
    updateQuantity(productId, newQuantity);
    // Reseta o frete
    setShippingOptions([]);
    setSelectedShipping(null);
  };

  const handleRemoveItem = (productId) => {
    removeItem(productId);
    // Reseta o frete
    setShippingOptions([]);
    setSelectedShipping(null);
  };

  // Funções de cliente e observação (do seu código original)
  const handleClienteChange = (e) => {
    const { name, value } = e.target;
    setCliente((prevCliente) => ({ ...prevCliente, [name]: value }));
    if (formErrors[name]) {
      setFormErrors((prevErrors) => ({ ...prevErrors, [name]: null }));
    }
  };

  const handleItemObservationChange = (itemId, value) => {
    updateItemObservation(itemId, value);
    const errorKey = `itemObservation-${itemId}`;
    if (formErrors[errorKey]) {
      setFormErrors((prevErrors) => ({ ...prevErrors, [errorKey]: null }));
    }
  };

  // Lógica de cálculo de frete (do seu código atual)
  const handleCalculateShipping = async () => {
    // Usar o CEP do formulário do cliente para o cálculo do frete.
    // Você pode usar o estado `cep` que já está no input de cálculo de frete,
    // mas se o usuário digitar o CEP no campo de cliente e não no campo de frete,
    // o cálculo não será disparado. Considere sincronizar ou usar um único campo de CEP.
    // Por simplicidade, vou usar o estado `cep` do input de frete.
    const cepParaCalculo = cep.replace(/\D/g, "");

    if (!/^\d{8}$/.test(cepParaCalculo)) {
      setShippingError("Por favor, insira um CEP válido com 8 dígitos.");
      setShippingOptions([]); // Limpa opções antigas
      setSelectedShipping(null); // Limpa seleção antiga
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

    // Verifica se há itens no carrinho para calcular o frete
    if (itemsPayload.length === 0) {
      setShippingError("Adicione produtos ao carrinho para calcular o frete.");
      setLoadingShipping(false);
      return;
    }

    try {
      const result = await calculateShippingCallable({
        cep_destino: cepParaCalculo,
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

  // Validação do formulário (do seu código original, com adição do frete)
  const validateForm = () => {
    const errors = {};
    // Validações do cliente
    if (!cliente.nomeCompleto.trim())
      errors.nomeComplepleto = "Nome completo é obrigatório.";
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

    // Validação da observação de cada item (agora considera item.observacaoObrigatoria)
    cartItems.forEach((item) => {
      const itemObsErrorKey = `itemObservation-${item.id}`; // Variável definida corretamente aqui
      // Verifica se a observação é obrigatória E se está vazia ou muito curta
      if (
        item.observacaoObrigatoria &&
        (!item.itemObservation || item.itemObservation.trim() === "")
      ) {
        errors[
          itemObsErrorKey
        ] = `Detalhes da personalização para "${item.nome}" são obrigatórios.`;
      } else if (
        item.observacaoObrigatoria &&
        item.itemObservation.trim().length < 5
      ) {
        errors[
          itemObsErrorKey
        ] = `Forneça mais detalhes para "${item.nome}" (mín. 5 caracteres).`;
      }
    });

    // NOVA VALIDAÇÃO: Frete
    if (!selectedShipping) {
      errors.shipping = "Por favor, calcule e selecione uma opção de frete.";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const total = getTotal();
  // Calcula o total com frete (do seu código atual)
  const totalComFrete = selectedShipping
    ? total + parseFloat(selectedShipping.price)
    : total;

  // Lógica de Checkout (combinada do seu código original e atual)
  const handleCheckout = async (e) => {
    e.preventDefault();
    if (!validateForm()) {
      alert(
        "Por favor, corrija os erros no formulário, incluindo a seleção do frete, antes de prosseguir."
      );
      // Tentativa de focar no primeiro erro
      const firstErrorKey = Object.keys(formErrors).find(
        (key) => formErrors[key]
      );
      if (firstErrorKey) {
        const firstErrorElement = document.getElementById(firstErrorKey);
        if (firstErrorElement) {
          firstErrorElement.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
          firstErrorElement.focus({ preventScroll: true });
        }
      }
      return;
    }
    if (cartItems.length === 0) {
      alert("Seu carrinho está vazio!");
      return;
    }

    setLoadingPayment(true);
    let orderId = null;

    try {
      // Cria o pedido no Firestore, incluindo detalhes do frete E IMAGENS
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
          imagemPrincipal: item.imagem || "", // Imagem principal do produto
          galeriaImagens: item.galeriaImagens || [], // TODAS AS IMAGENS DA GALERIA DO PRODUTO
        })),
        totalAmount: totalComFrete, // Salva o total COM frete
        subtotalAmount: total, // Salva o subtotal dos produtos
        shippingDetails: {
          // Salva detalhes do frete
          carrier: selectedShipping.name,
          price: parseFloat(selectedShipping.price),
          deliveryTime: selectedShipping.delivery_time,
          cep: cep.replace(/\D/g, ""), // CEP usado para cálculo do frete
        },
        statusPedido: "pendente_pagamento",
        statusPagamentoMP: "pendente",
        dataCriacao: serverTimestamp(),
      });
      orderId = newOrderRef.id;
      console.log("Pedido criado no Firestore com ID:", orderId);
    } catch (error) {
      console.error("Erro ao criar pedido no Firestore:", error);
      alert("Não foi possível registrar seu pedido. Tente novamente.");
      setLoadingPayment(false);
      return;
    }

    // Prepara itens para o Mercado Pago, incluindo o custo do frete
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
        id: "shipping_cost", // ID único para o item de frete
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

    if (!webhookUrl || webhookUrl.includes("COLE_A_URL_DA_SUA_FUNCAO")) {
      console.error("ERRO CRÍTICO: URL de Webhook não configurada.");
      alert("Erro de configuração. Contate o suporte.");
      setLoadingPayment(false);
      return;
    }

    try {
      console.log("Enviando para createPaymentPreference:", {
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
      console.log("Resposta da Cloud Function:", result);
      if (result.data && result.data.init_point) {
        clearCart(); // Limpa o carrinho ao ser redirecionado para o pagamento
        window.location.href = result.data.init_point;
      } else {
        console.error("Erro: init_point não encontrado.", result.data);
        alert("Não foi possível iniciar o pagamento. (PREF_INIT_FAIL)");
      }
    } catch (error) {
      console.error("Erro ao chamar Cloud Function:", error);
      let displayError =
        "Ocorreu um erro ao tentar processar seu pedido. Por favor, tente novamente mais tarde.";
      if (error.details && error.details.message) {
        displayError = error.details.message;
      } else if (error.message) {
        displayError = error.message;
      }
      alert(displayError + " (Código: CF_CALL_ERROR)");
    } finally {
      setLoadingPayment(false);
    }
  };

  // Renderização condicional para carrinho vazio (do seu código original)
  if (cartItems.length === 0) {
    return (
      <div className="container mx-auto px-4 py-20 text-center bg-white shadow-lg rounded-lg mt-10 max-w-2xl">
        <h2 className="text-3xl font-extrabold text-gray-900 mb-6">
          Seu carrinho está vazio.
        </h2>
        <p className="text-lg text-gray-600 mb-8">
          Que tal explorar nossos produtos incríveis?
        </p>
        <RouterLink
          to="/"
          className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-600 transition duration-300 ease-in-out"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 mr-2"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm.707-10.293a1 1 0 00-1.414-1.414L7.5 8.586 5.707 6.879a1 1 0 00-1.414 1.414l2.5 2.5a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
          Voltar para a loja
        </RouterLink>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-16">
      <h2 className="text-3xl font-extrabold mb-8 text-gray-900 border-b pb-4">
        Seu Carrinho de Compras
      </h2>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Coluna Principal: Itens do Carrinho e Formulário de Cliente */}
        <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow-md">
          <ul className="divide-y divide-gray-200">
            {cartItems.map((item) => {
              const caracteristicas = item.destaque_curto
                ? item.destaque_curto
                    .split(";")
                    .map((c) => c.trim())
                    .filter((c) => c !== "")
                : [];
              const itemObsErrorKey = `itemObservation-${item.id}`; // Variável definida corretamente aqui
              const itemPrice =
                item.preco_promocional &&
                Number(item.preco_promocional) < Number(item.preco)
                  ? item.preco_promocional
                  : item.preco;

              return (
                <li key={item.id} className="flex flex-col sm:flex-row py-6">
                  <div className="flex-shrink-0 w-32 h-32 sm:w-40 sm:h-40 relative rounded-md overflow-hidden">
                    <img
                      src={item.imagem} // Use item.imagem, como no seu código original
                      alt={item.nome}
                      className="w-full h-full object-cover object-center"
                    />
                    {item.preco_promocional &&
                      item.preco_promocional < item.preco && (
                        <span className="absolute top-2 left-2 bg-emerald-500 text-white text-xs font-semibold px-2 py-1 rounded-full">
                          Promoção!
                        </span>
                      )}
                  </div>
                  <div className="ml-0 sm:ml-4 flex flex-1 flex-col justify-between mt-4 sm:mt-0">
                    <div>
                      <div className="flex justify-between items-baseline mb-2">
                        <h3 className="text-xl font-bold text-gray-900">
                          {item.nome}
                        </h3>
                        {item.preco_promocional &&
                        item.preco_promocional < item.preco ? (
                          <div className="text-lg font-semibold flex items-baseline">
                            <span className="text-gray-500 line-through mr-2">
                              R${" "}
                              {Number(item.preco).toFixed(2).replace(".", ",")}
                            </span>
                            <span className="text-emerald-600">
                              R${" "}
                              {Number(item.preco_promocional)
                                .toFixed(2)
                                .replace(".", ",")}
                            </span>
                          </div>
                        ) : (
                          <p className="text-lg font-semibold text-gray-800">
                            R$ {Number(item.preco).toFixed(2).replace(".", ",")}
                          </p>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-gray-600">
                        {item.descricao}
                      </p>
                      {caracteristicas.length > 0 && (
                        <div className="mt-2 text-sm text-gray-700">
                          <p className="font-semibold mb-1">Características:</p>
                          <ul className="list-disc list-inside space-y-0.5 text-gray-600">
                            {caracteristicas.map((caracteristica, index) => (
                              <li key={index}>{caracteristica}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {/* ADIÇÃO AQUI: Exibir imagens da galeria no item do carrinho, se existirem */}
                      {item.galeriaImagens &&
                        item.galeriaImagens.length > 0 && (
                          <div className="mt-2">
                            <p className="text-sm font-semibold text-gray-700">
                              Outras Variações do produto:
                            </p>
                            <div className="flex flex-wrap gap-2 mt-1">
                              {item.galeriaImagens.map((imgUrl, idx) => (
                                <img
                                  key={idx}
                                  src={imgUrl}
                                  alt={`${item.nome} - Galeria ${idx + 1}`}
                                  className="w-16 h-16 object-cover rounded-md border border-gray-200"
                                />
                              ))}
                            </div>
                          </div>
                        )}
                    </div>

                    {/* Campo de observação por item */}
                    <div className="mt-4">
                      <label
                        htmlFor={itemObsErrorKey}
                        className="block text-sm font-medium text-gray-700 mb-1"
                      >
                        Personalização para "{item.nome}"*{" "}
                        <span className="text-xs font-normal text-gray-500">
                          (Ex: nome, tema, cor)
                        </span>
                        :
                      </label>
                      <textarea
                        id={itemObsErrorKey}
                        value={item.itemObservation || ""}
                        onChange={(e) =>
                          handleItemObservationChange(item.id, e.target.value)
                        }
                        className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm ${
                          formErrors[itemObsErrorKey]
                            ? "border-red-500"
                            : "border-gray-300"
                        }`}
                        rows="2"
                        placeholder="Digite os detalhes da personalização aqui..."
                        aria-describedby={
                          formErrors[itemObsErrorKey]
                            ? `${itemObsErrorKey}-error`
                            : undefined
                        }
                      ></textarea>
                      {formErrors[itemObsErrorKey] && (
                        <p
                          id={`${itemObsErrorKey}-error`}
                          className="text-red-500 text-xs mt-1"
                        >
                          {formErrors[itemObsErrorKey]}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-1 items-end justify-between text-sm mt-4 sm:mt-0">
                      <div className="flex items-center">
                        <label
                          htmlFor={`quantity-${item.id}`}
                          className="mr-2 text-gray-700"
                        >
                          Qtd:
                        </label>
                        <div className="flex items-center border border-gray-300 rounded-md shadow-sm">
                          <button
                            type="button"
                            onClick={() =>
                              handleDecreaseQuantity(item.id, item.quantity)
                            }
                            className="p-2 text-gray-700 hover:bg-gray-100 rounded-l-md focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          >
                            -
                          </button>
                          <input
                            id={`quantity-${item.id}`}
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) =>
                              handleQuantityChange(item.id, e.target.value)
                            }
                            className="w-12 text-center text-gray-900 focus:outline-none focus:ring-0 border-l border-r border-gray-300"
                            style={{
                              MozAppearance: "textfield",
                              WebkitAppearance: "none",
                            }}
                          />
                          <button
                            type="button"
                            onClick={() =>
                              handleIncreaseQuantity(item.id, item.quantity)
                            }
                            className="p-2 text-gray-700 hover:bg-gray-100 rounded-r-md focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          >
                            +
                          </button>
                        </div>
                      </div>
                      <div className="flex">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.id)}
                          className="text-red-600 hover:text-red-800 transition duration-200 ease-in-out font-medium"
                        >
                          Remover
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          {cartItems.length > 0 && (
            <form
              onSubmit={handleCheckout}
              id="checkout-form"
              className="mt-8 pt-6 border-t border-gray-200"
              noValidate
            >
              {/* Campos de informações do cliente - RESTAURADOS DO SEU CÓDIGO ORIGINAL */}
              <h3 className="text-xl font-semibold text-gray-800 mb-6">
                Informações para Contato e Entrega
              </h3>
              <div className="mb-4">
                <label
                  htmlFor="nomeCompleto"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Nome Completo*
                </label>
                <input
                  type="text"
                  name="nomeCompleto"
                  id="nomeCompleto"
                  value={cliente.nomeCompleto}
                  onChange={handleClienteChange}
                  className={`w-full p-2 border rounded-md shadow-sm ${
                    formErrors.nomeCompleto
                      ? "border-red-500"
                      : "border-gray-300"
                  }`}
                />
                {formErrors.nomeCompleto && (
                  <p className="text-red-500 text-xs mt-1">
                    {formErrors.nomeCompleto}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Email*
                  </label>
                  <input
                    type="email"
                    name="email"
                    id="email"
                    value={cliente.email}
                    onChange={handleClienteChange}
                    className={`w-full p-2 border rounded-md shadow-sm ${
                      formErrors.email ? "border-red-500" : "border-gray-300"
                    }`}
                  />
                  {formErrors.email && (
                    <p className="text-red-500 text-xs mt-1">
                      {formErrors.email}
                    </p>
                  )}
                </div>
                <div>
                  <label
                    htmlFor="telefone"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Telefone*{" "}
                    <span className="text-xs font-normal text-gray-500">
                      (com DDD, apenas números)
                    </span>
                  </label>
                  <input
                    type="tel"
                    name="telefone"
                    id="telefone"
                    value={cliente.telefone}
                    onChange={handleClienteChange}
                    placeholder="Ex: 22999998888"
                    className={`w-full p-2 border rounded-md shadow-sm ${
                      formErrors.telefone ? "border-red-500" : "border-gray-300"
                    }`}
                  />
                  {formErrors.telefone && (
                    <p className="text-red-500 text-xs mt-1">
                      {formErrors.telefone}
                    </p>
                  )}
                </div>
              </div>
              <div className="mb-4">
                <label
                  htmlFor="cpf"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  CPF*{" "}
                  <span className="text-xs font-normal text-gray-500">
                    (apenas números)
                  </span>
                </label>
                <input
                  type="text"
                  name="cpf"
                  id="cpf"
                  value={cliente.cpf}
                  onChange={handleClienteChange}
                  maxLength="11"
                  className={`w-full p-2 border rounded-md shadow-sm ${
                    formErrors.cpf ? "border-red-500" : "border-gray-300"
                  }`}
                />
                {formErrors.cpf && (
                  <p className="text-red-500 text-xs mt-1">{formErrors.cpf}</p>
                )}
              </div>
              <h4 className="text-lg font-medium text-gray-800 mt-6 mb-3">
                Endereço de Entrega
              </h4>
              <div className="mb-4">
                <label
                  htmlFor="cep"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  CEP*{" "}
                  <span className="text-xs font-normal text-gray-500">
                    (apenas números)
                  </span>
                </label>
                <input
                  type="text"
                  name="cep"
                  id="cep"
                  value={cliente.cep} // Este é o CEP do cliente, para o formulário
                  onChange={handleClienteChange}
                  maxLength="8"
                  className={`w-full p-2 border rounded-md shadow-sm ${
                    formErrors.cep ? "border-red-500" : "border-gray-300"
                  }`}
                />
                {formErrors.cep && (
                  <p className="text-red-500 text-xs mt-1">{formErrors.cep}</p>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="md:col-span-2">
                  <label
                    htmlFor="logradouro"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Logradouro*{" "}
                    <span className="text-xs font-normal text-gray-500">
                      (Rua, Av.)
                    </span>
                  </label>
                  <input
                    type="text"
                    name="logradouro"
                    id="logradouro"
                    value={cliente.logradouro}
                    onChange={handleClienteChange}
                    className={`w-full p-2 border rounded-md shadow-sm ${
                      formErrors.logradouro
                        ? "border-red-500"
                        : "border-gray-300"
                    }`}
                  />
                  {formErrors.logradouro && (
                    <p className="text-red-500 text-xs mt-1">
                      {formErrors.logradouro}
                    </p>
                  )}
                </div>
                <div>
                  <label
                    htmlFor="numero"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Número*
                  </label>
                  <input
                    type="text"
                    name="numero"
                    id="numero"
                    value={cliente.numero}
                    onChange={handleClienteChange}
                    className={`w-full p-2 border rounded-md shadow-sm ${
                      formErrors.numero ? "border-red-500" : "border-gray-300"
                    }`}
                  />
                  {formErrors.numero && (
                    <p className="text-red-500 text-xs mt-1">
                      {formErrors.numero}
                    </p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label
                    htmlFor="complemento"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Complemento{" "}
                    <span className="text-xs font-normal text-gray-500">
                      (opcional)
                    </span>
                  </label>
                  <input
                    type="text"
                    name="complemento"
                    id="complemento"
                    value={cliente.complemento}
                    onChange={handleClienteChange}
                    className="w-full p-2 border border-gray-300 rounded-md shadow-sm"
                  />
                </div>
                <div>
                  <label
                    htmlFor="bairro"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Bairro*
                  </label>
                  <input
                    type="text"
                    name="bairro"
                    id="bairro"
                    value={cliente.bairro}
                    onChange={handleClienteChange}
                    className={`w-full p-2 border rounded-md shadow-sm ${
                      formErrors.bairro ? "border-red-500" : "border-gray-300"
                    }`}
                  />
                  {formErrors.bairro && (
                    <p className="text-red-500 text-xs mt-1">
                      {formErrors.bairro}
                    </p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label
                    htmlFor="cidade"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Cidade*
                  </label>
                  <input
                    type="text"
                    name="cidade"
                    id="cidade"
                    value={cliente.cidade}
                    onChange={handleClienteChange}
                    className={`w-full p-2 border rounded-md shadow-sm ${
                      formErrors.cidade ? "border-red-500" : "border-gray-300"
                    }`}
                  />
                  {formErrors.cidade && (
                    <p className="text-red-500 text-xs mt-1">
                      {formErrors.cidade}
                    </p>
                  )}
                </div>
                <div>
                  <label
                    htmlFor="estado"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Estado*{" "}
                    <span className="text-xs font-normal text-gray-500">
                      (sigla, ex: RJ)
                    </span>
                  </label>
                  <input
                    type="text"
                    name="estado"
                    id="estado"
                    value={cliente.estado}
                    onChange={handleClienteChange}
                    maxLength="2"
                    className={`w-full p-2 border rounded-md shadow-sm ${
                      formErrors.estado ? "border-red-500" : "border-gray-300"
                    }`}
                  />
                  {formErrors.estado && (
                    <p className="text-red-500 text-xs mt-1">
                      {formErrors.estado}
                    </p>
                  )}
                </div>
              </div>
            </form>
          )}
        </div>

        {/* --- COLUNA DE RESUMO DO PEDIDO --- */}
        <div className="lg:col-span-1 bg-white p-6 rounded-lg shadow-md h-fit sticky top-24">
          <h3 className="text-2xl font-bold text-gray-900 mb-4">
            Resumo do Pedido
          </h3>

          {/* Subtotal de Itens */}
          <div className="flex justify-between items-center text-gray-700 text-lg mb-2">
            <span>Subtotal de Itens:</span>
            <span>R$ {total.toFixed(2).replace(".", ",")}</span>
          </div>

          {/* --- SEÇÃO DE CALCULAR FRETE --- */}
          <div className="mt-6 pt-4 border-t">
            <h4 className="text-lg font-semibold text-gray-800 mb-3">
              Calcular Frete
            </h4>
            <div className="flex items-start gap-2">
              <input
                type="text"
                placeholder="Seu CEP"
                value={cep} // Este é o estado para o CEP do cálculo de frete
                onChange={(e) => setCep(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md shadow-sm"
                maxLength="8" // Limita a 8 dígitos, se for só números
              />
              <button
                type="button" // Adicionado type="button" para evitar submit de form
                onClick={handleCalculateShipping}
                disabled={loadingShipping || cartItems.length === 0}
                className="bg-gray-700 text-white px-5 py-2 rounded-md hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
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
                    className={`flex items-center p-3 border rounded-md cursor-pointer hover:bg-gray-50 ${
                      selectedShipping?.id === option.id
                        ? "border-emerald-600 ring-1 ring-emerald-600 bg-emerald-50"
                        : "border-gray-300"
                    }`}
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

          {/* Detalhes do Frete Selecionado (aparece apenas se um frete for selecionado) */}
          {selectedShipping && (
            <div className="flex justify-between items-center text-gray-700 text-lg mb-2 mt-4 border-t pt-4">
              <span>Frete ({selectedShipping.name}):</span>
              <span>
                R${" "}
                {parseFloat(selectedShipping.price)
                  .toFixed(2)
                  .replace(".", ",")}
              </span>
            </div>
          )}

          {/* Total Final */}
          <div className="flex justify-between items-center text-xl font-extrabold text-gray-900 border-t pt-4 mt-4">
            <span>Total:</span>
            <span>R$ {totalComFrete.toFixed(2).replace(".", ",")}</span>
          </div>

          <button
            type="submit"
            form="checkout-form"
            disabled={
              loadingPayment || cartItems.length === 0 || !selectedShipping
            } // Desabilita se não houver frete selecionado
            className="w-full mt-6 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-6 rounded-md text-lg shadow-lg transform transition duration-300 ease-in-out hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loadingPayment
              ? "Processando Pagamento..."
              : "Finalizar Compra e Pagar"}
          </button>
          <div className="mt-4 text-center">
            <RouterLink
              to="/"
              className="text-emerald-600 hover:text-emerald-800 hover:underline transition duration-200 ease-in-out font-medium"
            >
              Continuar Comprando
            </RouterLink>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CartPage;
