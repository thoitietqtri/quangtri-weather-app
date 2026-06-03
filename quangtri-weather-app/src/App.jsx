import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet'
import { useEffect, useState } from 'react'
import 'leaflet/dist/leaflet.css'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

function WeatherPopup({ data }) {
  if (!data) return null
  return (
    <div className="card">
      <h3>Dự báo 3 ngày</h3>
      <table>
        <thead><tr><th>Ngày</th><th>Nhiệt độ</th><th>Mưa</th><th>Gió</th></tr></thead>
        <tbody>
          {data.daily.time.map((d,i) => (
            <tr key={i}>
              <td>{d}</td>
              <td>{data.daily.temperature_2m_min[i]}–{data.daily.temperature_2m_max[i]}</td>
              <td>{data.daily.precipitation_sum[i]}</td>
              <td>{data.daily.windspeed_10m_max[i]}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h3>Biểu đồ nhiệt độ theo giờ</h3>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart
          data={data.hourly.time.map((t,i)=>({
            time:t.slice(11,16), temp:data.hourly.temperature_2m[i]
          }))}
        >
          <XAxis dataKey="time" />
          <YAxis />
          <Tooltip />
          <Line type="monotone" dataKey="temp" stroke="#f97316" dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export default function App() {
  const [geoData, setGeoData] = useState(null)
  const [weather, setWeather] = useState(null)

  useEffect(() => {
    fetch('/quangtri-weather-app/PX_QUANGTRI.geojson')
      .then(res => res.json())
      .then(setGeoData)
      .catch(err => console.error('GeoJSON error:', err))
  }, [])

  const onEach = (feature, layer) => {
    layer.on('click', () => {
      const c = layer.getBounds().getCenter()
      fetch(`https://api.open-meteo.com/v1/forecast?latitude=${c.lat}&longitude=${c.lng}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max&hourly=temperature_2m,precipitation&timezone=auto`)
        .then(r=>r.json())
        .then(setWeather)
    })
  }

  return (
    <div style={{width:'100vw', height:'100vh', display:'flex', overflow:'hidden'}}>
      <div style={{flex:1, position:'relative'}}>
        <MapContainer 
          center={[16.8, 107.1]} 
          zoom={9} 
          style={{width:'100%', height:'100%', position:'absolute', top:0, left:0}}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {geoData && <GeoJSON data={geoData} onEachFeature={onEach} />}
        </MapContainer>
      </div>
      {weather && (
        <div style={{width:400, overflowY:'auto', background:'white', zIndex:1000}}>
          <WeatherPopup data={weather} />
        </div>
      )}
    </div>
  )
}
