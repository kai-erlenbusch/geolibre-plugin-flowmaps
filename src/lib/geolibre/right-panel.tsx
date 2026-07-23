import * as React from "react";
import { createRoot, Root } from "react-dom/client";
import type { GeoLibreAppAPI, GeoLibreControl } from "./host-api";
import type { PluginControl } from "../core/PluginControl";
import { sampleDatasets } from "../../samples";
import type { PluginState, ColorScheme } from "../core/types";
import { COLOR_SCHEMES } from "../core/types";
import { mapSingleCsvToFlowmapData, guessColumnMapping, ColumnMapping } from "../utils/csv-parser";
import { loadFileData } from "../utils/file-loader";
import { Leva, useControls, folder, useCreateStore } from "leva";

export const RIGHT_PANEL_ID = "geolibre-plugin-flowmaps-workbench";


const LevaControls = ({ state, updatePluginState, dataBounds }: { state: PluginState, updatePluginState: (updates: Partial<PluginState>) => void, dataBounds: { minCount: number, maxCount: number, totalFlows: number } }) => {
  const store = useCreateStore();

  useControls(() => ({
    Controls: folder({
      darkMode: { value: state.darkMode, onChange: (v) => updatePluginState({ darkMode: v }) },
      colorScheme: { options: [...COLOR_SCHEMES], value: state.colorScheme, onChange: (v) => updatePluginState({ colorScheme: v as ColorScheme }) },
      highlightColor: { value: state.highlightColor, onChange: (v) => updatePluginState({ highlightColor: v }) },
      animationEnabled: { value: state.animationEnabled, onChange: (v) => updatePluginState({ animationEnabled: v }) },
      flowLineThicknessScale: { value: state.flowLineThicknessScale, min: 0, max: 10, step: 0.1, onChange: (v) => updatePluginState({ flowLineThicknessScale: v }) },
      adaptiveScalesEnabled: { value: state.adaptiveScalesEnabled, onChange: (v) => updatePluginState({ adaptiveScalesEnabled: v }) },
      locationsEnabled: { value: state.locationsEnabled, onChange: (v) => updatePluginState({ locationsEnabled: v }) },
      locationTotalsEnabled: { value: state.locationTotalsEnabled, onChange: (v) => updatePluginState({ locationTotalsEnabled: v }) },
      locationLabelsEnabled: { value: state.locationLabelsEnabled, onChange: (v) => updatePluginState({ locationLabelsEnabled: v }) },
      flowEndpointsInViewportMode: { options: ['any', 'both', 'none'], value: state.flowEndpointsInViewportMode, onChange: (v) => updatePluginState({ flowEndpointsInViewportMode: v }) },
      volumeFilter: { value: state.volumeFilter || [dataBounds.minCount, dataBounds.maxCount], min: dataBounds.minCount, max: dataBounds.maxCount, step: 1, onChange: (v) => updatePluginState({ volumeFilter: v as [number, number] }) },
      maxTopFlowsDisplayNum: { value: state.maxTopFlowsDisplayNum, min: 0, max: Math.max(5000, dataBounds.totalFlows), step: 10, onChange: (v) => updatePluginState({ maxTopFlowsDisplayNum: v }) },
      opacity: { value: state.opacity, min: 0, max: 1, step: 0.05, onChange: (v) => updatePluginState({ opacity: v }) },
    }),
    Fade: folder({
      fadeEnabled: { value: state.fadeEnabled, onChange: (v) => updatePluginState({ fadeEnabled: v }) },
      fadeOpacityEnabled: { value: state.fadeOpacityEnabled, onChange: (v) => updatePluginState({ fadeOpacityEnabled: v }) },
      fadeAmount: { value: state.fadeAmount, min: 0, max: 100, step: 1, onChange: (v) => updatePluginState({ fadeAmount: v }) },
    }),
    Clustering: folder({
      clusteringEnabled: { value: state.clusteringEnabled, onChange: (v) => updatePluginState({ clusteringEnabled: v }) },
      clusteringAuto: { value: state.clusteringAuto, onChange: (v) => updatePluginState({ clusteringAuto: v }) },
      clusteringLevel: { value: state.clusteringLevel, min: 1, max: 10, step: 1, onChange: (v) => updatePluginState({ clusteringLevel: v }) },
    })
  }), { store }, [dataBounds]);

  return (
    <div style={{ marginTop: 10, position: 'relative', zIndex: 1, paddingBottom: 20 }}>
      {/* @ts-ignore - Leva store prop typing is missing in older versions but works in runtime */}
      <Leva store={store} flat fill titleBar={false} hideCopyButton />
    </div>
  );
};

export function FlowmapConfigPanel({ control }: { control: PluginControl }) {
  const [activeSample, setActiveSample] = React.useState<string>("montrealBixi");
  const activeSampleRef = React.useRef("montrealBixi");
  const [fileName, setFileName] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [pendingUpload, setPendingUpload] = React.useState<{data: any[], headers: string[], name: string} | null>(null);
  const [mapping, setMapping] = React.useState<Partial<ColumnMapping>>({});

  const [state, setState] = React.useState<PluginState>(() => control.getState() as PluginState);
  
  React.useEffect(() => {
    // Load montreal bixi on first render if no data exists
    if (!state.data?.flows?.length) {
      // Small timeout to allow initial render to settle
      setTimeout(() => {
        loadSample("montrealBixi");
      }, 50);
    }
  }, []);
  
  const dataBounds = React.useMemo(() => {
    if (!state.data || !state.data.flows || state.data.flows.length === 0) {
      return { minCount: 0, maxCount: 100, totalFlows: 0 };
    }
    let minCount = Infinity;
    let maxCount = -Infinity;
    for (const f of state.data.flows) {
      if (f.count < minCount) minCount = f.count;
      if (f.count > maxCount) maxCount = f.count;
    }
    if (minCount === Infinity) minCount = 0;
    if (maxCount === -Infinity) maxCount = 100;
    return { minCount, maxCount, totalFlows: state.data.flows.length };
  }, [state.data]);


  React.useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let latestState: PluginState | null = null;
    
    const handler = (event: any) => {
      latestState = event.state as PluginState;
      if (!timeoutId) {
        timeoutId = setTimeout(() => {
          if (latestState) {
            setState(latestState);
            latestState = null;
          }
          timeoutId = null;
        }, 100);
      }
    };
    control.on('statechange', handler);
    return () => {
      control.off('statechange', handler);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [control]);

  const updateTimeoutRef = React.useRef<number | null>(null);
  const pendingUpdatesRef = React.useRef<Partial<PluginState>>({});

  const updatePluginState = React.useCallback((updates: Partial<PluginState>) => {
    pendingUpdatesRef.current = { ...pendingUpdatesRef.current, ...updates };
    if (!updateTimeoutRef.current) {
      updateTimeoutRef.current = window.setTimeout(() => {
        control.setState(pendingUpdatesRef.current);
        pendingUpdatesRef.current = {};
        updateTimeoutRef.current = null;
      }, 50); // 50ms debounce/throttle
    }
  }, [control]);

  const processFile = async (file: File) => {
    setActiveSample("custom");
    setError("");
    try {
      const results = await loadFileData(file);
      const guessed = guessColumnMapping(results.headers);
      setPendingUpload({ data: results.data, headers: results.headers, name: results.name });
      setMapping(guessed);
    } catch (err: any) {
      setError(err.message);
    }
  };



  const [isDragging, setIsDragging] = React.useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const loadSample = async (sampleId: string) => {
    setActiveSample(sampleId);
    activeSampleRef.current = sampleId;
    
    if (sampleId === "montrealBixi") {
      setFileName("Montreal BIXI Demo");
      setError("Loading Montreal BIXI data... this might take a moment.");
      
      try {
        let response = await fetch('/plugins/geolibre-plugin-flowmaps/dist/montreal-bixi-flat.csv');
        if (!response.ok) {
           response = await fetch('/plugins/geolibre-plugin-flowmaps/montreal-bixi-flat.csv');
        }
        if (!response.ok) {
           response = await fetch('/geolibre-plugin-flowmaps/montreal-bixi-flat.csv');
        }
        if (!response.ok) {
           throw new Error("Could not fetch local demo file");
        }
        const blob = await response.blob();
        const file = new File([blob], "montreal-bixi-flat.csv", { type: "text/csv" });
        const results = await loadFileData(file);
        const mapping = guessColumnMapping(results.headers);
        const { locations, flows } = mapSingleCsvToFlowmapData(results.data, mapping as ColumnMapping);
        if (activeSampleRef.current !== sampleId) return;
        setError(null);
        setPendingUpload(null);
        control.setState({ data: { locations, flows }, timeFilter: undefined, volumeFilter: undefined });
      } catch (err: any) {
        if (activeSampleRef.current !== sampleId) return;
        setError("Failed to load Montreal BIXI: " + err.message);
        setActiveSample("custom");
      }
    } else if (sampleId !== "custom" && sampleDatasets[sampleId]) {
      try {
        setFileName(sampleId);
        setError("Loading " + sampleId + "...");
        const file = new File([sampleDatasets[sampleId]], `${sampleId}.csv`, { type: "text/csv" });
        const results = await loadFileData(file);
        const mapping = guessColumnMapping(results.headers);
        const { locations, flows } = mapSingleCsvToFlowmapData(results.data, mapping as ColumnMapping);
        if (activeSampleRef.current !== sampleId) return;
        setError(null);
        setPendingUpload(null);
        control.setState({ data: { locations, flows }, timeFilter: undefined, volumeFilter: undefined });
      } catch (err: any) {
        if (activeSampleRef.current !== sampleId) return;
        setError("Failed to load sample: " + err.message);
        setActiveSample("custom");
      }
    } else {
      if (activeSampleRef.current !== sampleId) return;
      // Clear data for "custom"
      setFileName(null);
      setError(null);
      setPendingUpload(null);
      control.setState({ data: { locations: [], flows: [] }, timeFilter: undefined, volumeFilter: undefined });
    }
  };

  const handleSampleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    loadSample(e.target.value);
  };

  const hasData = state.data != null && state.data.flows != null && state.data.locations != null;

  return (
    <div className="flowmaps-panel" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <h2>Flowmaps.gl Configuration</h2>
      
      <div className="control-group">
        <label>Dataset</label>
        <select value={activeSample} onChange={handleSampleChange} className="select-input">
          <option value="custom">Custom Upload</option>
          <option value="swissCommuting">Swiss Commuting Sample</option>
          <option value="globalFlights">Global Flights Sample</option>
          <option value="montrealBixi">Montreal BIXI Demo</option>
        </select>
        
        {activeSample === "custom" && (
          <>
            <div 
              className={`drop-zone ${isDragging ? 'dragging' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <input type="file" accept=".csv,.json,.geojson,.xlsx" onChange={handleFileUpload} />
              <p>Drag & Drop file here<br/><small>(CSV, JSON, GeoJSON, XLSX)</small></p>
            </div>
            <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-muted, #888)' }}>
              <p style={{ marginBottom: 4 }}><strong>Tip:</strong> Make sure your data contains Origin and Destination IDs, plus Latitude and Longitude for each.</p>
              <p style={{ marginBottom: 4 }}><strong>Time Series:</strong> Include a time column (e.g., ISO timestamp) to enable the timeline slider.</p>
              <p style={{ marginBottom: 4 }}>Demonstration datasets available in the dropdown.</p>
              <p>See <a href="https://flowmap.gl/docs/data-format" target="_blank" rel="noreferrer" style={{ color: 'var(--primary-color, #4facfe)' }}>flowmap.gl data formats</a> for details.</p>
            </div>
          </>
        )}
        
        {error && <p className="error-text" style={{color: 'red'}}>{error}</p>}
        {fileName && !error && hasData && !pendingUpload && (
          <p className="success-text" style={{color: 'green'}}>
            Loaded {state.data.flows.length} routes across {state.data.locations.length} locations
          </p>
        )}
      </div>

      {pendingUpload && (
        <div style={{ marginTop: 20, padding: 15, border: '1px solid #ccc', borderRadius: 4 }}>
          <h3>Data Mapping</h3>
          <p style={{fontSize: 12, marginBottom: 15}}>Map your CSV columns to Flowmap properties.</p>
          
          <div style={{display: 'flex', flexDirection: 'column', gap: 10}}>
            {Object.entries({
              origin: 'Origin ID *',
              dest: 'Destination ID *',
              originLon: 'Origin Longitude *',
              originLat: 'Origin Latitude *',
              destLon: 'Destination Longitude *',
              destLat: 'Destination Latitude *',
              count: 'Count / Volume',
              originName: 'Origin Name',
              destName: 'Destination Name',
              time: 'Time Column (Optional)'
            }).map(([key, label]) => (
              <div key={key} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <label style={{fontSize: 12}}>{label}</label>
                <select 
                  className="select-input"
                  value={(mapping as any)[key] || ""} 
                  onChange={(e) => setMapping(prev => ({...prev, [key]: e.target.value}))}
                  style={{width: 150, padding: 4, fontSize: 12}}
                >
                  <option value="">{key === 'count' ? '(None - Default to 1)' : key === 'time' ? '(None)' : '(Select)'}</option>
                  {pendingUpload.headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            ))}
          </div>

          <button 
            style={{marginTop: 20, width: '100%', padding: 8, cursor: 'pointer'}}
            onClick={() => {
              if (!mapping.origin || !mapping.dest || !mapping.originLon || !mapping.originLat || !mapping.destLon || !mapping.destLat) {
                setError("Please select all required fields (marked with *).");
                return;
              }
              try {
                const { locations, flows } = mapSingleCsvToFlowmapData(pendingUpload.data, mapping as ColumnMapping);
                if (flows.length === 0) {
                  setError("No valid flows found with this mapping.");
                } else {
                  setFileName(pendingUpload.name);
                  setDataKey(prev => prev + 1);
                  control.setState({ data: { locations, flows }, timeFilter: undefined, volumeFilter: undefined });
                  setPendingUpload(null);
                  setError(null);
                }
              } catch(e: any) {
                setError(e.message);
              }
            }}
          >
            Apply Mapping
          </button>
        </div>
      )}

      {hasData && !pendingUpload && (
        <div style={{ flex: 1, overflow: 'auto' }}>
          <LevaControls key={state.data?.locations?.[0]?.id ? `data-${state.data.locations[0].id}` : 'empty'} state={state} updatePluginState={updatePluginState} dataBounds={dataBounds} />
        </div>
      )}

      <div style={{ padding: '10px 0', marginTop: 'auto', borderTop: '1px solid var(--border-color, #333)', fontSize: 11, color: 'var(--text-muted, #888)', textAlign: 'center' }}>
        Powered by <a href="https://flowmap.gl/" target="_blank" rel="noreferrer" style={{ color: 'var(--primary-color, #4facfe)', textDecoration: 'none' }}>Flowmap.gl</a> | 
        <a href="https://github.com/visgl/flowmap.gl" target="_blank" rel="noreferrer" style={{ color: 'var(--primary-color, #4facfe)', marginLeft: 4, textDecoration: 'none' }}>GitHub</a>
      </div>
    </div>
  );
}

export function registerFlowmapRightPanel<TControl extends GeoLibreControl>(
  app: GeoLibreAppAPI<TControl>,
  control: PluginControl
): (() => void) | null {
  if (!app.registerRightPanel) return null;

  let root: Root | null = null;

  const unregister = app.registerRightPanel({
    id: RIGHT_PANEL_ID,
    title: "Flowmaps",
    defaultWidth: 320,
    render(container) {
      root = createRoot(container);
      root.render(<FlowmapConfigPanel control={control} />);

      return () => {
        root?.unmount();
      };
    },
  });

  app.openRightPanel?.(RIGHT_PANEL_ID);

  return () => {
    app.closeRightPanel?.(RIGHT_PANEL_ID);
    unregister();
  };
}
