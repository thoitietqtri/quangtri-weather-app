import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import './MapComponent.css';
import WeatherChart from './WeatherChart';

function getCanhBao(tmax, tmin, wind, rain) {
  const warnings = [];

  if (tmax >= 38) warnings.push({ text: '🔥 Cảnh báo nắng nóng gay gắt', color: '#cc0000' });
  else if (tmax >= 35) warnings.push({ text: '☀️ Cảnh báo nắng nóng', color: '#ff6600' });

  if (tmin < 13) warnings.push({ text: '🥶 Cảnh báo rét hại', color: '#0000cc' });
  else if (tmin < 15) warnings.push({ text: '❄️ Cảnh báo rét đậm', color: '#3399ff' });

  if (wind > 16) warnings.push({ text: '🌊 Cảnh báo gió mạnh, sóng lớn trên biển', color: '#6600cc' });

  if (rain > 200) warnings.push({ text: '🌊 Cảnh báo sạt lở đất, ngập lụt vùng trũng thấp và hạ du các sông', color: '#cc0066' });
  else if (rain > 100) warnings.push({ text: '⚠️ Cảnh báo sạt lở đất', color: '#cc6600' });

  return warnings;
}

function MapComponent() {
  const [selectedFeature, setSelectedFeature] = useState(null);
  const [weatherData, setWeatherData] = useState(null);
  const [weatherById, setWeatherById] = useState({});
  const [selectedDate, setSelectedDate] = useState('');
  const [geoData, setGeoData] = useState(null);

  useEffect(() => {
    fetch('/quangtri-weather-app/PX_QUANGTRI.geojson')
      .then(r => r.json())
      .then(data => {
        setGeoData(data);
        fetchAllWeather(data);
      })
      .catch(err => console.error('GeoJSON error:', err));
  }, []);

  const fetchAllWeather = async (data) => {
    const results = {};
    for (const feature of data.features) {
      const name = feature.properties.ten || feature.properties.Ten || feature.properties.name || '';
      const layer = L.geoJSON(feature);
      const center = layer.getBounds().getCenter();
      try {
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${center.lat}&longitude=${center.lng}&daily=temperature_2m_max&timezone=auto`);
        const d = await res.json();
        results[name] = d.daily?.temperature_2m_max?.[0] || null;
      } catch {
        results[name] = null;
      }
    }
    setWeatherById(results);
  };

  const getColorByTemperature = (temp) => {
    if (temp == null) return '#ccc';
    if (temp > 37) return '#ff0000';
    if (temp > 33) return '#ff8000';
    if (temp > 28) return '#ffff00';
    if (temp > 22) return '#80ff00';
    return '#00ffff';
  };

  const geoJsonStyle = (feature) => {
    const name = feature.properties.ten || feature.properties.Ten || feature.properties.name || '';
    const temp = weatherById[name];
    return { color: '#000', weight: 1, fillColor: getColorByTemperature(temp), fillOpacity: 0.6 };
  };

  const fetchWeather = async (center) => {
    const lat = center.lat;
    const lon = center.lng;
    let urlMeteo = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,precipitation,windspeed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max&timezone=auto`;
    if (selectedDate) urlMeteo += `&start_date=${selectedDate}&end_date=${selectedDate}`;
    try {
      const res = await fetch(urlMeteo);
      const data = await res.json();
      setWeatherData(data);
    } catch (err) {
      console.error('Lỗi Open-Meteo:', err);
    }
  };

  const handleFeatureClick = async (e) => {
    const feature = e.target.feature;
    const center = e.target.getBounds().getCenter();
    const name = feature.properties.ten || feature.properties.Ten || feature.properties.name || 'Không rõ';
    setSelectedFeature({ center, name });
    setWeatherData(null);
    await fetchWeather(center);
  };

  const onEachFeature = (feature, layer) => {
    layer.on({ click: handleFeatureClick });
  };

  const handleRefresh = () => {
    if (selectedFeature) fetchWeather(selectedFeature.center);
  };

  const renderPopup = () => {
    if (!selectedFeature) return null;
    if (!weatherData?.daily) {
      return (
        <Popup position={selectedFeature.center}>
          <div style={{ padding: '10px' }}>⏳ Đang tải dữ liệu...</div>
        </Popup>
      );
    }
    const { center, name } = selectedFeature;
    const daily = weatherData.daily;
    const tmax = daily.temperature_2m_max[0];
    const tmin = daily.temperature_2m_min[0];
    const rain = daily.precipitation_sum[0];
    const wind = daily.windspeed_10m_max[0];
    const windMs = parseFloat((wind / 3.6).toFixed(1));
    const warnings = getCanhBao(tmax, tmin, windMs, rain);

    return (
      <Popup position={center}>
        <div style={{
          fontSize: '14px', fontWeight: 'bold', lineHeight: '1.7',
          color: '#333', border: '3px solid #2196f3', borderRadius: '8px',
          padding: '10px', background: '#f5f5f5',
          boxShadow: '0 2px 10px rgba(0,0,0,0.3)', minWidth: '220px'
        }}>
          <div style={{ fontSize: '16px', color: '#2196f3', marginBottom: '4px' }}>{name}</div>
          <div style={{ fontSize: '13px', marginBottom: '8px', fontWeight: 'normal' }}>
            Ngày dự báo: {selectedDate || 'Hôm nay'}
          </div>

          <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>Trị số dự báo:</div>
          <div>🌡️ Tmax: {tmax}°C</div>
          <div>🌡️ Tmin: {tmin}°C</div>
          <div>☔ Mưa: {rain} mm</div>
          <div>💨 Gió: {windMs} m/s</div>

          {warnings.length > 0 && (
            <div style={{
              marginTop: '10px', padding: '8px',
              background: '#fff3cd', borderRadius: '6px',
              border: '1px solid #ffc107'
            }}>
              <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>⚠️ Cảnh báo thiên tai:</div>
              {warnings.map((w, i) => (
                <div key={i} style={{ color: w.color, fontWeight: 'bold', fontSize: '13px' }}>{w.text}</div>
              ))}
            </div>
          )}

          {warnings.length === 0 && (
            <div style={{
              marginTop: '10px', padding: '6px 8px',
              background: '#d4edda', borderRadius: '6px',
              border: '1px solid #28a745', color: '#155724',
              fontSize: '13px', fontWeight: 'bold'
            }}>
              ✅ Không có cảnh báo thiên tai
            </div>
          )}
        </div>
      </Popup>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <h2 style={{ textAlign: 'center', padding: '8px', margin: 0, background: '#fff', borderBottom: '1px solid #ddd' }}>
        DỰ BÁO THỜI TIẾT CHO XÃ/PHƯỜNG TỈNH QUẢNG TRỊ
      </h2>

      <div style={{ position: 'relative' }}>
        {geoData ? (
          <MapContainer center={[16.75, 107.1]} zoom={8} className="responsive-map">
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <GeoJSON data={geoData} onEachFeature={onEachFeature} style={geoJsonStyle} key={JSON.stringify(weatherById)} />
            {renderPopup()}
          </MapContainer>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '65vh' }}>
            ⏳ Đang tải bản đồ...
          </div>
        )}
      </div>

      <div style={{ padding: '10px', textAlign: 'center', background: '#fff', borderTop: '1px solid #ddd' }}>
        <div style={{ marginBottom: '8px', fontStyle: 'italic', fontWeight: 'bold', color: '#007bff' }}>
          Chọn ngày dự báo và nhớ click nút Làm mới
        </div>
        <button onClick={handleRefresh}>🔁 Làm mới</button>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          style={{ marginLeft: '10px' }}
        />
      </div>

      {weatherData?.hourly && (
        <div style={{ padding: '10px', background: '#fff' }}>
          <WeatherChart hourly={weatherData.hourly} regionName={selectedFeature?.name || ''} />
        </div>
      )}
    </div>
  );
}

export default MapComponent;
