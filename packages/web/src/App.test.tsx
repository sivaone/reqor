import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { App } from './App.js'

describe('App', () => {
  it('mounts and renders Reqor heading', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Reqor' })).toBeDefined()
  })
})
