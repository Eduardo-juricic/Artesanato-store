// src/components/ProductDetails.jsx
import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../FirebaseConfig";
import { FaStar } from "react-icons/fa";
import { useCart } from "../context/CartContext";
import { motion } from "framer-motion";
import Notification from "./Notification"; // Certifique-se que este componente existe e está no caminho correto

function ProductDetails() {
  const { id } = useParams();
  const [produto, setProduto] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [quantidade, setQuantidade] = useState(1);
  const { addToCart } = useCart();
  const navigate = useNavigate();
  const [notification, setNotification] = useState("");
  const [mainImage, setMainImage] = useState(""); // Novo estado para a imagem principal exibida

  useEffect(() => {
    const fetchProductDetails = async () => {
      setLoading(true);
      setError(null);
      try {
        const produtoRef = doc(db, "produtos", id);
        const docSnap = await getDoc(produtoRef);

        if (docSnap.exists()) {
          const data = { id: docSnap.id, ...docSnap.data() };
          setProduto(data);
          // Define a imagem principal inicial (pode ser a 'imagem' principal ou a primeira da 'galeriaImagens')
          setMainImage(
            data.imagem ||
              (data.galeriaImagens && data.galeriaImagens[0]) ||
              "https://via.placeholder.com/600"
          );
        } else {
          setError("Produto não encontrado!");
        }
      } catch (err) {
        setError("Erro ao carregar detalhes do produto.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchProductDetails();
  }, [id]);

  const handleQuantityChange = (amount) => {
    setQuantidade((prevQuantidade) => Math.max(1, prevQuantidade + amount));
  };

  const handleAddToCart = () => {
    if (produto) {
      addToCart({ ...produto, quantity: quantidade });
      setNotification(
        `${produto.nome} (x${quantidade}) adicionado ao carrinho!`
      );

      navigate("/carrinho");

      setTimeout(() => setNotification(""), 3000);
    }
  };

  // Nova função para trocar a imagem principal exibida ao clicar em uma miniatura
  const handleThumbnailClick = (imageUrl) => {
    setMainImage(imageUrl);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-200px)]">
        <p className="text-xl text-stone-700">
          Carregando detalhes do produto...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col justify-center items-center min-h-[calc(100vh-200px)] text-red-600">
        <p className="text-xl font-semibold">Erro:</p>
        <p>{error}</p>
      </div>
    );
  }

  if (!produto) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-200px)]">
        <p className="text-xl text-stone-700">Produto não encontrado.</p>
      </div>
    );
  }

  const precoOriginal = parseFloat(produto.preco);
  const precoPromocional = produto.preco_promocional
    ? parseFloat(produto.preco_promocional)
    : null;
  let precoFinal = precoOriginal;
  let mostrarPrecoAntigo = false;

  if (precoPromocional !== null && precoPromocional < precoOriginal) {
    precoFinal = precoPromocional;
    mostrarPrecoAntigo = true;
  }

  // Combina a imagem principal com as imagens da galeria, evitando duplicatas
  const allImages = [produto.imagem, ...(produto.galeriaImagens || [])].filter(
    Boolean
  );
  const uniqueImages = [...new Set(allImages)]; // Remove duplicatas

  return (
    <>
      <motion.div
        className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <div className="grid md:grid-cols-2 gap-8 lg:gap-12 items-start">
          {/* Coluna da Imagem */}
          <motion.div
            className="flex flex-col items-center"
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <div className="aspect-square w-full max-w-md bg-stone-100 rounded-xl shadow-lg overflow-hidden mb-4">
              <img
                src={mainImage} // Usa o estado mainImage para a imagem principal
                alt={produto.nome}
                className="w-full h-full object-cover"
              />
            </div>
            {/* Thumbnails da galeria */}
            {uniqueImages.length > 1 && ( // Exibe miniaturas apenas se houver mais de uma imagem
              <div className="flex space-x-2 justify-center w-full max-w-md overflow-x-auto p-2">
                {uniqueImages.map((imgUrl, index) => (
                  <img
                    key={index}
                    src={imgUrl}
                    alt={`${produto.nome} - Vista ${index + 1}`}
                    className={`w-20 h-20 object-cover rounded-md cursor-pointer border-2
                    ${
                      mainImage === imgUrl
                        ? "border-emerald-500 shadow-md"
                        : "border-transparent hover:border-gray-300"
                    }
                    transition-all duration-200`}
                    onClick={() => handleThumbnailClick(imgUrl)} // Ao clicar, define como imagem principal
                  />
                ))}
              </div>
            )}
          </motion.div>

          {/* Coluna de Detalhes */}
          <motion.div
            className="flex flex-col space-y-6"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <h1 className="text-3xl lg:text-4xl font-bold text-emerald-700">
              {produto.nome}
            </h1>

            <div className="flex items-baseline space-x-2">
              <span className="text-3xl font-extrabold text-emerald-600">
                R$ {precoFinal.toFixed(2).replace(".", ",")}
              </span>
              {mostrarPrecoAntigo && (
                <span className="text-xl text-stone-500 line-through">
                  R$ {precoOriginal.toFixed(2).replace(".", ",")}
                </span>
              )}
            </div>

            <p className="text-stone-600 text-base leading-relaxed">
              {produto.descricao || "Detalhes sobre este produto incrível."}
            </p>

            <div className="flex items-center space-x-3">
              <span className="font-medium text-stone-700">Quantidade:</span>
              <button
                onClick={() => handleQuantityChange(-1)}
                className="px-3 py-1 border border-stone-300 rounded-md hover:bg-stone-100 transition-colors"
                aria-label="Diminuir quantidade"
              >
                -
              </button>
              <input
                type="number"
                value={quantidade}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  if (val >= 1) setQuantidade(val);
                  else if (e.target.value === "") setQuantidade(1);
                }}
                className="w-16 text-center border border-stone-300 rounded-md py-1 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                min="1"
              />
              <button
                onClick={() => handleQuantityChange(1)}
                className="px-3 py-1 border border-stone-300 rounded-md hover:bg-stone-100 transition-colors"
                aria-label="Aumentar quantidade"
              >
                +
              </button>
            </div>

            <button
              className="w-full bg-emerald-600 text-white font-semibold py-3 px-6 rounded-lg text-lg
                        hover:bg-emerald-700 focus:outline-none focus:ring-2
                        focus:ring-emerald-500 focus:ring-opacity-75 shadow-md
                        transition-all duration-200 ease-in-out transform hover:scale-105"
              onClick={handleAddToCart}
            >
              Adicionar ao Carrinho
            </button>

            {produto.destaque_curto && (
              <div className="pt-4 border-t border-stone-200">
                <h3 className="text-lg font-semibold text-emerald-700 mb-2">
                  Destaques:
                </h3>
                <ul className="list-disc list-inside space-y-1 text-stone-600">
                  {produto.destaque_curto.split(";").map((feature, index) => (
                    <li key={index}>{feature.trim()}</li>
                  ))}
                </ul>
              </div>
            )}
          </motion.div>
        </div>
      </motion.div>
      {notification && (
        <Notification
          message={notification}
          onClose={() => setNotification("")}
        />
      )}
    </>
  );
}

export default ProductDetails;
