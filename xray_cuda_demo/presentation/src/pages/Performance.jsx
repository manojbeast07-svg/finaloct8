import { useState } from "react";
import { BarChart } from "../components/BarChart.jsx";
import { MetricCard } from "../components/MetricCard.jsx";
import { ProvenanceBadge } from "../components/ProvenanceBadge.jsx";
import { runLiveBatchSweep, runLivePerFilter } from "../data/apiClient.js";
import { isMissing } from "../utils/isMissing.js";
import { Why } from "../components/Why.jsx";

const BATCH_SIZE_OPTIONS = [1, 8, 16, 32, 64, 128, 256, 512];
const FILTER_SWEEP_SIZES = [512, 256, 128, 64, 32, 16, 8, 1];
const FILTER_OPTIONS = [
  { id: "gaussian", label: "Gaussian", color: "#58a6ff" },
  { id: "median", label: "Median", color: "#f0883e" },
  { id: "sobel", label: "Sobel", color: "#3fb950" },
  { id: "laplacian", label: "Laplacian", color: "#d2a8ff" },
  { id: "threshold", label: "Threshold", color: "#f778ba" },
];

function HistoricalBenchmark({ benchmark }) {
  const cpu = benchmark?.cpu?.mode4_end_to_end_ms?.median;
  const basic = benchmark?.basic_cuda?.mode4_end_to_end_ms?.median;
  const enhanced = benchmark?.enhanced_cuda?.mode4_end_to_end_ms?.median;

  return (
    <>
      <BarChart
        bars={[
          { label: "CPU / OpenCV", value: cpu, kind: "cpu" },
          { label: "Basic CUDA", value: basic, kind: "basic" },
          { label: "Enhanced CUDA", value: enhanced, kind: "enhanced" },
        ]}
        formatValue={(v) => `${v.toFixed(2)} ms`}
      />
      <div className="card-row cols-3">
        <MetricCard title="Basic CUDA vs CPU" kind="basic" value={isMissing(benchmark?.speedups?.basic_vs_cpu) ? null : `${benchmark.speedups.basic_vs_cpu.toFixed(2)}×`} />
        <MetricCard title="Enhanced CUDA vs CPU" kind="enhanced" value={isMissing(benchmark?.speedups?.enhanced_vs_cpu) ? null : `${benchmark.speedups.enhanced_vs_cpu.toFixed(2)}×`} />
        <MetricCard title="Enhanced CUDA vs Basic CUDA" kind="enhanced" value={isMissing(benchmark?.speedups?.enhanced_vs_basic_compute_only) ? null : `${benchmark.speedups.enhanced_vs_basic_compute_only.toFixed(2)}×`} />
      </div>
    </>
  );
}

function FilterPerformanceLineChart({ measurements, filter }) {
  const width = 820;
  const height = 390;
  const margin = { top: 22, right: 20, bottom: 66, left: 76 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const implementations = [
    { key: "cpu_kernel_ms", label: "CPU", color: "#a1a1aa" },
    { key: "basic_kernel_ms", label: "Basic CUDA", color: "#58a6ff" },
    { key: "enhanced_kernel_ms", label: "Enhanced CUDA", color: "#f0883e" },
  ];
  const seriesByImplementation = implementations.map((implementation) => ({
    ...implementation,
    points: measurements.map((measurement) => ({
      batchSize: measurement.effectiveBatchSize,
      value: measurement.rows.find((row) => row.filter === filter.id)?.[implementation.key],
    })).filter((point) => Number.isFinite(point.value)).sort((a, b) => a.batchSize - b.batchSize),
  }));
  const values = seriesByImplementation.flatMap((series) => series.points.map((point) => point.value));
  const yMax = Math.max(0.1, Math.ceil(Math.max(...values, 0.1) * 1.15 * 10) / 10);
  const yStep = yMax / 4;
  const yDigits = yMax < 1 ? 2 : 1;
  const maxBatchSize = Math.max(...measurements.map((measurement) => measurement.effectiveBatchSize), 1);
  const x = (batchSize) => margin.left + (batchSize / maxBatchSize) * plotWidth;
  const y = (value) => margin.top + plotHeight - (value / yMax) * plotHeight;

  return (
    <article className="card filter-performance-chart-card">
      <h4>{filter.label}</h4>
      <div className="filter-performance-chart-scroll">
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${filter.label}: CPU, Basic CUDA, and Enhanced CUDA kernel time by batch size`}>
          <text x={margin.left + plotWidth / 2} y={height - 10} textAnchor="middle" className="chart-axis-label">Batch size (images processed)</text>
          <text x="18" y={margin.top + plotHeight / 2} textAnchor="middle" className="chart-axis-label" transform={`rotate(-90 18 ${margin.top + plotHeight / 2})`}>Kernel time (ms)</text>
          {[0, 1, 2, 3, 4].map((tick) => {
            const value = yStep * tick;
            const yy = y(value);
            return (
              <g key={tick}>
                <line x1={margin.left} x2={width - margin.right} y1={yy} y2={yy} className="chart-grid-line" />
                <text x={margin.left - 10} y={yy + 4} textAnchor="end" className="chart-tick-label">{value.toFixed(yDigits)}</text>
              </g>
            );
          })}
          {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
            const batch = Math.round(maxBatchSize * fraction);
            const xx = margin.left + plotWidth * fraction;
            return (
              <g key={fraction}>
                <line x1={xx} x2={xx} y1={margin.top} y2={margin.top + plotHeight} className="chart-grid-line chart-grid-vertical" />
                <text x={xx} y={margin.top + plotHeight + 22} textAnchor="middle" className="chart-tick-label">{batch}</text>
              </g>
            );
          })}
          {seriesByImplementation.map((series) => {
            if (!series.points.length) return null;
            const coordinates = series.points.map((point) => `${x(point.batchSize)},${y(point.value)}`).join(" ");
            return (
              <g key={series.key}>
                <polyline points={coordinates} fill="none" stroke={series.color} strokeWidth="2.7" />
                {series.points.map((point) => (
                  <circle key={`${point.batchSize}-${point.value}`} cx={x(point.batchSize)} cy={y(point.value)} r="3.5" fill={series.color}>
                    <title>{`${filter.label} · ${series.label} · batch ${point.batchSize}: ${point.value.toFixed(3)} ms`}</title>
                  </circle>
                ))}
              </g>
            );
          })}
        </svg>
        <div className="filter-performance-legend">
          {implementations.map((implementation) => (
            <span key={implementation.key}><i style={{ background: implementation.color }} />{implementation.label}</span>
          ))}
        </div>
      </div>
    </article>
  );
}

function BatchSizeExplorer() {
  const [selected, setSelected] = useState(new Set([1, 8, 32, 64]));
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);
  const [rows, setRows] = useState(null);
  const [filterMeasurements, setFilterMeasurements] = useState([]);
  const [filterRunning, setFilterRunning] = useState(false);
  const [filterError, setFilterError] = useState(null);
  const [filterProgress, setFilterProgress] = useState(null);

  function toggle(size) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(size) ? next.delete(size) : next.add(size);
      return next;
    });
  }

  async function runTest() {
    setRunning(true);
    setError(null);
    try {
      const data = await runLiveBatchSweep({ batchSizes: Array.from(selected) });
      setRows(data.rows);
    } catch (e) {
      setError(e.message);
    } finally {
      setRunning(false);
    }
  }

  async function runFilterTest() {
    setFilterRunning(true);
    setFilterError(null);
    setFilterMeasurements([]);
    setFilterProgress({ completed: 0, total: FILTER_SWEEP_SIZES.length, batchSize: FILTER_SWEEP_SIZES[0] });
    const completed = [];
    const failures = [];
    try {
      for (let index = 0; index < FILTER_SWEEP_SIZES.length; index += 1) {
        const requestedBatchSize = FILTER_SWEEP_SIZES[index];
        setFilterProgress({ completed: index, total: FILTER_SWEEP_SIZES.length, batchSize: requestedBatchSize });
        try {
          const data = await runLivePerFilter({ batchSize: requestedBatchSize, seed: 42, includeCpu: true });
          const result = {
            requestedBatchSize,
            effectiveBatchSize: data.n_images ?? requestedBatchSize,
            rows: data.per_filter_results,
          };
          completed.push(result);
          setFilterMeasurements([...completed]);
        } catch (e) {
          failures.push(`batch ${requestedBatchSize}: ${e.message}`);
        }
      }
      if (completed.length === 0) throw new Error(failures.join("; ") || "No measurements completed.");
      if (failures.length) setFilterError(`Some batch sizes could not be measured: ${failures.join("; ")}`);
    } catch (e) {
      setFilterError(e.message);
    } finally {
      setFilterRunning(false);
      setFilterProgress(null);
    }
  }
  return (
    <div>
      <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
        Select batch sizes, then run the test — nothing is plotted until the measurement actually completes.
      </p>
      <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginBottom: "0.6rem" }}>
        {BATCH_SIZE_OPTIONS.map((size) => (
          <button key={size} className={`filter-card${selected.has(size) ? " active" : ""}`} style={{ padding: "0.4rem 0.8rem" }} onClick={() => toggle(size)}>
            {size}
          </button>
        ))}
      </div>
      <button className="btn-primary" onClick={runTest} disabled={running || selected.size === 0}>
        {running ? "Running…" : "Run Batch Size Test"}
      </button>
      {error && <p style={{ color: "var(--error)", fontSize: "0.82rem" }}>{error}</p>}
      {rows && (
        <>
          <ProvenanceBadge kind="LIVE" />
          <h4>Throughput (images/second)</h4>
          {rows.map((r) => (
            <div key={r.requested_batch_size} style={{ marginBottom: "0.6rem" }}>
              <p style={{ margin: "0.2rem 0", fontSize: "0.8rem", color: "var(--muted)" }}>Batch size {r.effective_batch_size}</p>
              <BarChart
                bars={[
                  { label: "CPU", value: r.cpu_images_per_second, kind: "cpu" },
                  { label: "Basic CUDA", value: r.basic_images_per_second, kind: "basic" },
                  { label: "Enhanced CUDA", value: r.enhanced_images_per_second, kind: "enhanced" },
                ]}
                formatValue={(v) => `${v.toFixed(0)} img/s`}
              />
            </div>
          ))}
        </>
      )}

      <div className="filter-performance-explorer">
        <h3>Filter-wise performance</h3>
        <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
          Compare CPU, Basic CUDA, and Enhanced CUDA for all five filters across the batch-size sweep, including the default batch size of 512.
        </p>
        <button className="btn-primary" onClick={runFilterTest} disabled={filterRunning}>
          {filterRunning ? "Measuring filters…" : "Run Filter Performance Sweep"}
        </button>
        {filterProgress && <p className="filter-performance-progress">Measuring batch size {filterProgress.batchSize} ({filterProgress.completed + 1} of {filterProgress.total})…</p>}
        {filterError && <p style={{ color: "var(--error)", fontSize: "0.82rem" }}>{filterError}</p>}
        {filterMeasurements.length > 0 && (
          <>
            <ProvenanceBadge kind="LIVE" />
            <div className="filter-performance-result">
              <h4>Per-filter performance across batch sizes</h4>
              <p className="filter-performance-caption">Each chart shows CPU, Basic CUDA, and Enhanced CUDA kernel time. X axis: images processed. Y axis: measured kernel time in milliseconds. Each filter uses its own vertical scale.</p>
              <div className="filter-performance-charts">
                {FILTER_OPTIONS.map((filter) => (
                  <FilterPerformanceLineChart key={filter.id} measurements={filterMeasurements} filter={filter} />
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function Performance({ historical }) {
  return (
    <div className="page">
      <h1>Performance</h1>

      <h2><ProvenanceBadge kind="HISTORICAL" /> Canonical Benchmark</h2>
      <div className="section-historical">
        {historical?.benchmark_summary ? <HistoricalBenchmark benchmark={historical.benchmark_summary} /> : <p className="data-unavailable">Historical benchmark unavailable.</p>}
      </div>

      <h2><ProvenanceBadge kind="LIVE" /> Batch-Size Explorer</h2>
      <div className="section-live">
        <Why question="Why does batch size matter?">
          Every GPU call has fixed overhead — a kernel launch, a host-to-device transfer setup — that doesn't grow
          with batch size. Processing more images in one call amortizes that fixed cost across more work, so
          throughput (images/second) typically rises with batch size, up to whatever this GPU's actual free VRAM
          can safely hold at once (see the "adapt to VRAM" behavior on the Live Processing page for what happens
          past that point).
        </Why>
        <BatchSizeExplorer />
      </div>
    </div>
  );
}
