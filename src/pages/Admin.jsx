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
  // ALTERADO: Adicionado campos de peso e dimensões ao estado do formulário
  const [form, setForm] = useState({
    nome: "",
    descricao: "",
    preco: "",
    imagem: null,
    currentImageUrl: "",
    destaque_curto: "",
    preco_promocional: "",
    peso: "", // kg
    altura: "", // cm
    largura: "", // cm
    comprimento: "", // cm
  });
  const [editandoId, setEditandoId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [cloudinaryConfig, setCloudinaryConfig] = useState({
    cloud_name: "",
    upload_preset: "",
  });
  const [showOrders, setShowOrders] = useState(false);

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

      // ALTERADO: Adicionado campos de peso e dimensões ao objeto salvo
      const produtoData = {
        nome: form.nome,
        descricao: form.descricao,
        preco: Number(form.preco),
        imagem: imageUrl,
        destaque_curto: form.destaque_curto,
        preco_promocional: form.preco_promocional
          ? Number(form.preco_promocional)
          : 0,
        peso: Number(form.peso),
        altura: Number(form.altura),
        largura: Number(form.largura),
        comprimento: Number(form.comprimento),
      };

      if (editandoId) {
        const ref = doc(db, "produtos", editandoId);
        await updateDoc(ref, produtoData);
        setEditandoId(null);
      } else {
        await addDoc(produtosRef, produtoData);
      }

      // ALTERADO: Limpa os novos campos do formulário
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
    if (window.confirm(`Tem certeza que deseja excluir o pedido ID: ${id}?`)) {
      try {
        const pedidoDocRef = doc(db, "pedidos", id);
        await deleteDoc(pedidoDocRef);
        buscarPedidos();
      } catch (error) {
        alert(`Erro ao excluir pedido: ${error.message}`);
      }
    }
  };

  // ALTERADO: Carrega os novos campos ao editar
  const editar = (produto) => {
    setForm({
      nome: produto.nome,
      descricao: produto.descricao,
      preco: produto.preco,
      imagem: null,
      currentImageUrl: produto.imagem || "",
      destaque_curto: produto.destaque_curto || "",
      preco_promocional: produto.preco_promocional || "",
      peso: produto.peso || "",
      altura: produto.altura || "",
      largura: produto.largura || "",
      comprimento: produto.comprimento || "",
      id: produto.id,
    });
    setEditandoId(produto.id);
    window.scrollTo(0, 0);
  };

  const definirDestaque = async (id) => {
    // ... (código existente sem alterações)
  };

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Painel Admin</h1>
        <button onClick={handleLogout} className="bg-red-600 ...">
          Sair
        </button>
      </div>

      {/* Seção de Pedidos Recebidos (sem alterações) */}
      <div className="mt-10">
        {/* ... (seu código JSX para pedidos) ... */}
        {/* ADICIONADO: Bloco para exibir detalhes do Frete */}
        {pedidos.map((pedido) => (
          <div
            key={pedido.id}
            className="border p-6 rounded-lg shadow-lg bg-white"
          >
            {/* ... (todo o seu código para exibir detalhes do pedido) ... */}
            {pedido.shippingDetails && (
              <div className="mb-4 p-4 bg-purple-50 rounded-md border border-purple-200">
                <h4 className="font-semibold text-md text-purple-800 mb-2">
                  Detalhes do Frete:
                </h4>
                <p>
                  <strong>Transportadora:</strong>{" "}
                  {pedido.shippingDetails.carrier}
                </p>
                <p>
                  <strong>Custo:</strong> R${" "}
                  {pedido.shippingDetails.price?.toFixed(2) || "0.00"}
                </p>
                <p>
                  <strong>Prazo Estimado:</strong>{" "}
                  {pedido.shippingDetails.deliveryTime} dias
                </p>
                <p>
                  <strong>CEP de Destino:</strong> {pedido.shippingDetails.cep}
                </p>
              </div>
            )}
            {/* ... (resto do código de exibição do pedido) ... */}
          </div>
        ))}
      </div>

      {/* Seção de Adicionar/Editar Produto */}
      <form onSubmit={handleSubmit} className="space-y-4 mb-10 p-6 border ...">
        <h2 className="text-2xl font-semibold ...">
          {editandoId ? "Editar Produto" : "Adicionar Novo Produto"}
        </h2>
        <textarea
          type="text"
          placeholder="Nome do Produto"
          value={form.nome}
          onChange={(e) => setForm({ ...form, nome: e.target.value })}
          className="border p-2 w-full rounded"
          required
        />
        <textarea
          placeholder="Descrição detalhada"
          value={form.descricao}
          onChange={(e) => setForm({ ...form, descricao: e.target.value })}
          className="border p-2 w-full ..."
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
          placeholder="Preço Promocional (opcional)"
          value={form.preco_promocional}
          onChange={(e) =>
            setForm({ ...form, preco_promocional: e.target.value })
          }
          className="border p-2 w-full ..."
        />
        <textarea
          type="text"
          placeholder="Características Principais (Separe com ;)"
          value={form.destaque_curto}
          onChange={(e) => setForm({ ...form, destaque_curto: e.target.value })}
          className="border p-2 w-full ..."
        />

        {/* ADICIONADO: Inputs para peso e dimensões */}
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

        <label className="block text-sm font-medium text-gray-700 mt-2">
          Imagem do Produto:
        </label>
        <input
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="border p-2 w-full ..."
        />

        {form.currentImageUrl && (
          <div className="mt-2">
            <p className="text-sm text-gray-600 mb-1">Imagem atual:</p>
            <img
              src={form.currentImageUrl}
              alt="Imagem atual"
              className="h-20 w-20 ..."
            />
          </div>
        )}
        <button
          type="submit"
          className="bg-blue-600 text-white ..."
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
              // ALTERADO: Limpa os novos campos ao cancelar
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
              });
              if (document.querySelector('input[type="file"]')) {
                document.querySelector('input[type="file"]').value = "";
              }
            }}
            className="bg-gray-400 text-white ..."
          >
            Cancelar Edição
          </button>
        )}
      </form>

      <div className="mb-10"></div>
    </div>
  );
};

export default Admin;
