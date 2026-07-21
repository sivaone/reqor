export type RequestSubTab = 'params' | 'headers' | 'body' | 'raw'

type RequestSubTabsProps = {
  activeTab: RequestSubTab
  onTabChange: (tab: RequestSubTab) => void
  headersCount: number
}

const TABS: Array<{ id: RequestSubTab; label: string }> = [
  { id: 'params', label: 'Params' },
  { id: 'headers', label: 'Headers' },
  { id: 'body', label: 'Body' },
  { id: 'raw', label: 'Raw .http' },
]

export function RequestSubTabs({ activeTab, onTabChange, headersCount }: RequestSubTabsProps) {
  return (
    <div role="tablist" aria-label="Request editor sections" className="flex border-b border-border">
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id
        const label =
          tab.id === 'headers' ? `${tab.label} (${headersCount})` : tab.label
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`request-tab-${tab.id}`}
            aria-controls={`request-panel-${tab.id}`}
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            className={`px-inset py-inset-sm text-body ${
              isActive
                ? 'border-b-2 border-primary text-foreground'
                : 'text-foreground-muted'
            }`}
            onClick={() => onTabChange(tab.id)}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
