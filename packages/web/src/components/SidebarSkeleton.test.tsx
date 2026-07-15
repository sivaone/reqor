import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SidebarSkeleton } from './SidebarSkeleton.js'

describe('SidebarSkeleton', () => {
  it('renders 4 to 6 skeleton rows', () => {
    render(<SidebarSkeleton />)

    const rows = screen.getAllByTestId('skeleton-row')
    expect(rows.length).toBeGreaterThanOrEqual(4)
    expect(rows.length).toBeLessThanOrEqual(6)
  })
})
