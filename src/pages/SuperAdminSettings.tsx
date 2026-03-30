import { Settings, Database, Shield, Globe, Bell, Lock } from 'lucide-react'

const SETTING_SECTIONS = [
  {
    icon: Shield,
    title: 'Access control',
    color: 'text-purple-600',
    bg: 'bg-purple-50',
    items: [
      { label: 'Invitation-only registration', value: 'Enabled', editable: false },
      { label: 'Session timeout',              value: '24 hours', editable: true },
      { label: 'Max login attempts',           value: '5',        editable: true },
    ],
  },
  {
    icon: Database,
    title: 'Data management',
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    items: [
      { label: 'Knowledge base',    value: 'Active',      editable: false },
      { label: 'Storage provider',  value: 'Supabase',    editable: false },
      { label: 'Attachment limit',  value: '10 MB / file', editable: true },
    ],
  },
  {
    icon: Globe,
    title: 'Application',
    color: 'text-green-600',
    bg: 'bg-green-50',
    items: [
      { label: 'Application name', value: 'Parul University Knowledge Hub', editable: false },
      { label: 'Default language', value: 'English',                        editable: false },
      { label: 'Timezone',         value: 'Asia/Kolkata (IST)',              editable: true },
    ],
  },
  {
    icon: Bell,
    title: 'Notifications',
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    items: [
      { label: 'Email notifications', value: 'Disabled', editable: true },
      { label: 'Digest frequency',    value: 'Weekly',   editable: true },
    ],
  },
  {
    icon: Lock,
    title: 'Security',
    color: 'text-red-600',
    bg: 'bg-red-50',
    items: [
      { label: 'Auth provider',   value: 'Supabase Auth', editable: false },
      { label: 'Password policy', value: 'Min 8 chars',   editable: false },
      { label: 'RLS policies',    value: 'Enforced',      editable: false },
    ],
  },
]

export default function SuperAdminSettings() {
  return (
    <div className="animate-fade-in space-y-6">

      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
          <Settings className="w-5 h-5 text-muted-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-serif text-foreground">System settings</h1>
          <p className="text-sm text-muted-foreground">View and manage system configuration</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {SETTING_SECTIONS.map(section => {
          const Icon = section.icon
          return (
            <div key={section.title} className="hub-card">
              <div className="flex items-center gap-2.5 mb-4">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${section.bg}`}>
                  <Icon className={`w-4 h-4 ${section.color}`} />
                </div>
                <h2 className="text-sm font-semibold text-foreground">{section.title}</h2>
              </div>
              <div className="space-y-3">
                {section.items.map(item => (
                  <div key={item.label} className="flex items-center justify-between gap-3 py-2 border-b border-border last:border-0">
                    <span className="text-sm text-foreground">{item.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground font-medium">{item.value}</span>
                      {item.editable && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                          editable
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <div className="hub-card border-amber-200 bg-amber-50/50">
        <p className="text-xs text-amber-700 leading-relaxed">
          <strong>Note:</strong> Most system settings are managed through environment variables and Supabase
          project configuration. Contact your system administrator to modify non-editable settings.
        </p>
      </div>
    </div>
  )
}
