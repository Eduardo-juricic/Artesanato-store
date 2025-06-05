# Artesanato Store - Demonstração de E-commerce

Bem-vindo ao **Artesanato Store**! Este é um projeto de demonstração de uma loja virtual completa, construído para ilustrar as funcionalidades e o design que posso oferecer aos meus clientes.

**Nota para Clientes:** Este site é um **exemplo funcional** e não representa uma loja real com produtos à venda. Ele serve como portfólio interativo para demonstrar minhas habilidades em desenvolvimento web e e-commerce.

## Visão Geral do Projeto

Artesanato Store é uma simulação de uma loja online para venda de produtos artesanais. O projeto foi desenvolvido com tecnologias modernas, focando em uma experiência de usuário agradável, design responsivo e funcionalidades essenciais para um e-commerce de sucesso.

## Funcionalidades Implementadas (Demonstração)

Este projeto de exemplo inclui as seguintes funcionalidades:

* **Visualização de Produtos:**
    * Listagem de produtos com imagens, descrições e preços.
    * Página de detalhes para cada produto.
    * Produto em destaque na página inicial.
* **Carrinho de Compras:**
    * Adicionar produtos ao carrinho.
    * Visualizar e editar itens no carrinho.
    * Remover itens do carrinho.
    * Cálculo do total do pedido.
    * Opção para adicionar observações de personalização por item.
* **Checkout (Simulado):**
    * Formulário para informações do cliente (nome, contato, endereço).
    * Integração com Mercado Pago para processamento de pagamento (utilizando chaves de teste/sandbox).
    * Páginas de feedback para status de pagamento (sucesso, falha, pendente).
* **Painel Administrativo (Simulado):**
    * Login seguro para administração.
    * Gerenciamento de produtos (CRUD - Adicionar, Visualizar, Editar, Deletar).
    * Opção para definir um produto como destaque.
    * Visualização de pedidos recebidos.
    * Logout.
* **Tecnologias e Design:**
    * Interface moderna e responsiva, adaptável a diferentes tamanhos de tela (desktop, tablet, mobile).
    * Componentes interativos e animações sutis para uma melhor experiência do usuário.
    * Utilização de React, Vite, Firebase e Tailwind CSS.

## Tecnologias Utilizadas

* **Frontend:**
    * React (com Hooks e Context API)
    * Vite (Build Tool)
    * Tailwind CSS (Estilização)
    * React Router (Navegação)
    * Framer Motion (Animações)
    * Heroicons & React Icons (Ícones)
* **Backend & Banco de Dados:**
    * Firebase (Autenticação, Firestore Database, Storage, Cloud Functions)
* **Pagamentos:**
    * Mercado Pago SDK (React e Node.js)
* **Hospedagem de Imagens (Exemplo):**
    * Cloudinary (para upload e armazenamento de imagens de produtos no painel admin)

## Como Executar Localmente (Para Desenvolvedores)

Se você é um desenvolvedor e deseja executar este projeto localmente:

1.  **Clone o repositório:**
    ```bash
    git clone [https://github.com/seu-usuario/artesanato-store.git](https://github.com/seu-usuario/artesanato-store.git)
    cd artesanato-store
    ```

2.  **Instale as dependências do frontend:**
    ```bash
    npm install
    ```

3.  **Instale as dependências das Cloud Functions:**
    ```bash
    cd functions
    npm install
    cd ..
    ```

4.  **Configure as Variáveis de Ambiente:**
    * Crie um arquivo `.env` na raiz do projeto e na pasta `functions`.
    * Adicione as chaves de API do Firebase e Mercado Pago (modo de teste) conforme os arquivos de exemplo ou configuração.
        * `VITE_FIREBASE_API_KEY`
        * `VITE_FIREBASE_AUTH_DOMAIN`
        * `VITE_FIREBASE_PROJECT_ID`
        * `VITE_FIREBASE_STORAGE_BUCKET`
        * `VITE_FIREBASE_MESSAGING_SENDER_ID`
        * `VITE_FIREBASE_APP_ID`
        * `VITE_MERCADO_PAGO_PUBLIC_KEY` (frontend)
        * `VITE_MERCADO_PAGO_WEBHOOK_URL` (frontend, para a URL da sua Cloud Function de webhook)
    * Configure os secrets do Mercado Pago para as Cloud Functions (conforme `functions/index.js`) no seu ambiente Firebase.
        * `MERCADOPAGO_ACCESS_TOKEN_PROD`
        * `MERCADOPAGO_ACCESS_TOKEN_TEST`

5.  **Configure o Firebase:**
    * Certifique-se de ter um projeto Firebase criado.
    * Atualize `firebase.json` e os arquivos de configuração do Firebase (`src/FirebaseConfig.js`) com os dados do seu projeto.
    * No Firestore, crie uma coleção `config` com um documento `cloudinary` contendo `cloud_name` e `upload_preset` se for usar o upload pelo painel admin.

6.  **Execute o projeto (Frontend):**
    ```bash
    npm run dev
    ```

7.  **Emule as Cloud Functions (Opcional, para testar pagamentos):**
    ```bash
    firebase emulators:start --only functions
    ```

## Objetivo do Projeto

O principal objetivo do "Artesanato Store" é servir como uma peça de portfólio robusta, demonstrando a capacidade de criar lojas virtuais personalizadas, desde o design e experiência do usuário até a integração de sistemas de pagamento e painéis administrativos.

Sinta-se à vontade para explorar o site e testar suas funcionalidades!

## Contato

Se você gostou do que viu e está interessado em um projeto de e-commerce similar ou personalizado, entre em contato!

* **Eduardo Juricic**
* **edujuricic@gmail.com**
* **+55 (22)981239371**

---

*Este README foi gerado com base na análise do repositório fornecido.*
