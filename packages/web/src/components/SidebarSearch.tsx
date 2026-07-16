type SidebarSearchProps = {
  value: string
  onChange: (value: string) => void
  placeholder: string
}

export function SidebarSearch({ value, onChange, placeholder }: SidebarSearchProps) {
  return (
    <input
      type="search"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="w-full rounded-md border border-border bg-background px-inset-sm py-inset-sm text-body"
    />
  )
}
