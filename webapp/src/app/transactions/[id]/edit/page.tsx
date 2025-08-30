import EditTransactionClient from '@/components/EditTransactionClient'

interface EditTransactionPageProps {
  params: {
    id: string
  }
}

export default function EditTransactionPage({ params }: EditTransactionPageProps) {
  return <EditTransactionClient transactionId={params.id} />
}

// Generate metadata for the page
export async function generateMetadata({ params }: EditTransactionPageProps) {
  return {
    title: `Edit Transaction - ${params.id} | Trackfolio`,
    description: `Edit transaction details`,
  }
}