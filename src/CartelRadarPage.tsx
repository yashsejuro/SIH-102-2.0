import React, { useEffect, useState, useMemo } from 'react';
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
}

interface GraphEdge {
  source: string;
  target: string;
  type: string;
  label: string;
  risk: number;
}

export function CartelRadarPage() {
  const [data, setData] = useState<{ rings: CartelRing[]; graph: { nodes: GraphNode[]; edges: GraphEdge[] }; metrics: any } | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedRingId, setSelectedRingId] = useState<string>('ALL');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>('c1');
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<GraphEdge | null>(null);
  const [creatingCaseFor, setCreatingCaseFor] = useState<string | null>(null);
  const [createdCaseInfo, setCreatedCaseInfo] = useState<{ id: number; title: string } | null>(null);

  useEffect(() => {
    axios.get(`${API_BASE}/api/forensics/cartels`)
      .then(res => {
        setData(res.data);
      })
      .catch(err => {
        console.error('Error fetching cartel forensic data:', err);
      })
      .finally(() => setLoading(false));
  }, []);

  // Fixed visual positions for graph layout
  const nodePositions = useMemo<Record<string, { x: number; y: number }>>(() => {
    return {
      // Ring 01 - Bengaluru Syndicate
      c1: { x: 140, y: 110 },
      c2: { x: 310, y: 90 },
      c3: { x: 230, y: 240 },
      e1: { x: 220, y: 155 }, // Director DIN
      e2: { x: 120, y: 225 }, // Plot 42-B Address
      // Ring 02 - Chennai/Mysuru Alliance
      c4: { x: 490, y: 120 },
      c5: { x: 570, y: 250 },
      e3: { x: 440, y: 210 }, // SBI Branch
      e4: { x: 550, y: 150 }, // Common Domain
      // Ring 03 - Kolkata/Patna Axis
      c6: { x: 320, y: 340 },
      c7: { x: 460, y: 350 },
      e5: { x: 390, y: 310 }, // Auditor
    };
  }, []);

  const filteredNodes = useMemo(() => {
    if (!data) return [];
    if (selectedRingId === 'ALL') return data.graph.nodes;
    return data.graph.nodes.filter(n => n.ring === selectedRingId);
  }, [data, selectedRingId]);

  const filteredEdges = useMemo(() => {
    if (!data) return [];
    const activeNodeIds = new Set(filteredNodes.map(n => n.id));
    return data.graph.edges.filter(e => activeNodeIds.has(e.source) && activeNodeIds.has(e.target));
  }, [data, filteredNodes]);

  const selectedNode = useMemo(() => {
    if (!data || !selectedNodeId) return null;
    return data.graph.nodes.find(n => n.id === selectedNodeId) || null;
  }, [data, selectedNodeId]);

  const selectedRing = useMemo(() => {
    if (!data || selectedRingId === 'ALL') return null;
    return data.rings.find(r => r.id === selectedRingId) || null;
  }, [data, selectedRingId]);

  const handleCreateCaseForRing = async (ring: CartelRing) => {
    setCreatingCaseFor(ring.id);
    try {
      const res = await axios.post(`${API_BASE}/api/audit-cases`, {
        project_id: 14,
        title: `Collusion Inquiry: ${ring.name}`,
        priority: 'CRITICAL',
        assigned_authority: 'District Vigilance Officer',
        notes: `Automated Cartel Detection flagged ${ring.contract_count} tenders totaling ₹${(ring.total_pooled_value / 10000000).toFixed(2)} Cr. Evidence: ${ring.flags.join('; ')}.`,
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
      return risk >= 90 ? '#ef4444' : risk >= 80 ? '#f97316' : '#eab308';
    }
    if (type === 'SHARED_DIRECTOR') return '#a855f7';
    if (type === 'SHARED_ADDRESS') return '#06b6d4';
    if (type === 'BANK_BRANCH') return '#3b82f6';
    return '#10b981';
  };

  const getNodeTypeName = (type: string) => {
    if (type === 'CONTRACTOR') return 'Contractor / Company';
    if (type === 'SHARED_DIRECTOR') return 'Shared Director DIN';
    if (type === 'SHARED_ADDRESS') return 'Shared Office Address';
    if (type === 'BANK_BRANCH') return 'Shared Bank Branch';
    return 'Common Contact Point';
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-[#729b92]">
        <div className="inline-block w-8 h-8 border-2 border-t-[#48a88a] border-[#1d433b] rounded-full animate-spin mb-3" />
        <div className="text-sm">Connecting company nodes and scanning for secret bidder rings...</div>
      </div>
    );
  }

  if (!data) {
    return <div className="p-8 text-center text-red-400">Failed to load Cartel Forensic Radar.</div>;
  }

  return (
    <div className="space-y-6">
      {/* Clear Top Header */}
      <div className="p-6 rounded-xl bg-gradient-to-r from-[#0d2621] via-[#091b17] to-[#143d35] border border-[#1f4e44] shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444] animate-pulse" />
              <span className="text-[11px] font-mono uppercase tracking-wider text-[#7dd8c6] font-semibold">
                ANTI-CORRUPTION RADAR
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-wide">
              Contractor Cartel & Collusion Radar
            </h1>
            <p className="text-xs text-[#a2d3c9] mt-1 max-w-2xl leading-relaxed">
              Finds companies that secretly team up to fix prices and rig government tenders.
              If two &ldquo;competing&rdquo; bidders share the same office, the same director, or the same bank branch, our system catches the collusion ring automatically.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="px-3.5 py-2 rounded-lg bg-[#0b201b] border border-[#1d453c] text-center">
              <div className="text-[10px] uppercase font-mono text-[#719d93]">Cartel Rings Caught</div>
              <div className="text-lg font-mono font-bold text-[#ef4444]">{data.metrics.total_cartel_rings} ACTIVE</div>
            </div>
            <div className="px-3.5 py-2 rounded-lg bg-[#0b201b] border border-[#1d453c] text-center">
              <div className="text-[10px] uppercase font-mono text-[#719d93]">Rigged Tenders</div>
              <div className="text-lg font-mono font-bold text-[#f59e0b]">{data.metrics.total_rigged_tenders} Works</div>
            </div>
            <div className="px-3.5 py-2 rounded-lg bg-[#0b201b] border border-[#1d453c] text-center">
              <div className="text-[10px] uppercase font-mono text-[#719d93]">Public Money at Risk</div>
              <div className="text-lg font-mono font-bold text-[#8cf0df]">₹{(data.metrics.total_pooled_exposure / 10000000).toFixed(2)} Cr</div>
            </div>
          </div>
        </div>
      </div>

      {/* Case created notification banner */}
      {createdCaseInfo && (
        <div className="p-4 rounded-xl bg-[#143d35] border border-[#2f7d6e] flex items-center justify-between gap-4 text-xs text-white">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-[#10b981] flex items-center justify-center font-bold text-[11px]">✓</span>
            <span>Audit Case <strong>#{String(createdCaseInfo.id).padStart(4, '0')}</strong> created for <strong>{createdCaseInfo.title}</strong></span>
          </div>
          <Link to="/cases" className="px-3 py-1.5 rounded bg-[#10b981] hover:bg-[#059669] text-white font-semibold transition-colors">
            Open in Audit Cases →
          </Link>
        </div>
      )}

      {/* Filter Tabs by Cartel Ring */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[#1b3d36] pb-3">
        <button
          onClick={() => { setSelectedRingId('ALL'); setSelectedEdge(null); }}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            selectedRingId === 'ALL'
              ? 'bg-[#1b4a40] text-white border border-[#2f7d6e]'
              : 'bg-[#0e2723] text-[#86b5ac] hover:bg-[#153832] border border-[#193c34]'
          }`}
        >
          All Rings ({data.rings.length})
        </button>
        {data.rings.map(r => (
          <button
            key={r.id}
            onClick={() => { setSelectedRingId(r.id); setSelectedEdge(null); }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 transition-colors ${
              selectedRingId === r.id
                ? 'bg-[#1b4a40] text-white border border-[#2f7d6e]'
                : 'bg-[#0e2723] text-[#86b5ac] hover:bg-[#153832] border border-[#193c34]'
            }`}
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: r.risk_score >= 90 ? '#ef4444' : r.risk_score >= 80 ? '#f97316' : '#eab308' }}
            />
            <span>{r.name.split('Bidder')[0].split('Civic')[0]}</span>
            <span className="font-mono text-[10px] text-[#719f96]">Risk {r.risk_score}%</span>
          </button>
        ))}
      </div>

      {/* Graph Visualizer + Detail Inspector Split Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* SVG Network Graph Canvas */}
        <div className="lg:col-span-8 p-4 rounded-xl bg-[#0b1d1a] border border-[#1e4840] shadow-md flex flex-col">
          <div className="flex items-center justify-between mb-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-white">Visual Connection Map</span>
              <span className="text-[#68948b] text-[11px]">· Click any node or link to see proof</span>
            </div>
            {/* Simple Legend */}
            <div className="hidden sm:flex items-center gap-3 text-[10px] font-mono text-[#78a49c]">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444]" /> Contractor
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded bg-[#a855f7]" /> Same Director
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded bg-[#06b6d4]" /> Same Office
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded bg-[#3b82f6]" /> Same Bank Branch
              </span>
            </div>
          </div>

          {/* SVG Map (Completely stable, zero jitter on hover) */}
          <div className="relative w-full h-[400px] bg-[#071714] rounded-lg border border-[#153630] overflow-hidden flex items-center justify-center">
            <svg viewBox="0 0 680 420" className="w-full h-full select-none">
              {/* Connecting Link Lines */}
              {filteredEdges.map((edge, i) => {
                const s = nodePositions[edge.source];
                const t = nodePositions[edge.target];
                if (!s || !t) return null;
                const isSelected = selectedEdge === edge;
                const strokeColor = edge.type.includes('ROTATIONAL') || edge.type.includes('COVER')
                  ? '#ef4444'
                  : edge.type.includes('DIRECTOR')
                  ? '#c084fc'
                  : edge.type.includes('ADDRESS')
                  ? '#22d3ee'
                  : '#60a5fa';

                return (
                  <g key={i} className="cursor-pointer" onClick={() => setSelectedEdge(edge)}>
                    {/* Generous invisible line hitzone */}
                    <line
                      x1={s.x}
                      y1={s.y}
                      x2={t.x}
                      y2={t.y}
                      stroke="transparent"
                      strokeWidth={14}
                    />
                    <line
                      x1={s.x}
                      y1={s.y}
                      x2={t.x}
                      y2={t.y}
                      stroke={strokeColor}
                      strokeWidth={isSelected ? 3.5 : edge.type.includes('ROTATIONAL') ? 2.5 : 1.5}
                      strokeDasharray={edge.type.includes('COVER') ? '4 3' : undefined}
                      opacity={isSelected ? 1 : 0.75}
                      pointerEvents="none"
                    />
                    <circle
                      cx={(s.x + t.x) / 2}
                      cy={(s.y + t.y) / 2}
                      r="4"
                      fill={strokeColor}
                      pointerEvents="none"
                    />
                  </g>
                );
              })}

              {/* Render Graph Nodes (Stable geometry, no scale-110 jitter) */}
              {filteredNodes.map((node) => {
                const pos = nodePositions[node.id];
                if (!pos) return null;
                const isSelected = selectedNodeId === node.id;
                const isHovered = hoveredNodeId === node.id;
                const isContractor = node.type === 'CONTRACTOR';
                const color = getNodeColor(node.type, node.risk);

                return (
                  <g
                    key={node.id}
                    transform={`translate(${pos.x}, ${pos.y})`}
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredNodeId(node.id)}
                    onMouseLeave={() => setHoveredNodeId(null)}
                    onClick={() => { setSelectedNodeId(node.id); setSelectedEdge(null); }}
                  >
                    {/* Stable invisible mouse hit-zone */}
                    <circle
                      r={isContractor ? 28 : 22}
                      fill="transparent"
                    />

                    {/* Highlight Ring on hover or selection (pointerEvents: none prevents cursor loops) */}
                    {(isSelected || isHovered) && (
                      <circle
                        r={isContractor ? 25 : 19}
                        fill="none"
                        stroke={isSelected ? '#6ee7b7' : '#5eead4'}
                        strokeWidth={isSelected ? 2.5 : 1.5}
                        strokeDasharray={isSelected ? '4 2' : undefined}
                        pointerEvents="none"
                      />
                    )}

                    {/* Node Visual Shape */}
                    {isContractor ? (
                      <circle
                        r={20}
                        fill={color}
                        fillOpacity={isHovered ? 0.45 : isSelected ? 0.35 : 0.22}
                        stroke={color}
                        strokeWidth={isSelected ? 3 : isHovered ? 2.5 : 2}
                        pointerEvents="none"
                      />
                    ) : (
                      <rect
                        x={-14}
                        y={-14}
                        width={28}
                        height={28}
                        rx={6}
                        fill={color}
                        fillOpacity={isHovered ? 0.45 : isSelected ? 0.35 : 0.22}
                        stroke={color}
                        strokeWidth={isSelected ? 3 : isHovered ? 2.5 : 2}
                        pointerEvents="none"
                      />
                    )}

                    {/* Icon initials */}
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

                    {/* Node Text Label (pointerEvents: none completely stops flickering) */}
                    <text
                      y={isContractor ? 30 : 26}
                      textAnchor="middle"
                      fontSize="10"
                      fill={isSelected ? '#ffffff' : isHovered ? '#e6fff9' : '#b2ded6'}
                      fontWeight={isSelected || isHovered ? 'bold' : 'normal'}
                      pointerEvents="none"
                    >
                      {node.label.length > 20 ? `${node.label.substring(0, 18)}...` : node.label}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="flex items-center justify-between text-[11px] text-[#6d968e] mt-3">
            <div>Click any circle or box to see who owns it and why it&apos;s suspicious.</div>
            <div className="font-mono">Live Forensic Graph</div>
          </div>
        </div>

        {/* Selected Entity / Edge Inspector Drawer */}
        <div className="lg:col-span-4 p-5 rounded-xl bg-[#0b1d1a] border border-[#1e4840] shadow-md flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[#1b3d36] mb-3">
              <span className="text-[11px] font-mono uppercase tracking-wider text-[#70c9ba] font-bold">
                EVIDENCE INSPECTOR
              </span>
              {selectedNode && (
                <span
                  className="px-2 py-0.5 rounded text-[10px] font-bold font-mono text-white"
                  style={{ backgroundColor: getNodeColor(selectedNode.type, selectedNode.risk) }}
                >
                  {selectedNode.risk >= 85 ? 'HIGH RISK' : 'MEDIUM RISK'} ({selectedNode.risk}%)
                </span>
              )}
            </div>

            {selectedEdge ? (
              <div className="space-y-3">
                <div className="text-xs font-semibold text-[#f87171] uppercase font-mono">
                  SUSPICIOUS LINK FOUND
                </div>
                <div className="p-3.5 rounded-lg bg-[#0e2723] border border-[#1e4840] space-y-2 text-xs">
                  <div className="font-semibold text-white text-sm">{selectedEdge.label}</div>
                  <div className="text-[#a5dcd2]">
                    Link Type: <strong className="text-white">{selectedEdge.type.replace(/_/g, ' ')}</strong>
                  </div>
                  <div className="text-[#a5dcd2]">
                    Suspicion Score: <strong className="text-[#f87171]">{selectedEdge.risk}% Evidence Confidence</strong>
                  </div>
                  <p className="text-[11px] text-[#86b5ac] pt-1 leading-relaxed">
                    This link connects two competing companies through shared resources, proving they are not bidding independently.
                  </p>
                </div>
              </div>
            ) : selectedNode ? (
              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-bold text-white">{selectedNode.label}</h3>
                  <div className="text-xs font-mono text-[#76a39b]">{getNodeTypeName(selectedNode.type)}</div>
                </div>

                {selectedNode.type === 'CONTRACTOR' ? (
                  <div className="space-y-3 text-xs">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2.5 rounded bg-[#0e2723] border border-[#1a3f37]">
                        <span className="text-[#719d93] block text-[10px] uppercase">Won Tenders</span>
                        <span className="font-mono font-bold text-white text-sm">{selectedNode.wins} Won</span>
                      </div>
                      <div className="p-2.5 rounded bg-[#0e2723] border border-[#1a3f37]">
                        <span className="text-[#719d93] block text-[10px] uppercase">Participated In</span>
                        <span className="font-mono font-bold text-white text-sm">{selectedNode.bids} Tenders</span>
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-[#0e2723] border border-[#1a3f37] space-y-1">
                      <div className="text-[10px] text-[#719d93] uppercase font-mono">What We Found:</div>
                      <div className="text-xs text-[#c4ede5] leading-relaxed">
                        Frequently enters tenders with partner companies who submit slightly higher bids to help this company win at higher prices.
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-3.5 rounded-lg bg-[#0e2723] border border-[#1a3f37] space-y-2 text-xs text-[#c4ede5]">
                    <div className="text-[10px] text-[#719d93] uppercase font-mono">Shared Identity Proof:</div>
                    <p className="leading-relaxed">
                      This exact resource (director, office, or bank branch) was discovered registered under multiple supposedly competing contractor companies.
                    </p>
                    <div className="text-[11px] font-mono text-[#9de0d4] bg-[#143d35] p-2 rounded">
                      Violates: General Financial Rules (GFR Rule 144) · Anti-Bid Rigging Law
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-6 text-center text-xs text-[#719d93]">
                Click on any circle or line on the map to see its details.
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-[#1b3d36] mt-4">
            <div className="text-[10px] text-[#719d93] mb-2 uppercase font-mono">
              Take Action on this Cartel:
            </div>
            {selectedRing ? (
              <button
                disabled={creatingCaseFor !== null}
                onClick={() => handleCreateCaseForRing(selectedRing)}
                className="w-full py-2.5 px-3 rounded-lg bg-[#16655c] hover:bg-[#1b7a6f] text-white text-xs font-semibold shadow transition-colors flex items-center justify-center gap-2"
              >
                {creatingCaseFor === selectedRing.id ? 'Registering Case...' : 'Register Official Audit Case'}
              </button>
            ) : (
              <button
                disabled={creatingCaseFor !== null}
                onClick={() => handleCreateCaseForRing(data.rings[0])}
                className="w-full py-2.5 px-3 rounded-lg bg-[#16655c] hover:bg-[#1b7a6f] text-white text-xs font-semibold shadow transition-colors flex items-center justify-center gap-2"
              >
                {creatingCaseFor === data.rings[0].id ? 'Registering Case...' : `Register Case for ${data.rings[0].name.split('Bidder')[0]}`}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Cartel Rings Detailed Dossiers */}
      <div>
        <h2 className="text-base font-bold text-white mb-3 flex items-center gap-2">
          <span className="w-2 h-4 bg-[#ef4444] rounded-sm" />
          Caught Cartel Rings ({data.rings.length} Groups)
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {data.rings.map((ring) => (
            <div
              key={ring.id}
              className={`p-5 rounded-xl border flex flex-col justify-between transition-all ${
                selectedRingId === ring.id
                  ? 'bg-[#12302a] border-[#389182] shadow-lg ring-1 ring-[#3ca392]'
                  : 'bg-[#0b1d1a] border-[#1e4840] hover:border-[#2f6d61]'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-mono text-[#76a39b] uppercase">{ring.id} · {ring.location}</span>
                    <h3 className="text-sm font-bold text-white mt-0.5">{ring.name}</h3>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-[#991b1b] text-white shrink-0">
                    {ring.risk_score}% RISK
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs py-1">
                  <div>
                    <span className="text-[#729b92] block text-[10px] uppercase">Combined Tender Value</span>
                    <span className="font-mono font-bold text-[#7fe0d0]">₹{(ring.total_pooled_value / 10000000).toFixed(2)} Crore</span>
                  </div>
                  <div>
                    <span className="text-[#729b92] block text-[10px] uppercase">Rigged Contracts</span>
                    <span className="font-mono font-bold text-white">{ring.contract_count} Works</span>
                  </div>
                </div>

                {/* Evidence Flags in Plain English */}
                <div className="space-y-1.5 pt-1">
                  <div className="text-[10px] uppercase font-mono text-[#729b92]">Evidence Found by System:</div>
                  {ring.flags.map((flag, idx) => (
                    <div key={idx} className="p-2 rounded bg-[#071614] border border-[#163832] text-[11px] text-[#9cd8cc] flex items-start gap-1.5 leading-snug">
                      <span className="text-[#ef4444] font-bold shrink-0">✓</span>
                      <span>{flag}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-[#1a3f37] mt-4 flex items-center justify-between gap-2">
                <button
                  onClick={() => { setSelectedRingId(ring.id); setSelectedNodeId(ring.id === 'RING-01' ? 'c1' : ring.id === 'RING-02' ? 'c4' : 'c6'); }}
                  className="px-3 py-1.5 rounded text-xs text-[#a2dcd2] hover:text-white bg-[#143630] hover:bg-[#1d4c44] border border-[#214b43] transition-colors"
                >
                  View on Map
                </button>
                <button
                  disabled={creatingCaseFor !== null}
                  onClick={() => handleCreateCaseForRing(ring)}
                  className="px-3 py-1.5 rounded text-xs font-semibold text-white bg-[#16655c] hover:bg-[#1e786e] transition-colors"
                >
                  {creatingCaseFor === ring.id ? 'Registering...' : 'Register Audit Case'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
export default CartelRadarPage;
