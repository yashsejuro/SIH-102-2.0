import React, { useEffect, useState, useMemo, useRef } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { API_BASE } from './auth';

interface CartelRing {
  id: string;
  name: string;
  risk_score: number;
  severity: string;
  total_pooled_value: number;
  contract_count: number;
  location: string;
  primary_contractor: string;
  interconnected_bidders: string[];
  flags: string[];
  centrality_score: number;
  cover_bidding_probability: number;
  cvc_violation_code: string;
}

interface GraphNode {
  id: string;
  label: string;
  type: 'CONTRACTOR' | 'SHARED_DIRECTOR' | 'SHARED_ADDRESS' | 'BANK_BRANCH' | 'COMMON_CONTACT' | 'COMMON_AUDITOR';
  risk: number;
  wins?: number;
  bids?: number;
  ring: string;
  x?: number;
  y?: number;
  totalAmount?: number;
}

interface GraphEdge {
  source: string;
  target: string;
  type: string;
  label: string;
  risk: number;
}

interface CartelApiResponse {
  rings: CartelRing[];
  graph: {
    nodes: GraphNode[];
    edges: GraphEdge[];
  };
  metrics: {
    total_cartel_rings: number;
    high_risk_contractors: number;
    total_pooled_exposure: number;
    total_rigged_tenders: number;
    cvc_inquiry_readiness: string;
    source?: string;
  };
  is_custom_uploaded?: boolean;
  has_custom_available?: boolean;
  dataset_name?: string;
  uploaded_at?: string;
  records_count?: number;
  raw_summary?: {
    total_records: number;
    distinct_contractors: number;
    distinct_tenders: number;
    shared_din_count: number;
    shared_office_count: number;
    shared_bank_count: number;
  };
}

export function CartelRadarPage() {
  const [data, setData] = useState<CartelApiResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeDataSource, setActiveDataSource] = useState<'BENCHMARK' | 'UPLOADED'>('BENCHMARK');

  // Selected entities for drill-down
  const [selectedRingId, setSelectedRingId] = useState<string>('ALL');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<GraphEdge | null>(null);

  // Ingestion Modal State
  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);
  const [uploadTab, setUploadTab] = useState<'FILE' | 'PASTE'>('FILE');
  const [dragOver, setDragOver] = useState<boolean>(false);
  const [uploadingFile, setUploadingFile] = useState<boolean>(false);
  const [pasteContent, setPasteContent] = useState<string>('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccessMsg, setUploadSuccessMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Case Registration Action State
  const [creatingCaseFor, setCreatingCaseFor] = useState<string | null>(null);
  const [createdCaseInfo, setCreatedCaseInfo] = useState<{ id: number; title: string } | null>(null);

  // Fetch Cartel Data based on chosen source
  const loadCartelData = async (sourcePreference?: 'BENCHMARK' | 'UPLOADED') => {
    setLoading(true);
    setError(null);
    try {
      const sourceQuery = sourcePreference === 'UPLOADED' ? '?source=uploaded' : sourcePreference === 'BENCHMARK' ? '?source=benchmark' : '';
      const res = await axios.get<CartelApiResponse>(`${API_BASE}/api/forensics/cartels${sourceQuery}`);
      setData(res.data);

      if (res.data.is_custom_uploaded) {
        setActiveDataSource('UPLOADED');
      } else {
        setActiveDataSource('BENCHMARK');
      }

      // Default select the first contractor node if available
      if (res.data.graph.nodes.length > 0) {
        const firstContractor = res.data.graph.nodes.find(n => n.type === 'CONTRACTOR') || res.data.graph.nodes[0];
        setSelectedNodeId(firstContractor.id);
      }
    } catch (err: any) {
      console.error('Error fetching cartel forensic data:', err);
      // If requested uploaded but none exists, fallback to benchmark
      if (sourcePreference === 'UPLOADED') {
        loadCartelData('BENCHMARK');
      } else {
        setError('Unable to load forensic cartel dataset. Ensure backend server is running.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCartelData();
  }, []);

  // Compute dynamic positions if missing or ensure clean layout
  const positionedNodes = useMemo(() => {
    if (!data) return [];
    const nodes = data.graph.nodes;
    const width = 760;
    const height = 440;
    const cx = width / 2;
    const cy = height / 2;

    const contractorNodes = nodes.filter(n => n.type === 'CONTRACTOR');
    const assetNodes = nodes.filter(n => n.type !== 'CONTRACTOR');

    return nodes.map((node) => {
      if (node.x && node.y && !data.is_custom_uploaded) {
        return node;
      }
      if (node.type === 'CONTRACTOR') {
        const idx = contractorNodes.findIndex(c => c.id === node.id);
        const total = contractorNodes.length || 1;
        const angle = (2 * Math.PI * idx) / total - Math.PI / 2;
        const radius = Math.min(180, 120 + total * 4);
        return {
          ...node,
          x: Math.round(cx + radius * Math.cos(angle)),
          y: Math.round(cy + radius * Math.sin(angle) * 0.8),
        };
      } else {
        const idx = assetNodes.findIndex(a => a.id === node.id);
        const total = assetNodes.length || 1;
        const angle = (2 * Math.PI * idx) / total + Math.PI / 4;
        const radius = Math.min(100, 50 + total * 6);
        return {
          ...node,
          x: Math.round(cx + radius * Math.cos(angle)),
          y: Math.round(cy + radius * Math.sin(angle) * 0.72),
        };
      }
    });
  }, [data]);

  const nodeMap = useMemo(() => {
    const map = new Map<string, GraphNode>();
    positionedNodes.forEach(n => map.set(n.id, n));
    return map;
  }, [positionedNodes]);

  const filteredNodes = useMemo(() => {
    if (selectedRingId === 'ALL') return positionedNodes;
    return positionedNodes.filter(n => n.ring === selectedRingId);
  }, [positionedNodes, selectedRingId]);

  const filteredEdges = useMemo(() => {
    if (!data) return [];
    const activeNodeIds = new Set(filteredNodes.map(n => n.id));
    return data.graph.edges.filter(e => activeNodeIds.has(e.source) && activeNodeIds.has(e.target));
  }, [data, filteredNodes]);

  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    return nodeMap.get(selectedNodeId) || null;
  }, [selectedNodeId, nodeMap]);

  const selectedRing = useMemo(() => {
    if (!data || selectedRingId === 'ALL') return null;
    return data.rings.find(r => r.id === selectedRingId) || null;
  }, [data, selectedRingId]);

  // Handle file ingestion
  const handleFileUpload = async (file: File) => {
    setUploadingFile(true);
    setUploadError(null);
    setUploadSuccessMsg(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await axios.post(`${API_BASE}/api/forensics/cartels/analyze`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUploadSuccessMsg(`Ingested "${file.name}" successfully! Processed ${res.data.records_processed} tender records.`);
      setShowUploadModal(false);
      await loadCartelData('UPLOADED');
    } catch (err: any) {
      console.error('Failed to analyze uploaded tender dataset:', err);
      setUploadError(err.response?.data?.error || 'Failed to parse file. Please verify CSV or JSON format.');
    } finally {
      setUploadingFile(false);
    }
  };

  const handlePasteSubmit = async () => {
    if (!pasteContent.trim()) {
      setUploadError('Please paste valid CSV rows before submitting.');
      return;
    }
    setUploadingFile(true);
    setUploadError(null);

    try {
      const res = await axios.post(`${API_BASE}/api/forensics/cartels/analyze`, {
        csv_text: pasteContent,
        dataset_name: 'Pasted Tender Bids',
      });
      setUploadSuccessMsg(`Analyzed pasted bids! Processed ${res.data.records_processed} records.`);
      setShowUploadModal(false);
      setPasteContent('');
      await loadCartelData('UPLOADED');
    } catch (err: any) {
      console.error('Failed to analyze pasted tender records:', err);
      setUploadError(err.response?.data?.error || 'Failed to parse CSV text.');
    } finally {
      setUploadingFile(false);
    }
  };

  const handleLoadSampleDataset = async () => {
    setUploadingFile(true);
    setUploadError(null);

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

    try {
      await axios.post(`${API_BASE}/api/forensics/cartels/analyze`, {
        csv_text: sampleCsv,
        dataset_name: 'PMGSY & PWD Tender Benchmark Register.csv',
      });
      setShowUploadModal(false);
      await loadCartelData('UPLOADED');
    } catch (err: any) {
      console.error('Failed to load sample dataset:', err);
      setUploadError('Failed to load sample dataset.');
    } finally {
      setUploadingFile(false);
    }
  };

  const handleResetToBenchmark = async () => {
    try {
      await axios.post(`${API_BASE}/api/forensics/cartels/reset`);
      await loadCartelData('BENCHMARK');
    } catch (err) {
      console.error('Failed to reset dataset:', err);
    }
  };

  const handleCreateCaseForRing = async (ring: CartelRing) => {
    setCreatingCaseFor(ring.id);
    try {
      const res = await axios.post(`${API_BASE}/api/audit-cases`, {
        project_id: 14,
        title: `Collusion & Syndicate Inquiry: ${ring.name}`,
        priority: 'CRITICAL',
        assigned_authority: 'Central Vigilance Officer / Competition Bureau',
        notes: `Cartel Radar identified ${ring.contract_count} rigged tenders totaling ₹${(ring.total_pooled_value / 10000000).toFixed(2)} Cr. Indicators: ${ring.flags.join('; ')}. Statutory grounds: GFR Rule 144 & Section 3(3) Competition Act 2002.`,
      });
      setCreatedCaseInfo({ id: res.data.id, title: res.data.title });
    } catch (err) {
      console.error('Failed to create audit case for cartel:', err);
    } finally {
      setCreatingCaseFor(null);
    }
  };

  const getNodeColor = (type: string, risk: number) => {
    if (type === 'CONTRACTOR') {
      return risk >= 90 ? '#b91c1c' : risk >= 80 ? '#c2410c' : '#b45309';
    }
    if (type === 'SHARED_DIRECTOR') return '#6b21a8';
    if (type === 'SHARED_ADDRESS') return '#0f766e';
    if (type === 'BANK_BRANCH') return '#1d4ed8';
    return '#334155';
  };

  const getNodeTypeName = (type: string) => {
    if (type === 'CONTRACTOR') return 'Contractor / Company Entity';
    if (type === 'SHARED_DIRECTOR') return 'Common Director DIN Identifier';
    if (type === 'SHARED_ADDRESS') return 'Common Registered Office Address';
    if (type === 'BANK_BRANCH') return 'Common Bank Guarantee / Branch IFSC';
    return 'Common Contact Point / Liaison';
  };

  if (loading && !data) {
    return (
      <div className="p-16 text-center bg-white border border-slate-200 rounded-xl shadow-sm my-6 max-w-5xl mx-auto">
        <div className="inline-block w-9 h-9 border-4 border-slate-300 border-t-teal-700 rounded-full animate-spin mb-4" />
        <h2 className="text-base font-bold text-slate-900">Scanning Forensic Bidder Network Graph...</h2>
        <p className="text-sm text-slate-600 mt-1 max-w-md mx-auto">
          Cross-referencing bidder DIN numbers, shared registered offices, bank guarantee branches, and rotational bid spreads.
        </p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-12 text-center bg-white border border-rose-200 rounded-xl shadow-sm my-6 max-w-2xl mx-auto">
        <div className="w-12 h-12 bg-rose-50 text-rose-700 rounded-full flex items-center justify-center font-bold text-xl mx-auto mb-3">!</div>
        <h2 className="text-base font-bold text-slate-900">Unable to Load Cartel Forensic Radar</h2>
        <p className="text-sm text-slate-600 mt-1 mb-5">{error || 'Forensic analysis service is currently unreachable.'}</p>
        <button
          onClick={() => loadCartelData('BENCHMARK')}
          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
        >
          Retry with Benchmark Cases
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      {/* Institutional Civic Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider bg-rose-100 text-rose-900 border border-rose-200">
                <span className="w-2 h-2 rounded-full bg-rose-600 mr-2 animate-pulse" />
                Vigilance Forensics Radar
              </span>
              <span className="text-xs font-medium text-slate-600">
                Statutory Framework: GFR Rule 144 &amp; Section 3(3) Competition Act 2002
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Contractor Cartel &amp; Collusion Radar
            </h1>

            <p className="text-sm text-slate-700 leading-relaxed">
              Automated detection of synchronized bidder syndicates and anti-competitive rotation. Identifies non-independent entities sharing company directors (DIN), registered workplace offices, or bank guarantee branches.
            </p>
          </div>

          {/* Metric Summary Cards */}
          <div className="grid grid-cols-3 gap-3 shrink-0">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 min-w-[125px]">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-600">Active Rings</div>
              <div className="text-2xl font-extrabold font-mono text-rose-700 mt-1">
                {data.metrics.total_cartel_rings}
              </div>
              <div className="text-xs text-slate-500 font-medium">Flagged Syndicates</div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 min-w-[125px]">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-600">Rigged Tenders</div>
              <div className="text-2xl font-extrabold font-mono text-amber-700 mt-1">
                {data.metrics.total_rigged_tenders}
              </div>
              <div className="text-xs text-slate-500 font-medium">Compromised Works</div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 min-w-[145px]">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-600">Public Exposure</div>
              <div className="text-2xl font-extrabold font-mono text-teal-800 mt-1">
                ₹{(data.metrics.total_pooled_exposure / 10000000).toFixed(2)} Cr
              </div>
              <div className="text-xs text-slate-500 font-medium">Pooled Contract Sum</div>
            </div>
          </div>
        </div>

        {/* Dataset Ingestion / Switcher Bar */}
        <div className="mt-6 pt-5 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 mr-1">Data Source:</span>
            <button
              onClick={() => loadCartelData('BENCHMARK')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeDataSource === 'BENCHMARK'
                  ? 'bg-slate-900 text-white shadow-sm ring-2 ring-slate-900/20'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-300'
              }`}
            >
              <span>🏛️ CVC / CCI Benchmark Cases</span>
              {activeDataSource === 'BENCHMARK' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
            </button>

            <button
              onClick={() => {
                if (data.is_custom_uploaded || data.has_custom_available) {
                  loadCartelData('UPLOADED');
                } else {
                  setShowUploadModal(true);
                }
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeDataSource === 'UPLOADED'
                  ? 'bg-teal-900 text-white shadow-sm ring-2 ring-teal-900/20'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-300'
              }`}
            >
              <span>📁 Ingested Custom Dataset</span>
              {activeDataSource === 'UPLOADED' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {activeDataSource === 'UPLOADED' && (
              <button
                onClick={handleResetToBenchmark}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
              >
                Reset to Benchmark
              </button>
            )}

            <button
              onClick={() => setShowUploadModal(true)}
              className="px-3.5 py-1.5 bg-teal-800 hover:bg-teal-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-all flex items-center gap-1.5"
            >
              <span>+ Ingest Tender Dataset</span>
            </button>

            <a
              href={`${API_BASE}/api/forensics/cartels/sample-template`}
              download="sih_tender_cartel_sample.csv"
              className="px-3 py-1.5 bg-white text-slate-700 hover:bg-slate-100 text-xs font-medium rounded-lg border border-slate-300 transition-colors flex items-center gap-1"
            >
              <span>⬇ Sample CSV</span>
            </a>
          </div>
        </div>

        {/* Active Custom Dataset Notification Banner */}
        {activeDataSource === 'UPLOADED' && (
          <div className="mt-4 p-3.5 rounded-lg bg-teal-50 border border-teal-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-teal-950">
            <div className="flex items-center gap-2.5">
              <span className="w-5 h-5 rounded-full bg-teal-800 text-white flex items-center justify-center font-bold text-xs shrink-0">
                ✓
              </span>
              <div>
                <strong>Active Ingested Dataset:</strong> {data.dataset_name || 'Custom Tenders'} ({data.records_count || data.raw_summary?.total_records || '10+'} tender bids analyzed dynamically).
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] bg-teal-100 text-teal-900 px-2 py-0.5 rounded font-semibold border border-teal-300">
                Dynamic Graph Mode
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Case Created Success Banner */}
      {createdCaseInfo && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-emerald-950 shadow-sm animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <span className="w-6 h-6 rounded-full bg-emerald-700 text-white flex items-center justify-center font-bold text-xs shrink-0">
              ✓
            </span>
            <div>
              <span className="font-bold text-emerald-900">Official Vigilance Inquiry Registered:</span> Case{' '}
              <strong className="font-mono">#{String(createdCaseInfo.id).padStart(4, '0')}</strong> has been opened for{' '}
              <strong>{createdCaseInfo.title}</strong> under Rule 144.
            </div>
          </div>
          <Link
            to="/cases"
            className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-emerald-800 hover:bg-emerald-700 text-white font-semibold transition-colors shrink-0 shadow-sm"
          >
            Open in Vigilance Cases →
          </Link>
        </div>
      )}

      {/* Syndicate Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-200">
        <button
          onClick={() => { setSelectedRingId('ALL'); setSelectedEdge(null); }}
          className={`px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
            selectedRingId === 'ALL'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-300'
          }`}
        >
          All Detected Syndicates ({data.rings.length})
        </button>
        {data.rings.map((r) => (
          <button
            key={r.id}
            onClick={() => { setSelectedRingId(r.id); setSelectedEdge(null); }}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 whitespace-nowrap transition-all ${
              selectedRingId === r.id
                ? 'bg-slate-900 text-white shadow-sm ring-2 ring-slate-900/20'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-300'
            }`}
          >
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: r.risk_score >= 90 ? '#b91c1c' : r.risk_score >= 80 ? '#c2410c' : '#b45309' }}
            />
            <span>{r.name.length > 28 ? `${r.name.slice(0, 26)}...` : r.name}</span>
            <span
              className={`text-[11px] font-mono px-1.5 py-0.2 rounded font-bold ${
                selectedRingId === r.id ? 'bg-slate-800 text-teal-300' : 'bg-slate-100 text-slate-700'
              }`}
            >
              {r.risk_score}%
            </span>
          </button>
        ))}
      </div>

      {/* Forensic Visual Graph & Evidence Inspector Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Interactive SVG Network Canvas */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3.5 border-b border-slate-100 gap-3 mb-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>Interactive Collusion &amp; Entity Relationship Map</span>
                <span className="text-xs font-normal text-slate-500">({filteredNodes.length} nodes · {filteredEdges.length} correlation links)</span>
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Click any contractor or shared identifier node to inspect statutory evidence records.
              </p>
            </div>

            {/* High-Contrast Legend */}
            <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-700">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-rose-700" /> Contractor
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-purple-700" /> Director DIN
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-teal-700" /> Same Office
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-blue-700" /> Bank Branch
              </span>
            </div>
          </div>

          {/* SVG Map Canvas with Clean High-Contrast Palette */}
          <div className="relative w-full h-[450px] bg-slate-50/70 rounded-lg border border-slate-200 overflow-hidden flex items-center justify-center">
            {/* Background grid pattern */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="radar-grid" width="32" height="32" patternUnits="userSpaceOnUse">
                  <path d="M 32 0 L 0 0 0 32" fill="none" stroke="#e2e8f0" strokeWidth="1" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#radar-grid)" />
            </svg>

            <svg viewBox="0 0 760 440" className="w-full h-full select-none relative z-10">
              {/* Connecting Edges */}
              {filteredEdges.map((edge, i) => {
                const s = nodeMap.get(edge.source);
                const t = nodeMap.get(edge.target);
                if (!s || !t || s.x === undefined || s.y === undefined || t.x === undefined || t.y === undefined) return null;
                const isSelected = selectedEdge === edge;
                const strokeColor = edge.type.includes('ROTATIONAL') || edge.type.includes('COVER')
                  ? '#dc2626'
                  : edge.type.includes('DIRECTOR')
                  ? '#7e22ce'
                  : edge.type.includes('ADDRESS')
                  ? '#0f766e'
                  : '#2563eb';

                return (
                  <g key={i} className="cursor-pointer" onClick={() => setSelectedEdge(edge)}>
                    {/* Generous hitzone */}
                    <line
                      x1={s.x}
                      y1={s.y}
                      x2={t.x}
                      y2={t.y}
                      stroke="transparent"
                      strokeWidth={18}
                    />
                    <line
                      x1={s.x}
                      y1={s.y}
                      x2={t.x}
                      y2={t.y}
                      stroke={strokeColor}
                      strokeWidth={isSelected ? 4 : 2.5}
                      strokeDasharray={edge.type.includes('COVER') ? '6 3' : undefined}
                      opacity={isSelected ? 1 : 0.85}
                      pointerEvents="none"
                    />
                    <circle
                      cx={(s.x + t.x) / 2}
                      cy={(s.y + t.y) / 2}
                      r={isSelected ? 6 : 4.5}
                      fill={strokeColor}
                      stroke="#ffffff"
                      strokeWidth={2}
                      pointerEvents="none"
                    />
                  </g>
                );
              })}

              {/* Graph Nodes */}
              {filteredNodes.map((node) => {
                if (node.x === undefined || node.y === undefined) return null;
                const isSelected = selectedNodeId === node.id;
                const isHovered = hoveredNodeId === node.id;
                const isContractor = node.type === 'CONTRACTOR';
                const color = getNodeColor(node.type, node.risk);

                return (
                  <g
                    key={node.id}
                    transform={`translate(${node.x}, ${node.y})`}
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredNodeId(node.id)}
                    onMouseLeave={() => setHoveredNodeId(null)}
                    onClick={() => { setSelectedNodeId(node.id); setSelectedEdge(null); }}
                  >
                    {/* Wide mouse hit zone */}
                    <circle
                      r={isContractor ? 32 : 26}
                      fill="transparent"
                    />

                    {/* Active Selection Ring */}
                    {(isSelected || isHovered) && (
                      <circle
                        r={isContractor ? 28 : 22}
                        fill="none"
                        stroke={isSelected ? '#0f172a' : '#0d9488'}
                        strokeWidth={isSelected ? 3 : 2}
                        strokeDasharray={isSelected ? '5 2.5' : undefined}
                        pointerEvents="none"
                      />
                    )}

                    {/* Node Visual Shape with crisp solid fill */}
                    {isContractor ? (
                      <circle
                        r={22}
                        fill="#ffffff"
                        stroke={color}
                        strokeWidth={isSelected ? 3.5 : 2.5}
                        pointerEvents="none"
                      />
                    ) : (
                      <rect
                        x={-16}
                        y={-16}
                        width={32}
                        height={32}
                        rx={6}
                        fill="#ffffff"
                        stroke={color}
                        strokeWidth={isSelected ? 3.5 : 2.5}
                        pointerEvents="none"
                      />
                    )}

                    {/* Core icon background */}
                    {isContractor ? (
                      <circle
                        r={14}
                        fill={color}
                        pointerEvents="none"
                      />
                    ) : (
                      <rect
                        x={-11}
                        y={-11}
                        width={22}
                        height={22}
                        rx={3}
                        fill={color}
                        pointerEvents="none"
                      />
                    )}

                    {/* Text initials inside icon */}
                    <text
                      textAnchor="middle"
                      dy="4"
                      fontSize="10"
                      fontWeight="bold"
                      fill="#ffffff"
                      fontFamily="monospace"
                      pointerEvents="none"
                    >
                      {isContractor ? 'C' : node.type === 'SHARED_DIRECTOR' ? 'DIN' : node.type === 'SHARED_ADDRESS' ? 'OFF' : 'BNK'}
                    </text>

                    {/* High-Contrast Label Underneath */}
                    <g transform={`translate(0, ${isContractor ? 36 : 30})`}>
                      {/* Contrast pill backdrop */}
                      <rect
                        x={-(Math.min(node.label.length * 4.2 + 8, 80))}
                        y={-10}
                        width={Math.min(node.label.length * 8.4 + 16, 160)}
                        height={18}
                        rx={4}
                        fill={isSelected ? '#0f172a' : '#ffffff'}
                        stroke={isSelected ? '#0f172a' : '#cbd5e1'}
                        strokeWidth={1}
                        pointerEvents="none"
                      />
                      <text
                        textAnchor="middle"
                        dy="3"
                        fontSize="11"
                        fill={isSelected ? '#ffffff' : '#0f172a'}
                        fontWeight="700"
                        fontFamily="sans-serif"
                        pointerEvents="none"
                      >
                        {node.label.length > 22 ? `${node.label.substring(0, 20)}...` : node.label}
                      </text>
                    </g>
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-600 mt-3 pt-2 border-t border-slate-100 gap-2">
            <span>Tip: Click any contractor circle or connector line to review forensic audit evidence.</span>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-800">Layout Algorithm:</span>
              <span className="font-mono bg-slate-100 text-slate-800 px-2 py-0.5 rounded font-bold border border-slate-200">
                Radial Force Correlation
              </span>
            </div>
          </div>
        </div>

        {/* Evidence Inspector Side Panel */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col justify-between min-h-[450px]">
          <div>
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 mb-4">
              <span className="text-xs font-mono uppercase tracking-wider text-slate-600 font-extrabold">
                STATUTORY EVIDENCE INSPECTOR
              </span>
              {selectedNode && (
                <span
                  className="px-2.5 py-1 rounded text-xs font-extrabold font-mono text-white shadow-sm"
                  style={{ backgroundColor: getNodeColor(selectedNode.type, selectedNode.risk) }}
                >
                  {selectedNode.risk >= 85 ? 'HIGH RISK' : 'MEDIUM RISK'} ({selectedNode.risk}%)
                </span>
              )}
            </div>

            {selectedEdge ? (
              <div className="space-y-4">
                <div className="text-xs font-extrabold text-rose-700 uppercase tracking-wider flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-pulse" />
                  FLAGGED ANTI-COMPETITIVE LINK
                </div>

                <div className="p-4 rounded-lg bg-rose-50 border border-rose-200 space-y-3 text-xs">
                  <div className="font-extrabold text-slate-900 text-sm leading-snug">{selectedEdge.label}</div>
                  <div className="text-slate-700">
                    Link Classification:{' '}
                    <strong className="text-slate-900 font-semibold">{selectedEdge.type.replace(/_/g, ' ')}</strong>
                  </div>
                  <div className="text-slate-700">
                    Forensic Confidence:{' '}
                    <strong className="text-rose-800 font-mono font-bold">{selectedEdge.risk}% Statutory Confidence</strong>
                  </div>
                  <p className="text-xs text-slate-600 pt-2 leading-relaxed border-t border-rose-200">
                    This link correlates distinct competing tenderers via shared assets or synchronized bidding, violating non-collusion affidavits under GFR Rule 144.
                  </p>
                </div>
              </div>
            ) : selectedNode ? (
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900 leading-tight">{selectedNode.label}</h3>
                  <div className="text-xs font-bold text-teal-800 mt-1">{getNodeTypeName(selectedNode.type)}</div>
                </div>

                {selectedNode.type === 'CONTRACTOR' ? (
                  <div className="space-y-3.5 text-xs">
                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                        <span className="text-slate-600 block text-xs font-bold uppercase tracking-wider">Won Tenders</span>
                        <span className="font-mono font-extrabold text-slate-900 text-base mt-0.5 block">
                          {selectedNode.wins ?? 0} Won
                        </span>
                      </div>
                      <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                        <span className="text-slate-600 block text-xs font-bold uppercase tracking-wider">Total Bids</span>
                        <span className="font-mono font-extrabold text-slate-900 text-base mt-0.5 block">
                          {selectedNode.bids ?? 0} Tenders
                        </span>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 space-y-1.5">
                      <div className="text-xs font-extrabold text-amber-900 uppercase tracking-wider">Forensic Pattern:</div>
                      <div className="text-xs text-slate-800 leading-relaxed">
                        Enters public tenders systematically alongside sister corporate entities that submit elevated cover bids to guarantee procurement award.
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700">
                      <span className="font-bold text-slate-900 block mb-1">CVC Audit Directive:</span>
                      Verify director DIN listings on MCA-21 and cross-examine bid submission IP logs for concurrency.
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-3 text-xs text-slate-800">
                    <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">Common Identity Asset</div>
                    <p className="leading-relaxed text-slate-700">
                      This verified identifier (director DIN, registered workplace, or bank branch) was confirmed registered across competing contractor filings.
                    </p>
                    <div className="text-xs font-mono font-bold text-teal-900 bg-teal-50 border border-teal-200 p-3 rounded-md">
                      Statutory Violation: GFR Rule 144 &amp; Competition Act (Section 3)
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-slate-500">
                Select an entity or connector line on the map to inspect evidence records.
              </div>
            )}
          </div>

          <div className="pt-5 border-t border-slate-200 mt-5">
            <div className="text-xs font-bold text-slate-600 mb-2 uppercase tracking-wider">
              Enforcement Action:
            </div>
            {selectedRing ? (
              <button
                disabled={creatingCaseFor !== null}
                onClick={() => handleCreateCaseForRing(selectedRing)}
                className="w-full py-3 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {creatingCaseFor === selectedRing.id ? 'Registering Official Case...' : 'Initiate Statutory Vigilance Case'}
              </button>
            ) : (
              <button
                disabled={creatingCaseFor !== null}
                onClick={() => handleCreateCaseForRing(data.rings[0])}
                className="w-full py-3 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {creatingCaseFor === data.rings[0]?.id ? 'Registering...' : `Initiate Case for ${data.rings[0]?.name.split(' ')[0] || 'Syndicate'}`}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Flagged Cartel Syndicates Detailed Cards */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-rose-700" />
            Flagged Procurement Syndicates ({data.rings.length} Groups Identified)
          </h2>
          <span className="text-xs font-medium text-slate-600">Cross-verified against GeM &amp; Ministry Vendor Database</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {data.rings.map((ring) => (
            <div
              key={ring.id}
              className={`p-5 rounded-xl border flex flex-col justify-between transition-all bg-white shadow-sm ${
                selectedRingId === ring.id
                  ? 'border-teal-700 ring-2 ring-teal-700/20 shadow-md'
                  : 'border-slate-200 hover:border-slate-400'
              }`}
            >
              <div className="space-y-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-xs font-mono font-bold text-slate-500 uppercase">{ring.id} · {ring.location}</span>
                    <h3 className="text-base font-extrabold text-slate-900 mt-0.5 leading-snug">{ring.name}</h3>
                  </div>
                  <span className="px-2.5 py-1 rounded text-xs font-extrabold font-mono bg-rose-100 text-rose-900 border border-rose-200 shrink-0">
                    {ring.risk_score}% RISK
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs py-2 border-y border-slate-100">
                  <div>
                    <span className="text-slate-500 block text-xs uppercase font-bold">Pooled Value</span>
                    <span className="font-mono font-extrabold text-teal-800 text-base">
                      ₹{(ring.total_pooled_value / 10000000).toFixed(2)} Cr
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-xs uppercase font-bold">Rigged Contracts</span>
                    <span className="font-mono font-extrabold text-slate-900 text-base">
                      {ring.contract_count} Works
                    </span>
                  </div>
                </div>

                {/* Evidence Flags */}
                <div className="space-y-2 pt-1">
                  <div className="text-xs uppercase font-extrabold text-slate-700">Forensic Indicators:</div>
                  {ring.flags.map((flag, idx) => (
                    <div key={idx} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 flex items-start gap-2 leading-relaxed">
                      <span className="text-rose-700 font-bold shrink-0 mt-0.5">●</span>
                      <span>{flag}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-5 border-t border-slate-100 mt-5 flex items-center justify-between gap-2.5">
                <button
                  onClick={() => {
                    setSelectedRingId(ring.id);
                    const matchingNode = data.graph.nodes.find(n => n.ring === ring.id && n.type === 'CONTRACTOR');
                    if (matchingNode) setSelectedNodeId(matchingNode.id);
                  }}
                  className="px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 transition-colors"
                >
                  Locate on Graph
                </button>
                <button
                  disabled={creatingCaseFor !== null}
                  onClick={() => handleCreateCaseForRing(ring)}
                  className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-60"
                >
                  {creatingCaseFor === ring.id ? 'Registering...' : 'Register Inquiry'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Dataset Upload & Analysis Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl p-6 sm:p-7 space-y-5 animate-scaleIn">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Ingest Tender &amp; Bidder Dataset</h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  Upload tender files to analyze anti-competitive bidder rotation, DIN collisions, and address overlaps.
                </p>
              </div>
              <button
                onClick={() => setShowUploadModal(false)}
                className="w-8 h-8 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 flex items-center justify-center text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {/* Tab switch: File Upload vs Direct Paste */}
            <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
              <button
                onClick={() => setUploadTab('FILE')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  uploadTab === 'FILE'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Upload File (.csv, .xlsx, .json)
              </button>
              <button
                onClick={() => setUploadTab('PASTE')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  uploadTab === 'PASTE'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Paste Tabular / CSV Data
              </button>
            </div>

            {uploadError && (
              <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-900 font-medium">
                {uploadError}
              </div>
            )}

            {uploadSuccessMsg && (
              <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 font-medium">
                {uploadSuccessMsg}
              </div>
            )}

            {uploadTab === 'FILE' ? (
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    handleFileUpload(e.dataTransfer.files[0]);
                  }
                }}
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
                  dragOver
                    ? 'border-teal-700 bg-teal-50/50'
                    : 'border-slate-300 hover:border-slate-400 bg-slate-50/50'
                }`}
              >
                <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center mx-auto mb-3 text-xl">
                  📁
                </div>
                <div className="text-sm font-bold text-slate-900">
                  {uploadingFile ? 'Analyzing Syndicates & Collusion Links...' : 'Drop your Tender & Contractor CSV or Excel file here'}
                </div>
                <p className="text-xs text-slate-600 mt-1 mb-4">
                  Accepts Tender ID, Contractor Name, Bid Amount, Director DIN, Address, Bank IFSC, and IP columns.
                </p>

                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".csv,.xlsx,.xls,.json"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileUpload(e.target.files[0]);
                    }
                  }}
                />

                <div className="flex flex-wrap items-center justify-center gap-3">
                  <button
                    disabled={uploadingFile}
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors cursor-pointer disabled:opacity-60"
                  >
                    Browse Files
                  </button>

                  <button
                    disabled={uploadingFile}
                    onClick={handleLoadSampleDataset}
                    className="px-4 py-2 bg-teal-800 hover:bg-teal-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors cursor-pointer disabled:opacity-60"
                  >
                    Try with PMGSY Sample Data
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <textarea
                  value={pasteContent}
                  onChange={(e) => setPasteContent(e.target.value)}
                  placeholder={`Tender_ID,Contractor_Name,Bid_Amount,Director_DIN,Registered_Address\nTND-01,ABC Civil Ltd,4500000,DIN-01234567,Plot 42 Industrial Area\nTND-01,XYZ Builders,4900000,DIN-01234567,Plot 42 Industrial Area`}
                  rows={7}
                  className="w-full text-xs font-mono p-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900 text-slate-900 placeholder:text-slate-400"
                />
                <button
                  disabled={uploadingFile}
                  onClick={handlePasteSubmit}
                  className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg shadow-sm transition-colors disabled:opacity-60"
                >
                  {uploadingFile ? 'Analyzing Syndicates...' : 'Analyze Pasted Data'}
                </button>
              </div>
            )}

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>Automatic column mapping detects GeM and PMGSY formats.</span>
              <a
                href={`${API_BASE}/api/forensics/cartels/sample-template`}
                download="sih_tender_cartel_sample.csv"
                className="text-teal-800 hover:underline font-semibold"
              >
                Download CSV Sample Template
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CartelRadarPage;
