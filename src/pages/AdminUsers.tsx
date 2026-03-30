import { useState } from 'react'
import { db } from '@/lib/db'
import type { AppRole } from '@/lib/constants'

export default function AdminUsersPage() {
  const [users, setUsers] = useState(() => db.users.getAll())

  function updateRole(userId: string, newRole: AppRole) {
    db.users.updateRole(userId, newRole)
    setUsers(db.users.getAll())
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-serif text-foreground">User management</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage staff access levels</p>
      </div>

      <div className="hub-card">
        <h2 className="text-sm font-semibold text-foreground mb-4">{users.length} staff members</h2>
        <div className="space-y-2">
          {users.map(u => (
            <div key={u.id} className="flex items-center justify-between py-3 border-b border-border last:border-0 gap-4">
              <div>
                <p className="text-sm font-medium text-foreground">{u.full_name || 'Unnamed'}</p>
                <p className="text-xs text-muted-foreground">{u.email} {u.department ? `· ${u.department}` : ''}</p>
              </div>
              <select className="hub-input text-xs py-1 w-36" value={u.role}
                onChange={e => updateRole(u.id, e.target.value as AppRole)}>
                <option value="user">User</option>
                <option value="sub_admin">Sub Admin</option>
                <option value="admin">Admin</option>
                <option value="super_admin">Super Admin</option>
              </select>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
