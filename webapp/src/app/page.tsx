import { redirect } from 'next/navigation'
import Dashboard from '@/components/Dashboard'
import { serverAuthService } from '@/lib/auth/server.auth.service'

export default async function Home() {
  const { user, error } = await serverAuthService.getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  return <Dashboard user={user} />
}
