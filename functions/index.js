// functions/index.js

const functions = require("firebase-functions/v2"); // CORREÇÃO: Removido o "/https"
const { setGlobalOptions } = require("firebase-functions/v2");
const { MercadoPagoConfig, Preference, Payment } = require("mercadopago");
const admin = require("firebase-admin");
const { logger } = require("firebase-functions");
const axios = require("axios"); // Adicionado o require do axios no início

if (admin.apps.length === 0) {
  admin.initializeApp();
}

setGlobalOptions({
  region: "southamerica-east1",
  memory: "256MiB",
  timeoutSeconds: 60,
});

// --- LÓGICA DE CONFIGURAÇÃO DOS TOKENS ---
const PROD_SECRET_NAME = "MERCADOPAGO_ACCESS_TOKEN_PROD";
const TEST_SECRET_NAME = "MERCADOPAGO_ACCESS_TOKEN_TEST";
const MELHOR_ENVIO_TOKEN_SECRET = "MELHOR_ENVIO_TOKEN"; // Novo secret

const PROD_ACCESS_TOKEN_FROM_SECRET = process.env[PROD_SECRET_NAME];
const TEST_ACCESS_TOKEN_FROM_SECRET = process.env[TEST_SECRET_NAME];
const MELHOR_ENVIO_TOKEN = process.env[MELHOR_ENVIO_TOKEN_SECRET]; // Carrega o novo secret

const YOUR_PROVIDED_TEST_ACCESS_TOKEN =
  "TEST-2041651583950402-051909-c6b895278dbff8c34731dd86d4c95c67-98506488";

let CHAVE_ACESSO_MP_A_SER_USADA;
let idempotencyKeyBase = Date.now().toString();

const isProductionEnvironment = !!process.env.K_SERVICE;
const isEmulatorEnvironment = process.env.FUNCTIONS_EMULATOR === "true";

// Lógica de seleção do token do Mercado Pago (sem alterações)
if (isProductionEnvironment) {
  if (PROD_ACCESS_TOKEN_FROM_SECRET) {
    CHAVE_ACESSO_MP_A_SER_USADA = PROD_ACCESS_TOKEN_FROM_SECRET;
    logger.info(
      "MODO PRODUÇÃO: Usando Access Token de PRODUÇÃO do Mercado Pago."
    );
  } else {
    const errorMsg = `ERRO CRÍTICO: Rodando em AMBIENTE DE PRODUÇÃO mas o ACCESS TOKEN DE PRODUÇÃO não foi lido.`;
    logger.error(errorMsg);
    throw new Error(errorMsg);
  }
} else {
  CHAVE_ACESSO_MP_A_SER_USADA =
    TEST_ACCESS_TOKEN_FROM_SECRET || YOUR_PROVIDED_TEST_ACCESS_TOKEN;
  logger.info(
    "MODO TESTE/EMULADOR: Usando Access Token de TESTE do Mercado Pago."
  );
}
// ... resto da lógica de verificação do token do Mercado Pago

const client = new MercadoPagoConfig({
  accessToken: CHAVE_ACESSO_MP_A_SER_USADA,
  options: { timeout: 7000 },
});
logger.info("Cliente MercadoPagoConfig inicializado.");

// --- OPÇÕES GLOBAIS PARA FUNÇÕES ---
// Garante que todas as funções declaradas com estas opções terão acesso aos secrets.
const allFunctionOptions = {
  secrets: [PROD_SECRET_NAME, TEST_SECRET_NAME, MELHOR_ENVIO_TOKEN_SECRET],
};

// --- DEFINIÇÃO DAS FUNÇÕES ---

exports.createPaymentPreference = functions.https.onCall(
  allFunctionOptions,
  async (request) => {
    // Seu código da função createPaymentPreference existente e sem alterações aqui...
    // ...
    const data = request.data;
    const auth = request.auth;
    logger.info("Função createPaymentPreference chamada com dados:", data, {
      auth,
    });
    const { items, payerInfo, externalReference, backUrls, notificationUrl } =
      data;
    if (!items || !Array.isArray(items) || items.length === 0) {
      logger.error(
        "Erro em createPaymentPreference: Lista de itens vazia ou inválida."
      );
      throw new functions.https.HttpsError(
        "invalid-argument",
        "A lista de 'items' é obrigatória."
      );
    }
    // ... O resto do seu código para esta função permanece o mesmo.
    const preference = new Preference(client);
    // ...
    return { id: response.id, init_point: response.init_point };
  }
);

exports.processPaymentNotification = functions.https.onRequest(
  allFunctionOptions,
  async (req, res) => {
    // Seu código da função processPaymentNotification existente e sem alterações aqui...
    // ...
    logger.info("Função processPaymentNotification chamada.");
    if (req.method !== "POST") {
      return res.status(405).send("Method Not Allowed.");
    }
    // ... O resto do seu código para esta função permanece o mesmo.
    return res.status(200).send("OK.");
  }
);

// --- NOVA FUNÇÃO PARA CALCULAR FRETE ---
exports.calculateShipping = functions.https.onCall(
  allFunctionOptions, // Usa as mesmas opções para ter acesso ao secret do Melhor Envio
  async (request) => {
    logger.info("Função calculateShipping chamada com dados:", request.data);

    if (!MELHOR_ENVIO_TOKEN) {
      logger.error("Token do Melhor Envio não encontrado nos secrets.");
      throw new functions.https.HttpsError(
        "internal",
        "Erro de configuração do servidor de frete."
      );
    }

    const { cep_destino, items } = request.data;
    if (!cep_destino || !items || items.length === 0) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "CEP de destino e lista de itens são obrigatórios."
      );
    }

    // --- DADOS DO REMETENTE (Você já substituiu corretamente) ---
    const fromCEP = "28979440";

    const payload = {
      from: { postal_code: fromCEP },
      to: { postal_code: cep_destino },
      products: items.map((item) => ({
        id: item.id,
        width: Number(item.largura),
        height: Number(item.altura),
        length: Number(item.comprimento),
        weight: Number(item.peso),
        insurance_value: Number(item.precoUnitario),
        quantity: Number(item.quantity),
      })),
      options: { receipt: false, own_hand: false },
      services: "1,2,3,4", // Correios: 1 (PAC), 2 (SEDEX).
    };

    logger.info("Payload para Melhor Envio:", JSON.stringify(payload, null, 2));

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
      logger.info(`Recebidas ${validOptions.length} opções de frete válidas.`);

      if (validOptions.length === 0 && response.data.length > 0) {
        const firstError = response.data.find((opt) => opt.error);
        if (firstError) {
          throw new functions.https.HttpsError(
            "not-found",
            `Frete indisponível: ${firstError.error}`
          );
        }
      }

      return validOptions;
    } catch (error) {
      const errorMsg = error.response ? error.response.data : error.message;
      logger.error("Erro ao chamar API do Melhor Envio:", errorMsg);
      throw new functions.https.HttpsError(
        "internal",
        "Não foi possível calcular o frete no momento."
      );
    }
  }
);

logger.info("Arquivo functions/index.js carregado e funções exportadas.");
