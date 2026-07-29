import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { User } from 'next-auth'

export default async function Header() {
  const session = await getServerSession(authOptions)
  const user = session?.user as User

  return (
    <header className="border-b h-16 flex items-center px-6">
      <div className="flex-1">
        <h2 className="text-xl font-semibold">HugoAI Dashboard</h2>
      </div>
      <div className="flex items-center space-x-4">
        <span className="text-sm">{user?.name}</span>
        <button
          onClick={() => window.location.href = '/api/auth/logout'}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Logout
        </button>
      </div>
    </header>
  )
}