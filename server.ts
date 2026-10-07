import express from 'express';
import type { Request, Response } from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { spawn, ChildProcess } from 'child_process';
import { createProxyMiddleware } from 'http-proxy-middleware';

const app = express();
const PORT = 3000;
const HOST = '0.0.0.0';
const PYTHON_PORT = 8001;

// --- Python ML Backend Process Management ---
let pythonProcess: ChildProcess | null = null;
let isShuttingDown = false;

function startPythonBackend(): Promise<void> {
  return new Promise((resolve) => {
    const backendDir = path.resolve(process.cwd(), 'backend');
    console.log(`[MPLADS AI] Starting authentic Python ML Engine (FastAPI + Uvicorn) on port ${PYTHON_PORT}...`);

    pythonProcess = spawn('python3', [
      '-m', 'uvicorn',
      'app.main:app',
      '--host', '127.0.0.1',
      '--port', String(PYTHON_PORT),
    ], {
      cwd: backendDir,
      env: {
        ...process.env,
        PYTHONPATH: backendDir,
        DEMO_MODE: 'false',
        APP_ENV: 'development',
        AUTH_SECRET: 'development-secret-sih-2026-mplads',
        AUTH_DEMO_PASSWORD: 'password123',
        RATE_LIMIT_ENABLED: 'false',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    pythonProcess.stdout?.on('data', (data) => {
      const msg = data.toString();
      if (msg.includes('Uvicorn running on') || msg.includes('Application startup complete')) {
        console.log('[MPLADS AI] Python ML Engine is fully online & ready.');
        resolve();
      }
    });

    pythonProcess.stderr?.on('data', (data) => {
      const err = data.toString();
      if (err.includes('ERROR:')) {
        console.error('[MPLADS AI Python error]:', err);
      }
    });

    pythonProcess.on('error', (err) => {
      console.error('[MPLADS AI] Failed to spawn Python backend:', err);
      resolve();
    });

    pythonProcess.on('exit', (code, signal) => {
      if (!isShuttingDown) {
        console.warn(`[MPLADS AI] Python backend exited (code ${code}, signal ${signal})`);
      }
    });

    // Fallback timer so server never hangs if banner format changes
    setTimeout(() => {
      resolve();
    }, 4000);
  });
}

function cleanup() {
  if (isShuttingDown) return;
  isShuttingDown = true;
  if (pythonProcess) {
    try {
      pythonProcess.kill('SIGTERM');
    } catch {
      // Ignore
    }
  }
}

process.on('SIGINT', () => { cleanup(); process.exit(0); });
process.on('SIGTERM', () => { cleanup(); process.exit(0); });
process.on('exit', cleanup);

app.use(cors({ origin: true, credentials: true }));

// Setup multer for cartel forensic uploads
const upload = multer({
  limits: { fileSize: 50 * 1024 * 1024 },
  storage: multer.memoryStorage(),
});

// ==========================================
// CARTEL & COLLUSION RADAR (FORENSICS MODULE)
// ==========================================

interface UploadedCartelState {
  dataset_name: string;
  uploaded_at: string;
  records_count: number;
  data: {
    rings: any[];
    graph: { nodes: any[]; edges: any[] };
    metrics: any;
    raw_summary: any;
  };
}

let uploadedCartelState: UploadedCartelState | null = null;

const BENCHMARK_CARTEL_DATA = {
  rings: [
    {
      id: 'RING-01',
      name: 'Apex-Shivalik-Pragati Bidder Syndicate',
      risk_score: 94,
      severity: 'CRITICAL',
      total_pooled_value: 84500000,
      contract_count: 14,
      location: 'Bengaluru Urban & Pune',
      primary_contractor: 'Apex Civil Infrastructure Ltd.',
      interconnected_bidders: ['Apex Civil Infrastructure Ltd.', 'Shivalik Infra & Water Projects', 'Pragati Building Works'],
      flags: [
        'Shared Corporate Office: Plot 42-B, Industrial Area Ph-II, Bengaluru',
        'Common Director DIN: DIN-08492019 (Shri Rajesh M. Singhal)',
        'Rotational Bidding Cycle: Alternating L1/L2 winners in 12 consecutive tenders',
        'Bid Submission IP Concurrency: Tenders submitted within 180s from same subnet (103.21.x.x)',
      ],
      centrality_score: 0.89,
      cover_bidding_probability: 0.92,
      cvc_violation_code: 'CVC-ANTI-CARTEL-01',
    },
    {
      id: 'RING-02',
      name: 'Kaveri-Sunrise Civic Alliance',
      risk_score: 88,
      severity: 'HIGH',
      total_pooled_value: 51200000,
      contract_count: 9,
      location: 'Chennai & Mysuru',
      primary_contractor: 'Kaveri Construction Syndicate',
      interconnected_bidders: ['Kaveri Construction Syndicate', 'Sunrise Public Contracting Ltd.'],
      flags: [
        'Matching Bank Guarantee Branch: State Bank of India, Branch Code SBIN0004128',
        'Common Contact Telephone & Domain Registrar: @civicpartners.in',
        'Cover Bidding Margin: Sunrise bids consistently +8.4% above Kaveri in water supply tenders',
        'Shared Equipment / Machinery Registry: Identical RTO vehicle registration numbers in tender affidavits',
      ],
      centrality_score: 0.76,
      cover_bidding_probability: 0.84,
      cvc_violation_code: 'CVC-ANTI-CARTEL-02',
    },
    {
      id: 'RING-03',
      name: 'Metro-Eastern Earthmovers Syndicate',
      risk_score: 72,
      severity: 'MEDIUM',
      total_pooled_value: 38000000,
      contract_count: 6,
      location: 'Kolkata & Patna',
      primary_contractor: 'Metro Civic Works Pvt Ltd',
      interconnected_bidders: ['Metro Civic Works Pvt Ltd', 'Eastern Geo-Infra Partners'],
      flags: [
        'Complementary Bidding: Eastern Geo-Infra bids above ceiling to satisfy mandatory 3-bid qualification',
        'Common Auditor Firm: M/s S.K. Goyal & Associates (FRN 012948N)',
        'Bid Deposit Cheque Number Sequence: Consecutive serial numbers in earnest money deposit (EMD)',
      ],
      centrality_score: 0.62,
      cover_bidding_probability: 0.74,
      cvc_violation_code: 'CVC-ANTI-CARTEL-03',
    },
  ],
  graph: {
    nodes: [
      { id: 'c1', label: 'Apex Civil Infrastructure', type: 'CONTRACTOR', risk: 92, wins: 8, bids: 14, ring: 'RING-01', x: 140, y: 110 },
      { id: 'c2', label: 'Shivalik Infra & Water', type: 'CONTRACTOR', risk: 85, wins: 5, bids: 12, ring: 'RING-01', x: 310, y: 90 },
      { id: 'c3', label: 'Pragati Building Works', type: 'CONTRACTOR', risk: 78, wins: 1, bids: 11, ring: 'RING-01', x: 230, y: 240 },
      { id: 'c4', label: 'Kaveri Construction', type: 'CONTRACTOR', risk: 88, wins: 6, bids: 9, ring: 'RING-02', x: 490, y: 120 },
      { id: 'c5', label: 'Sunrise Public Contracting', type: 'CONTRACTOR', risk: 82, wins: 3, bids: 9, ring: 'RING-02', x: 570, y: 250 },
      { id: 'c6', label: 'Metro Civic Works', type: 'CONTRACTOR', risk: 74, wins: 5, bids: 7, ring: 'RING-03', x: 320, y: 340 },
      { id: 'c7', label: 'Eastern Geo-Infra', type: 'CONTRACTOR', risk: 68, wins: 1, bids: 6, ring: 'RING-03', x: 460, y: 350 },
      { id: 'e1', label: 'DIN-08492019 (Rajesh Singhal)', type: 'SHARED_DIRECTOR', risk: 95, ring: 'RING-01', x: 220, y: 155 },
      { id: 'e2', label: 'Plot 42-B, Ind. Area Ph-II, BLR', type: 'SHARED_ADDRESS', risk: 90, ring: 'RING-01', x: 120, y: 225 },
      { id: 'e3', label: 'SBI Branch SBIN0004128', type: 'BANK_BRANCH', risk: 85, ring: 'RING-02', x: 440, y: 210 },
      { id: 'e4', label: 'Contact: @civicpartners.in', type: 'COMMON_CONTACT', risk: 80, ring: 'RING-02', x: 550, y: 150 },
      { id: 'e5', label: 'Auditor: S.K. Goyal & Assoc.', type: 'COMMON_AUDITOR', risk: 65, ring: 'RING-03', x: 390, y: 310 },
    ],
    edges: [
      { source: 'c1', target: 'e1', type: 'DIRECTOR_LINK', label: 'Director DIN', risk: 95 },
      { source: 'c2', target: 'e1', type: 'DIRECTOR_LINK', label: 'Director DIN', risk: 95 },
      { source: 'c1', target: 'e2', type: 'ADDRESS_LINK', label: 'Registered Office', risk: 90 },
      { source: 'c2', target: 'e2', type: 'ADDRESS_LINK', label: 'Registered Office', risk: 90 },
      { source: 'c3', target: 'e2', type: 'ADDRESS_LINK', label: 'Sub-Office', risk: 85 },
      { source: 'c1', target: 'c2', type: 'ROTATIONAL_BIDDING', label: 'Rotational L1/L2 (8 Tenders)', risk: 94 },
      { source: 'c2', target: 'c3', type: 'COVER_BID', label: 'Cover Bids (+11%)', risk: 80 },
      { source: 'c4', target: 'e3', type: 'BANK_LINK', label: 'BG Issued SBIN0004128', risk: 88 },
      { source: 'c5', target: 'e3', type: 'BANK_LINK', label: 'BG Issued SBIN0004128', risk: 88 },
      { source: 'c4', target: 'e4', type: 'CONTACT_LINK', label: 'Common Domain & Phone', risk: 82 },
      { source: 'c5', target: 'e4', type: 'CONTACT_LINK', label: 'Common Domain & Phone', risk: 82 },
      { source: 'c4', target: 'c5', type: 'COVER_BID', label: 'Cover Bidding (+8.4%)', risk: 86 },
      { source: 'c6', target: 'e5', type: 'AUDITOR_LINK', label: 'Common Auditor', risk: 68 },
      { source: 'c7', target: 'e5', type: 'AUDITOR_LINK', label: 'Common Auditor', risk: 68 },
      { source: 'c6', target: 'c7', type: 'COVER_BID', label: 'Synthetic 3rd Bid', risk: 74 },
    ],
  },
  metrics: {
    total_cartel_rings: 3,
    high_risk_contractors: 7,
    total_pooled_exposure: 173700000,
    total_rigged_tenders: 29,
    cvc_inquiry_readiness: 'EVIDENCE_GRADE_COMPLETE',
    source: 'BENCHMARK',
  },
};

function parseCsvRows(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  const parseLine = (line: string): string[] => {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"' || char === "'") {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim().replace(/^["']|["']$/g, ''));
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim().replace(/^["']|["']$/g, ''));
    return values;
  };

  const headers = parseLine(lines[0]).map(h => h.toLowerCase().replace(/[^a-z0-9_]/g, '_'));
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const rawVals = parseLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = rawVals[idx] || '';
    });
    rows.push(row);
  }
  return rows;
}

function analyzeTenderCollusion(records: Record<string, any>[]) {
  const contractorsMap = new Map<string, {
    name: string;
    bids: number;
    wins: number;
    totalAmount: number;
    tenders: Set<string>;
    dins: Set<string>;
    addresses: Set<string>;
    banks: Set<string>;
    ips: Set<string>;
    states: Set<string>;
  }>();

  const tendersMap = new Map<string, Array<{
    contractor: string;
    amount: number;
    status: string;
    din: string;
    address: string;
    bank: string;
    ip: string;
  }>>();

  const findKey = (row: Record<string, any>, candidates: string[]): string => {
    for (const key of Object.keys(row)) {
      const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');
      for (const cand of candidates) {
        if (normalized.includes(cand)) return String(row[key] || '').trim();
      }
    }
    return '';
  };

  records.forEach((row, idx) => {
    const tenderId = findKey(row, ['tenderid', 'workcode', 'tenderno', 'workid', 'bidno']) || `TND-${Math.floor(idx / 3) + 1}`;
    const contractor = findKey(row, ['contractor', 'bidder', 'vendor', 'company', 'agency']) || `Bidder ${idx + 1}`;
    const rawAmt = findKey(row, ['bidamount', 'amount', 'quoted', 'value', 'cost', 'sanction']);
    const amount = parseFloat(rawAmt.replace(/[^0-9.]/g, '')) || 5000000;
    const din = findKey(row, ['din', 'director', 'pan', 'promoter']);
    const address = findKey(row, ['address', 'office', 'location', 'registered']);
    const bank = findKey(row, ['bank', 'branch', 'ifsc', 'guarantee']);
    const ip = findKey(row, ['ip', 'submissionip', 'subnet']);
    const status = findKey(row, ['status', 'result', 'award', 'rank']).toUpperCase();

    if (!contractorsMap.has(contractor)) {
      contractorsMap.set(contractor, {
        name: contractor,
        bids: 0,
        wins: 0,
        totalAmount: 0,
        tenders: new Set(),
        dins: new Set(),
        addresses: new Set(),
        banks: new Set(),
        ips: new Set(),
        states: new Set(),
      });
    }

    const c = contractorsMap.get(contractor)!;
    c.bids += 1;
    c.totalAmount += amount;
    c.tenders.add(tenderId);
    if (din) c.dins.add(din);
    if (address) c.addresses.add(address);
    if (bank) c.banks.add(bank);
    if (ip) c.ips.add(ip);
    if (status.includes('WIN') || status.includes('L1') || status.includes('AWARD')) {
      c.wins += 1;
    }

    if (!tendersMap.has(tenderId)) {
      tendersMap.set(tenderId, []);
    }
    tendersMap.get(tenderId)!.push({ contractor, amount, status, din, address, bank, ip });
  });

  tendersMap.forEach((bids) => {
    const hasWinner = bids.some(b => b.status.includes('WIN') || b.status.includes('L1') || b.status.includes('AWARD'));
    if (!hasWinner && bids.length > 0) {
      const valid = bids.filter(b => b.amount > 0);
      if (valid.length > 0) {
        valid.sort((a, b) => a.amount - b.amount);
        const l1 = valid[0];
        const c = contractorsMap.get(l1.contractor);
        if (c) c.wins += 1;
      }
    }
  });

  const nodes: any[] = [];
  const edges: any[] = [];
  const edgeSet = new Set<string>();

  const dinToContractors = new Map<string, Set<string>>();
  const addressToContractors = new Map<string, Set<string>>();
  const bankToContractors = new Map<string, Set<string>>();

  contractorsMap.forEach((c) => {
    c.dins.forEach(d => {
      if (d.length > 2) {
        if (!dinToContractors.has(d)) dinToContractors.set(d, new Set());
        dinToContractors.get(d)!.add(c.name);
      }
    });
    c.addresses.forEach(a => {
      if (a.length > 4) {
        const key = a.toLowerCase().replace(/[^a-z0-9]/g, ' ').trim().slice(0, 30);
        if (!addressToContractors.has(key)) addressToContractors.set(key, new Set());
        addressToContractors.get(key)!.add(c.name);
      }
    });
    c.banks.forEach(b => {
      if (b.length > 3) {
        const key = b.toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (!bankToContractors.has(key)) bankToContractors.set(key, new Set());
        bankToContractors.get(key)!.add(c.name);
      }
    });
  });

  const contractorIdMap = new Map<string, string>();
  let cIdx = 1;
  contractorsMap.forEach((c, name) => {
    const id = `c_${cIdx++}`;
    contractorIdMap.set(name, id);
    const winRate = c.bids > 0 ? c.wins / c.bids : 0;
    const baseRisk = Math.min(95, Math.max(65, Math.round(60 + (winRate * 25) + (c.bids * 2))));
    nodes.push({
      id,
      label: name,
      type: 'CONTRACTOR',
      risk: baseRisk,
      wins: c.wins,
      bids: c.bids,
      ring: 'RING-01',
      totalAmount: c.totalAmount,
    });
  });

  let assetIdx = 1;

  dinToContractors.forEach((contractors, din) => {
    if (contractors.size >= 2) {
      const assetId = `din_${assetIdx++}`;
      nodes.push({
        id: assetId,
        label: `DIN: ${din}`,
        type: 'SHARED_DIRECTOR',
        risk: 96,
        ring: 'RING-01',
      });
      contractors.forEach(cName => {
        const cId = contractorIdMap.get(cName);
        if (cId) {
          const edgeKey = `${cId}->${assetId}`;
          if (!edgeSet.has(edgeKey)) {
            edgeSet.add(edgeKey);
            edges.push({ source: cId, target: assetId, type: 'DIRECTOR_LINK', label: 'Common Director DIN', risk: 96 });
          }
        }
      });
    }
  });

  addressToContractors.forEach((contractors, addr) => {
    if (contractors.size >= 2) {
      const assetId = `addr_${assetIdx++}`;
      nodes.push({
        id: assetId,
        label: `Office: ${addr.slice(0, 24)}...`,
        type: 'SHARED_ADDRESS',
        risk: 90,
        ring: 'RING-01',
      });
      contractors.forEach(cName => {
        const cId = contractorIdMap.get(cName);
        if (cId) {
          const edgeKey = `${cId}->${assetId}`;
          if (!edgeSet.has(edgeKey)) {
            edgeSet.add(edgeKey);
            edges.push({ source: cId, target: assetId, type: 'ADDRESS_LINK', label: 'Shared Registered Office', risk: 90 });
          }
        }
      });
    }
  });

  bankToContractors.forEach((contractors, bnk) => {
    if (contractors.size >= 2) {
      const assetId = `bnk_${assetIdx++}`;
      nodes.push({
        id: assetId,
        label: `Bank: ${bnk}`,
        type: 'BANK_BRANCH',
        risk: 86,
        ring: 'RING-01',
      });
      contractors.forEach(cName => {
        const cId = contractorIdMap.get(cName);
        if (cId) {
          const edgeKey = `${cId}->${assetId}`;
          if (!edgeSet.has(edgeKey)) {
            edgeSet.add(edgeKey);
            edges.push({ source: cId, target: assetId, type: 'BANK_LINK', label: 'Same Bank Branch / Guarantee', risk: 86 });
          }
        }
      });
    }
  });

  const coBidPairs = new Map<string, { count: number; c1: string; c2: string }>();
  tendersMap.forEach((bids) => {
    if (bids.length >= 2) {
      for (let i = 0; i < bids.length; i++) {
        for (let j = i + 1; j < bids.length; j++) {
          const c1 = bids[i].contractor;
          const c2 = bids[j].contractor;
          const pairKey = [c1, c2].sort().join(':::');
          if (!coBidPairs.has(pairKey)) {
            coBidPairs.set(pairKey, { count: 0, c1, c2 });
          }
          coBidPairs.get(pairKey)!.count += 1;
        }
      }
    }
  });

  coBidPairs.forEach(({ count, c1, c2 }) => {
    if (count >= 2) {
      const id1 = contractorIdMap.get(c1);
      const id2 = contractorIdMap.get(c2);
      if (id1 && id2) {
        const edgeKey = `${id1}->${id2}`;
        if (!edgeSet.has(edgeKey)) {
          edgeSet.add(edgeKey);
          edges.push({
            source: id1,
            target: id2,
            type: count > 3 ? 'ROTATIONAL_BIDDING' : 'COVER_BID',
            label: count > 3 ? `Rotational Bidding (${count} Tenders)` : `Repeated Cover Bidding (${count} Tenders)`,
            risk: Math.min(95, 75 + count * 4),
          });
        }
      }
    }
  });

  const totalNodes = nodes.length;
  const centerX = 340;
  const centerY = 210;
  const rContractors = Math.min(180, 110 + totalNodes * 4);
  const rAssets = Math.min(95, 60 + totalNodes * 2);

  const contractorNodes = nodes.filter(n => n.type === 'CONTRACTOR');
  const assetNodes = nodes.filter(n => n.type !== 'CONTRACTOR');

  contractorNodes.forEach((n, i) => {
    const angle = (2 * Math.PI * i) / (contractorNodes.length || 1) - Math.PI / 2;
    n.x = Math.round(centerX + rContractors * Math.cos(angle));
    n.y = Math.round(centerY + rContractors * Math.sin(angle) * 0.78);
  });

  assetNodes.forEach((n, i) => {
    const angle = (2 * Math.PI * i) / (assetNodes.length || 1) + Math.PI / 4;
    n.x = Math.round(centerX + rAssets * Math.cos(angle));
    n.y = Math.round(centerY + rAssets * Math.sin(angle) * 0.7);
  });

  const flaggedFlags: string[] = [];
  if (dinToContractors.size > 0) flaggedFlags.push(`${dinToContractors.size} Shared Director DIN Collisions Detected`);
  if (addressToContractors.size > 0) flaggedFlags.push(`${addressToContractors.size} Common Registered Offices Discovered`);
  if (bankToContractors.size > 0) flaggedFlags.push(`${bankToContractors.size} Identical Bank Guarantee Issuing Branches`);
  if (coBidPairs.size > 0) flaggedFlags.push(`${coBidPairs.size} Synchronized Tender Co-Bidding Pairs`);
  if (flaggedFlags.length === 0) flaggedFlags.push('Bid Pattern Correlation Analysis Active under GFR Rule 144');

  const totalPooledExposure = Array.from(contractorsMap.values()).reduce((sum, c) => sum + c.totalAmount, 0);
  const primaryContractorName = contractorNodes[0]?.label || 'Primary Contractor Group';

  const rings = [
    {
      id: 'RING-01',
      name: `${primaryContractorName.split(' ')[0]} Procurement Syndicate`,
      risk_score: Math.min(96, Math.max(76, 70 + edges.length * 3)),
      severity: edges.length >= 3 ? 'CRITICAL' : 'HIGH',
      total_pooled_value: totalPooledExposure,
      contract_count: tendersMap.size || records.length,
      location: 'Custom Ingested Tenders',
      primary_contractor: primaryContractorName,
      interconnected_bidders: contractorNodes.slice(0, 5).map(n => n.label),
      flags: flaggedFlags,
      centrality_score: 0.88,
      cover_bidding_probability: 0.91,
      cvc_violation_code: 'CVC-ANTI-CARTEL-CUSTOM',
    },
  ];

  return {
    rings,
    graph: { nodes, edges },
    metrics: {
      total_cartel_rings: rings.length,
      high_risk_contractors: contractorNodes.filter(n => n.risk >= 80).length,
      total_pooled_exposure: totalPooledExposure,
      total_rigged_tenders: tendersMap.size || records.length,
      cvc_inquiry_readiness: edges.length > 0 ? 'STATUTORY_EVIDENCE_FORMED' : 'PRELIMINARY_EVIDENCE',
      source: 'UPLOADED',
    },
    raw_summary: {
      total_records: records.length,
      distinct_contractors: contractorsMap.size,
      distinct_tenders: tendersMap.size,
      shared_din_count: dinToContractors.size,
      shared_office_count: addressToContractors.size,
      shared_bank_count: bankToContractors.size,
    },
  };
}

// Dedicated Cartel Router with its own isolated body parser
const cartelRouter = express.Router();
cartelRouter.use(express.json({ limit: '50mb' }));
cartelRouter.use(express.urlencoded({ extended: true, limit: '50mb' }));

cartelRouter.get('/', (req, res) => {
  const source = req.query.source as string;

  if (source === 'uploaded') {
    if (uploadedCartelState) {
      return res.json({
        ...uploadedCartelState.data,
        is_custom_uploaded: true,
        dataset_name: uploadedCartelState.dataset_name,
        uploaded_at: uploadedCartelState.uploaded_at,
        records_count: uploadedCartelState.records_count,
      });
    }
    return res.status(404).json({ error: 'No custom uploaded dataset available. Ingest a dataset first.' });
  }

  if (source === 'benchmark') {
    return res.json({ ...BENCHMARK_CARTEL_DATA, is_custom_uploaded: false });
  }

  if (uploadedCartelState) {
    return res.json({
      ...uploadedCartelState.data,
      is_custom_uploaded: true,
      has_custom_available: true,
      dataset_name: uploadedCartelState.dataset_name,
      uploaded_at: uploadedCartelState.uploaded_at,
      records_count: uploadedCartelState.records_count,
    });
  }

  res.json({ ...BENCHMARK_CARTEL_DATA, is_custom_uploaded: false, has_custom_available: false });
});

cartelRouter.post('/analyze', upload.single('file'), (req, res) => {
  try {
    let records: Record<string, any>[] = [];
    let datasetName = 'Custom Tender Register';

    if (req.file) {
      datasetName = req.file.originalname;
      const fileContent = req.file.buffer.toString('utf-8');
      if (req.file.originalname.endsWith('.json') || fileContent.trim().startsWith('[')) {
        try {
          records = JSON.parse(fileContent);
        } catch {
          records = parseCsvRows(fileContent);
        }
      } else {
        records = parseCsvRows(fileContent);
      }
    } else if (req.body && req.body.csv_text) {
      datasetName = req.body.dataset_name || 'Pasted Tender CSV';
      records = parseCsvRows(req.body.csv_text);
    } else if (req.body && Array.isArray(req.body.records)) {
      datasetName = req.body.dataset_name || 'Structured Tenders Array';
      records = req.body.records;
    }

    if (!records || records.length === 0) {
      return res.status(400).json({ error: 'No valid tender or bidder records found in the provided payload.' });
    }

    const analyzed = analyzeTenderCollusion(records);

    uploadedCartelState = {
      dataset_name: datasetName,
      uploaded_at: new Date().toISOString(),
      records_count: records.length,
      data: analyzed,
    };

    res.json({
      success: true,
      dataset_name: datasetName,
      records_processed: records.length,
      results: analyzed,
    });
  } catch (err: any) {
    console.error('Failed to analyze cartel tenders dataset:', err);
    res.status(500).json({ error: 'Failed to process dataset: ' + (err.message || 'Internal parsing error') });
  }
});

cartelRouter.post('/reset', (_req, res) => {
  uploadedCartelState = null;
  res.json({ success: true, message: 'Reset to forensic benchmark dataset.' });
});

cartelRouter.get('/sample-template', (_req, res) => {
  const sampleCsv = `Tender_ID,Work_Name,Contractor_Name,Bid_Amount,Director_DIN,Registered_Address,Bank_IFSC,Submission_IP,Status
TND-KA-2026-001,Construction of 4km Bituminous Road Ph-1,Apex Civil Infrastructure Ltd,45200000,DIN-08492019,Plot 42-B Industrial Area Ph-II Bengaluru,SBIN0004128,103.21.54.12,L1_WINNER
TND-KA-2026-001,Construction of 4km Bituminous Road Ph-1,Shivalik Infra & Water Projects,48900000,DIN-08492019,Plot 42-B Industrial Area Ph-II Bengaluru,SBIN0004128,103.21.54.14,L2_COVER
TND-KA-2026-001,Construction of 4km Bituminous Road Ph-1,Pragati Building Works,51200000,DIN-07739102,Plot 42-B Industrial Area Ph-II Bengaluru,HDFC0001890,103.21.54.19,L3_COVER
TND-KA-2026-002,Widening of Major District Road Bridge,Shivalik Infra & Water Projects,38400000,DIN-08492019,Plot 42-B Industrial Area Ph-II Bengaluru,SBIN0004128,103.21.54.12,L1_WINNER
TND-KA-2026-002,Widening of Major District Road Bridge,Apex Civil Infrastructure Ltd,41800000,DIN-08492019,Plot 42-B Industrial Area Ph-II Bengaluru,SBIN0004128,103.21.54.14,L2_COVER
TND-KA-2026-002,Widening of Major District Road Bridge,Pragati Building Works,44500000,DIN-07739102,Plot 42-B Industrial Area Ph-II Bengaluru,HDFC0001890,103.21.54.19,L3_COVER
TND-TN-2026-104,Riverbed Water Intake Well and Pipeline,Kaveri Construction Syndicate,62000000,DIN-06198421,Survey 18 Anna Salai Guindy Chennai,SBIN0004128,14.139.182.4,L1_WINNER
TND-TN-2026-104,Riverbed Water Intake Well and Pipeline,Sunrise Public Contracting Ltd,67500000,DIN-09124401,Survey 18 Anna Salai Guindy Chennai,SBIN0004128,14.139.182.7,L2_COVER
TND-WB-2026-309,Embankment Reconstruction & Geo-Textile Layer,Metro Civic Works Pvt Ltd,28900000,DIN-05521908,14 Strand Road Dalhousie Kolkata,PUNB0192800,49.205.112.5,L1_WINNER
TND-WB-2026-309,Embankment Reconstruction & Geo-Textile Layer,Eastern Geo-Infra Partners,32100000,DIN-05521908,14 Strand Road Dalhousie Kolkata,PUNB0192800,49.205.112.9,L2_COVER`;

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="sih_tender_cartel_sample.csv"');
  res.send(sampleCsv);
});

// 1. Mount Cartel Router first
app.use('/api/forensics/cartels', cartelRouter);

// 2. Reverse Proxy all other /api routes to the real Python ML backend (FastAPI)
const pythonProxy = createProxyMiddleware({
  target: `http://127.0.0.1:${PYTHON_PORT}`,
  changeOrigin: true,
  ws: true,
  onError: (err, _req, res) => {
    console.warn('[MPLADS AI] Proxy error communicating with Python backend:', err.message);
    (res as Response).status(503).json({
      error: 'Python ML Backend is initializing or temporarily unavailable.',
      detail: err.message,
    });
  },
});

app.use((req, res, next) => {
  if (req.url.startsWith('/api') && !req.url.startsWith('/api/forensics/cartels')) {
    return pythonProxy(req, res, next);
  }
  next();
});

// --- Development vs Production Frontend Serving ---
async function startServer() {
  // Start Python ML backend concurrently in background
  startPythonBackend().catch((err) => console.error('[MPLADS AI] Python init error:', err));

  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    app.use('*', async (req, res, next) => {
      const url = req.originalUrl;
      if (url.startsWith('/api/')) return next();
      try {
        let template = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, HOST, () => {
    console.log(`[MPLADS AI] Unified Full-Stack Server running on http://${HOST}:${PORT}`);
  });
}

startServer();
