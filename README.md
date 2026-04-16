# Pharmaceutical Cold Chain Monitoring System

A real-time web application for monitoring pharmaceutical cold chain temperatures with advanced alert systems and data visualization.

## Features

### Core Functionality
- **Real-time Temperature Monitoring**: Simulates temperature sensor readings every 1.5 seconds
- **Safe Range Validation**: Monitors temperatures between 2°C - 8°C
- **Status Indicators**: Visual feedback with color-coded status (Normal/Critical)
- **Alert System**: Toast notifications for critical temperature events
- **Alert History**: Comprehensive log of all critical events with timestamps
- **Temperature Trends**: Real-time chart showing temperature patterns over time

### Dashboard Components
- **Live Temperature Display**: Large, prominent temperature readout
- **Status Indicator**: Normal (green) / Critical (red) with pulsing animation
- **Metrics Panel**: Alert counter, system uptime, current status
- **Temperature Chart**: Real-time line chart with safe zone visualization
- **Alert History Table**: Detailed log of critical events
- **Control Panel**: Start/stop monitoring, reset alerts

### Technical Features
- **Responsive Design**: Works on desktop, tablet, and mobile devices
- **Real-time Updates**: Continuous monitoring with 1.5-second intervals
- **Alert Debouncing**: Prevents duplicate alerts within 10 seconds
- **Data Persistence**: Maintains alert history during session
- **Professional UI**: Clean, modern interface using Tailwind CSS

## Quick Start

1. **Open the Application**: Simply open `index.html` in any modern web browser
2. **Auto-Start**: Monitoring begins automatically after 2 seconds
3. **Monitor**: Watch real-time temperature updates and alerts
4. **Control**: Use the control panel to start/stop monitoring or reset alerts

## Temperature Simulation

The system uses a realistic temperature simulation algorithm:
- **Random Walk**: Temperature changes by ±0.5°C per update
- **Occasional Spikes**: 5% chance of larger temperature fluctuations
- **Realistic Bounds**: Temperatures range from -5°C to 15°C
- **Safe Range**: 2°C - 8°C (pharmaceutical standard)

## Alert System

### Alert Triggers
- Temperature below 2°C (too cold)
- Temperature above 8°C (too warm)

### Alert Features
- **Toast Notifications**: Slide-in alerts with temperature and timestamp
- **Visual Indicators**: Red pulsing animation for critical status
- **Alert History**: Table with timestamp, temperature, status, and duration
- **Debounce Logic**: 10-second minimum between alerts to prevent spam

## File Structure

```
pharma-cold-chain/
├── index.html          # Main application page
├── app.js             # Application logic and monitoring system
└── README.md          # Documentation
```

## Browser Compatibility

- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

## Dependencies

The application uses CDN-hosted libraries:
- **Tailwind CSS**: For responsive styling
- **Chart.js**: For temperature trend visualization
- **Lucide Icons**: For modern iconography

## Usage Instructions

### Starting Monitoring
1. Click "Start Monitoring" button or wait for auto-start
2. System will begin simulating temperature readings
3. Watch for alerts when temperature goes out of range

### Viewing Alerts
- Toast notifications appear in top-right corner
- Alert history table shows all critical events
- Alert counter displays total number of alerts

### Resetting Alerts
- Click "Reset Alerts" to clear alert history
- Confirmation dialog prevents accidental reset
- Temperature monitoring continues

## Technical Implementation

### Temperature Algorithm
```javascript
// Random walk with occasional spikes
const change = (Math.random() - 0.5) * 1.0;
currentTemp += change;

// 5% chance of larger spike
if (Math.random() < 0.05) {
    currentTemp += (Math.random() - 0.5) * 4;
}
```

### Alert Logic
- Validates temperature against 2°C - 8°C range
- Debounces alerts to prevent spam
- Tracks alert history with timestamps
- Updates UI in real-time

### Chart Configuration
- Real-time line chart with 50 data points
- Smooth animations for temperature changes
- Responsive design that adapts to screen size

## Future Enhancements

- Real sensor integration via WebSocket
- Multiple sensor monitoring
- Historical data export
- Email/SMS alert integration
- User authentication
- Database persistence
- Mobile app version

## Support

For technical support or questions about the Cold Chain Monitoring System, please refer to the documentation or contact the development team.
