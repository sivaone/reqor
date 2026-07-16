type SidebarTab = 'collections' | 'history'

type SidebarTabsProps = {
  activeTab: SidebarTab
  onTabChange: (tab: SidebarTab) => void
}

export function SidebarTabs({ activeTab, onTabChange }: SidebarTabsProps) {
  const tabs: { id: SidebarTab; label: string }[] = [
    { id: 'collections', label: 'Collections' },
    { id: 'history', label: 'History' },
  ]

  return (
    <div role="tablist" aria-label="Sidebar sections" className="flex border-b border-border">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={`flex-1 px-inset py-inset-sm text-body ${
              isActive
                ? 'border-b-2 border-primary text-foreground'
                : 'text-foreground-muted'
            }`}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}

export type { SidebarTab }
