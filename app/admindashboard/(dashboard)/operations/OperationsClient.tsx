"use client";

import React, { useState, useEffect } from "react";

export default function OperationsClient() {
  const [healthData, setHealthData] = useState<any>(null);
  const [queueData, setQueueData] = useState<any>(null);
  const [metricsData, setMetricsData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedJobPayload, setSelectedJobPayload] = useState<any>(null);
  const [selectedJobStack, setSelectedJobStack] = useState<any>(null);

  // Search parameters
  const [searchJobId, setSearchJobId] = useState("");
  const [searchOrderId, setSearchOrderId] = useState("");

  const fetchData = async () => {
    try {
      const qParams = new URLSearchParams();
      if (searchJobId) qParams.append("searchJobId", searchJobId);
      if (searchOrderId) qParams.append("searchOrderId", searchOrderId);

      const [hRes, qRes, mRes] = await Promise.all([
        fetch("/api/health"),
        fetch(`/api/admin/queues?${qParams.toString()}`),
        fetch("/api/metrics"),
      ]);

      if (hRes.ok) setHealthData(await hRes.json());
      if (qRes.ok) setQueueData(await qRes.json());
      if (mRes.ok) setMetricsData(await mRes.json());
    } catch (err) {
      console.error("Failed to fetch operations status:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000); // refresh every 10s
    return () => clearInterval(interval);
  }, [searchJobId, searchOrderId]);

  const handleQueueToggle = async (queueName: string, isCurrentlyPaused: boolean) => {
    const action = isCurrentlyPaused ? "resume" : "pause";
    const actionKey = `${action}-${queueName}`;
    setActionLoading(actionKey);
    try {
      const res = await fetch("/api/admin/queues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, queueName }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert(data.message);
        fetchData();
      } else {
        alert(`Failed to ${action} queue: ${data.error || "Unknown error"}`);
      }
    } catch (err: any) {
      alert(`Action error: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleJobAction = async (action: "retry" | "cancel", queueName: string, jobId: string) => {
    const actionKey = `${action}-${queueName}-${jobId}`;
    setActionLoading(actionKey);
    try {
      const res = await fetch("/api/admin/queues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, queueName, jobId }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert(data.message);
        fetchData();
      } else {
        alert(`Action failed: ${data.error || "Unknown error"}`);
      }
    } catch (err: any) {
      alert(`Action error: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="p-8 space-y-8 bg-[#faf9f8] min-h-screen text-[#1a1c1c] font-body">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-[#1a1c1c]/10 w-48 rounded-none"></div>
          <div className="h-64 bg-[#1a1c1c]/5 rounded-none"></div>
        </div>
      </div>
    );
  }

  const subsystems = healthData?.subsystems || {};
  const queues = queueData?.queues || {};

  return (
    <div className="p-8 space-y-8 bg-[#faf9f8] min-h-screen text-[#1a1c1c] font-body">
      {/* Header */}
      <div>
        <h1 className="font-headline font-black uppercase text-2xl tracking-wider text-[#1a1c1c]">System Operations</h1>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#775a19] mt-1">Platform Performance & Observability Console</p>
      </div>

      {/* Health Overview Grid */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {Object.entries(subsystems).map(([name, data]: any) => {
          const isHealthy = data.status === "healthy";
          return (
            <div key={name} className="border border-[#1a1c1c]/10 bg-white p-4 rounded-none flex flex-col justify-between">
              <div>
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[#1a1c1c]/50">{name}</span>
                <h3 className="font-headline font-bold uppercase text-xs mt-1">{isHealthy ? "Healthy" : "Degraded"}</h3>
                <span className="text-[8px] text-[#1a1c1c]/40 font-mono block mt-1">v{data.version} | {data.environment}</span>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-[#1a1c1c]/5 pt-2">
                <span className="text-[9px] text-[#1a1c1c]/60">{data.latencyMs}ms</span>
                <span className={`size-2 rounded-none ${isHealthy ? "bg-emerald-500" : "bg-red-500"}`}></span>
              </div>
            </div>
          );
        })}
      </div>

      {/* System Metrics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
        <div className="border border-[#1a1c1c]/10 bg-white p-4 rounded-none">
          <span className="text-[8px] font-black uppercase tracking-wider text-[#1a1c1c]/50">Process Uptime</span>
          <span className="block text-lg font-bold mt-1">{metricsData?.system?.uptimeSeconds || 0}s</span>
        </div>
        <div className="border border-[#1a1c1c]/10 bg-white p-4 rounded-none">
          <span className="text-[8px] font-black uppercase tracking-wider text-[#1a1c1c]/50">Memory Usage (RSS)</span>
          <span className="block text-lg font-bold mt-1">{metricsData?.system?.memory?.rssMb || 0} MB</span>
        </div>
        <div className="border border-[#1a1c1c]/10 bg-white p-4 rounded-none">
          <span className="text-[8px] font-black uppercase tracking-wider text-[#1a1c1c]/50">API Total Requests</span>
          <span className="block text-lg font-bold mt-1">{metricsData?.api?.totalRequests || 0}</span>
        </div>
        <div className="border border-[#1a1c1c]/10 bg-white p-4 rounded-none">
          <span className="text-[8px] font-black uppercase tracking-wider text-[#1a1c1c]/50">Payment Success Rate</span>
          <span className="block text-lg font-bold mt-1 text-emerald-600">{metricsData?.commerce?.paymentSuccessRate || 100}%</span>
        </div>
      </div>

      {/* Metrics / Cache / Performance Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cache Performance Card */}
        <div className="border border-[#1a1c1c]/10 bg-white p-6 rounded-none">
          <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#775a19] mb-4">Cache Hit Performance</h2>
          <div className="space-y-4">
            <div className="flex justify-between items-baseline">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#1a1c1c]/70">Hit Ratio</span>
              <span className="text-xl font-bold tracking-tight">{((metricsData?.cache?.hitRatio || 0) * 100).toFixed(1)}%</span>
            </div>
            <div className="w-full bg-[#1a1c1c]/5 h-1.5 rounded-none">
              <div 
                className="bg-[#775a19] h-1.5 rounded-none" 
                style={{ width: `${(metricsData?.cache?.hitRatio || 0) * 100}%` }}
              ></div>
            </div>
            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-[#1a1c1c]/5 text-[10px]">
              <div>
                <span className="text-[#1a1c1c]/50 uppercase tracking-wider block">Hits</span>
                <span className="font-bold">{metricsData?.cache?.hits || 0}</span>
              </div>
              <div>
                <span className="text-[#1a1c1c]/50 uppercase tracking-wider block">Misses</span>
                <span className="font-bold">{metricsData?.cache?.misses || 0}</span>
              </div>
            </div>
          </div>
        </div>

        {/* API Average Latency */}
        <div className="border border-[#1a1c1c]/10 bg-white p-6 rounded-none lg:col-span-2">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#775a19]">API Route Latency (Avg)</h2>
            <div className="text-[8px] font-black uppercase tracking-wider bg-red-100 text-red-800 px-2 py-0.5">
              Slowest: {metricsData?.api?.slowest?.route} ({metricsData?.api?.slowest?.latencyMs}ms)
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {Object.entries(metricsData?.api?.averages || {}).map(([route, avg]: any) => (
              <div key={route} className="border border-[#1a1c1c]/5 p-3 rounded-none bg-[#faf9f8]">
                <span className="text-[9px] font-mono text-[#1a1c1c]/60 truncate block">{route}</span>
                <span className="text-sm font-bold block mt-1">{avg}ms</span>
              </div>
            ))}
            {Object.keys(metricsData?.api?.averages || {}).length === 0 && (
              <p className="text-[10px] text-[#1a1c1c]/50 uppercase">No active API request latencies tracked yet.</p>
            )}
          </div>
        </div>
      </div>

      {/* Commerce Backlog Statuses */}
      <div className="border border-[#1a1c1c]/10 bg-white p-6 rounded-none">
        <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#775a19] mb-4">Fulfillment Backlogs</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-bold uppercase tracking-wider">
          <div className="border border-[#1a1c1c]/5 p-4 bg-[#faf9f8] flex justify-between items-center">
            <span>Email Backlog</span>
            <span className={`px-2 py-0.5 text-xs ${metricsData?.commerce?.backlogs?.email > 0 ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800"}`}>
              {metricsData?.commerce?.backlogs?.email || 0}
            </span>
          </div>
          <div className="border border-[#1a1c1c]/5 p-4 bg-[#faf9f8] flex justify-between items-center">
            <span>Shiprocket Backlog</span>
            <span className={`px-2 py-0.5 text-xs ${metricsData?.commerce?.backlogs?.shiprocket > 0 ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800"}`}>
              {metricsData?.commerce?.backlogs?.shiprocket || 0}
            </span>
          </div>
          <div className="border border-[#1a1c1c]/5 p-4 bg-[#faf9f8] flex justify-between items-center">
            <span>Payment Processor Backlog</span>
            <span className={`px-2 py-0.5 text-xs ${metricsData?.commerce?.backlogs?.payment > 0 ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800"}`}>
              {metricsData?.commerce?.backlogs?.payment || 0}
            </span>
          </div>
        </div>
      </div>

      {/* Queue Status Management Section */}
      <div className="border border-[#1a1c1c]/10 bg-white p-6 rounded-none">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#775a19]">BullMQ Background Queues</h2>
          
          {/* Filters & Search Inputs */}
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              placeholder="Search Job ID..."
              value={searchJobId}
              onChange={(e) => setSearchJobId(e.target.value)}
              className="border border-[#1a1c1c]/25 bg-white text-xs px-3 py-1.5 rounded-none font-bold uppercase tracking-wider outline-none focus:border-[#775a19]"
            />
            <input
              type="text"
              placeholder="Search Order ID..."
              value={searchOrderId}
              onChange={(e) => setSearchOrderId(e.target.value)}
              className="border border-[#1a1c1c]/25 bg-white text-xs px-3 py-1.5 rounded-none font-bold uppercase tracking-wider outline-none focus:border-[#775a19]"
            />
          </div>
        </div>

        <div className="space-y-6">
          {Object.entries(queues).map(([qName, qData]: any) => {
            const counts = qData.counts || {};
            const failedJobsList = qData.jobs?.failed || [];
            const activeJobsList = qData.jobs?.active || [];
            const isPaused = qData.isPaused;
            const oldestJob = qData.oldestWaitingJob;
            const isActionLoading = actionLoading === `pause-${qName}` || actionLoading === `resume-${qName}`;
            
            return (
              <div key={qName} className="border border-[#1a1c1c]/10 p-4 rounded-none space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between pb-2 border-b border-[#1a1c1c]/5 gap-2">
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="text-xs font-black uppercase tracking-wider">{qName}</h3>
                      <span className={`px-2 py-0.25 text-[8px] font-black uppercase tracking-widest ${isPaused ? "bg-red-100 text-red-800" : "bg-emerald-100 text-emerald-800"}`}>
                        {isPaused ? "Paused" : "Running"}
                      </span>
                      <span className="text-[8px] text-[#1a1c1c]/40 font-mono uppercase font-black">
                        Workers Active: {qData.workersCount || 0}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-[9px] font-black uppercase tracking-wider">
                    {/* Job counts badges */}
                    <div className="flex gap-2">
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-800">Active: {counts.active || 0}</span>
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-800">Waiting: {counts.waiting || 0}</span>
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-800">Delayed: {counts.delayed || 0}</span>
                      <span className="px-2 py-0.5 bg-green-100 text-green-800">Completed: {counts.completed || 0}</span>
                      <span className="px-2 py-0.5 bg-red-100 text-red-800">Failed: {counts.failed || 0}</span>
                    </div>

                    {/* Pause/Resume buttons */}
                    <button
                      disabled={isActionLoading}
                      onClick={() => handleQueueToggle(qName, isPaused)}
                      className={`px-3 py-1 font-bold rounded-none uppercase text-[8px] tracking-widest ${isPaused ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-red-600 hover:bg-red-700 text-white"} disabled:opacity-50`}
                    >
                      {isPaused ? "Resume Queue" : "Pause Queue"}
                    </button>
                  </div>
                </div>

                {/* Oldest Waiting Job Info */}
                {oldestJob && (
                  <div className="text-[9px] bg-amber-50/50 border border-amber-200/50 p-2 rounded-none flex justify-between items-center">
                    <span>
                      <strong className="uppercase">Oldest Waiting Job:</strong> ID: <code className="font-mono text-xs">{oldestJob.id}</code> | Created: {new Date(oldestJob.timestamp).toLocaleString()}
                    </span>
                    <button 
                      onClick={() => handleJobAction("retry", qName, oldestJob.id)}
                      className="px-2 py-0.5 bg-amber-600 hover:bg-amber-700 text-white rounded-none font-bold uppercase tracking-widest text-[8px]"
                    >
                      Trigger Retry
                    </button>
                  </div>
                )}

                {/* Failed Jobs Details List */}
                {failedJobsList.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-[9px] font-black uppercase tracking-wider text-red-600 block">Failed Jobs Queue</span>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-[#1a1c1c]/5 text-[10px]">
                        <thead>
                          <tr className="text-left font-black uppercase tracking-wider text-[#1a1c1c]/50">
                            <th className="py-2">Job ID</th>
                            <th className="py-2">Name</th>
                            <th className="py-2">Reason</th>
                            <th className="py-2 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#1a1c1c]/5 font-medium">
                          {failedJobsList.map((job: any) => {
                            const isJobLoading = actionLoading === `retry-${qName}-${job.id}` || actionLoading === `cancel-${qName}-${job.id}`;
                            return (
                              <tr key={job.id} className="hover:bg-red-50/30">
                                <td className="py-2 font-mono">{job.id}</td>
                                <td className="py-2">{job.name}</td>
                                <td className="py-2 text-red-600 max-w-xs truncate" title={job.failedReason}>{job.failedReason}</td>
                                <td className="py-2 text-right space-x-2">
                                  <button
                                    onClick={() => { setSelectedJobPayload(job.data); setSelectedJobStack(job.stacktrace); }}
                                    className="px-2 py-1 text-[9px] uppercase tracking-wider border border-[#1a1c1c]/10 bg-white hover:bg-gray-50 rounded-none font-bold"
                                  >
                                    Inspect
                                  </button>
                                  <button
                                    disabled={isJobLoading}
                                    onClick={() => handleJobAction("retry", qName, job.id)}
                                    className="px-2 py-1 text-[9px] uppercase tracking-wider bg-[#775a19] hover:bg-[#775a19]/90 text-white rounded-none font-bold disabled:opacity-50"
                                  >
                                    Retry
                                  </button>
                                  <button
                                    disabled={isJobLoading}
                                    onClick={() => handleJobAction("cancel", qName, job.id)}
                                    className="px-2 py-1 text-[9px] uppercase tracking-wider bg-red-600 hover:bg-red-700 text-white rounded-none font-bold disabled:opacity-50"
                                  >
                                    Cancel
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Payload Inspection Modal */}
      {(selectedJobPayload || selectedJobStack) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 font-mono text-xs">
          <div className="bg-white border border-[#1a1c1c]/15 w-full max-w-3xl p-6 space-y-4 rounded-none max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-[#1a1c1c]/10 pb-2">
              <h3 className="font-bold uppercase text-[#775a19]">Job Detail Inspector</h3>
              <button 
                onClick={() => { setSelectedJobPayload(null); setSelectedJobStack(null); }}
                className="text-lg font-bold border-none bg-transparent cursor-pointer"
              >
                &times;
              </button>
            </div>
            {selectedJobPayload && (
              <div>
                <span className="font-black uppercase text-[9px] text-[#1a1c1c]/50 block mb-1">Payload Data</span>
                <pre className="bg-[#faf9f8] p-3 border border-[#1a1c1c]/5 overflow-auto max-h-48 text-[10px]">
                  {JSON.stringify(selectedJobPayload, null, 2)}
                </pre>
              </div>
            )}
            {selectedJobStack && selectedJobStack.length > 0 && (
              <div>
                <span className="font-black uppercase text-[9px] text-[#1a1c1c]/50 block mb-1">Stack Trace</span>
                <pre className="bg-[#faf9f8] p-3 border border-red-200 text-red-700 overflow-auto max-h-48 text-[10px]">
                  {selectedJobStack.join("\n")}
                </pre>
              </div>
            )}
            <div className="text-right pt-2 border-t border-[#1a1c1c]/5">
              <button 
                onClick={() => { setSelectedJobPayload(null); setSelectedJobStack(null); }}
                className="px-4 py-2 border border-[#1a1c1c]/10 uppercase tracking-widest font-bold text-[9px] hover:bg-gray-50 rounded-none bg-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
