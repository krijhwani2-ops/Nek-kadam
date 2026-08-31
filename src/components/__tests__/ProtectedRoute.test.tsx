import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import ProtectedRoute from '../ProtectedRoute';
import { useAuth } from '../../contexts/AuthContext';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import '@testing-library/jest-dom';

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: vi.fn()
}));

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading spinner when loading is true', () => {
    vi.mocked(useAuth).mockReturnValue({
      loading: true,
      isLoggedIn: false,
      session: null,
      login: vi.fn(),
      logout: vi.fn(),
      updatePresence: vi.fn(),
    });

    const { container } = render(
      <MemoryRouter>
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>
      </MemoryRouter>
    );

    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('redirects to /login when not logged in and not loading', () => {
    vi.mocked(useAuth).mockReturnValue({
      loading: false,
      isLoggedIn: false,
      session: null,
      login: vi.fn(),
      logout: vi.fn(),
      updatePresence: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route path="/login" element={<div>Login Page</div>} />
          <Route
            path="/protected"
            element={
              <ProtectedRoute>
                <div>Protected Content</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Login Page')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('renders children when logged in and not loading', () => {
    vi.mocked(useAuth).mockReturnValue({
      loading: false,
      isLoggedIn: true,
      session: {
        userId: '1',
        userName: 'Test User',
        department: 'Medical',
        role: 'Doctor',
        loginTime: new Date().toISOString()
      },
      login: vi.fn(),
      logout: vi.fn(),
      updatePresence: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route
            path="/protected"
            element={
              <ProtectedRoute>
                <div>Protected Content</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });
});
