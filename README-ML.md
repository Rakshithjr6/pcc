# Pharmaceutical Cold Chain Monitoring System - ML Edition

Advanced cold chain monitoring with ML-based anomaly detection, severity scoring, and intelligent alerting.

## 🚀 Features

### ML-Based Anomaly Detection (Section 4)
- **Isolation Forest Algorithm**: Primary anomaly detection model
- **Sliding Window Processing**: Analyzes last 30-60 sensor readings
- **Feature Vector**: [temperature, humidity, temp_change_rate, humidity_change_rate]
- **Anomaly Score**: 0-1 scale with configurable threshold (default: 0.6)
- **Real-time Classification**: Normal / Anomalous
- **Database Storage**: All anomaly scores stored in SQLite

### Severity Scoring Engine (Section 5)
- **Magnitude Calculation**: Deviation from nearest safe limit
- **Duration Tracking**: Total time outside safe range
- **Severity Formula**: Score = Magnitude × Duration
- **Classification**:
  - Low: score < 10
  - Medium: 10-50
  - Critical: > 50
- **Combined Scoring**: Temperature + Humidity severity

### Intelligent Alert Engine (Section 6)
**Trigger Conditions:**
- Rule-based breach detected
- NOT suppressed by context filter (doors open)
- ML model flags anomaly

**Alert Output:**
- Timestamp
- Storage Unit ID
- Temperature & Humidity values
- Severity level with color coding
- Anomaly score
- Descriptive message

**Features:**
- Real-time WebSocket push to frontend
- Database persistence
- Acknowledgment system
- Alert prioritization by severity

### Dashboard Integration (Section 7)
**New Components:**
1. **Anomaly Score Trend Graph**: Real-time visualization with color coding
2. **Intelligent Alert Panel**: Severity-based color coding (red/yellow/blue)
3. **Breach Timeline**: Historical breach visualization
4. **ML Evaluation Metrics**: Recall, Precision, False Alarm Rate, F1 Score
5. **Model Configuration Panel**: Adjustable threshold, window size, retrain button

### Data Flow Integration (Section 8)
```
Filtered Sensor Data
    ↓
ML Anomaly Detection (Isolation Forest)
    ↓
Severity Scoring Engine
    ↓
Intelligent Alert Engine
    ↓
WebSocket → Dashboard
    ↓
SQLite Database Storage
```

### Evaluation Metrics (Section 9)
**Computed Metrics:**
- **Recall**: True Positives / (True Positives + False Negatives)
- **Precision**: True Positives / (True Positives + False Positives)
- **False Alarm Rate**: Per 1000 readings
- **F1 Score**: Harmonic mean of precision and recall
- **Accuracy**: (TP + TN) / Total

**Display**: Real-time metrics in dashboard analytics section

### Additional Enhancements (Section 10)
- **Configurable Threshold**: Adjustable via UI slider (0.1-0.9)
- **Window Size Selection**: 30, 60, or 120 readings
- **Model Retraining**: Manual retrain button
- **Data Export**: JSON export for audit/analysis
- **Audit Logging**: All decisions logged to database

## 📦 Installation

### Prerequisites
- Node.js 14+ 
- npm or yarn

### Setup
```bash
# Install dependencies
npm install

# Start the server
npm start

# Or use nodemon for development
npm run dev
```

The server will start on port 3000 (or PORT environment variable).

## 🌐 Access

- **Dashboard**: http://localhost:3000
- **API Base**: http://localhost:3000/api

## 📡 API Endpoints

### Sensor Data
- `GET /api/sensor/current` - Latest reading
- `GET /api/sensor/history?limit=100` - Historical data
- `POST /api/sensor/ingest` - Submit new reading

### Anomaly Detection
- `GET /api/anomaly/scores?limit=100` - Anomaly scores with sensor data

### Alerts
- `GET /api/alerts?limit=50&acknowledged=false` - Get alerts
- `POST /api/alerts/:id/acknowledge` - Acknowledge alert

### Breaches
- `GET /api/breaches?limit=50` - Breach history

### Metrics
- `GET /api/metrics` - Evaluation metrics (recall, precision, F1, etc.)

### Configuration
- `GET /api/config` - Get model configuration
- `PUT /api/config/:key` - Update configuration

## 🔌 WebSocket Events

**Client receives:**
- `alert` - New alert generated
- `sensor_update` - New sensor reading with anomaly score
- `initial` - Initial data on connection

## 🗄️ Database Schema

### Tables
1. **sensor_readings** - All sensor measurements
2. **anomaly_scores** - ML anomaly detection results
3. **alerts** - Generated alerts with severity
4. **breaches** - Breach events with duration
5. **evaluation_metrics** - ML performance tracking
6. **model_config** - Configurable parameters

## 🎨 Dashboard Components

### 1. Sensor Display Cards
- Temperature with status (Normal/Critical)
- Humidity with 3-level status (Normal/Warning/Critical)
- Doors status integration (alerts suppressed when open)

### 2. Charts
- **Temperature/Humidity Trends**: Dual-axis line chart
- **Anomaly Score Trend**: Color-coded (green/yellow/red)
- **Threshold Line**: Visual indicator at 0.6

### 3. Alert Panel
- Real-time alert display
- Color-coded by severity (Critical=red, Medium=yellow, Low=blue)
- Acknowledgment buttons
- Unacknowledged alert counter

### 4. Breach Timeline
- Chronological breach list
- Duration calculation
- Status indicators (ONGOING/ENDED)
- Type classification (temperature/humidity/both)

### 5. ML Metrics Panel
- Recall, Precision, F1 Score percentages
- False Alarm Rate per 1000 readings
- Window size indicator

### 6. Model Configuration
- Anomaly threshold slider (0.1-0.9)
- Window size dropdown (30/60/120)
- Retrain model button
- Export data button

## ⚙️ Configuration

### Default Model Parameters
```javascript
{
  anomaly_threshold: 0.6,        // Anomaly detection threshold
  isolation_forest_trees: 100,   // Number of trees in forest
  isolation_forest_sample_size: 256,  // Sample size per tree
  window_size: 60,               // Sliding window size
  severity_threshold_low: 10,  // Low severity cutoff
  severity_threshold_medium: 50  // Medium severity cutoff
}
```

### Safe Ranges
- **Temperature**: 2-8°C
- **Humidity**: 40-60%
- **Humidity Warning**: 35-39%, 61-65% (close to safe range)

## 🧪 Testing

### Manual Testing
1. Start monitoring
2. Observe normal readings
3. Wait for simulated critical values
4. Verify alerts appear in panel
5. Acknowledge alerts
6. Check breach timeline updates

### ML Testing
1. Check anomaly scores in chart
2. Adjust threshold slider
3. Observe alert frequency changes
4. Verify metrics update

## 📊 Performance

- **Update Interval**: 1.5 seconds
- **Window Size**: Configurable (30-120 readings)
- **Database**: SQLite (lightweight, no setup)
- **WebSocket**: Real-time push updates
- **ML Training**: Incremental on window data

## 🔒 Security Considerations

- CORS enabled for development
- Input validation on API endpoints
- SQLite parameterized queries (SQL injection protection)
- No authentication (add for production)

## 🚀 Production Deployment

### Recommended Additions
1. **Authentication**: JWT or session-based
2. **HTTPS**: SSL/TLS encryption
3. **Database**: PostgreSQL for scalability
4. **Monitoring**: PM2 or systemd
5. **Logging**: Winston or similar
6. **Backup**: Automated database backups

### Environment Variables
```bash
PORT=3000
NODE_ENV=production
DB_PATH=/data/coldchain.db
ANOMALY_THRESHOLD=0.6
```

## 📝 License

MIT License - Feel free to use and modify.

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Create Pull Request

## 📧 Support

For issues or questions, please create a GitHub issue.

---

**Built with:** Node.js, Express, WebSocket, SQLite, Chart.js, Tailwind CSS, Lucide Icons

**ML Algorithm:** Isolation Forest for unsupervised anomaly detection

**Architecture:** Modular, scalable, real-time data pipeline
