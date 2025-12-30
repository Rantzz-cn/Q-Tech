# Q-Tech - Smart Queue Management System

> *No More Waiting in Line - Smart Queuing for a Better Experience*

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18+-blue.svg)](https://reactjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14+-blue.svg)](https://www.postgresql.org/)
[![License](https://img.shields.io/badge/License-ISC-blue.svg)](LICENSE)

## 📱 Overview

Q-Tech is a comprehensive digital queue management system that eliminates physical waiting lines by providing virtual queue numbers through a mobile application, real-time status updates, and efficient service counter management.

## ✨ Key Features

### For Students
- 📱 **Mobile App** - Request queue numbers from anywhere
- 🔔 **Real-time Updates** - Live queue position and status
- ⏱️ **Wait Time Estimation** - Know how long to wait
- 📊 **Queue History** - View past queue requests
- 🚫 **Queue Cancellation** - Cancel if needed

### For Counter Staff
- 💻 **Web Dashboard** - Manage queues efficiently
- 📞 **Call Next** - One-click queue management
- 📈 **Statistics** - Track counter performance
- ⚡ **Real-time Sync** - Instant queue updates

### For Administrators
- 🎛️ **Service Management** - Create and manage services
- 👥 **User Management** - Manage students and staff
- 📊 **Analytics Dashboard** - Comprehensive insights
- 🖥️ **Display Board** - TV screen for queue display
- ⚙️ **System Settings** - Configure system-wide settings
- 🔧 **Maintenance Mode** - Control system availability

## 🛠️ Tech Stack

### Backend
- **Node.js** with Express.js
- **PostgreSQL** database
- **Socket.io** for real-time updates
- **JWT** for authentication
- **bcrypt** for password hashing

### Frontend
- **React/Next.js** for web dashboard
- **React Native** for mobile app
- **Socket.io Client** for real-time updates

### Infrastructure
- **PostgreSQL** for data storage
- **WebSocket** for real-time communication
- **RESTful API** architecture

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- npm or yarn

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Rantzz-cn/Q-Tech.git
   cd Q-Tech
   ```

2. **Setup Backend**:
   ```bash
   cd backend
   npm install
   cp .env.example .env
   # Configure .env with your database credentials
   ```

3. **Setup Database**:
   ```bash
   createdb qtech
   psql -d qtech -f ../database/migrations/001_initial_schema.sql
   psql -d qtech -f ../database/migrations/002_create_system_settings.sql
   psql -d qtech -f ../database/migrations/003_add_queue_prefix_to_services.sql
   psql -d qtech -f ../database/migrations/004_add_performance_indexes.sql
   ```

4. **Seed Demo Data** (Optional):
   ```bash
   psql -d qtech -f ../database/seeds/demo-data.sql
   ```

5. **Start Backend**:
   ```bash
   cd backend
   npm run dev
   ```

6. **Start Web Dashboard**:
   ```bash
   cd web-dashboard
   npm install
   npm run dev
   ```

7. **Access**:
   - Backend API: http://localhost:3000
   - Web Dashboard: http://localhost:3001

## 🎬 Demo Credentials

For portfolio demonstration, use these demo accounts:

### Administrator
- **Email**: `admin@clsu.edu.ph`
- **Password**: `demo123`

### Counter Staff
- **Email**: `staff1@clsu.edu.ph`
- **Password**: `demo123`

### Student
- **Email**: `student1@clsu.edu.ph`
- **Password**: `demo123`

> ⚠️ **Note**: These are demo credentials only. Change all passwords before production deployment.

## 📸 Screenshots

### Mobile App
- Login Screen
- Services List
- Queue Status
- Queue History

### Web Dashboard
- Admin Dashboard
- Service Management
- Queue Management
- Analytics
- Display Board

## 🧪 Testing

### Run Tests
```bash
# Unit tests
cd backend
npm run test:unit

# Integration tests
npm run test:integration

# All tests
npm test
```

### Test Coverage
- ✅ 20 Unit Tests
- ✅ 53 Integration Tests
- ✅ Performance Tests
- **Total**: 73 tests passing

## 📚 Documentation

Comprehensive documentation is available in the `docs/` directory:

- [API Documentation](docs/api-documentation.md)
- [Architecture](docs/architecture.md)
- [Database Schema](docs/database-schema.md)
- [Deployment Guide](docs/deployment-guide.md)
- [Performance Optimization](docs/performance-optimization.md)
- [User Acceptance Testing](docs/user-acceptance-testing.md)

## 🏗️ Project Structure

```
Q-Tech/
├── backend/           # Node.js/Express API
│   ├── controllers/   # Request handlers
│   ├── models/        # Database models
│   ├── routes/        # API routes
│   ├── middleware/    # Custom middleware
│   ├── socket/         # WebSocket handlers
│   └── tests/         # Test files
├── web-dashboard/      # React/Next.js admin dashboard
│   └── src/
│       ├── pages/     # Next.js pages
│       └── components/# React components
├── mobile/            # React Native mobile app
│   └── src/
│       ├── screens/   # App screens
│       └── components/# React Native components
├── database/          # Database files
│   ├── migrations/    # Database migrations
│   └── seeds/         # Demo data
└── docs/              # Documentation
```

## 🎯 Key Features Implemented

- ✅ User Authentication (JWT)
- ✅ Queue Number Generation
- ✅ Real-time Queue Updates (WebSocket)
- ✅ Multi-service Support
- ✅ Custom Queue Prefixes
- ✅ System Maintenance Mode
- ✅ Admin Dashboard
- ✅ Counter Dashboard
- ✅ TV Display Board
- ✅ Analytics & Reports
- ✅ Performance Optimization
- ✅ Comprehensive Testing

## 📊 Performance

- **API Response Time**: <200ms average
- **Database Queries**: Optimized with 27 indexes
- **Caching**: Response caching for frequently accessed data
- **Real-time Updates**: <1s latency

## 🔒 Security

- JWT token authentication
- Password hashing with bcrypt
- Input validation
- SQL injection protection
- CORS configuration
- Environment variable security

## 🚀 Deployment

See [Deployment Guide](docs/deployment-guide.md) for detailed instructions.

Quick deployment options:
- **Backend**: Railway, Render, Heroku
- **Web Dashboard**: Vercel, Netlify
- **Database**: Railway PostgreSQL, Supabase

## 📝 License

ISC License

## 👤 Author

- GitHub: [Rantzz-cn](https://github.com/Rantzz-cn)
- Email: teraldicoranier@gmail.com




---

