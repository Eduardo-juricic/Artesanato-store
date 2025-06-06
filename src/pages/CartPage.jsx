import React, { useState } from "react";
import { useCart } from "../context/CartContext";
import { Link as RouterLink } from "react-router-dom";
// A importação do 'connectFunctionsEmulator' foi adicionada aqui
import {
  getFunctions,
  httpsCallable,
  connectFunctionsEmulator,
} from "firebase/functions";
import { db } from "../FirebaseConfig";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

function CartPage() {
  const {
    cartItems,
    updateQuantity,
    removeItem,
    getTotal,
    updateItemObservation,
  } = useCart();

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

  const [cepFrete, setCepFrete] = useState("");
  const [shippingOptions, setShippingOptions] = useState([]);
  const [selectedShipping, setSelectedShipping] = useState(null);
  const [shippingCost, setShippingCost] = useState(0);
  const [loadingShipping, setLoadingShipping] = useState(false);
  const [shippingError, setShippingError] = useState("");

  const subtotal = getTotal();

  const functionsInstance = getFunctions(undefined, "southamerica-east1");
  const createPreferenceCallable = httpsCallable(
    functionsInstance,
    "createPaymentPreference"
  );
  const calculateShippingCallable = httpsCallable(
    functionsInstance,
    "calculateShipping"
  );

  // ***** CÓDIGO DE CONEXÃO COM O EMULADOR ADICIONADO AQUI *****
  if (window.location.hostname === "localhost") {
    console.log(
      "MODO DE TESTE: Conectando ao emulador de Functions na porta 5001..."
    );
    try {
      connectFunctionsEmulator(functionsInstance, "127.0.0.1", 5001);
    } catch (e) {
      console.warn(
        "Erro ao conectar ao emulador, talvez já esteja conectado.",
        e
      );
    }
  }
  // ***************************************************************

  const handleClienteChange = (e) => {
    const { name, value } = e.target;
    setCliente((prev) => ({ ...prev, [name]: value }));
    if (formErrors[name]) setFormErrors((prev) => ({ ...prev, [name]: null }));
  };

  const handleItemObservationChange = (itemId, value) => {
    updateItemObservation(itemId, value);
    const errorKey = `itemObservation-${itemId}`;
    if (formErrors[errorKey])
      setFormErrors((prev) => ({ ...prev, [errorKey]: null }));
  };

  const handleQuantityChange = (productId, quantity) => {
    updateQuantity(productId, Math.max(1, parseInt(quantity, 10) || 1));
  };

  const handleIncreaseQuantity = (productId, currentQuantity) => {
    updateQuantity(productId, currentQuantity + 1);
  };

  const handleDecreaseQuantity = (productId, currentQuantity) => {
    updateQuantity(productId, Math.max(1, currentQuantity - 1));
  };

  const handleRemoveItem = (productId) => {
    removeItem(productId);
  };

  const handleCalculateShipping = async () => {
    if (!/^\d{8}$/.test(cepFrete.replace(/\D/g, ""))) {
      setShippingError("Por favor, digite um CEP válido com 8 dígitos.");
      return;
    }

    setLoadingShipping(true);
    setShippingError("");
    setShippingOptions([]);
    setSelectedShipping(null);
    setShippingCost(0);

    const productsPayload = cartItems.map((item) => {
      if (!item.peso || !item.altura || !item.largura || !item.comprimento) {
        console.error(
          `Produto "${item.nome}" (ID: ${item.id}) está sem dados de dimensão/peso.`
        );
      }
      return {
        id: item.id,
        largura: item.largura,
        altura: item.altura,
        comprimento: item.comprimento,
        peso: item.peso,
        preco: parseFloat(
          item.preco_promocional &&
            Number(item.preco_promocional) < Number(item.preco)
            ? item.preco_promocional
            : item.preco
        ),
        quantity: item.quantity,
      };
    });

    if (productsPayload.some((p) => !p.peso)) {
      setShippingError(
        "Um ou mais produtos no carrinho não possuem dados de peso/dimensão. Não é possível calcular o frete."
      );
      setLoadingShipping(false);
      return;
    }

    try {
      const result = await calculateShippingCallable({
        from: { postal_code: "28979440" },
        to: { postal_code: cepFrete.replace(/\D/g, "") },
        products: productsPayload,
      });
      setShippingOptions(result.data);
    } catch (error) {
      console.error("Erro ao calcular frete:", error);
      setShippingError(
        error.message ||
          "Não foi possível calcular o frete. Verifique o CEP e tente novamente."
      );
    } finally {
      setLoadingShipping(false);
    }
  };

  const validateForm = () => {
    const errors = {};
    if (!cliente.nomeCompleto.trim())
      errors.nomeCompleto = "Nome completo é obrigatório.";
    // ... (suas outras validações aqui) ...
    if (!selectedShipping) {
      errors.shipping = "Por favor, calcule e selecione uma opção de frete.";
      setShippingError("É necessário selecionar uma opção de entrega.");
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCheckout = async (e) => {
    e.preventDefault();
    if (!validateForm()) {
      alert("Por favor, corrija os erros no formulário antes de prosseguir.");
      return;
    }
    setLoadingPayment(true);
    let orderId = null;

    try {
      const newOrderRef = await addDoc(collection(db, "pedidos"), {
        cliente,
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
        totalAmount: subtotal + shippingCost,
        frete: {
          servico: selectedShipping.name,
          custo: shippingCost,
          prazo_entrega_dias: selectedShipping.delivery_time,
        },
        statusPedido: "pendente_pagamento",
        statusPagamentoMP: "pendente",
        dataCriacao: serverTimestamp(),
      });
      orderId = newOrderRef.id;

      const itemsPayload = cartItems.map((item) => ({
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
      }));

      if (selectedShipping && shippingCost > 0) {
        itemsPayload.push({
          id: "shipping",
          title: `Frete - ${selectedShipping.name}`,
          description: "Custo de envio do pedido",
          quantity: 1,
          unit_price: parseFloat(shippingCost.toFixed(2)),
        });
      }

      const nomeArray = cliente.nomeCompleto.trim().split(" ");
      const nome = nomeArray[0];
      const sobrenome = nomeArray.slice(1).join(" ");
      const payerInfoPayload = {
        name: nome,
        surname: sobrenome,
        email: cliente.email,
      };
      const baseUrl = window.location.origin;
      const webhookUrl = import.meta.env.VITE_MERCADO_PAGO_WEBHOOK_URL;

      const result = await createPreferenceCallable({
        items: itemsPayload,
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
        window.location.href = result.data.init_point;
      } else {
        throw new Error(
          "init_point não encontrado na resposta da preferência."
        );
      }
    } catch (error) {
      console.error("Erro no checkout:", error);
      alert(`Erro ao finalizar o pedido: ${error.message}`);
    } finally {
      setLoadingPayment(false);
    }
  };

  if (cartItems.length === 0) {
    return (
      <div className="container mx-auto px-4 py-20 text-center bg-white shadow-lg rounded-lg mt-10 max-w-2xl">
        <h2 className="text-3xl font-extrabold text-gray-900 mb-6">
          Seu carrinho está vazio.
        </h2>
        <RouterLink
          to="/"
          className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-emerald-600 hover:bg-emerald-700"
        >
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
        <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow-md">
          <ul className="divide-y divide-gray-200">
            {cartItems.map((item) => (
              <li key={item.id} className="flex flex-col sm:flex-row py-6">
                <div className="flex-shrink-0 w-32 h-32 sm:w-40 sm:h-40 relative rounded-md overflow-hidden">
                  <img
                    src={item.imagem}
                    alt={item.nome}
                    className="w-full h-full object-cover object-center"
                  />
                </div>
                <div className="ml-0 sm:ml-4 flex flex-1 flex-col justify-between mt-4 sm:mt-0">
                  <h3 className="text-xl font-bold text-gray-900">
                    {item.nome}
                  </h3>
                  <div className="flex flex-1 items-end justify-between text-sm mt-4 sm:mt-0">
                    <div className="flex items-center">
                      <button
                        onClick={() =>
                          handleDecreaseQuantity(item.id, item.quantity)
                        }
                        className="p-2 text-gray-700 hover:bg-gray-100 rounded-l-md"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) =>
                          handleQuantityChange(item.id, e.target.value)
                        }
                        className="w-12 text-center text-gray-900 focus:outline-none border-t border-b border-gray-300"
                        min="1"
                      />
                      <button
                        onClick={() =>
                          handleIncreaseQuantity(item.id, item.quantity)
                        }
                        className="p-2 text-gray-700 hover:bg-gray-100 rounded-r-md"
                      >
                        +
                      </button>
                    </div>
                    <button
                      onClick={() => removeItem(item.id)}
                      className="font-medium text-red-600 hover:text-red-500"
                    >
                      Remover
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-8 pt-6 border-t border-gray-200">
            <h3 className="text-xl font-semibold text-gray-800 mb-4">
              Calcular Frete
            </h3>
            <div className="flex items-start space-x-2">
              <input
                type="text"
                value={cepFrete}
                onChange={(e) => setCepFrete(e.target.value)}
                placeholder="Digite seu CEP"
                maxLength="9"
                className="w-full max-w-xs p-2 border border-gray-300 rounded-md shadow-sm"
              />
              <button
                onClick={handleCalculateShipping}
                disabled={loadingShipping}
                className="bg-gray-700 text-white px-5 py-2 rounded-md hover:bg-gray-800 disabled:opacity-50"
              >
                {loadingShipping ? "Calculando..." : "Calcular"}
              </button>
            </div>
            {shippingError && (
              <p className="text-red-500 text-sm mt-2">{shippingError}</p>
            )}
            {shippingOptions.length > 0 && (
              <div className="mt-4 space-y-3">
                <h4 className="font-medium">Escolha uma opção de entrega:</h4>
                {shippingOptions.map((option) => (
                  <div
                    key={option.id}
                    className="flex items-center p-3 border rounded-md cursor-pointer hover:bg-gray-50"
                  >
                    <input
                      type="radio"
                      id={`shipping-${option.id}`}
                      name="shippingOption"
                      value={option.id}
                      checked={selectedShipping?.id === option.id}
                      onChange={() => {
                        setSelectedShipping(option);
                        setShippingCost(parseFloat(option.price));
                        setShippingError("");
                      }}
                      className="h-4 w-4 text-emerald-600 border-gray-300 focus:ring-emerald-500"
                    />
                    <label
                      htmlFor={`shipping-${option.id}`}
                      className="ml-3 block text-sm font-medium text-gray-800 flex-grow"
                    >
                      <div className="flex justify-between items-center">
                        <span>
                          {option.company.name} - {option.name}
                        </span>
                        <span className="font-bold text-lg text-emerald-700">
                          R${" "}
                          {parseFloat(option.price)
                            .toFixed(2)
                            .replace(".", ",")}
                        </span>
                      </div>
                      <p className="text-gray-500">
                        Prazo de entrega: {option.delivery_time} dias
                      </p>
                    </label>
                  </div>
                ))}
              </div>
            )}
          </div>

          <form
            onSubmit={handleCheckout}
            id="checkout-form"
            className="mt-8 pt-6 border-t border-gray-200"
            noValidate
          >
            <h3 className="text-xl font-semibold text-gray-800 mb-6">
              Informações para Contato e Entrega
            </h3>
            {/* Seu formulário de cliente aqui... */}
          </form>
        </div>

        <div className="lg:col-span-1 bg-white p-6 rounded-lg shadow-md h-fit sticky top-24">
          <h3 className="text-2xl font-bold text-gray-900 mb-4">
            Resumo do Pedido
          </h3>
          <div className="flex justify-between items-center text-gray-700 text-lg mb-2">
            <span>Subtotal:</span>
            <span>R$ {subtotal.toFixed(2).replace(".", ",")}</span>
          </div>
          <div className="flex justify-between items-center text-gray-700 text-lg mb-2">
            <span>Frete:</span>
            <span>
              {selectedShipping
                ? `R$ ${shippingCost.toFixed(2).replace(".", ",")}`
                : "A calcular"}
            </span>
          </div>
          <div className="flex justify-between items-center text-xl font-extrabold text-gray-900 border-t pt-4 mt-4">
            <span>Total:</span>
            <span>
              R$ {(subtotal + shippingCost).toFixed(2).replace(".", ",")}
            </span>
          </div>
          <button
            type="submit"
            form="checkout-form"
            disabled={
              loadingPayment || cartItems.length === 0 || !selectedShipping
            }
            className="w-full mt-6 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-6 rounded-md text-lg shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loadingPayment ? "Processando..." : "Finalizar Compra e Pagar"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default CartPage;
