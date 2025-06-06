import React, { useState, useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../FirebaseConfig";
import { Link } from "react-router-dom"; // Importe o Link para navegação
import Notification from "./Notification";
import { motion } from "framer-motion";
import { Element } from "react-scroll";

function Products() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Removido useCart e notificationMessage pois a função de adicionar ao carrinho foi movida
  // const { addToCart } = useCart();
  // const [notificationMessage, setNotificationMessage] = useState(null);

  // Removido handleAddToCart pois o botão "Comprar" não está mais aqui
  // const handleAddToCart = (product) => {
  //   addToCart(product);
  //   setNotificationMessage(`${product.nome} adicionado ao carrinho!`);
  //   setTimeout(() => {
  //     setNotificationMessage(null);
  //   }, 3000);
  // };

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const productsRef = collection(db, "produtos");
        const snapshot = await getDocs(productsRef);
        const productsList = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        const produtosNormais = productsList.filter(
          (product) => !product.destaque // Filtra produtos que não são destaque
        );
        setProducts(produtosNormais);
      } catch (err) {
        console.error("Erro ao buscar produtos:", err);
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  if (loading) {
    return (
      <section className="bg-white py-20 text-center">
        <div className="text-xl text-emerald-700">Carregando produtos...</div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="bg-white py-20 text-center">
        <div className="text-xl text-red-600">
          Erro ao carregar produtos: {error.message}
        </div>
      </section>
    );
  }

  if (products.length === 0) {
    return (
      <section className="bg-white py-20 text-center">
        <div className="text-xl text-stone-700">
          Nenhum produto encontrado no momento.
        </div>
      </section>
    );
  }

  return (
    <Element name="produtos-section">
      <section className="bg-gray-50 py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-4xl font-bold mb-12 text-emerald-700 text-center">
            Nossos Produtos
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {products.map((product, index) => (
              <motion.div
                key={product.id}
                className="group bg-white rounded-xl shadow-lg hover:shadow-2xl transition-shadow duration-300 ease-out overflow-hidden flex flex-col"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.07 }}
              >
                {/* O Link envolve toda a imagem para que ela também seja clicável */}
                <Link
                  to={`/produto/${product.id}`}
                  className="relative aspect-square w-full overflow-hidden"
                >
                  <img
                    src={product.imagem || "https://via.placeholder.com/300"}
                    alt={product.nome || "Nome do Produto"}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 ease-out"
                  />
                </Link>
                <div className="p-6 flex flex-col flex-grow items-center text-center">
                  <h3 className="text-xl font-semibold text-emerald-800 mb-2">
                    {product.nome || "Produto Incrível"}
                  </h3>
                  <p className="text-sm text-stone-600 mb-4 flex-grow min-h-[60px]">
                    {product.descricaoCurta ||
                      (product.descricao &&
                        product.descricao.substring(0, 80) +
                          (product.descricao.length > 80 ? "..." : "")) ||
                      "Descrição detalhada do produto em breve."}
                  </p>
                  {/* Lógica para exibir preço promocional ou normal */}
                  {product.preco_promocional &&
                  Number(product.preco_promocional) < Number(product.preco) ? (
                    <div className="flex items-center justify-center mb-6">
                      <p className="text-gray-500 line-through text-lg mr-2">
                        R$ {Number(product.preco).toFixed(2).replace(".", ",")}
                      </p>
                      <p className="text-2xl font-bold text-orange-600">
                        R${" "}
                        {Number(product.preco_promocional)
                          .toFixed(2)
                          .replace(".", ",")}
                      </p>
                    </div>
                  ) : (
                    <p className="text-2xl font-bold text-emerald-600 mb-6">
                      R${" "}
                      {product.preco
                        ? Number(product.preco).toFixed(2).replace(".", ",")
                        : "N/A"}
                    </p>
                  )}
                  {/* Botão "Ver Detalhes" */}
                  <Link
                    to={`/produto/${product.id}`}
                    className="mt-auto bg-emerald-600 text-white hover:bg-emerald-700 font-semibold py-3 px-8 rounded-lg transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-opacity-50 w-full md:w-auto"
                  >
                    Ver Detalhes
                  </Link>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
        {/* A notificação não é mais necessária neste componente após a mudança */}
        {/* {notificationMessage && (
          <Notification
            message={notificationMessage}
            onClose={() => setNotificationMessage(null)}
          />
        )} */}
      </section>
    </Element>
  );
}

export default Products;
