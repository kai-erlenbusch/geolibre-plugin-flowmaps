import pandas as pd

print('Reading flows.parquet...')
flows = pd.read_parquet(r'C:\Users\erlen\Downloads\flows.parquet')
flows['origin'] = flows['origin'].astype(str)
flows['dest'] = flows['dest'].astype(str)

print('Reading locations.parquet...')
locations = pd.read_parquet(r'C:\Users\erlen\Downloads\locations.parquet')
locations['id'] = locations['id'].astype(str)

print('Merging data...')
merged = flows.merge(locations, left_on='origin', right_on='id', suffixes=('', '_drop'))
merged = merged.rename(columns={'lon': 'originLon', 'lat': 'originLat', 'name': 'originName'})
if 'id' in merged.columns:
    merged = merged.drop(columns=['id'])

merged = merged.merge(locations, left_on='dest', right_on='id', suffixes=('', '_drop'))
merged = merged.rename(columns={'lon': 'destLon', 'lat': 'destLat', 'name': 'destName'})
if 'id' in merged.columns:
    merged = merged.drop(columns=['id'])

print('Saving to montreal-bixi-flat.csv...')
merged.to_csv(r'D:\exploratory\geolibre\geolibre-plugin-flowmaps\montreal-bixi-flat.csv', index=False)
print('Done!')
