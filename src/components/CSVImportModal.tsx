'use client';

import { useState, useRef } from 'react';
import { supabase, Batch, requireUserId } from '@/lib/supabase';

interface CSVImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  batches: Batch[];
  feePct: number;
}

interface ParsedRow {
  [key: string]: string;
}

interface MappedRow {
  plant_name: string;
  buyer_name: string;
  sale_price: number;
  date: string;
  cost_per_plant: number;
  batch_id: string | null;
  hasCost: boolean;
}

const MAPPING_KEY = 'jli_csv_column_mapping';

export default function CSVImportModal({ isOpen, onClose, onComplete, batches, feePct }: CSVImportModalProps) {
  const [step, setStep] = useState(1);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({
    plant_name: '', buyer_name: '', sale_price: '', date: ''
  });
  const [mappedRows, setMappedRows] = useState<MappedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setStep(1);
    setHeaders([]);
    setRows([]);
    setMappedRows([]);
    setImporting(false);
    setResult(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function parseCSV(text: string) {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return;

    // Parse headers
    const hdrs = parseCSVLine(lines[0]);
    setHeaders(hdrs);

    // Parse rows
    const parsed: ParsedRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const vals = parseCSVLine(lines[i]);
      const row: ParsedRow = {};
      hdrs.forEach((h, idx) => {
        row[h] = vals[idx] || '';
      });
      parsed.push(row);
    }
    setRows(parsed);

    // Load saved mapping
    try {
      const saved = localStorage.getItem(MAPPING_KEY);
      if (saved) {
        const savedMapping = JSON.parse(saved);
        // Only use saved mapping if the headers match
        const validMapping: Record<string, string> = { plant_name: '', buyer_name: '', sale_price: '', date: '' };
        Object.keys(validMapping).forEach(field => {
          if (savedMapping[field] && hdrs.includes(savedMapping[field])) {
            validMapping[field] = savedMapping[field];
          }
        });
        setMapping(validMapping);
      }
    } catch { /* ignore */ }

    setStep(2);
  }

  function parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') {
          current += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          current += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === ',') {
          result.push(current.trim());
          current = '';
        } else {
          current += ch;
        }
      }
    }
    result.push(current.trim());
    return result;
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      parseCSV(text);
    };
    reader.readAsText(file);
  }

  function handleMappingConfirm() {
    // Save mapping to localStorage
    localStorage.setItem(MAPPING_KEY, JSON.stringify(mapping));

    // Map rows
    const mapped: MappedRow[] = rows.map(row => {
      const salePrice = parseFloat(row[mapping.sale_price]?.replace(/[$,]/g, '') || '0') || 0;
      return {
        plant_name: row[mapping.plant_name] || '',
        buyer_name: row[mapping.buyer_name] || '',
        sale_price: salePrice,
        date: row[mapping.date] || new Date().toISOString().split('T')[0],
        cost_per_plant: 0,
        batch_id: null,
        hasCost: false,
      };
    }).filter(r => r.plant_name && r.buyer_name);

    setMappedRows(mapped);
    setStep(3);
  }

  function updateRowCost(index: number, cost: number, batchId: string | null) {
    setMappedRows(prev => {
      const next = [...prev];
      next[index] = { ...next[index], cost_per_plant: cost, batch_id: batchId, hasCost: cost > 0 };
      return next;
    });
  }

  function handleBatchLink(index: number, batchId: string) {
    const batch = batches.find(b => b.id === batchId);
    if (batch) {
      updateRowCost(index, batch.cost_per_plant, batchId);
    } else {
      updateRowCost(index, mappedRows[index].cost_per_plant, null);
    }
  }

  const allCostsAssigned = mappedRows.every(r => r.hasCost);

  const [importError, setImportError] = useState<string | null>(null);

  async function handleImport() {
    setImporting(true);
    setImportError(null);

    try {
      // Batch duplicate check: fetch all existing sales for the relevant date range
      const dates = [...new Set(mappedRows.map(r => r.date))];
      const { data: existingSales, error: fetchErr } = await supabase
        .from('sales')
        .select('plant_name, buyer_name, date')
        .in('date', dates);

      if (fetchErr) throw new Error(`Failed to check duplicates: ${fetchErr.message}`);

      // Build a set of existing keys for O(1) lookup
      const existingKeys = new Set(
        (existingSales || []).map(s => `${s.plant_name}|${s.buyer_name}|${s.date}`)
      );

      // Separate new rows from duplicates
      const newRows: typeof mappedRows = [];
      let skipped = 0;
      for (const row of mappedRows) {
        const key = `${row.plant_name}|${row.buyer_name}|${row.date}`;
        if (existingKeys.has(key)) {
          skipped++;
        } else {
          newRows.push(row);
        }
      }

      // Batch insert all new rows at once
      if (newRows.length > 0) {
        const insertRows = newRows.map(row => {
          const feeAmount = row.sale_price * (feePct / 100);
          const trueProfit = row.sale_price - row.cost_per_plant - feeAmount;
          const trueMargin = row.sale_price > 0 ? (trueProfit / row.sale_price) * 100 : 0;
          return {
            plant_name: row.plant_name,
            buyer_name: row.buyer_name,
            sale_price: row.sale_price,
            date: row.date,
            cost_per_plant: row.cost_per_plant,
            batch_id: row.batch_id,
            shipping_cost: 0,
            shipping_covered_by_us: false,
            palmstreet_fee_amount: parseFloat(feeAmount.toFixed(2)),
            true_profit: parseFloat(trueProfit.toFixed(2)),
            true_margin_pct: parseFloat(trueMargin.toFixed(2)),
            refunded: false,
            refund_amount: 0,
            notes: 'Imported from CSV',
            stream_id: null,
          };
        });

        const csvUid = await requireUserId();
        const insertRowsWithUid = insertRows.map(r => ({ ...r, user_id: csvUid }));
        const { error: insertErr } = await supabase.from('sales').insert(insertRowsWithUid);
        if (insertErr) throw new Error(`Import failed: ${insertErr.message}`);
      }

      setResult({ imported: newRows.length, skipped });
      setStep(5);
    } catch (err) {
      setImportError(String(err instanceof Error ? err.message : err));
    }
    setImporting(false);
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-deep-jungle border border-tropical-leaf/30 rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-tropical-leaf/20">
          <div>
            <h2 className="font-heading text-2xl text-hot-pink">Import Sales CSV</h2>
            <p className="text-flamingo-blush/60 text-sm font-body mt-1">
              Step {Math.min(step, 4)} of 4
            </p>
          </div>
          <button onClick={handleClose} className="text-flamingo-blush/50 hover:text-white text-2xl cursor-pointer">&times;</button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 px-6 py-3 border-b border-tropical-leaf/10">
          {['Upload', 'Map Columns', 'Assign Costs', 'Review & Import'].map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-heading ${
                step > i + 1 ? 'bg-tropical-leaf text-white' :
                step === i + 1 ? 'bg-hot-pink text-white' :
                'bg-dark-bg text-flamingo-blush/50'
              }`}>
                {step > i + 1 ? '✓' : i + 1}
              </div>
              <span className={`text-xs font-body hidden sm:inline ${step === i + 1 ? 'text-white' : 'text-flamingo-blush/50'}`}>
                {label}
              </span>
              {i < 3 && <div className="w-6 h-px bg-tropical-leaf/20" />}
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Step 1: Upload */}
          {step === 1 && (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🦩</div>
              <h3 className="font-heading text-xl text-white mb-2">Upload Sales CSV</h3>
              <p className="text-flamingo-blush/60 font-body text-sm mb-6">
                Export your sales data from your platform and upload the CSV file here.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-8 py-3 bg-hot-pink hover:bg-flamingo-blush text-white font-heading rounded-lg transition-colors cursor-pointer"
              >
                Choose CSV File
              </button>
            </div>
          )}

          {/* Step 2: Column Mapping */}
          {step === 2 && (
            <div>
              <h3 className="font-heading text-lg text-white mb-4">Map Columns</h3>
              <p className="text-flamingo-blush/60 font-body text-sm mb-4">
                Match your CSV columns to the app fields. This mapping will be saved for future imports.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {[
                  { key: 'plant_name', label: 'Item Name *' },
                  { key: 'buyer_name', label: 'Buyer Name *' },
                  { key: 'sale_price', label: 'Sale Price *' },
                  { key: 'date', label: 'Date *' },
                ].map(field => (
                  <div key={field.key}>
                    <label className="block text-sm text-flamingo-blush mb-1 font-body">{field.label}</label>
                    <select
                      value={mapping[field.key]}
                      onChange={e => setMapping(m => ({ ...m, [field.key]: e.target.value }))}
                      className="w-full px-3 py-2 bg-dark-bg border border-deep-jungle rounded-lg text-white focus:outline-none focus:border-hot-pink font-body text-sm"
                    >
                      <option value="">— Select column —</option>
                      {headers.map(h => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              {/* Preview table */}
              <div className="mb-4">
                <h4 className="text-sm text-flamingo-blush font-body mb-2">CSV Preview (first 5 rows)</h4>
                <div className="overflow-x-auto bg-dark-bg/50 rounded-lg">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-tropical-leaf/20">
                        {headers.map(h => (
                          <th key={h} className="px-3 py-2 text-left text-flamingo-blush font-body whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.slice(0, 5).map((row, i) => (
                        <tr key={i} className="border-b border-tropical-leaf/10">
                          {headers.map(h => (
                            <td key={h} className="px-3 py-2 text-white/70 font-body whitespace-nowrap">{row[h]}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <button
                onClick={handleMappingConfirm}
                disabled={!mapping.plant_name || !mapping.buyer_name || !mapping.sale_price || !mapping.date}
                className="px-6 py-2 bg-hot-pink hover:bg-flamingo-blush text-white font-heading rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
              >
                Continue to Cost Assignment
              </button>
            </div>
          )}

          {/* Step 3: Cost Assignment */}
          {step === 3 && (
            <div>
              <h3 className="font-heading text-lg text-white mb-2">Assign Costs</h3>
              <p className="text-flamingo-blush/60 font-body text-sm mb-4">
                Link each plant to a batch or manually enter its cost. All rows need a cost before importing.
              </p>

              <div className="overflow-x-auto bg-dark-bg/50 rounded-lg mb-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-tropical-leaf/20">
                      <th className="px-3 py-2 text-left text-flamingo-blush font-body">Item</th>
                      <th className="px-3 py-2 text-left text-flamingo-blush font-body">Buyer</th>
                      <th className="px-3 py-2 text-left text-flamingo-blush font-body">Sale $</th>
                      <th className="px-3 py-2 text-left text-flamingo-blush font-body">Link Batch</th>
                      <th className="px-3 py-2 text-left text-flamingo-blush font-body">Cost/Plant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mappedRows.map((row, i) => (
                      <tr key={i} className={`border-b border-tropical-leaf/10 ${!row.hasCost ? 'bg-yellow-500/5' : ''}`}>
                        <td className="px-3 py-2 text-white font-body">{row.plant_name}</td>
                        <td className="px-3 py-2 text-flamingo-blush/70 font-body">{row.buyer_name}</td>
                        <td className="px-3 py-2 text-white font-body">${row.sale_price.toFixed(2)}</td>
                        <td className="px-3 py-2">
                          <select
                            value={row.batch_id || ''}
                            onChange={e => handleBatchLink(i, e.target.value)}
                            className="w-full px-2 py-1 bg-dark-bg border border-deep-jungle rounded text-white text-xs font-body focus:outline-none focus:border-hot-pink"
                          >
                            <option value="">Manual</option>
                            {batches.map(b => (
                              <option key={b.id} value={b.id}>{b.name} (${b.cost_per_plant.toFixed(2)})</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={row.cost_per_plant || ''}
                            onChange={e => updateRowCost(i, parseFloat(e.target.value) || 0, row.batch_id)}
                            className="w-24 px-2 py-1 bg-dark-bg border border-deep-jungle rounded text-white text-xs font-body focus:outline-none focus:border-hot-pink"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {!allCostsAssigned && (
                <p className="text-yellow-400 text-xs font-body mb-3">
                  ⚠️ {mappedRows.filter(r => !r.hasCost).length} row(s) still need a cost assigned
                </p>
              )}

              <button
                onClick={() => setStep(4)}
                disabled={!allCostsAssigned}
                className="px-6 py-2 bg-hot-pink hover:bg-flamingo-blush text-white font-heading rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
              >
                Review Import
              </button>
            </div>
          )}

          {/* Step 4: Review & Confirm */}
          {step === 4 && (
            <div>
              <h3 className="font-heading text-lg text-white mb-2">Review & Confirm</h3>
              <p className="text-flamingo-blush/60 font-body text-sm mb-4">
                Verify the calculated profits below. Platform fee: {feePct}%. Click confirm to import all rows.
              </p>

              <div className="overflow-x-auto bg-dark-bg/50 rounded-lg mb-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-tropical-leaf/20">
                      <th className="px-3 py-2 text-left text-flamingo-blush font-body">Item</th>
                      <th className="px-3 py-2 text-left text-flamingo-blush font-body">Buyer</th>
                      <th className="px-3 py-2 text-left text-flamingo-blush font-body">Sale $</th>
                      <th className="px-3 py-2 text-left text-flamingo-blush font-body">Cost</th>
                      <th className="px-3 py-2 text-left text-flamingo-blush font-body">Fee ({feePct}%)</th>
                      <th className="px-3 py-2 text-left text-flamingo-blush font-body">True Profit</th>
                      <th className="px-3 py-2 text-left text-flamingo-blush font-body">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mappedRows.map((row, i) => {
                      const fee = row.sale_price * (feePct / 100);
                      const profit = row.sale_price - row.cost_per_plant - fee;
                      return (
                        <tr key={i} className="border-b border-tropical-leaf/10">
                          <td className="px-3 py-2 text-white font-body">{row.plant_name}</td>
                          <td className="px-3 py-2 text-flamingo-blush/70 font-body">{row.buyer_name}</td>
                          <td className="px-3 py-2 text-white font-body">${row.sale_price.toFixed(2)}</td>
                          <td className="px-3 py-2 text-flamingo-blush/70 font-body">${row.cost_per_plant.toFixed(2)}</td>
                          <td className="px-3 py-2 text-hot-pink font-body">-${fee.toFixed(2)}</td>
                          <td className={`px-3 py-2 font-heading ${profit >= 0 ? 'text-tropical-leaf' : 'text-red-400'}`}>
                            ${profit.toFixed(2)}
                          </td>
                          <td className="px-3 py-2 text-flamingo-blush/70 font-body">{row.date}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleImport}
                  disabled={importing}
                  className="px-6 py-2 bg-hot-pink hover:bg-flamingo-blush text-white font-heading rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {importing ? 'Importing...' : `Confirm Import (${mappedRows.length} rows)`}
                </button>
                <button
                  onClick={() => setStep(3)}
                  className="px-4 py-2 bg-warm-wood/30 hover:bg-warm-wood/50 text-white font-body rounded-lg text-sm cursor-pointer"
                >
                  Back
                </button>
              </div>

              {/* Import error */}
              {importError && (
                <div className="mt-4 bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                  <p className="text-red-400 font-body text-sm">⚠️ {importError}</p>
                </div>
              )}

              {/* Flamingo loading animation */}
              {importing && (
                <div className="mt-6 text-center">
                  <div className="text-5xl animate-bounce inline-block">🦩</div>
                  <p className="text-flamingo-blush font-body text-sm mt-2 animate-pulse">Loading the jungle...</p>
                </div>
              )}
            </div>
          )}

          {/* Step 5: Success */}
          {step === 5 && result && (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🎉</div>
              <h3 className="font-heading text-2xl text-tropical-leaf mb-4">Import Complete!</h3>
              <div className="bg-dark-bg/50 rounded-lg p-6 inline-block">
                <p className="text-white font-body text-lg mb-2">
                  <span className="text-tropical-leaf font-heading">{result.imported}</span> rows imported
                </p>
                <p className="text-flamingo-blush/70 font-body text-sm">
                  <span className="text-flamingo-blush">{result.skipped}</span> duplicates skipped
                </p>
              </div>
              <div className="mt-6">
                <button
                  onClick={() => { handleClose(); onComplete(); }}
                  className="px-6 py-2 bg-hot-pink hover:bg-flamingo-blush text-white font-heading rounded-lg transition-colors cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
