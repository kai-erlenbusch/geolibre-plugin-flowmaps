import * as React from 'react';
import type { PluginState } from '../core/types';

export function TimelineOverlay({ state, updatePluginState }: { state: PluginState, updatePluginState: (updates: Partial<PluginState>) => void }) {
  const [isPlaying, setIsPlaying] = React.useState(false);
  const timeFilterRef = React.useRef<[number, number] | undefined>(state.timeFilter);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [dragState, setDragState] = React.useState<'none' | 'left' | 'right' | 'center'>('none');
  const dragOffsetRef = React.useRef<number>(0);

  React.useEffect(() => {
    timeFilterRef.current = state.timeFilter;
  }, [state.timeFilter]);

  const timeData = React.useMemo(() => {
    if (!state.data || !state.data.flows || state.data.flows.length === 0) return null;
    let minTime = Infinity;
    let maxTime = -Infinity;
    for (const f of state.data.flows) {
      if (f.time !== undefined && !isNaN(f.time)) {
        if (f.time < minTime) minTime = f.time;
        if (f.time > maxTime) maxTime = f.time;
      }
    }
    if (minTime === Infinity) return null;
    
    const span = maxTime - minTime;
    const numBuckets = 100;
    const buckets = new Array(numBuckets).fill(0);
    
    if (span > 0) {
      for (const f of state.data.flows) {
        if (f.time !== undefined && !isNaN(f.time)) {
          let idx = Math.floor(((f.time - minTime) / span) * numBuckets);
          if (idx >= numBuckets) idx = numBuckets - 1;
          buckets[idx] += f.count || 1;
        }
      }
    }
    
    const maxBucket = Math.max(...buckets, 1);
    
    return { minTime, maxTime, span, buckets, maxBucket };
  }, [state.data]);

  React.useEffect(() => {
    if (!timeData) return;
    const tf = state.timeFilter;
    if (!tf || tf[0] < timeData.minTime || tf[1] > timeData.maxTime) {
      if (timeData.span === 0) {
        updatePluginState({ timeFilter: [timeData.minTime, timeData.minTime] });
      } else {
        const windowSize = Math.max(1, timeData.span * 0.1);
        updatePluginState({ timeFilter: [timeData.minTime, timeData.minTime + windowSize] });
      }
    }
  }, [timeData, state.timeFilter, updatePluginState]);

  React.useEffect(() => {
    if (!isPlaying || !timeData) return;
    const step = Math.max(1, timeData.span * 0.005);
    
    const interval = setInterval(() => {
      const current = timeFilterRef.current;
      if (!current) return;
      const windowSize = current[1] - current[0];
      let nextStart = current[0] + step;
      let nextEnd = nextStart + windowSize;
      
      if (nextEnd > timeData.maxTime) {
        nextStart = timeData.minTime;
        nextEnd = nextStart + windowSize;
      }
      updatePluginState({ timeFilter: [nextStart, nextEnd] });
    }, 100);
    return () => clearInterval(interval);
  }, [isPlaying, timeData, updatePluginState]);

  const handlePointerDown = (e: React.PointerEvent, type: 'left' | 'right' | 'center') => {
    if (!containerRef.current || !state.timeFilter || !timeData) return;
    e.preventDefault();
    setDragState(type);
    
    const rect = containerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickTime = timeData.minTime + (clickX / rect.width) * timeData.span;
    
    if (type === 'center') {
      dragOffsetRef.current = clickTime - state.timeFilter[0];
    }
  };

  React.useEffect(() => {
    if (dragState === 'none') return;
    
    const handlePointerMove = (e: PointerEvent) => {
      if (!containerRef.current || !timeData || !state.timeFilter) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
      const time = timeData.minTime + (x / rect.width) * timeData.span;
      
      const [start, end] = state.timeFilter;
      const minWin = timeData.span * 0.001; // minimum 0.1% window
      
      if (dragState === 'left') {
        updatePluginState({ timeFilter: [Math.min(time, end - minWin), end] });
      } else if (dragState === 'right') {
        updatePluginState({ timeFilter: [start, Math.max(time, start + minWin)] });
      } else if (dragState === 'center') {
        const windowSize = end - start;
        let newStart = time - dragOffsetRef.current;
        let newEnd = newStart + windowSize;
        
        if (newStart < timeData.minTime) {
          newStart = timeData.minTime;
          newEnd = newStart + windowSize;
        }
        if (newEnd > timeData.maxTime) {
          newEnd = timeData.maxTime;
          newStart = newEnd - windowSize;
        }
        
        updatePluginState({ timeFilter: [newStart, newEnd] });
      }
    };
    
    const handlePointerUp = () => {
      setDragState('none');
    };
    
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [dragState, state.timeFilter, timeData, updatePluginState]);

  if (!timeData) return null;

  const currentWindowSize = state.timeFilter ? state.timeFilter[1] - state.timeFilter[0] : 0;
  const currentStart = state.timeFilter ? state.timeFilter[0] : timeData.minTime;
  
  const startPct = timeData.span > 0 ? ((currentStart - timeData.minTime) / timeData.span) * 100 : 0;
  const widthPct = timeData.span > 0 ? (currentWindowSize / timeData.span) * 100 : 100;

  return (
    <div style={{
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: '100px',
      backgroundColor: 'rgba(15, 23, 36, 0.9)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 20px',
      zIndex: 10,
      color: 'white',
      fontFamily: 'sans-serif',
      borderTop: '1px solid rgba(255,255,255,0.1)',
      userSelect: 'none'
    }}>
      <button 
        onClick={() => setIsPlaying(!isPlaying)}
        style={{
          background: 'none',
          border: 'none',
          color: 'white',
          cursor: 'pointer',
          padding: '10px',
          marginRight: '15px'
        }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
          {isPlaying ? (
            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
          ) : (
            <path d="M8 5v14l11-7z"/>
          )}
        </svg>
      </button>

      <div 
        ref={containerRef}
        style={{ flex: 1, position: 'relative', height: '60px', marginLeft: '10px', marginRight: '20px' }}
      >
        {/* Histogram SVG */}
        <svg width="100%" height="100%" preserveAspectRatio="none" style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
          {timeData.buckets.map((count, i) => {
            const heightPct = (count / timeData.maxBucket) * 100;
            return (
              <rect 
                key={i}
                x={`${i}%`}
                y={`${100 - heightPct}%`}
                width="1%"
                height={`${heightPct}%`}
                fill="#4a90e2"
                opacity={0.6}
              />
            );
          })}
        </svg>
        
        {/* Scrubber window */}
        <div 
          onPointerDown={(e) => handlePointerDown(e, 'center')}
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: `${startPct}%`,
            width: `${widthPct}%`,
            backgroundColor: 'rgba(74, 144, 226, 0.2)',
            cursor: dragState === 'center' ? 'grabbing' : 'grab',
            pointerEvents: 'auto'
          }}
        >
          {/* Left Handle */}
          <div
            onPointerDown={(e) => { e.stopPropagation(); handlePointerDown(e, 'left'); }}
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: '16px',
              cursor: 'ew-resize',
              zIndex: 2,
              transform: 'translateX(-50%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <div style={{ width: '4px', height: '24px', backgroundColor: '#fff', borderRadius: '2px', boxShadow: '0 0 2px rgba(0,0,0,0.5)' }} />
          </div>
          {/* Right Handle */}
          <div
            onPointerDown={(e) => { e.stopPropagation(); handlePointerDown(e, 'right'); }}
            style={{
              position: 'absolute',
              right: 0,
              top: 0,
              bottom: 0,
              width: '16px',
              cursor: 'ew-resize',
              zIndex: 2,
              transform: 'translateX(50%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <div style={{ width: '4px', height: '24px', backgroundColor: '#fff', borderRadius: '2px', boxShadow: '0 0 2px rgba(0,0,0,0.5)' }} />
          </div>
        </div>
        
        {/* Time labels */}
        <div style={{ position: 'absolute', bottom: '-20px', left: 0, fontSize: '11px', color: '#888' }}>
          {new Date(timeData.minTime).toLocaleString()}
        </div>
        <div style={{ position: 'absolute', bottom: '-20px', right: 0, fontSize: '11px', color: '#888' }}>
          {new Date(timeData.maxTime).toLocaleString()}
        </div>
      </div>
      
      <div style={{ fontSize: '12px', minWidth: '150px', textAlign: 'right' }}>
        <div>{new Date(currentStart).toLocaleString()}</div>
        <div style={{ color: '#888' }}>to</div>
        <div>{new Date(currentStart + currentWindowSize).toLocaleString()}</div>
      </div>
    </div>
  );
}
