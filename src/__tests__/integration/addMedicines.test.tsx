import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Medicines from '../../pages/Medicines';
import { parseMedicines } from '../../lib/utils';
import { mockMedicines } from '../../test/mocks/mockFixtures';
import { db } from '../../lib/db';

// Mock DB implementation
vi.mock('../../lib/db', () => {
  const insertFn = vi.fn().mockImplementation(() => Promise.resolve({ error: null }));
  const upsertFn = vi.fn().mockImplementation(() => Promise.resolve({ error: null }));
  const inFn = vi.fn().mockImplementation(() => Promise.resolve({ data: mockMedicines, error: null }));
  const orderFn = vi.fn().mockImplementation(() => Promise.resolve({ data: mockMedicines, error: null }));
  
  const selectFn = vi.fn().mockImplementation(() => ({
    order: orderFn,
    in: inFn,
  }));

  const fromFn = vi.fn().mockImplementation(() => ({
    select: selectFn,
    insert: insertFn,
    upsert: upsertFn,
  }));

  return {
    db: {
      from: fromFn,
    },
  };
});

describe('Integration: Add Medicines & Prescription Master', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Single Medicine Form Addition', () => {
    it('opens add form, converts code to uppercase, and calls db.insert', async () => {
      render(<Medicines />);

      await waitFor(() => {
        expect(screen.getByText('Medicine Master')).toBeInTheDocument();
      });

      // Click "Add One" button
      const addOneBtn = screen.getByRole('button', { name: /Add One/i });
      fireEvent.click(addOneBtn);

      expect(screen.getByText('Register New Medicine')).toBeInTheDocument();

      const codeInput = screen.getByPlaceholderText(/e.g. A1, B12/i);
      const nameInput = screen.getByPlaceholderText(/e.g. Aconitum Napellus/i);

      // Enter lowercase code "m100" and medicine name
      fireEvent.change(codeInput, { target: { value: 'm100' } });
      fireEvent.change(nameInput, { target: { value: 'Test Medicine M100' } });

      const saveBtn = screen.getByRole('button', { name: /Save Medicine/i });
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(db.from).toHaveBeenCalledWith('medicines');
        // Get the mock returned by db.from('medicines')
        const medicinesTable = (db.from as any).mock.results[0].value;
        expect(medicinesTable.insert).toHaveBeenCalledWith([
          { code: 'M100', name: 'Test Medicine M100' },
        ]);
      });

      // Check success message
      await waitFor(() => {
        expect(screen.getByText('Medicine added successfully!')).toBeInTheDocument();
      });
    });

    it('shows error message if required fields are missing', async () => {
      render(<Medicines />);

      await waitFor(() => {
        expect(screen.getByText('Medicine Master')).toBeInTheDocument();
      });

      const addOneBtn = screen.getByRole('button', { name: /Add One/i });
      fireEvent.click(addOneBtn);

      const saveBtn = screen.getByRole('button', { name: /Save Medicine/i });
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(screen.getByText('Code and Name are required')).toBeInTheDocument();
      });
    });
  });

  describe('Bulk Import Multi-line Parsing (Comma, Tab, Space Delimited)', () => {
    it('parses comma, tab, and space delimited lines, uppercases codes, and calls db.upsert', async () => {
      render(<Medicines />);

      await waitFor(() => {
        expect(screen.getByText('Medicine Master')).toBeInTheDocument();
      });

      const bulkAddBtn = screen.getByRole('button', { name: /Bulk Add/i });
      fireEvent.click(bulkAddBtn);

      expect(screen.getByText('Bulk Import Medicines')).toBeInTheDocument();

      const textarea = screen.getByPlaceholderText(/A1, Aconitum Napellus/i);

      // Multiline text with comma, tab, and space delimiters
      const bulkInput = [
        'c1, Comma Medicine',
        't2\tTab Medicine',
        's3 Space Medicine Full Name',
      ].join('\n');

      fireEvent.change(textarea, { target: { value: bulkInput } });

      const importBtn = screen.getByRole('button', { name: /Start Bulk Import/i });
      fireEvent.click(importBtn);

      await waitFor(() => {
        expect(db.from).toHaveBeenCalledWith('medicines');
        const medicinesTable = (db.from as any).mock.results[0].value;
        expect(medicinesTable.upsert).toHaveBeenCalledWith(
          [
            { code: 'C1', name: 'Comma Medicine' },
            { code: 'T2', name: 'Tab Medicine' },
            { code: 'S3', name: 'Space Medicine Full Name' },
          ],
          { onConflict: 'code' }
        );
      });

      await waitFor(() => {
        expect(screen.getByText('Successfully imported 3 medicines!')).toBeInTheDocument();
      });
    });
  });

  describe('Prescription String Parsing (parseMedicines)', () => {
    it('splits prescription string on + and ,, normalizes codes to uppercase, and maps db lookup results', async () => {
      // Mock db.from('medicines').select('*').in('code', ...)
      const mockIn = vi.fn().mockImplementation(() =>
        Promise.resolve({
          data: [
            { code: 'A1', name: 'Aconitum Napellus' },
            { code: 'B12', name: 'Belladonna' },
          ],
          error: null,
        })
      );
      (db.from as any).mockReturnValue({
        select: vi.fn().mockReturnValue({
          in: mockIn,
        }),
      });

      // Prescription string with mixed delimiters (+ and ,) and mixed case
      const result = await parseMedicines('a1 + b12, c3');

      // Should query DB with uppercased codes ['A1', 'B12', 'C3']
      expect(mockIn).toHaveBeenCalledWith('code', ['A1', 'B12', 'C3']);

      // A1 and B12 found in DB, C3 not found (Unknown Medicine)
      expect(result).toEqual([
        { code: 'A1', name: 'Aconitum Napellus', found: true },
        { code: 'B12', name: 'Belladonna', found: true },
        { code: 'C3', name: 'Unknown Medicine', found: false },
      ]);
    });

    it('returns empty array when given empty or whitespace input', async () => {
      expect(await parseMedicines('')).toEqual([]);
      expect(await parseMedicines('   + ,  ')).toEqual([]);
    });
  });
});
