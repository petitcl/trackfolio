import HoldingDetailsClient from '@/components/HoldingDetailsClient'

interface HoldingPageProps {
  params: Promise<{
    symbol: string
  }>
}

export default async function HoldingPage({ params }: HoldingPageProps) {
  // Decode the symbol in case it was URL encoded
  const { symbol } = await params
  const decodedSymbol = decodeURIComponent(symbol)

  return <HoldingDetailsClient symbol={decodedSymbol} />
}

// Generate metadata for the page
export async function generateMetadata({ params }: HoldingPageProps) {
  const { symbol } = await params
  const decodedSymbol = decodeURIComponent(symbol)
  return {
    title: `${decodedSymbol} - Holding Details | Trackfolio`,
    description: `View detailed information and transaction history for ${decodedSymbol}`,
  }
}