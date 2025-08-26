// (moved from original file)
// Keep type="text/babel" in the HTML because this file contains JSX.

const { useState, useEffect, useRef } = React;

function App() {
  const [page, setPage] = useState('home');
  const [formData, setFormData] = useState({ transport: '', energy: '', diet: 'omnivore' });
  const [industrialData, setIndustrialData] = useState({ electricity: '', fuel: '', waste: '' });
  const [cityData, setCityData] = useState({ population: '', transport: '', buildings: '' });
  const [results, setResults] = useState(null);
  const [history, setHistory] = useState([]);
  const pieChartRef = useRef(null);
  const barChartRef = useRef(null);
  let pieChart, barChart;

  useEffect(() => {
    const stored = localStorage.getItem('carbonHistory');
    if (stored) setHistory(JSON.parse(stored));
  }, []);

  useEffect(() => {
    localStorage.setItem('carbonHistory', JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    const handler = () => setPage(window.__page || 'home');
    window.addEventListener('pageChange', handler);
    return () => window.removeEventListener('pageChange', handler);
  }, []);

  const EMISSION_FACTORS = {
    transport: 0.21,
    energy: 0.475,
    diet: { vegan: 2.5, vegetarian: 3.0, omnivore: 5.0, heavy_meat: 7.0 },
    industrial: { electricity: 0.5, fuel: 2.3, waste: 1.2 },
    city: { transport: 0.15, buildings: 0.2 }
  };

  const handleChange = (e, setFunc, state) => {
    setFunc({ ...state, [e.target.name]: e.target.value });
  };

  const handleSubmitPersonal = (e) => {
    e.preventDefault();
    const transportCO2 = parseFloat(formData.transport || 0) * EMISSION_FACTORS.transport;
    const energyCO2 = parseFloat(formData.energy || 0) * EMISSION_FACTORS.energy;
    const dietCO2 = EMISSION_FACTORS.diet[formData.diet];
    const total = (transportCO2 + energyCO2 + dietCO2).toFixed(2);
    const entry = {
      date: new Date().toLocaleString(),
      transport: transportCO2,
      energy: energyCO2,
      diet: dietCO2,
      total
    };
    setResults(entry);
    setHistory([entry, ...history]);
  };

  const handleSubmitIndustrial = (e) => {
    e.preventDefault();
    const electricity = parseFloat(industrialData.electricity || 0) * EMISSION_FACTORS.industrial.electricity;
    const fuel = parseFloat(industrialData.fuel || 0) * EMISSION_FACTORS.industrial.fuel;
    const waste = parseFloat(industrialData.waste || 0) * EMISSION_FACTORS.industrial.waste;
    setResults({ electricity, fuel, waste, total: (electricity + fuel + waste).toFixed(2) });
  };

  const handleSubmitCity = (e) => {
    e.preventDefault();
    const transport = parseFloat(cityData.transport || 0) * EMISSION_FACTORS.city.transport;
    const buildings = parseFloat(cityData.buildings || 0) * EMISSION_FACTORS.city.buildings;
    const population = parseFloat(cityData.population || 1);
    setResults({
      transport,
      buildings,
      perCapita: ((transport + buildings) / population).toFixed(2),
      total: (transport + buildings).toFixed(2)
    });
  };

  useEffect(() => {
    if (results && pieChartRef.current && barChartRef.current) {
      if (pieChart) pieChart.destroy();
      if (barChart) barChart.destroy();

      const keys = Object.keys(results).filter(k => k !== 'total' && k !== 'date' && k !== 'perCapita');
      const values = keys.map(k => results[k]);
      const colors = ['#66bb6a', '#81c784', '#a5d6a7', '#c8e6c9', '#e8f5e9'];

      pieChart = new Chart(pieChartRef.current.getContext('2d'), {
        type: 'pie',
        data: {
          labels: keys,
          datasets: [{ data: values, backgroundColor: colors }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: { position: 'bottom' },
            title: { display: true, text: 'Emission Breakdown (Pie)' }
          }
        }
      });

      barChart = new Chart(barChartRef.current.getContext('2d'), {
        type: 'bar',
        data: {
          labels: keys,
          datasets: [{
            label: 'kg CO₂e',
            data: values,
            backgroundColor: colors
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: { display: false },
            title: { display: true, text: 'Emission Breakdown (Bar)' }
          },
          scales: {
            y: {
              beginAtZero: true,
              title: { display: true, text: 'kg CO₂e' }
            }
          }
        }
      });
    }
  }, [results]);

  const ResultsChart = () => results && (
    <div className="results">
      <h3>Emissions Breakdown</h3>
      <canvas ref={pieChartRef}></canvas>
      <canvas ref={barChartRef}></canvas>
      <p><strong>Total:</strong> {results.total} kg CO₂e</p>
      {results.perCapita && <p><strong>Per Capita:</strong> {results.perCapita} kg CO₂e</p>}
    </div>
  );

  const renderTracker = () => (
    <div>
      <form onSubmit={handleSubmitPersonal}>
        <h2>Personal Carbon Footprint</h2>
        <label>Transport (km driven):</label>
        <input type="number" name="transport" onChange={e => handleChange(e, setFormData, formData)} required />
        <label>Energy Usage (kWh):</label>
        <input type="number" name="energy" onChange={e => handleChange(e, setFormData, formData)} required />
        <label>Diet Type:</label>
        <select name="diet" onChange={e => handleChange(e, setFormData, formData)}>
          <option value="vegan">Vegan</option>
          <option value="vegetarian">Vegetarian</option>
          <option value="omnivore">Omnivore</option>
          <option value="heavy_meat">Heavy Meat</option>
        </select>
        <button type="submit">Calculate</button>
      </form>
      <ResultsChart />
      {history.length > 0 && <div className="history">
        <h3>Calculation History</h3>
        <ul>{history.map((h, i) => <li key={i}>{h.date}: {h.total} kg CO2e</li>)}</ul>
      </div>}
    </div>
  );

  const renderIndustrial = () => (
    <div>
      <form onSubmit={handleSubmitIndustrial}>
        <h2>Industrial Carbon Footprint</h2>
        <label>Electricity Usage (kWh):</label>
        <input type="number" name="electricity" onChange={e => handleChange(e, setIndustrialData, industrialData)} required />
        <label>Fuel Consumption (liters):</label>
        <input type="number" name="fuel" onChange={e => handleChange(e, setIndustrialData, industrialData)} required />
        <label>Waste Generated (kg):</label>
        <input type="number" name="waste" onChange={e => handleChange(e, setIndustrialData, industrialData)} required />
        <button type="submit">Calculate</button>
      </form>
      <ResultsChart />
    </div>
  );

  const renderCity = () => (
    <div>
      <form onSubmit={handleSubmitCity}>
        <h2>City Level Carbon Footprint</h2>
        <label>Population:</label>
        <input type="number" name="population" onChange={e => handleChange(e, setCityData, cityData)} required />
        <label>Total Transport Use (vehicle km):</label>
        <input type="number" name="transport" onChange={e => handleChange(e, setCityData, cityData)} required />
        <label>Building Energy Usage (kWh):</label>
        <input type="number" name="buildings" onChange={e => handleChange(e, setCityData, cityData)} required />
        <button type="submit">Calculate</button>
      </form>
      <ResultsChart />
    </div>
  );

    const renderHome = () => (
<div className="results" style={{ textAlign: 'center' }}>
  <img
      src="https://media.istockphoto.com/id/1401304047/vector/reduce-your-carbon-footprint-logo-net-zero-emission.jpg?s=612x612&w=0&k=20&c=xub0yqSnVW4NN827DP0k7VPy5Gc3SSZ-4PbgITJbKVo="
      alt="welcome"
      style={{ width: 120, borderRadius: '50%', margin: '20px auto' }}
    />
  <h1> Welcome to the Carbon Footprint Tracker</h1>
  <p>Start your journey to greener future! This tracker helps you estimate your environmental impact and gives you tools to reduce it.</p>
  

  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', marginTop: '20px' }}>

    <div style={{
background: '#e8f5e9',
padding: '15px',
borderRadius: '10px',
boxShadow: '0 1px 5px rgba(0,0,0,0.1)',
maxWidth: '500px',
width: '100%',
textAlign: 'center'
}}>
      <img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcThw6q3kwwfB8kp6bD3RtYyfuqWg9InnBfUT_A00kYCSicMrSRpiCsnGJctbJ3KY8Z6Vmo&usqp=CAU" alt="Personal Tracker" className="home-img-anim personal" style={{ width: 120, borderRadius: '50%', margin: '20px auto' }}/>
      <h3> Personal Tracker</h3>
      <p>Calculate emissions from daily transport, energy, and diet.</p>
      <button onClick={() => setPage('tracker')}>Try It</button>
    </div>

    <div style={{
background: '#e8f5e9',
padding: '15px',
borderRadius: '10px',
boxShadow: '0 1px 5px rgba(0,0,0,0.1)',
maxWidth: '500px',
width: '100%',
textAlign: 'center'
}}>
      <img
              src="https://i.pinimg.com/736x/4b/df/53/4bdf5392f915edc73ae3248792886f9f.jpg"
              alt="Industrial Tracker"
              className="home-img-anim industrial"
              style={{ width: 120, borderRadius: '50%', margin: '20px auto' }}
            />
      <h3> Industrial Tracker</h3>
      <p>Measure emissions from fuel, electricity, and waste in industries.</p>
      <button onClick={() => setPage('industrial')}>Try It</button>
    </div>

    <div style={{
background: '#e8f5e9',
padding: '15px',
borderRadius: '10px',
boxShadow: '0 1px 5px rgba(0,0,0,0.1)',
maxWidth: '500px',
width: '100%',
textAlign: 'center'
}}>
      <img
              src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSNnUUADuLX63nO2L70qY5ohMxBePiPLjn1PQ&s"
              alt="City Tracker"
              className="home-img-anim city"
              style={{ width: 120, borderRadius: '50%', margin: '20px auto' }}
            />
      <h3> City Tracker</h3>
      <p>Estimate city-wide impact based on transport and buildings.</p>
      <button onClick={() => setPage('city')}>Try It</button>
    </div>
  </div>

   <div style={{ marginTop: '30px', textAlign: 'left' }}>
          <h3>Why Track Your Carbon Footprint?</h3>
          <ul>
            <li>✅ Understand Your Impact: The average global per capita carbon footprint is ~4.7 tons CO₂e/year (Global Carbon Project, 2024), but in high-income countries, it’s often >10 tons. Tracking reveals your contribution.</li>
            <li>✅ Reduce Emissions: Simple actions like reducing car use by 20% can cut ~0.5 tons CO₂e/year (EPA, 2025).</li>
            <li>✅ Support Global Goals: Align with the UN’s Sustainable Development Goal 13 (Climate Action) by lowering your footprint.</li>
            <li>✅ Drive Systemic Change: Informed individuals push for policies that cut emissions, like the EU’s 55% reduction target by 2030 (European Commission, 2024).</li>
          </ul>
        </div>

  <div style={{ marginTop: '30px', textAlign: 'center' }}>
    <h3> Get Started Now</h3>
    <p>Select a tracker from the menu above and begin your eco-friendly journey.</p>
    <button
      onClick={() => setPage('tracker')}
      style={{
        background: '#43a047',
        color: 'white',
        padding: '10px 20px',
        border: 'none',
        borderRadius: '8px',
        fontSize: '16px',
        cursor: 'pointer'
      }}
    >
      Start Tracking
    </button>
  </div>
</div>
);

  const renderTips = () => (
    <div className="tips">
      <h2>Tips to Reduce Your Carbon Footprint</h2>
      <ul>
        <li>🚴 Use Public Transport, Bike, or Walk: Replacing a 20-km daily car commute with public transit saves ~2.8 tons CO₂e/year (EPA, 2025). Cycling or walking also boosts health, reducing healthcare emissions indirectly.</li>
        <li>💡 Switch to Energy-Efficient Appliances: ENERGY STAR appliances cut energy use by 10–50% (U.S. DOE, 2024), saving ~0.3–0.7 tons CO₂e/year for a household.</li>
        <li>🥦 Eat More Plant-Based Meals: A vegan diet emits ~2.5 tons CO₂e/year compared to ~7 tons for heavy meat diets (Poore & Nemecek, 2018, Science). Even one plant-based day/week saves ~0.4 tons/year.</li>
        <li>🔌 Unplug Unused Electronics: Standby power consumes 5–10% of household energy (IEA, 2024), equating to ~0.1 tons CO₂e/year. Use smart power strips to eliminate “phantom” loads.</li>
        <li>♻️ Reduce, Reuse, Recycle: Proper recycling reduces landfill methane emissions by ~0.2 tons CO₂e/year per household (EPA, 2025). Prioritize reducing single-use plastics.</li>
        <li>🌳 Plant Trees or Support Reforestation: A single mature tree absorbs ~22 kg CO₂/year (USDA Forest Service, 2024). Supporting projects like Trillion Trees can offset ~0.5 tons CO₂e/year.</li>
        <li>💧 Conserve Water: Heating water accounts for ~15% of home energy use (IEA, 2024). Low-flow showerheads and shorter showers save ~0.15 tons CO₂e/year.</li>
      </ul>
    </div>
  );

  const renderAbout = () => (
    <div className="about">
      <h2>About This Project</h2>
      <p>About This Project</p>
<p>The Carbon Footprint Tracker empowers individuals, industries, and cities to measure and reduce their environmental impact. Built with React.js and Chart.js, it uses emission factors from trusted sources like the IPCC (2023) and EPA (2025). For example, personal transport emissions are calculated at 0.21 kg CO₂e/km, reflecting average gasoline vehicle efficiency (EPA, 2025).</p>
<p>Why track? Global emissions hit 36.8 billion tons CO₂e in 2024 (Global Carbon Project). Without action, warming could exceed 2°C by 2050, risking severe climate impacts (IPCC, 2023). This tool helps you align with science-based targets, like the Paris Agreement’s 1.5°C goal, by providing actionable insights.</p>
<p>Sources: IPCC AR6 (2023), EPA (2025), Global Carbon Project (2024).</p>
    </div>
  );

  switch (page) {
    case 'tracker': return renderTracker();
    case 'industrial': return renderIndustrial();
    case 'city': return renderCity();
    case 'tips': return renderTips();
    case 'about': return renderAbout();
    default: return renderHome();
  }
}

function setPage(page) {
  window.__page = page;
  window.dispatchEvent(new Event('pageChange'));
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
// ==UserScript==
// @name Carbon Tracker Dark Animations
// @match *://localhost/*  // Adjust to your app's URL
// ==/UserScript==
(function() {
  const style = document.createElement('style');
  style.textContent = ``;
  document.head.appendChild(style);
})();

// Initialize particles.js (kept in app.js so all scripts are together)
particlesJS('particles-js', {
  particles: {
    number: { value: 50, density: { enable: true, value_area: 800 } },
    color: { value: '#4caf50' },
    shape: {
      type: 'circle',
      stroke: { width: 0, color: '#000000' }
    },
    opacity: { value: 0.5, random: true },
    size: { value: 4, random: true },
    line_linked: {
      enable: true,
      distance: 150,
      color: '#81c784',
      opacity: 0.4,
      width: 1
    },
    move: {
      enable: true,
      speed: 2,
      direction: 'none',
      random: false,
      straight: false,
      bounce: false
    }
  },
  interactivity: {
    detect_on: 'canvas',
    events: {
      onhover: { enable: true, mode: 'repulse' },
      onclick: { enable: true, mode: 'push' },
      resize: true
    },
    modes: {
      repulse: { distance: 100, duration: 0.4 },
      push: { particles_nb: 4 }
    }
  },
  retina_detect: true
});