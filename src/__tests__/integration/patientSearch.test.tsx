import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import PatientsList from '../../pages/PatientsList';
import { AppProvider } from '../../contexts/AppContext';
import { mockPatients } from '../../test/mocks/mockFixtures';
import { db } from '../../lib/db';

// Mock the db module
vi.mock('../../lib/db', () => {
  return {
    db: {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockImplementation(() => Promise.resolve({ data: mockPatients, error: null })),
    },
    fullDataSync: vi.fn().mockResolvedValue({ success: true, message: 'Synced' }),
  };
});

function renderPatientsList() {
  return render(
    <BrowserRouter>
      <AppProvider>
        <PatientsList />
      </AppProvider>
    </BrowserRouter>
  );
}

describe('Integration: Patient Search & Filter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (db.from as any).mockReturnThis();
    (db.select as any).mockReturnThis();
    (db.order as any).mockResolvedValue({ data: mockPatients, error: null });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders initial list of patients including regular and TEMP- cards', async () => {
    renderPatientsList();

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
      expect(screen.getByText('Unknown Temporary Patient')).toBeInTheDocument();
    });

    // Check card number badges
    expect(screen.getByText('#1001')).toBeInTheDocument();
    expect(screen.getByText('#1002')).toBeInTheDocument();
    expect(screen.getByText('#1003')).toBeInTheDocument();
  });

  it('displays "No ID" badge for TEMP- card numbers', async () => {
    renderPatientsList();

    await waitFor(() => {
      expect(screen.getByText('Unknown Temporary Patient')).toBeInTheDocument();
    });

    // TEMP-9999 should render 'No ID' badge
    expect(screen.getByText('No ID')).toBeInTheDocument();
  });

  it('filters patients by name after 200ms debounce', async () => {
    vi.useFakeTimers();
    renderPatientsList();

    // Fast-forward initial async fetch execution
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(screen.getByText('John Doe')).toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText(/Search patient by name or card number/i);
    
    // Type query "Jane"
    fireEvent.change(searchInput, { target: { value: 'Jane' } });

    // Before 200ms, debounced query hasn't updated
    expect(screen.getByText('John Doe')).toBeInTheDocument();

    // Fast-forward past the 200ms debounce threshold
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    // Now only Jane Smith should be visible
    expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();

    vi.useRealTimers();
  });

  it('filters patients by phone number', async () => {
    vi.useFakeTimers();
    renderPatientsList();

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    const searchInput = screen.getByPlaceholderText(/Search patient by name or card number/i);

    // Type query "91234" (Jane Smith's phone: 9123456789)
    fireEvent.change(searchInput, { target: { value: '91234' } });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();

    vi.useRealTimers();
  });

  it('filters patients by card_number', async () => {
    vi.useFakeTimers();
    renderPatientsList();

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    const searchInput = screen.getByPlaceholderText(/Search patient by name or card number/i);

    // Type query "1003" (Alice Johnson's card_number)
    fireEvent.change(searchInput, { target: { value: '1003' } });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
    expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
    expect(screen.getByText('#1003')).toBeInTheDocument();

    vi.useRealTimers();
  });

  it('displays empty search result UI when no patients match the search query', async () => {
    vi.useFakeTimers();
    renderPatientsList();

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    const searchInput = screen.getByPlaceholderText(/Search patient by name or card number/i);

    // Type query with no match
    fireEvent.change(searchInput, { target: { value: 'NonExistentPatient123' } });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    expect(screen.getByText('No results found')).toBeInTheDocument();
    expect(screen.getByText('No results for "NonExistentPatient123"')).toBeInTheDocument();
    expect(screen.queryByText('John Doe')).not.toBeInTheDocument();

    vi.useRealTimers();
  });
});
