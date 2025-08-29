import HoldingDetailsClient from '@/components/HoldingDetailsClient'

interface HoldingPageProps {
  params: {
    symbol: string
  }
}

export default function HoldingPage({ params }: HoldingPageProps) {
  // Decode the symbol in case it was URL encoded
  const symbol = decodeURIComponent(params.symbol)

  return <HoldingDetailsClient symbol={symbol} />
}

// Generate metadata for the page
export async function generateMetadata({ params }: HoldingPageProps) {
  const symbol = decodeURIComponent(params.symbol)
  return {
    title: `${symbol} - Holding Details | Trackfolio`,
    description: `View detailed information and transaction history for ${symbol}`,
  }
}