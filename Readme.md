# 🤖 AI-Powered Incident Management System - Backend

A comprehensive backend system for automatic incident detection, AI-powered analysis, and multi-service monitoring.

---

## 📋 Table of Contents

- [Overview](#overview)
- [Technologies Used](#technologies-used)
- [Architecture](#architecture)
- [How It Works](#how-it-works)
- [API Endpoints](#api-endpoints)
- [AI Integration](#ai-integration)
- [Database Models](#database-models)
- [Quick Start](#quick-start)
- [Configuration](#configuration)

---

## 🎯 Overview

This backend system provides:

- **Automatic Incident Detection** - Monitors services and creates incidents
- **AI-Powered Analysis** - Uses NVIDIA NIM LLMs for root cause analysis
- **Multi-Service Monitoring** - Supports unlimited service registration
- **RESTful API** - Complete API for frontend integration
- **Real-time Monitoring** - Continuous health checks every 5 minutes
- **Intelligent Fallbacks** - Rule-based analysis when AI unavailable

**Purpose**: Centralized backend for enterprise-scale incident management with AI capabilities.

---

## 🛠️ Technologies Used

### Core Framework
- **Node.js** - JavaScript runtime
- **Express.js 5.2.1** - Web application framework
- **MongoDB** - NoSQL database
- **Mongoose 9.0.2** - MongoDB object modeling

### AI/ML Integration
- **NVIDIA NIM API** - Large Language Model inference
  - Primary: `meta/llama-3.1-8b-instruct`
  - Secondary: `mistralai/mistral-7b-instruct`
- **Axios 1.13.2** - HTTP client for API calls

### Security & Middleware
- **CORS 2.8.5** - Cross-Origin Resource Sharing
- **dotenv 17.2.3** - Environment variable management
- **jsonwebtoken 9.0.3** - JWT authentication (for future use)

### Development Tools
- **Nodemon 3.1.11** - Development auto-reload

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────┐
│         Express Application             │
│                                         │
│  ┌──────────────────────────────────┐  │
│  │      Middleware Stack            │  │
│  │  CORS → JSON → Security          │  │
│  └──────────────────────────────────┘  │
│                  │                      │
│  ┌───────────────▼───────────────┐    │
│  │      API Routes                 │    │
│  │                                │    │
│  │  /api/incidents                │    │
│  │  /api/services                 │    │
│  │  /api/ai                       │    │
│  │  /api/logs                     │    │
│  │  /api/system                   │    │
│  └───────────────┬───────────────┘    │
│                  │                      │
│  ┌───────────────▼───────────────┐    │
│  │      Controllers               │    │
│  │                                │    │
│  │  incident.routes.js          │    │
│  │  service.routes.js            │    │
│  │  ai.controller.js             │    │
│  │  system.routes.js             │    │
│  └───────────────┬───────────────┘    │
│                  │                      │
│  ┌───────────────▼───────────────┐    │
│  │      Services Layer            │    │
│  │                                │    │
│  │  monitoring.service.js        │    │
│  │  huggingface.client.js        │    │
│  │    (NVIDIA NIM integration)   │    │
│  └───────────────┬───────────────┘    │
│                  │                      │
│  ┌───────────────▼───────────────┐    │
│  │      Database Layer            │    │
│  │                                │    │
│  │  MongoDB                       │    │
│  │  • Incidents Collection        │    │
│  │  • Logs Collection            │    │
│  │  • Services Collection         │    │
│  └───────────────────────────────┘    │
└─────────────────────────────────────────┘
```

### Directory Structure

```
ai-incident-assistant/
├── src/
│   ├── server.js              # Entry point
│   ├── app.js                 # Express app setup
│   ├── config/
│   │   └── db.js              # MongoDB connection
│   ├── models/
│   │   ├── Incident.js        # Incident model
│   │   ├── Log.js             # Log model
│   │   └── Service.js         # Service model
│   ├── api/
│   │   ├── incident.routes.js # Incident endpoints
│   │   ├── service.routes.js   # Service endpoints
│   │   ├── ai.routes.js       # AI endpoints
│   │   ├── log.routes.js      # Log endpoints
│   │   └── system.routes.js   # System endpoints
│   ├── huggins/
│   │   ├── ai.controller.js    # AI analysis logic
│   │   └── huggingface.client.js  # NVIDIA NIM client
│   ├── services/
│   │   └── monitoring.service.js  # Monitoring service
│   └── middleware/
│       └── toolGuard.js       # Security middleware
├── package.json
└── README.md
```

---

## ⚙️ How It Works

### 1. Service Registration

```
Engineer registers service
    ↓
POST /api/services
    ↓
Service saved to MongoDB
    ↓
Monitoring service picks it up
```

### 2. Automatic Monitoring

```
Monitoring Service (every 5 minutes)
    ↓
Fetch all enabled services from DB
    ↓
For each service:
    GET {service.url}/health
    ↓
Check response status & data
    ↓
If unhealthy/unreachable:
    Create incident in MongoDB
    Add log entry
    Link to service
```

### 3. AI Analysis Flow

```
Engineer requests AI analysis
    ↓
GET /api/ai/analysis/:incidentId
    ↓
Fetch incident & logs
    ↓
Call NVIDIA NIM API:
    1. Try Llama 3.1 (primary)
    2. Try Mistral 7B (secondary)
    3. Fallback to rule-based
    ↓
Analyze:
    - Severity
    - Category
    - Root Cause
    ↓
Generate suggestions
    ↓
Update incident with AI analysis
    ↓
Return results to frontend
```

### 4. Incident Lifecycle

```
Service Issue Detected
    ↓
Incident Created (status: "open")
    ↓
Engineer Views Incident
    ↓
Engineer Runs AI Analysis
    ↓
AI Provides Root Cause & Suggestions
    ↓
Engineer Resolves Issue
    ↓
Incident Status: "resolved"
    ↓
Timeline Updated
```

---

## 📡 API Endpoints

### Incidents

- **GET** `/api/incidents` - List incidents (with filters)
  - Query params: `status`, `severity`, `category`, `serviceId`, `limit`
- **GET** `/api/incidents/:id` - Get incident details
- **PATCH** `/api/incidents/:id/status` - Update incident status
- **POST** `/api/incidents/:id/approve-action` - Approve AI action

### Services

- **GET** `/api/services` - List services (with filters)
- **GET** `/api/services/:id` - Get service details
- **POST** `/api/services` - Register new service
- **PATCH** `/api/services/:id` - Update service
- **DELETE** `/api/services/:id` - Delete service
- **POST** `/api/services/:id/test` - Test service health

### AI Analysis

- **GET** `/api/ai/analysis/:incidentId` - Run AI analysis on incident

### Logs

- **GET** `/api/logs/:incidentId` - Get logs for incident

### System

- **GET** `/api/system/stats` - Get system statistics
- **POST** `/api/system/events` - Simulate system event
- **POST** `/api/system/monitoring/start` - Start monitoring
- **POST** `/api/system/monitoring/stop` - Stop monitoring
- **GET** `/api/system/monitoring/status` - Get monitoring status

---

## 🤖 AI Integration

### NVIDIA NIM Models

**Primary Model**: `meta/llama-3.1-8b-instruct`
- Best for: Classification, reasoning, explanations
- Fast and reliable
- Industry-trusted

**Secondary Model**: `mistralai/mistral-7b-instruct`
- Backup for: Quick classification
- Fallback when primary fails

### AI Analysis Process

1. **Severity Analysis**
   - Prompt: "Classify incident severity"
   - Output: "high", "medium", or "low"

2. **Category Analysis**
   - Prompt: "Categorize incident type"
   - Output: "performance", "database", "authentication", etc.

3. **Root Cause Analysis**
   - Prompt: "Analyze root cause with confidence"
   - Output: Root cause description + probability score

4. **Fallback Mechanism**
   - If AI unavailable → Rule-based pattern matching
   - Ensures system always provides analysis

### Logging

Detailed console logs track:
- Which model is being used
- API call attempts
- Fallback triggers
- Analysis results

---

## 💾 Database Models

### Incident Model

```javascript
{
  title: String,
  description: String,
  serviceId: ObjectId (ref: Service),
  serviceName: String,
  severity: "low" | "medium" | "high",
  category: "performance" | "database" | "authentication" | "network" | "deployment",
  source: "system" | "engineer",
  status: "open" | "investigating" | "resolved" | "auto-resolved",
  aiAnalysis: {
    rootCause: String,
    rootCauseProbability: Number,
    suggestedActions: Array,
    relatedIncidentIds: Array
  },
  timeline: Array,
  metadata: {
    firstDetectedAt: Date,
    lastUpdatedAt: Date,
    logCount: Number,
    errorCount: Number
  }
}
```

### Service Model

```javascript
{
  name: String,
  url: String,
  healthEndpoint: String (default: "/health"),
  description: String,
  category: "api" | "database" | "cache" | "queue" | "storage" | "monitoring" | "other",
  enabled: Boolean,
  metadata: {
    tags: Array,
    owner: String,
    team: String,
    environment: "production" | "staging" | "development"
  }
}
```

### Log Model

```javascript
{
  incidentId: ObjectId (ref: Incident),
  message: String,
  level: "info" | "warning" | "error",
  createdAt: Date
}
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- MongoDB (local or Atlas)
- NVIDIA NIM API key

### Installation

```bash
npm install
```

### Configuration

Create `.env` file:

```bash
PORT=5000
MONGODB_URI=mongodb://localhost:27017/incident-management
NIM_API_KEY=your-nvidia-nim-api-key
NIM_BASE_URL=https://integrate.api.nvidia.com
PRIMARY_MODEL=meta/llama-3.1-8b-instruct
SECONDARY_MODEL=mistralai/mistral-7b-instruct
```

### Start Server

```bash
# Development
npm run dev

# Production
node src/server.js
```

Server runs on `http://localhost:5000`

### Start Monitoring Service

Monitoring service starts automatically when server starts.

---

## ⚙️ Configuration

### Environment Variables

- `PORT` - Server port (default: 5000)
- `MONGODB_URI` - MongoDB connection string
- `NIM_API_KEY` - NVIDIA NIM API key
- `NIM_BASE_URL` - NVIDIA NIM base URL
- `PRIMARY_MODEL` - Primary LLM model
- `SECONDARY_MODEL` - Secondary LLM model
- `MONITOR_DEMO_SERVER` - Enable demo server monitoring (default: true)
- `ENABLE_RANDOM_EVENTS` - Enable random event simulation (default: true)

### MongoDB Setup

1. Install MongoDB locally or use MongoDB Atlas
2. Update `MONGODB_URI` in `.env`
3. Database and collections created automatically

---

## 🔄 Monitoring Service

### How It Works

1. **Starts automatically** when backend starts
2. **Fetches services** from database every cycle
3. **Checks health** of each enabled service
4. **Creates incidents** when issues detected
5. **Updates existing incidents** with new logs
6. **Auto-resolves** incidents when service recovers

### Configuration

- **Check Interval**: 5 minutes (300000ms)
- **Timeout**: 5 seconds per health check
- **Auto-resolve**: After 30 minutes of no errors

---

## 🎯 Key Features

✅ **Multi-Service Support** - Monitor unlimited services  
✅ **Automatic Detection** - Creates incidents automatically  
✅ **AI-Powered Analysis** - NVIDIA NIM LLM integration  
✅ **Intelligent Fallbacks** - Rule-based when AI unavailable  
✅ **Service Management** - Full CRUD for services  
✅ **Real-time Monitoring** - Continuous health checks  
✅ **Incident Tracking** - Complete lifecycle management  
✅ **Log Aggregation** - Centralized log storage  
✅ **Timeline Tracking** - Full audit trail  

---

**Built with Node.js, Express, MongoDB, and NVIDIA NIM for enterprise incident management** 🚀
