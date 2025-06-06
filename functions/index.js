const functions = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const { MercadoPagoConfig, Preference, Payment } = require("mercadopago");
const admin = require("firebase-admin");
const { logger } = require("firebase-functions");
const axios = require("axios"); // Adicionado para o Melhor Envio

if (admin.apps.length === 0) {
  admin.initializeApp();
}

setGlobalOptions({
  region: "southamerica-east1",
  memory: "256MiB",
  timeoutSeconds: 60,
});

// --- SUA LÓGICA DE CONFIGURAÇÃO DO MERCADO PAGO (MANTIDA) ---
const PROD_SECRET_NAME_MP = "MERCADOPAGO_ACCESS_TOKEN_PROD";
const TEST_SECRET_NAME_MP = "MERCADOPAGO_ACCESS_TOKEN_TEST";

const getMercadoPagoClient = () => {
  const isProductionEnvironment = !!process.env.K_SERVICE;
  const isEmulatorEnvironment = process.env.FUNCTIONS_EMULATOR === "true";

  let accessToken;

  if (isProductionEnvironment) {
    accessToken = process.env[PROD_SECRET_NAME_MP];
    logger.info(
      "MODO PRODUÇÃO: Usando Access Token de PRODUÇÃO do Mercado Pago."
    );
  } else if (isEmulatorEnvironment) {
    accessToken = process.env[TEST_SECRET_NAME_MP];
    logger.info("MODO EMULADOR: Usando Access Token de TESTE do Mercado Pago.");
  }

  if (!accessToken) {
    logger.error(
      "ERRO CRÍTICO: Token de acesso do Mercado Pago não encontrado para o ambiente atual."
    );
    throw new Error("Configuração de pagamento do Mercado Pago incompleta.");
  }

  return new MercadoPagoConfig({ accessToken, options: { timeout: 7000 } });
};

// --- DEFINIÇÃO DAS FUNÇÕES ---

// Função do Mercado Pago
exports.createPaymentPreference = functions.onCall(
  { secrets: [PROD_SECRET_NAME_MP, TEST_SECRET_NAME_MP] },
  async (request) => {
    const client = getMercadoPagoClient();
    const data = request.data;
    logger.info("Função createPaymentPreference chamada com dados:", data);

    const { items, payerInfo, externalReference, backUrls, notificationUrl } =
      data;
    if (!items || items.length === 0)
      throw new functions.HttpsError(
        "invalid-argument",
        "A lista de 'items' é obrigatória."
      );
    if (!payerInfo || !payerInfo.email)
      throw new functions.HttpsError(
        "invalid-argument",
        "As 'payerInfo' com 'email' são obrigatórias."
      );

    const preferenceRequest = {
      items: items.map((item) => ({
        id: String(item.id || "item-default-id"),
        title: String(item.title || "Produto"),
        description: String(item.description || item.title),
        quantity: Number(item.quantity),
        unit_price: Number(item.unit_price),
        currency_id: "BRL",
      })),
      payer: {
        name: String(payerInfo.name || "Comprador"),
        surname: String(payerInfo.surname || ""),
        email: String(payerInfo.email),
      },
      back_urls: backUrls,
      auto_return: "approved",
      external_reference: String(externalReference),
      notification_url: String(notificationUrl),
    };

    try {
      const preference = new Preference(client);
      const response = await preference.create({ body: preferenceRequest });
      logger.info("Preferência criada! ID:", response.id);
      return { id: response.id, init_point: response.init_point };
    } catch (error) {
      logger.error(
        "Erro ao criar preferência MP:",
        error.cause || error.message
      );
      throw new functions.HttpsError(
        "internal",
        "Falha ao criar preferência de pagamento."
      );
    }
  }
);

// Função de notificação do Mercado Pago
exports.processPaymentNotification = functions.onRequest(
  { secrets: [PROD_SECRET_NAME_MP, TEST_SECRET_NAME_MP] },
  async (req, res) => {
    logger.info("Função processPaymentNotification chamada.");
    const client = getMercadoPagoClient();

    // Seu código de notificação aqui...
    const paymentId = req.query.id || req.body.data?.id;
    if (!paymentId) {
      logger.warn("Notificação recebida sem ID de pagamento.");
      return res.status(200).send("Notificação recebida sem ID.");
    }

    try {
      const payment = new Payment(client);
      const paymentDetails = await payment.get({ id: String(paymentId) });

      if (paymentDetails && paymentDetails.external_reference) {
        const orderRef = admin
          .firestore()
          .collection("pedidos")
          .doc(paymentDetails.external_reference);
        await orderRef.update({
          statusPagamentoMP: paymentDetails.status,
          paymentIdMP: String(paymentId),
          dadosCompletosPagamentoMP: paymentDetails,
          ultimaAtualizacaoWebhook:
            admin.firestore.FieldValue.serverTimestamp(),
        });
        logger.info(
          `Pedido ${paymentDetails.external_reference} atualizado para status: ${paymentDetails.status}.`
        );
      } else {
        logger.warn(
          "Pagamento sem external_reference ou não encontrado:",
          paymentId
        );
      }
      return res.status(200).send("OK");
    } catch (error) {
      logger.error(`Erro ao processar notificação para ${paymentId}:`, error);
      return res.status(500).send("Erro interno.");
    }
  }
);

// **NOVA** Função de cálculo de frete do Melhor Envio
exports.calculateShipping = functions.onCall(
  { secrets: ["MELHOR_ENVIO_TOKEN"] },
  async (request) => {
    const MELHOR_ENVIO_TOKEN = process.env.MELHOR_ENVIO_TOKEN;
    if (!MELHOR_ENVIO_TOKEN) {
      logger.error("Token do Melhor Envio não encontrado nos secrets.");
      throw new functions.HttpsError(
        "internal",
        "Configuração de frete incompleta."
      );
    }

    const { from, to, products } = request.data;
    logger.info("Função calculateShipping chamada com dados:", request.data);

    if (!to || !products || products.length === 0) {
      throw new functions.HttpsError(
        "invalid-argument",
        "CEP de destino e produtos são obrigatórios."
      );
    }

    const payload = {
      from: { postal_code: from.postal_code },
      to: { postal_code: to.postal_code },
      products: products.map((p) => ({
        id: String(p.id),
        width: Number(p.largura),
        height: Number(p.altura),
        length: Number(p.comprimento),
        weight: Number(p.peso),
        insurance_value: Number(p.preco),
        quantity: Number(p.quantity),
      })),
    };

    try {
      const response = await axios.post(
        "https://www.melhorenvio.com.br/api/v2/me/shipment/calculate",
        payload,
        {
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            Authorization: `Bearer ${MELHOR_ENVIO_TOKEN}`,
            "User-Agent": "Artesanato Store (edujuricic@gmail.com)",
          },
        }
      );

      const validOptions = response.data.filter((option) => !option.error);

      if (validOptions.length === 0) {
        logger.warn("Nenhuma opção de frete válida retornada.", response.data);
        throw new functions.HttpsError(
          "not-found",
          "Não foi possível calcular o frete para este CEP."
        );
      }

      logger.info("Opções de frete calculadas:", validOptions);
      return validOptions;
    } catch (error) {
      logger.error(
        "Erro ao chamar API do Melhor Envio:",
        error.response?.data || error.message
      );
      throw new functions.HttpsError(
        "internal",
        "Erro ao calcular o frete. Tente novamente."
      );
    }
  }
);
