// src/pages/Admin.jsx
import { useState, useEffect } from "react";
import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
} from "firebase/firestore";
import { db, auth } from "../FirebaseConfig";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/24/outline";

const Admin = () => {
  const [produtos, setProdutos] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  // ESTADO DO FORMULÁRIO: COMBINAÇÃO DOS DOIS CÓDIGOS
  const [form, setForm] = useState({
    nome: "",
    descricao: "",
    preco: "",
    imagem: null,
    currentImageUrl: "",
    destaque_curto: "",
    preco_promocional: "",
    peso: "", // kg (Novo)
    altura: "", // cm (Novo)
    largura: "", // cm (Novo)
    comprimento: "", // cm (Novo)
    observacaoObrigatoria: false, // (Novo)
  });
  const [editandoId, setEditandoId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [cloudinaryConfig, setCloudinaryConfig] = useState({
    cloud_name: "",
    upload_preset: "",
  });
  const [showOrders, setShowOrders] = useState(false); // Estado para controlar a visibilidade dos pedidos

  const navigate = useNavigate();
  const produtosRef = collection(db, "produtos");
  const pedidosRef = collection(db, "pedidos");

  const buscarProdutos = async () => {
    const snapshot = await getDocs(produtosRef);
    const lista = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    setProdutos(lista);
  };

  const buscarPedidos = async () => {
    try {
      const snapshot = await getDocs(pedidosRef);
      const listaPedidos = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      listaPedidos.sort((a, b) => {
        const dateA = a.dataCriacao?.toDate();
        const dateB = b.dataCriacao?.toDate();
        if (dateA && dateB) {
          return dateB - dateA;
        }
        if (dateA) return -1;
        if (dateB) return 1;
        return 0;
      });
      setPedidos(listaPedidos);
    } catch (error) {
      console.error("Erro ao buscar pedidos:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      console.log("Usuário deslogado com sucesso!");
      navigate("/login");
    } catch (error) {
      console.error("Erro ao deslogar:", error);
    }
  };

  useEffect(() => {
    buscarProdutos();
    buscarPedidos();

    const configRef = doc(db, "config", "cloudinary");
    getDoc(configRef)
      .then((docSnap) => {
        if (docSnap.exists()) {
          setCloudinaryConfig(docSnap.data());
        } else {
          console.log(
            "No such document! (config/cloudinary) - Por favor, crie este documento no Firestore."
          );
        }
      })
      .catch((error) => {
        console.error("Erro ao buscar config do Cloudinary:", error);
      });
  }, []);

  const handleFileChange = (e) => {
    setForm({ ...form, imagem: e.target.files[0] });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setUploading(true);

    try {
      let imageUrl = form.currentImageUrl;

      if (form.imagem) {
        const formData = new FormData();
        formData.append("file", form.imagem);
        formData.append(
          "upload_preset",
          cloudinaryConfig.upload_preset || "produtos_upload"
        );
        formData.append("folder", "produtos");

        const response = await fetch(
          `https://api.cloudinary.com/v1_1/${
            cloudinaryConfig.cloud_name || "dtbvkmxy9"
          }/image/upload`,
          {
            method: "POST",
            body: formData,
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            `Erro do Cloudinary: ${
              errorData.error?.message || response.statusText
            }`
          );
        }

        const data = await response.json();
        imageUrl = data.secure_url;
      }

      // DADOS DO PRODUTO A SEREM SALVOS/ATUALIZADOS (COMBINAÇÃO)
      const produtoData = {
        nome: form.nome,
        descricao: form.descricao,
        preco: Number(form.preco),
        imagem: imageUrl,
        destaque_curto: form.destaque_curto,
        preco_promocional: form.preco_promocional
          ? Number(form.preco_promocional)
          : 0,
        peso: Number(form.peso), // Adicionado peso
        altura: Number(form.altura), // Adicionado altura
        largura: Number(form.largura), // Adicionado largura
        comprimento: Number(form.comprimento), // Adicionado comprimento
        observacaoObrigatoria: form.observacaoObrigatoria || false, // Adicionado
      };

      if (editandoId) {
        const ref = doc(db, "produtos", editandoId);
        await updateDoc(ref, produtoData);
        setEditandoId(null);
      } else {
        await addDoc(produtosRef, produtoData);
      }

      // RESET DO FORMULÁRIO APÓS SUBMISSÃO (COMBINAÇÃO)
      setForm({
        nome: "",
        descricao: "",
        preco: "",
        imagem: null,
        currentImageUrl: "",
        destaque_curto: "",
        preco_promocional: "",
        peso: "", // Limpa o peso
        altura: "", // Limpa a altura
        largura: "", // Limpa a largura
        comprimento: "", // Limpa o comprimento
        observacaoObrigatoria: false, // Limpa o checkbox
      });

      if (document.querySelector('input[type="file"]')) {
        document.querySelector('input[type="file"]').value = "";
      }
      buscarProdutos();
    } catch (error) {
      console.error("Erro ao enviar produto:", error);
      alert(`Erro ao processar produto: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  const deletar = async (id) => {
    if (window.confirm("Tem certeza que deseja excluir este produto?")) {
      const ref = doc(db, "produtos", id);
      await deleteDoc(ref);
      buscarProdutos();
    }
  };

  const deletarPedido = async (id) => {
    if (
      window.confirm(
        `Tem certeza que deseja excluir o pedido ID: ${id}? Esta ação não pode ser desfeita.`
      )
    ) {
      try {
        const pedidoDocRef = doc(db, "pedidos", id);
        await deleteDoc(pedidoDocRef);
        buscarPedidos();
      } catch (error) {
        alert(`Erro ao excluir pedido: ${error.message}`);
      }
    }
  };

  // EDIÇÃO DE PRODUTO: CARREGA TODOS OS CAMPOS, INCLUINDO OS NOVOS
  const editar = (produto) => {
    setForm({
      nome: produto.nome,
      descricao: produto.descricao,
      preco: produto.preco,
      imagem: null, // Resetar a imagem para upload de uma nova
      currentImageUrl: produto.imagem || "", // Manter URL da imagem atual
      destaque_curto: produto.destaque_curto || "",
      preco_promocional: produto.preco_promocional || "",
      peso: produto.peso || "", // Carrega peso
      altura: produto.altura || "", // Carrega altura
      largura: produto.largura || "", // Carrega largura
      comprimento: produto.comprimento || "", // Carrega comprimento
      observacaoObrigatoria: produto.observacaoObrigatoria || false, // Carrega checkbox
      id: produto.id, // ID do produto que está sendo editado
    });
    setEditandoId(produto.id);
    window.scrollTo(0, 0); // Rola para o topo da página para ver o formulário
  };

  const definirDestaque = async (id) => {
    const produtoParaAtualizar = produtos.find((p) => p.id === id);
    const novoEstadoDestaque = !produtoParaAtualizar?.destaque;
    const updatesBatch = [];

    // Desativar destaque de outros produtos se um novo for destacado
    produtos.forEach((p) => {
      if (p.destaque && p.id !== id) {
        const ref = doc(db, "produtos", p.id);
        updatesBatch.push(updateDoc(ref, { destaque: false }));
      }
    });

    const refProdutoClicado = doc(db, "produtos", id);
    updatesBatch.push(
      updateDoc(refProdutoClicado, { destaque: novoEstadoDestaque })
    );

    await Promise.all(updatesBatch);
    buscarProdutos();
  };

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Painel Admin</h1>
        <button
          onClick={handleLogout}
          className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors duration-200 shadow"
        >
          Sair
        </button>
      </div>
      {/* Seção de Adicionar/Editar Produto (DO SEU CÓDIGO MAIS RECENTE - AJUSTADO) */}
      <form
        onSubmit={handleSubmit}
        className="space-y-4 mb-10 p-6 border rounded-lg shadow-lg bg-white"
      >
        <h2 className="text-2xl font-semibold mb-4 text-gray-700">
          {editandoId ? "Editar Produto" : "Adicionar Novo Produto"}
        </h2>
        <input
          type="text"
          placeholder="Nome do Produto"
          value={form.nome}
          onChange={(e) => setForm({ ...form, nome: e.target.value })}
          className="border p-2 w-full rounded"
          required
        />
        <textarea
          placeholder="Descrição detalhada do produto"
          value={form.descricao}
          onChange={(e) => setForm({ ...form, descricao: e.target.value })}
          className="border p-2 w-full rounded h-24 resize-y"
          required
        />
        <input
          type="number"
          placeholder="Preço (ex: 99.99)"
          value={form.preco}
          onChange={(e) => setForm({ ...form, preco: e.target.value })}
          className="border p-2 w-full rounded"
          step="0.01"
          required
        />
        <input
          type="number"
          placeholder="Preço Promocional (opcional, ex: 79.99)"
          value={form.preco_promocional}
          onChange={(e) =>
            setForm({ ...form, preco_promocional: e.target.value })
          }
          className="border p-2 w-full rounded"
          step="0.01"
        />
        <textarea
          placeholder="Características Principais (Separe cada uma com ;)"
          value={form.destaque_curto}
          onChange={(e) => setForm({ ...form, destaque_curto: e.target.value })}
          className="border p-2 w-full rounded h-20 resize-y"
        />

        {/* INPUTS PARA PESO E DIMENSÕES (DO SEU CÓDIGO MAIS RECENTE) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
          <div>
            <label
              htmlFor="peso"
              className="block text-sm font-medium text-gray-700"
            >
              Peso (kg)
            </label>
            <input
              type="number"
              id="peso"
              placeholder="Ex: 0.5"
              value={form.peso}
              onChange={(e) => setForm({ ...form, peso: e.target.value })}
              className="border p-2 w-full rounded"
              step="0.01"
              required
            />
          </div>
          <div>
            <label
              htmlFor="altura"
              className="block text-sm font-medium text-gray-700"
            >
              Altura (cm)
            </label>
            <input
              type="number"
              id="altura"
              placeholder="Ex: 10"
              value={form.altura}
              onChange={(e) => setForm({ ...form, altura: e.target.value })}
              className="border p-2 w-full rounded"
              step="0.1"
              required
            />
          </div>
          <div>
            <label
              htmlFor="largura"
              className="block text-sm font-medium text-gray-700"
            >
              Largura (cm)
            </label>
            <input
              type="number"
              id="largura"
              placeholder="Ex: 20"
              value={form.largura}
              onChange={(e) => setForm({ ...form, largura: e.target.value })}
              className="border p-2 w-full rounded"
              step="0.1"
              required
            />
          </div>
          <div>
            <label
              htmlFor="comprimento"
              className="block text-sm font-medium text-gray-700"
            >
              Comprimento (cm)
            </label>
            <input
              type="number"
              id="comprimento"
              placeholder="Ex: 15"
              value={form.comprimento}
              onChange={(e) =>
                setForm({ ...form, comprimento: e.target.value })
              }
              className="border p-2 w-full rounded"
              step="0.1"
              required
            />
          </div>
        </div>

        {/* CHECKBOX "Observação obrigatória" (DO SEU CÓDIGO ANTIGO) */}
        <div className="flex items-center my-4">
          <input
            type="checkbox"
            id="observacaoObrigatoria"
            name="observacaoObrigatoria"
            checked={form.observacaoObrigatoria || false}
            onChange={(e) =>
              setForm({ ...form, observacaoObrigatoria: e.target.checked })
            }
            className="mr-2 h-5 w-5 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
          />
          <label
            htmlFor="observacaoObrigatoria"
            className="text-sm font-medium text-gray-700"
          >
            Observação obrigatória para este produto? (Ex: para escolha de
            cor/sabor)
          </label>
        </div>

        <label className="block text-sm font-medium text-gray-700 mt-2">
          Imagem do Produto:
        </label>
        <input
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="border p-2 w-full rounded file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />

        {form.currentImageUrl && (
          <div className="mt-2">
            <p className="text-sm text-gray-600 mb-1">Imagem atual:</p>
            <img
              src={form.currentImageUrl}
              alt="Imagem atual do produto"
              className="h-20 w-20 object-cover rounded-md border border-gray-300"
            />
          </div>
        )}
        <button
          type="submit"
          className="bg-blue-600 text-white w-full py-3 rounded-lg hover:bg-blue-700 transition-colors duration-200 text-lg font-medium"
          disabled={uploading}
        >
          {uploading
            ? "Enviando..."
            : editandoId
            ? "Atualizar Produto"
            : "Adicionar Produto"}
        </button>
        {editandoId && (
          <button
            type="button"
            onClick={() => {
              setEditandoId(null);
              // Limpa o formulário, incluindo os novos campos
              setForm({
                nome: "",
                descricao: "",
                preco: "",
                imagem: null,
                currentImageUrl: "",
                destaque_curto: "",
                preco_promocional: "",
                peso: "",
                altura: "",
                largura: "",
                comprimento: "",
                observacaoObrigatoria: false,
              });
              if (document.querySelector('input[type="file"]')) {
                document.querySelector('input[type="file"]').value = "";
              }
            }}
            className="bg-gray-400 text-white w-full py-3 rounded-lg mt-2 hover:bg-gray-500 transition-colors duration-200 text-lg font-medium"
          >
            Cancelar Edição
          </button>
        )}
      </form>
      {/* Seção de Pedidos Recebidos (DO SEU CÓDIGO ANTIGO - COM O NOVO BLOCO DE FRETE) */}
      <div className="mt-10">
        <div
          className="flex justify-between items-center mb-6 cursor-pointer"
          onClick={() => setShowOrders(!showOrders)}
        >
          <h2 className="text-2xl font-semibold text-gray-700">
            Pedidos Recebidos
          </h2>
          {showOrders ? (
            <ChevronUpIcon className="h-6 w-6 text-gray-700" />
          ) : (
            <ChevronDownIcon className="h-6 w-6 text-gray-700" />
          )}
        </div>

        {showOrders && (
          <>
            {pedidos.length === 0 && (
              <p className="text-gray-600">Nenhum pedido recebido ainda.</p>
            )}
            <div className="space-y-6">
              {pedidos.map((pedido) => (
                <div
                  key={pedido.id}
                  className="border p-6 rounded-lg shadow-lg bg-white"
                >
                  <div className="flex flex-col sm:flex-row justify-between items-start mb-3">
                    <h3 className="font-bold text-xl text-blue-700 mb-2 sm:mb-0">
                      Pedido ID: {pedido.id}
                    </h3>
                    <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
                      Data:{" "}
                      {pedido.dataCriacao?.toDate
                        ? pedido.dataCriacao.toDate().toLocaleString("pt-BR", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })
                        : "Data não disponível"}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 mb-4 text-sm">
                    <div>
                      <p>
                        <strong>Status Pedido:</strong>{" "}
                        <span className="font-semibold">
                          {pedido.statusPedido || "N/A"}
                        </span>
                      </p>
                    </div>
                    <div>
                      <p>
                        <strong>Status Pagamento MP:</strong>{" "}
                        <span
                          className={`font-semibold ${
                            pedido.statusPagamentoMP === "approved"
                              ? "text-green-600"
                              : "text-orange-500"
                          }`}
                        >
                          {pedido.statusPagamentoMP || "N/A"}
                        </span>
                      </p>
                    </div>
                    <div>
                      <p>
                        <strong>Subtotal de Produtos:</strong>{" "}
                        <span className="font-semibold">
                          R${" "}
                          {pedido.subtotalAmount
                            ?.toFixed(2)
                            .replace(".", ",") || "0,00"}
                        </span>
                      </p>
                    </div>
                    <div>
                      <p>
                        <strong>Total do Pedido:</strong>{" "}
                        <span className="font-semibold">
                          R${" "}
                          {pedido.totalAmount?.toFixed(2).replace(".", ",") ||
                            "0,00"}
                        </span>
                      </p>
                    </div>
                    {pedido.paymentIdMP && (
                      <div>
                        <p>
                          <strong>ID Pagamento MP:</strong> {pedido.paymentIdMP}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Detalhes do Frete (NOVO BLOCO - DO SEU CÓDIGO MAIS RECENTE) */}
                  {pedido.shippingDetails && (
                    <div className="mb-4 p-4 bg-purple-50 rounded-md border border-purple-200">
                      <h4 className="font-semibold text-md text-purple-800 mb-2">
                        Detalhes do Frete:
                      </h4>
                      <p>
                        <strong>Transportadora:</strong>{" "}
                        {pedido.shippingDetails.carrier || "N/A"}
                      </p>
                      <p>
                        <strong>Custo:</strong> R${" "}
                        {pedido.shippingDetails.price
                          ?.toFixed(2)
                          .replace(".", ",") || "0,00"}
                      </p>
                      <p>
                        <strong>Prazo Estimado:</strong>{" "}
                        {pedido.shippingDetails.deliveryTime || "N/A"} dias
                      </p>
                      <p>
                        <strong>CEP de Destino:</strong>{" "}
                        {pedido.shippingDetails.cep || "N/A"}
                      </p>
                    </div>
                  )}

                  <div className="mb-4 p-4 bg-blue-50 rounded-md border border-blue-200">
                    <h4 className="font-semibold text-md text-blue-800 mb-2">
                      Detalhes do Cliente:
                    </h4>
                    <p>
                      <strong>Nome:</strong>{" "}
                      {pedido.cliente?.nomeCompleto || "N/A"}
                    </p>
                    <p>
                      <strong>Email:</strong> {pedido.cliente?.email || "N/A"}
                    </p>
                    <p>
                      <strong>Telefone:</strong>{" "}
                      {pedido.cliente?.telefone || "N/A"}
                    </p>
                    <p>
                      <strong>CPF:</strong> {pedido.cliente?.cpf || "N/A"}
                    </p>
                  </div>

                  <div className="mb-4 p-4 bg-green-50 rounded-md border border-green-200">
                    <h4 className="font-semibold text-md text-green-800 mb-2">
                      Endereço de Entrega:
                    </h4>
                    <p>
                      {pedido.cliente?.endereco?.logradouro || "N/A"},{" "}
                      {pedido.cliente?.endereco?.numero || "N/A"}
                    </p>
                    {pedido.cliente?.endereco?.complemento && (
                      <p>
                        Complemento: {pedido.cliente?.endereco?.complemento}
                      </p>
                    )}
                    <p>
                      {pedido.cliente?.endereco?.bairro || "N/A"} -{" "}
                      {pedido.cliente?.endereco?.cidade || "N/A"},{" "}
                      {pedido.cliente?.endereco?.estado || "N/A"}
                    </p>
                    <p>CEP: {pedido.cliente?.endereco?.cep || "N/A"}</p>
                  </div>

                  <div className="mb-4">
                    <h4 className="font-semibold text-md text-gray-800 mb-2">
                      Itens do Pedido:
                    </h4>
                    <ul className="list-disc list-inside pl-4 text-sm space-y-1">
                      {pedido.items?.map((item, index) => (
                        <li key={index} className="text-gray-700">
                          {item.nome || "Item sem nome"} (Qtd:{" "}
                          {item.quantity || 0}) - R${" "}
                          {parseFloat(item.precoUnitario || 0)
                            .toFixed(2)
                            .replace(".", ",")}
                          {item.observacaoProduto && ( // Usar observacaoProduto, como salvo no Firestore
                            <p className="text-xs text-blue-600 pl-4">
                              ↳ Obs: {item.observacaoProduto}
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-6 pt-4 border-t border-gray-200 flex justify-end">
                    <button
                      onClick={() => deletarPedido(pedido.id)}
                      className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50 transition-colors duration-200 text-sm shadow"
                    >
                      Excluir Pedido
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      <div className="mb-10"></div> {/* Espaçamento */}
      {/* Seção de Produtos Cadastrados (DO SEU CÓDIGO ANTIGO - COM EXIBIÇÃO DOS NOVOS CAMPOS) */}
      <div className="mt-10">
        <h2 className="text-2xl font-semibold mb-4 text-gray-700">
          Produtos Cadastrados
        </h2>
        {produtos.length === 0 && (
          <p className="text-gray-600">Nenhum produto cadastrado ainda.</p>
        )}
        <div className="space-y-4">
          {produtos.map((produto) => (
            <div
              key={produto.id}
              className="border p-4 rounded-lg shadow-md flex flex-col md:flex-row items-start md:items-center justify-between bg-white hover:shadow-lg transition-shadow"
            >
              <div className="flex items-center mb-4 md:mb-0 w-full md:w-auto flex-grow">
                {produto.imagem && (
                  <img
                    src={produto.imagem}
                    alt={produto.nome}
                    className="h-28 w-28 object-cover mr-4 rounded-lg flex-shrink-0 border"
                  />
                )}
                <div className="flex-grow">
                  <h3 className="font-bold text-xl text-gray-800">
                    {produto.nome}
                  </h3>
                  {produto.destaque_curto && (
                    <p className="text-sm text-gray-500 italic mb-1">
                      {produto.destaque_curto}
                    </p>
                  )}
                  {/* Exibir se a observação é obrigatória */}
                  <p
                    className={`text-xs mb-1 ${
                      produto.observacaoObrigatoria
                        ? "text-red-500 font-semibold"
                        : "text-gray-500"
                    }`}
                  >
                    Observação:{" "}
                    {produto.observacaoObrigatoria ? "Obrigatória" : "Opcional"}
                  </p>
                  <p className="text-gray-700 text-sm mb-1 line-clamp-2">
                    {produto.descricao}
                  </p>
                  {/* Exibir preço promocional ou normal */}
                  {produto.preco_promocional > 0 &&
                  parseFloat(produto.preco_promocional) <
                    parseFloat(produto.preco) ? (
                    <div className="flex items-center">
                      <p className="text-gray-500 line-through text-md mr-2">
                        R${" "}
                        {parseFloat(produto.preco).toFixed(2).replace(".", ",")}
                      </p>
                      <p className="text-xl font-bold text-orange-600">
                        R${" "}
                        {parseFloat(produto.preco_promocional)
                          .toFixed(2)
                          .replace(".", ",")}
                      </p>
                    </div>
                  ) : (
                    <p className="text-green-700 font-semibold text-lg">
                      R${" "}
                      {produto.preco
                        ? parseFloat(produto.preco).toFixed(2).replace(".", ",")
                        : "0,00"}
                    </p>
                  )}
                  {/* EXIBIR PESO E DIMENSÕES */}
                  <div className="text-xs text-gray-600 mt-2">
                    <p>
                      <strong>Peso:</strong> {produto.peso || "N/A"} kg
                    </p>
                    <p>
                      <strong>Dimensões:</strong> {produto.largura || "N/A"}cm
                      (L) x {produto.altura || "N/A"}cm (A) x{" "}
                      {produto.comprimento || "N/A"}cm (C)
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 justify-end w-full md:w-auto md:ml-4 flex-shrink-0">
                <button
                  onClick={() => editar(produto)}
                  className="bg-yellow-500 text-white px-4 py-2 rounded-md hover:bg-yellow-600 transition-colors duration-200 text-sm"
                >
                  Editar
                </button>
                <button
                  onClick={() => deletar(produto.id)}
                  className="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600 transition-colors duration-200 text-sm"
                >
                  Excluir
                </button>
                <button
                  onClick={() => definirDestaque(produto.id)}
                  className={`px-4 py-2 rounded-md transition-colors duration-200 text-sm ${
                    produto.destaque
                      ? "bg-indigo-700 text-white hover:bg-indigo-800"
                      : "bg-indigo-500 text-white hover:bg-indigo-600"
                  }`}
                >
                  {produto.destaque ? "Em Destaque" : "Definir Destaque"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Admin;
