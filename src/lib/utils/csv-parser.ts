export interface ColumnMapping {
  origin: string;
  dest: string;
  originLon: string;
  originLat: string;
  destLon: string;
  destLat: string;
  count?: string;
  originName?: string;
  destName?: string;
  time?: string;
}

/**
 * Guesses the column mapping from a list of headers
 */
export function guessColumnMapping(headers: string[]): Partial<ColumnMapping> {
  const mapping: Partial<ColumnMapping> = {};
  const lowerHeaders = headers.map(h => h.toLowerCase());
  
  const findMatch = (regex: RegExp) => headers.find((_, i) => regex.test(lowerHeaders[i]));

  mapping.origin = findMatch(/^(origin|start|source)(_id)?$/) || findMatch(/origin|start|source/);
  mapping.dest = findMatch(/^(dest|destination|end|target)(_id)?$/) || findMatch(/dest|end|target/);
  
  mapping.originLat = findMatch(/^(origin|start|source).*lat/) || findMatch(/^lat.*(origin|start|source)/);
  mapping.originLon = findMatch(/^(origin|start|source).*lon/) || findMatch(/^lon.*(origin|start|source)/);
  
  mapping.destLat = findMatch(/^(dest|destination|end|target).*lat/) || findMatch(/^lat.*(dest|end|target)/);
  mapping.destLon = findMatch(/^(dest|destination|end|target).*lon/) || findMatch(/^lon.*(dest|end|target)/);
  
  mapping.count = findMatch(/^(count|volume|weight|magnitude)$/) || findMatch(/count|volume/);
  mapping.originName = findMatch(/^(origin|start|source).*name/) || findMatch(/^name.*(origin|start|source)/);
  mapping.destName = findMatch(/^(dest|destination|end|target).*name/) || findMatch(/^name.*(dest|end|target)/);
  mapping.time = findMatch(/^(time|timestamp|date|datetime|hour)$/) || findMatch(/time|date/);
  
  if (!mapping.origin || !mapping.dest || !mapping.originLat || !mapping.originLon || !mapping.destLat || !mapping.destLon) {
    throw new Error("Could not determine required columns (origin, dest, and their lat/lon coordinates) from CSV headers. Please ensure your CSV has appropriately named columns.");
  }
  
  return mapping;
}

/**
 * Parses raw array of CSV row objects (where a single row contains both flow and coordinates)
 */
export function mapSingleCsvToFlowmapData(data: any[], mapping?: ColumnMapping): { locations: any[], flows: any[] } {
  const locationsMap = new Map();
  const flows = [];

  for (const row of data) {
    const oId = mapping ? row[mapping.origin] : row.origin;
    const dId = mapping ? row[mapping.dest] : row.dest;
    
    if (oId != null && dId != null) {
      const originId = String(oId);
      const destId = String(dId);
      
      const oLon = mapping ? row[mapping.originLon] : row.origin_lon;
      const oLat = mapping ? row[mapping.originLat] : row.origin_lat;
      const oName = mapping?.originName ? row[mapping.originName] : (row.origin_name || originId);
      
      if (oLon != null && oLat != null && !locationsMap.has(originId)) {
        locationsMap.set(originId, { id: originId, name: oName, lon: Number(oLon), lat: Number(oLat) });
      }
      
      const dLon = mapping ? row[mapping.destLon] : row.dest_lon;
      const dLat = mapping ? row[mapping.destLat] : row.dest_lat;
      const dName = mapping?.destName ? row[mapping.destName] : (row.dest_name || destId);

      if (dLon != null && dLat != null && !locationsMap.has(destId)) {
        locationsMap.set(destId, { id: destId, name: dName, lon: Number(dLon), lat: Number(dLat) });
      }

      let count = 1;
      if (mapping) {
        if (mapping.count && row[mapping.count] != null) {
          count = Number(row[mapping.count]);
        }
      } else if (row.count != null) {
        count = Number(row.count);
      }

      let time: number | undefined;
      if (mapping) {
        if (mapping.time && row[mapping.time] != null) {
          const tVal = row[mapping.time];
          if (typeof tVal === 'number') {
            time = tVal;
          } else {
            const parsed = Date.parse(String(tVal));
            if (!isNaN(parsed)) {
              time = parsed;
            } else {
              console.warn(`Could not parse time value: ${tVal}`);
            }
          }
        }
      } else if (row.time != null) {
        if (typeof row.time === 'number') {
          time = row.time;
        } else {
          const parsed = Date.parse(String(row.time));
          if (!isNaN(parsed)) {
            time = parsed;
          }
        }
      }

      const flow: any = {
        origin: originId,
        dest: destId,
        count
      };
      
      if (time !== undefined) {
        flow.time = time;
      }

      flows.push(flow);
    }
  }

  return { locations: Array.from(locationsMap.values()), flows };
}

/**
 * Parses dual arrays of CSV row objects (locations.csv and flows.csv separately)
 */
export function mapDualCsvToFlowmapData(locationsData: any[], flowData: any[]): { locations: any[], flows: any[] } {
  const locationsMap = new Map();
  
  for (const row of locationsData) {
    if (row.id != null && row.lat != null && row.lon != null) {
      locationsMap.set(String(row.id), { 
        id: String(row.id), 
        name: row.name || String(row.id), 
        lat: Number(row.lat), 
        lon: Number(row.lon) 
      });
    }
  }

  const flows = [];
  for (const row of flowData) {
    if (row.origin != null && row.dest != null) {
      const originId = String(row.origin);
      const destId = String(row.dest);
      if (locationsMap.has(originId) && locationsMap.has(destId)) {
        flows.push({
          origin: originId,
          dest: destId,
          count: Number(row.count || 1)
        });
      } else {
        console.warn(`Skipping flow due to missing location: ${originId} -> ${destId}`);
      }
    }
  }

  return { locations: Array.from(locationsMap.values()), flows };
}
