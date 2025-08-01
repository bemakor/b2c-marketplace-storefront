"use client"

import { HttpTypes } from "@medusajs/types"
import {
  AlgoliaProductSidebar,
  ProductCard,
  ProductListingActiveFilters,
  ProductsPagination,
} from "@/components/organisms"
import { client } from "@/lib/client"
import { Configure, useHits } from "react-instantsearch"
import { InstantSearchNext } from "react-instantsearch-nextjs"
import { useSearchParams } from "next/navigation"
import { getFacedFilters } from "@/lib/helpers/get-faced-filters"
import { PRODUCT_LIMIT } from "@/const"
import { ProductListingSkeleton } from "@/components/organisms/ProductListingSkeleton/ProductListingSkeleton"
import { useEffect, useState } from "react"
import { listProducts } from "@/lib/data/products"
import { getProductPrice } from "@/lib/helpers/get-product-price"

export const AlgoliaProductsListing = ({
  category_id,
  collection_id,
  seller_handle,
  locale = process.env.NEXT_PUBLIC_DEFAULT_REGION,
}: {
  category_id?: string
  collection_id?: string
  locale?: string
  seller_handle?: string
  currency_code?: string
}) => {
  const searchParamas = useSearchParams()

  const facetFilters: string = getFacedFilters(searchParamas)
  const query: string = searchParamas.get("query") || ""

  // Build facet filters for array attributes
  const facetFiltersList = [
    `supported_countries:${locale}`,
    category_id ? `categories.id:${category_id}` : '',
    facetFilters
  ].filter(Boolean)
  
  // Build basic filters for non-array attributes
  const basicFilters = [
    seller_handle ? `NOT seller:null AND seller.handle:${seller_handle}` : 'NOT seller:null',
    'NOT seller.store_status:SUSPENDED',
    collection_id ? `collections.id:${collection_id}` : ''
  ].filter(Boolean).join(' AND ')

  return (
    <InstantSearchNext searchClient={client} indexName="products">
      <Configure 
        query={query} 
        filters={basicFilters} 
        facetFilters={facetFiltersList}
      />
      <ProductsListing locale={locale} categoryId={category_id} />
    </InstantSearchNext>
  )
}

const ProductsListing = ({ locale, categoryId }: { locale?: string, categoryId?: string }) => {
  const [prod, setProd] = useState<HttpTypes.StoreProduct[] | null>(null)
  const { items, results } = useHits()

  const searchParamas = useSearchParams()

  useEffect(() => {
    listProducts({
      countryCode: locale,
      queryParams: {
        fields:
          "*variants.calculated_price,*seller.reviews,-thumbnail,-images,-type,-tags,-variants.options,-options,-collection,-collection_id",
        limit: 999,
      },
    }).then(({ response }) => {
      const filteredProds = response.products.filter((prod) => {
        const { cheapestPrice } = getProductPrice({ product: prod })
        return Boolean(cheapestPrice) && prod
      })
      setProd(filteredProds)
    })
  }, [locale])

  if (!results?.processingTimeMS) return <ProductListingSkeleton />

  const page: number = +(searchParamas.get("page") || 1)
  const filteredProducts = items.filter((pr) =>
    prod?.some((p: any) => p.id === pr.objectID)
  )

  const products = filteredProducts
    .filter((pr) => prod?.some((p: any) => p.id === pr.objectID))
    .slice((page - 1) * PRODUCT_LIMIT, page * PRODUCT_LIMIT)

  const count = filteredProducts?.length || 0
  const pages = Math.ceil(count / PRODUCT_LIMIT) || 1

  return (
    <>
      <div className="flex justify-between w-full items-center">
        <div className="my-4 label-md">{`${count} listings`}</div>
      </div>
      <div className="hidden md:block">
        <ProductListingActiveFilters />
      </div>
      <div className="md:flex gap-4">
        <div>
          <AlgoliaProductSidebar />
        </div>
        <div className="w-full">
          {!items.length ? (
            <div className="text-center w-full my-10">
              <h2 className="uppercase text-primary heading-lg">no results</h2>
              <p className="mt-4 text-lg">
                Sorry, we can&apos;t find any results for your criteria
              </p>
            </div>
          ) : (
            <div className="w-full">
              <ul className="flex flex-wrap gap-4">
                {products.map(
                  (hit) =>
                    prod?.find((p: any) => p.id === hit.objectID) && (
                      <ProductCard
                        api_product={prod?.find(
                          (p: any) => p.id === hit.objectID
                        )}
                        key={hit.objectID}
                        product={hit}
                      />
                    )
                )}
              </ul>
            </div>
          )}
        </div>
      </div>
      <ProductsPagination pages={pages} />
    </>
  )
}
