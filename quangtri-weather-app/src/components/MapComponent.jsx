import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import './MapComponent.css';
import WeatherChart from './WeatherChart';

function MapComponent() {
  const [selectedFeature, setSelectedFeature] = useState(null);
  const [weatherData, setWeatherData] = useState(null);
  const [weatherOW, setWeatherOW] = useState(null);
  const [weatherById, setWeatherById] = useState({});
  const [selectedDate, setSelectedDate] = useState('');
  const [geoData, setGeoData] = useState(null);

  const OPENWEATHER_KEY = '724acaddbed244f61b696130723cd9a3';

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

  const fetchWeather = async (center, date) => {
    const lat = center.lat;
    const lon = center.lng;
    const d = date || selectedDate;
    let urlMeteo = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,precipitation,windspeed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max&timezone=auto`;
    if (d) urlMeteo += `&start_date=${d}&end_date=${d}`;

    try {
      const res = await fetch(urlMeteo);
      const data = await res.json();
      setWeatherData(data);
    } catch (err) {
      console.error('Lỗi Open-Meteo:', err);
    }

    try {
      const res = await fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${OPENWEATHER_KEY}&units=metric`);
      const data = await res.json();
      setWeatherOW(data);
    } catch (err) {
      console.error('Lỗi OpenWeather:', err);
    }
  };

  const aggregateOWDaily = () => {
    if (!weatherOW?.list) return null;
    let tmax = -Infinity, tmin = Infinity, rainSum = 0, windSum = 0, count = 0;
    const todayStr = new Date().toISOString().split('T')[0];
    for (const item of weatherOW.list) {
      const dateStr = item.dt_txt.split(' ')[0];
      if (dateStr === todayStr) {
        const temp = item.main.temp;
        if (temp > tmax) tmax = temp;
        if (temp < tmin) tmin = temp;
        rainSum += item.rain?.['3h'] || 0;
        windSum += item.wind.speed;
        count++;
      }
    }
    if (count === 0) return null;
    return { tmax: tmax.toFixed(1), tmin: tmin.toFixed(1), rain: rainSum.toFixed(1), wind: (windSum / count).toFixed(1) };
  };

  const handleFeatureClick = async (e) => {
    const feature = e.target.feature;
    const center = e.target.getBounds().getCenter();
    const name = feature.properties.ten || feature.properties.Ten || feature.properties.name || 'Không rõ';
    setSelectedFeature({ center, name });
    setWeatherData(null);
    setWeatherOW(null);
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
    const owDaily = aggregateOWDaily();

    return (
      <Popup position={center}>
        <div style={{
          fontSize: '14px', fontWeight: 'bold', lineHeight: '1.6',
          color: '#333', border: '3px solid #2196f3', borderRadius: '8px',
          padding: '10px', background: '#f5f5f5',
          boxShadow: '0 2px 10px rgba(0,0,0,0.3)', minWidth: '200px'
        }}>
          <div style={{ fontSize: '16px', color: '#2196f3', marginBottom: '4px' }}>{name}</div>
          <div style={{ fontSize: '13px', marginBottom: '8px', fontWeight: 'normal' }}>
            Ngày dự báo: {selectedDate || 'Hôm nay'}
          </div>
          <div style={{ fontWeight: 'bold' }}>Trị số dự báo:</div>
          <div>🌡️ Tmax: {tmax}°C</div>
          <div>🌡️ Tmin: {tmin}°C</div>
          <div>☔ Mưa: {rain} mm</div>
          <div>💨 Gió: {(wind / 3.6).toFixed(1)} m/s</div>
          {owDaily && (
            <>
              <div style={{ fontWeight: 'bold', marginTop: '8px' }}>OpenWeather (Hôm nay):</div>
              <div>🌡️ Tmax: {owDaily.tmax}°C</div>
              <div>🌡️ Tmin: {owDaily.tmin}°C</div>
              <div>☔ Mưa: {owDaily.rain} mm</div>
              <div>💨 Gió TB: {owDaily.wind} m/s</div>
            </>
          )}
        </div>
      </Popup>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <h2 style={{ textAlign: 'center', padding: '8px', margin: 0, background: '#fff', borderBottom: '1px solid #ddd' }}>
        DỰ BÁO THỜI TIẾT CHO XÃ/PHƯỜNG TỈNH QUẢNG TRỊ
      </h2>

      <div style={{ flex: 1, position: 'relative' }}>
        {geoData ? (
          <MapContainer center={[16.75, 107.1]} zoom={8} className="responsive-map">
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <GeoJSON data={geoData} onEachFeature={onEachFeature} style={geoJsonStyle} key={JSON.stringify(weatherById)} />
            {renderPopup()}
          </MapContainer>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
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

