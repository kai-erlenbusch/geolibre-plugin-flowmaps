import Papa from "papaparse";

export async function loadFileData(file: File): Promise<{ data: any[], headers: string[], name: string }> {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';

  try {
    if (ext === 'csv') {
      return await loadCSV(file);
    } else if (ext === 'json' || ext === 'geojson') {
      return await loadJSON(file);
    } else if (ext === 'xlsx') {
      return await loadXLSX(file);
    } else {
      throw new Error(`Unsupported file type: .${ext}. Please upload a CSV, JSON, GeoJSON, or XLSX file.`);
    }
  } catch (error: any) {
    throw new Error(`Failed to parse file: ${error.message || 'Unknown error'}`);
  }
}

async function loadCSV(file: File): Promise<{ data: any[], headers: string[], name: string }> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      worker: true,
      complete: (results) => {
        if (results.meta.fields) {
          resolve({ data: results.data as any[], headers: results.meta.fields, name: file.name });
        } else {
          reject(new Error("Could not read headers from CSV."));
        }
      },
      error: (error) => {
        reject(error);
      }
    });
  });
}

async function loadJSON(file: File): Promise<{ data: any[], headers: string[], name: string }> {
  const text = await file.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new Error("Invalid JSON structure");
  }

  let data: any[] = [];

  if (Array.isArray(parsed)) {
    data = parsed;
  } else if (parsed && parsed.type === 'FeatureCollection' && Array.isArray(parsed.features)) {
    data = parsed.features.map((feature: any) => {
      const row: any = { ...feature.properties };
      if (feature.geometry) {
        if (feature.geometry.type === 'LineString' && Array.isArray(feature.geometry.coordinates)) {
          const coords = feature.geometry.coordinates;
          if (coords.length >= 2) {
            const start = coords[0];
            const end = coords[coords.length - 1];
            row.originLon = start[0];
            row.originLat = start[1];
            row.destLon = end[0];
            row.destLat = end[1];
          }
        } else if (feature.geometry.type === 'Point' && Array.isArray(feature.geometry.coordinates)) {
          const coords = feature.geometry.coordinates;
          row.originLon = coords[0];
          row.originLat = coords[1];
        } else {
          // Unsupported geometry type, just keep properties
        }
      }
      return row;
    });
  } else {
    throw new Error("JSON file must contain an array of objects or a GeoJSON FeatureCollection.");
  }

  if (data.length === 0) {
    throw new Error("No data found in the JSON file.");
  }

  // Extract headers
  const headersSet = new Set<string>();
  for (const row of data) {
    if (row && typeof row === 'object') {
      for (const key of Object.keys(row)) {
        headersSet.add(key);
      }
    }
  }

  return { data, headers: Array.from(headersSet), name: file.name };
}

async function loadXLSX(file: File): Promise<{ data: any[], headers: string[], name: string }> {
  let XLSX;
  try {
    XLSX = await import('xlsx');
  } catch (e) {
    throw new Error("Failed to load Excel parsing library.");
  }

  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error("No sheets found in the Excel workbook.");
  }

  const worksheet = workbook.Sheets[firstSheetName];
  const data = XLSX.utils.sheet_to_json(worksheet, { defval: null });

  if (data.length === 0) {
    throw new Error("No data found in the Excel sheet.");
  }

  const headersSet = new Set<string>();
  for (const row of data) {
    if (row && typeof row === 'object') {
      for (const key of Object.keys(row)) {
        headersSet.add(key);
      }
    }
  }

  return { data, headers: Array.from(headersSet), name: file.name };
}
