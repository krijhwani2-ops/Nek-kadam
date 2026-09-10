import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import MedicineQueue from '../../pages/MedicineQueue';
import TokenQueue from '../../pages/TokenQueue';
import { AuthProvider } from '../../contexts/AuthContext';
import { mockQueueTasks, mockTokens, mockDeptCounters, mockDepartments } from '../../test/mocks/mockFixtures';

// Setup fake session in localStorage
function setMockSession() {
  localStorage.setItem('nk_current_user', JSON.stringify({
    userId: 'v1',
    userName: 'Test Volunteer',
    department: 'Medical',
    role: 'Volunteer',
    loginTime: new Date().toISOString()
  }));
  localStorage.setItem('nk_token', 'test-token-123');
}

describe('Integration: Queue Tasks & Token Lifecycle', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    setMockSession();
    vi.stubGlobal('confirm', () => true);
    vi.stubGlobal('alert', vi.fn());

    mockFetch = vi.fn(async (url: string | URL | Request, options?: RequestInit) => {
      const urlString = typeof url === 'string' ? url : url.toString();

      if (urlString.includes('/api/queue/claim')) {
        const body = JSON.parse((options?.body as string) || '{}');
        return {
          ok: true,
          json: async () => ({ success: true, taskId: body.taskId }),
        };
      }
      if (urlString.includes('/api/queue/finish')) {
        const body = JSON.parse((options?.body as string) || '{}');
        return {
          ok: true,
          json: async () => ({ success: true, taskId: body.taskId }),
        };
      }
      if (urlString.includes('/api/queue/tasks')) {
        return {
          ok: true,
          json: async () => ({ data: mockQueueTasks }),
        };
      }
      if (urlString.includes('/api/tokens/dashboard')) {
        return {
          ok: true,
          json: async () => ({
            data: mockDeptCounters,
            totals: { totalToday: 5, totalDone: 1, dateKey: '2026-08-13' },
          }),
        };
      }
      if (urlString.includes('/api/tokens/start')) {
        return {
          ok: true,
          json: async () => ({ data: { ...mockTokens[0], status: 'IN_PROGRESS' } }),
        };
      }
      if (urlString.includes('/api/tokens/move')) {
        return {
          ok: true,
          json: async () => ({ data: { ...mockTokens[1], status: 'DONE' } }),
        };
      }
      if (urlString.includes('/api/tokens/skip')) {
        return {
          ok: true,
          json: async () => ({ data: { ...mockTokens[0], status: 'SKIPPED' } }),
        };
      }
      if (urlString.includes('/api/tokens/requeue')) {
        return {
          ok: true,
          json: async () => ({ data: { ...mockTokens[3], status: 'WAITING' } }),
        };
      }
      if (urlString.includes('/api/tokens/cancel')) {
        return {
          ok: true,
          json: async () => ({ data: { ...mockTokens[0], status: 'CANCELLED' } }),
        };
      }
      if (urlString.includes('/api/tokens/priority')) {
        return {
          ok: true,
          json: async () => ({ data: { ...mockTokens[0], priority: 'URGENT' } }),
        };
      }
      if (urlString.includes('/api/tokens')) {
        return {
          ok: true,
          json: async () => ({ data: mockTokens }),
        };
      }
      if (urlString.includes('/api/departments')) {
        return {
          ok: true,
          json: async () => ({ data: mockDepartments }),
        };
      }
      if (urlString.includes('/api/presence/heartbeat')) {
        return {
          ok: true,
          json: async () => ({ success: true }),
        };
      }

      return {
        ok: true,
        json: async () => ({ success: true }),
      };
    });

    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  describe('Medicine Queue Tasks (Claiming & Finishing)', () => {
    it('renders initial queue tasks correctly in Self-Pick Pipeline and My Active Workbench', async () => {
      render(
        <AuthProvider>
          <MedicineQueue />
        </AuthProvider>
      );

      // Wait for tasks to load
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Pending task John Doe should be in Self-Pick Pipeline
      expect(screen.getByText('Self-Pick Pipeline')).toBeInTheDocument();
      expect(screen.getByText('Claim Work')).toBeInTheDocument();

      // In-progress task Jane Smith (claimed by Test Volunteer) in My Active Workbench
      expect(screen.getByText('My Active Workbench')).toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      expect(screen.getByText('Complete & Mark Ready')).toBeInTheDocument();
    });

    it('claims a task via POST /api/queue/claim and updates local component state', async () => {
      render(
        <AuthProvider>
          <MedicineQueue />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const claimButton = screen.getByRole('button', { name: /Claim Work/i });
      fireEvent.click(claimButton);

      await waitFor(() => {
        const claimCalls = mockFetch.mock.calls.filter(call => call[0].includes('/api/queue/claim'));
        expect(claimCalls.length).toBeGreaterThan(0);
        expect(JSON.parse(claimCalls[0][1].body)).toEqual({
          taskId: 'task-1',
          volunteerName: 'Test Volunteer',
        });
      });

      // State updated: John Doe should now be in My Active Workbench with "Complete & Mark Ready" button
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        const completeButtons = screen.getAllByRole('button', { name: /Complete & Mark Ready/i });
        expect(completeButtons.length).toBeGreaterThanOrEqual(1);
      });
    });

    it('finishes a claimed task via POST /api/queue/finish and updates local component state', async () => {
      render(
        <AuthProvider>
          <MedicineQueue />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      });

      const finishButton = screen.getByRole('button', { name: /Complete & Mark Ready/i });
      fireEvent.click(finishButton);

      await waitFor(() => {
        const finishCalls = mockFetch.mock.calls.filter(call => call[0].includes('/api/queue/finish'));
        expect(finishCalls.length).toBeGreaterThan(0);
        expect(JSON.parse(finishCalls[0][1].body)).toEqual({ taskId: 'task-2' });
      });

      // State updated: Jane Smith moves to Dispatch History with status READY
      await waitFor(() => {
        expect(screen.getByText('Dispatch History')).toBeInTheDocument();
        const readyBadges = screen.getAllByText('READY');
        expect(readyBadges.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Department Token State Actions (WAITING, IN_PROGRESS, DONE, SKIPPED, CANCELLED)', () => {
    it('renders tokens with various statuses (WAITING, IN_PROGRESS, DONE, SKIPPED, CANCELLED)', async () => {
      render(
        <AuthProvider>
          <TokenQueue />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Token System')).toBeInTheDocument();
      });

      // Check status badges present (note: IN_PROGRESS renders as "IN PROGRESS")
      await waitFor(() => {
        expect(screen.getAllByText('WAITING').length).toBeGreaterThan(0);
        expect(screen.getAllByText('IN PROGRESS').length).toBeGreaterThan(0);
        expect(screen.getAllByText('DONE').length).toBeGreaterThan(0);
        expect(screen.getAllByText('SKIPPED').length).toBeGreaterThan(0);
        expect(screen.getAllByText('CANCELLED').length).toBeGreaterThan(0);
      });
    });

    it('triggers startToken action for WAITING token', async () => {
      render(
        <AuthProvider>
          <TokenQueue />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Token System')).toBeInTheDocument();
      });

      // Find start button (title="Start")
      const startButton = await screen.findByTitle('Start');
      fireEvent.click(startButton);

      await waitFor(() => {
        const startCalls = mockFetch.mock.calls.filter(call => call[0].includes('/api/tokens/start'));
        expect(startCalls.length).toBeGreaterThan(0);
        expect(JSON.parse(startCalls[0][1].body)).toMatchObject({
          tokenId: 'tok-1',
          departmentId: 'dept-rec',
        });
      });
    });

    it('triggers moveToken action for IN_PROGRESS token', async () => {
      render(
        <AuthProvider>
          <TokenQueue />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Token System')).toBeInTheDocument();
      });

      const moveButton = await screen.findByTitle('Move/Complete');
      fireEvent.click(moveButton);

      await waitFor(() => {
        const moveCalls = mockFetch.mock.calls.filter(call => call[0].includes('/api/tokens/move'));
        expect(moveCalls.length).toBeGreaterThan(0);
        expect(JSON.parse(moveCalls[0][1].body)).toMatchObject({ tokenId: 'tok-2' });
      });
    });

    it('triggers skipToken action', async () => {
      render(
        <AuthProvider>
          <TokenQueue />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Token System')).toBeInTheDocument();
      });

      const skipButtons = screen.getAllByTitle('Skip');
      fireEvent.click(skipButtons[0]);

      await waitFor(() => {
        const skipCalls = mockFetch.mock.calls.filter(call => call[0].includes('/api/tokens/skip'));
        expect(skipCalls.length).toBeGreaterThan(0);
      });
    });

    it('triggers requeueToken action for SKIPPED token', async () => {
      render(
        <AuthProvider>
          <TokenQueue />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Token System')).toBeInTheDocument();
      });

      const requeueButton = await screen.findByTitle('Re-queue');
      fireEvent.click(requeueButton);

      await waitFor(() => {
        const requeueCalls = mockFetch.mock.calls.filter(call => call[0].includes('/api/tokens/requeue'));
        expect(requeueCalls.length).toBeGreaterThan(0);
        expect(JSON.parse(requeueCalls[0][1].body)).toMatchObject({ tokenId: 'tok-4' });
      });
    });

    it('triggers cancelToken action for active token', async () => {
      render(
        <AuthProvider>
          <TokenQueue />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Token System')).toBeInTheDocument();
      });

      const cancelButtons = screen.getAllByTitle('Cancel');
      fireEvent.click(cancelButtons[0]);

      await waitFor(() => {
        const cancelCalls = mockFetch.mock.calls.filter(call => call[0].includes('/api/tokens/cancel'));
        expect(cancelCalls.length).toBeGreaterThan(0);
      });
    });
  });
});
