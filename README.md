# Flowmaps.gl Plugin for GeoLibre

A powerful plugin for visualizing origin-destination data in GeoLibre using [flowmap.gl](https://flowmap.gl/). This plugin allows you to seamlessly explore mobility, migration, and other flow data with high-performance WebGL rendering.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- **Origin-Destination Mapping**: Leverages flowmap.gl to render tens of thousands of dynamic flow lines on your map.
- **Time-Series Analysis**: Built-in time slider to dynamically filter flows by timestamp.
- **Custom Dataset Support**: Drag and drop your own Flow, Location, and Time CSVs directly into the configuration panel.
- **GeoLibre Integration**: Fully integrates with GeoLibre Desktop's native Right Panel UI and automatically registers toolbar menus.
- **Demonstration Datasets**: Includes built-in demonstration data (e.g., Montreal Bixi Bike Shares) to get you started immediately.

## Data Formatting

When uploading your own datasets, ensure your CSV files follow the [flowmap.gl data format](https://flowmap.gl/docs/data-format):

> **Tip:** Make sure your Locations dataset contains Origin and Destination IDs, plus Latitude and Longitude for each. Time-series flow datasets should include a timestamp column.

## Installation

### From the GeoLibre Marketplace (Recommended)

1. Open **GeoLibre Desktop**.
2. Go to **Settings > Plugins**.
3. Find **Flowmaps.gl** in the plugin registry and click Install.
4. Restart GeoLibre to load the plugin.

### Manual Installation (Development)

To build the plugin from source and install it into your local GeoLibre Desktop data directory:

```bash
# Clone the repository
git clone https://github.com/kai-erlenbusch/geolibre-plugin-flowmaps.git
cd geolibre-plugin-flowmaps

# Install dependencies
npm install

# Build and package the plugin bundle (.zip)
npm run package:geolibre

# Install directly into GeoLibre Desktop (auto-scanned on startup)
npm run install:geolibre
```

Restart GeoLibre Desktop. The plugin will be available under the Plugins toolbar menu.

## Development

This plugin is built using the GeoLibre Plugin Template and uses React, Vite, and MapLibre GL JS.

```bash
# Start development server
npm run dev

# Run tests
npm run test

# Lint and Format
npm run lint
npm run format
```

### Architecture

- `src/lib/geolibre/right-panel.tsx`: The primary configuration UI that docks in GeoLibre.
- `src/lib/components/TimelineOverlay.tsx`: The time slider overlay that communicates temporal bounds to the map layer.
- `src/lib/core/PluginControl.ts`: The core MapLibre control that interfaces with GeoLibre's API.

## Acknowledgements

This plugin wraps the excellent [flowmap.gl](https://flowmap.gl/) library created by the vis.gl community.
- Website: https://flowmap.gl/
- GitHub: https://github.com/visgl/flowmap.gl

## License

MIT License - see [LICENSE](LICENSE) for details.
