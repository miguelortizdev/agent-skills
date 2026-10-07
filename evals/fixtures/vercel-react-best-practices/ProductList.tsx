export async function ProductList() {
  const products = await fetch('/api/products').then((response) => response.json())
  const recommendations = await fetch('/api/recommendations').then((response) => response.json())

  return <ProductGrid products={products} recommendations={recommendations} />
}

function ProductGrid({ products, recommendations }) {
  return <div>{products.length + recommendations.length}</div>
}
