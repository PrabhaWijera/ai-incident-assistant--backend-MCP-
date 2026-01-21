# AI Incident Assistant - Backend API Server

The backend component of the AI-Powered Incident Management System. This Express.js server handles incident management, service registration, continuous monitoring, and AI-powered analysis of system incidents.

## What the System Backend Does

The backend serves as the central hub for incident management operations:

- **Incident Management**: Creates, tracks, and manages system incidents across all monitored services
- **Service Registration**: Maintains a registry of services to monitor with configurable health endpoints
- **Continuous Monitoring**: Automatically polls registered services every 5 minutes to detect failures
- **AI Analysis Integration**: Leverages NVIDIA NIM AI models to analyze incidents and provide recommendations
- **Data Persistence**: Stores incident data, logs, and service information in MongoDB
- **API Gateway**: Provides REST API and MCP JSON-RPC endpoints for frontend and external integrations
- **Event Processing**: Processes health check responses and converts them into actionable incidents
- **Notification System**: Tracks and logs all system events and failure detections

## Technologies Used

### Core Technologies
- **Node.js** - JavaScript runtime environment
- **Express.js** - Web application framework for building REST APIs
- **MongoDB** - NoSQL database for storing incidents, logs, and services
- **Mongoose** - ODM (Object Document Mapper) for MongoDB interactions
- **Axios** - HTTP client for making requests to monitored services
- **JSON Web Tokens (JWT)** - For secure authentication

### AI Integration Technologies
- **NVIDIA NIM (NVIDIA Inference Microservices)** - AI model hosting and inference
- **Llama 3.1 8B Instruct** - Primary AI model for incident analysis
- **Mistral 7B Instruct** - Secondary AI model for backup analysis
- **Model Context Protocol (MCP)** - JSON-RPC interface for AI tools

### Development Tools
- **Nodemon** - Development utility for auto-restarting the server
- **Dotenv** - Environment variable management
- **Cors** - Cross-Origin Resource Sharing middleware

## How the Process Works

### 1. Service Registration Process
```
Engineer Request
      ↓
POST /api/services
      ↓
Validate Service Data
      ↓
Save to MongoDB
      ↓
Service Registered
      ↓
Ready for Monitoring
```

### 2. Continuous Monitoring Process
```
Monitoring Service Start
      ↓
Wait for Check Interval (5 min)
      ↓
Fetch All Enabled Services
      ↓
For Each Service:
   ├─ Check /health endpoint
   ├─ Check /api endpoint  
   ├─ Check /db endpoint
   └─ Check /auth endpoint
      ↓
Analyze Response Status
      ↓
If Healthy → Log Healthy Status
      ↓
If Unhealthy → Create/Update Incident
      ↓
Continue Monitoring Loop
```

### 3. Incident Creation Process
```
Health Check Failure Detected
      ↓
Determine Severity & Category
      ↓
Check for Existing Open Incident
      ↓
If No Existing Incident → Create New Incident
      ↓
If Existing Incident → Update with New Log
      ↓
Store in MongoDB
      ↓
Notify Frontend via API
```

### 4. AI Analysis Process
```
Engineer Requests AI Analysis
      ↓
POST /api/mcp/jsonrpc (analyzeIncident)
      ↓
MCP Tool Calls Backend Service
      ↓
Fetch Incident & Related Logs
      ↓
Call NVIDIA NIM API (Llama 3.1)
      ↓
If Primary Fails → Try Secondary (Mistral)
      ↓
If Both Fail → Rule-Based Fallback
      ↓
Generate Analysis Result
      ↓
Return to Frontend (Read-Only)
```

### 5. Incident Lifecycle Management
```
Incident Detected
      ↓
Status: "open"
      ↓
Engineer Reviews
      ↓
Status: "investigating"
      ↓
AI Analysis Available
      ↓
Engineer Takes Action
      ↓
Status: "resolved"
      ↓
Incident Lifecycle Complete
```

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        EXPRESS SERVER                                       │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                        ROUTE HANDLERS                               │  │
│  │                                                                     │  │
│  │  /api/incidents  →  Incident Controller                             │  │
│  │  /api/logs       →  Log Controller                                  │  │
│  │  /api/services   →  Service Controller                              │  │
│  │  /api/system     →  System Controller                               │  │
│  │  /api/mcp        →  MCP JSON-RPC Tools                              │  │
│  │  /health         →  Health Check                                      │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                        │                                                   │
│                        │                                                   │
│  ┌─────────────────────▼─────────────────────────────────────────────────┐  │
│  │                      MIDDLEWARE LAYER                               │  │
│  │  ┌─────────────────────────────────────────────────────────────────┐  │  │
│  │  │  CORS Middleware (Cross-Origin)                               │  │  │
│  │  │  Body Parser (JSON)                                           │  │  │
│  │  │  Authentication (JWT - if needed)                             │  │  │
│  │  └─────────────────────────────────────────────────────────────────┘  │  │
│  └─────────────────────────────────────────────────────────────────────────┘  │
│                        │                                                   │
│                        │                                                   │
│  ┌─────────────────────▼─────────────────────────────────────────────────┐  │
│  │                     DATA LAYER                                      │  │
│  │  ┌─────────────────────────────────────────────────────────────────┐  │  │
│  │  │  Mongoose ODM                                                │  │  │
│  │  │      │                                                         │  │  │
│  │  │      ▼                                                         │  │  │
│  │  │  MongoDB (Incidents, Logs, Services)                         │  │  │
│  │  └─────────────────────────────────────────────────────────────────┘  │  │
│  └─────────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                           │
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     EXTERNAL INTEGRATIONS                                 │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                        MONITORING SERVICE                           │  │
│  │  ┌─────────────────────────────────────────────────────────────────┐  │  │
│  │  │  Continuous Polling (Every 5 mins)                           │  │  │
│  │  │  Health Check Requests to Registered Services                  │  │  │
│  │  │  Failure Detection & Incident Creation                         │  │  │
│  │  └─────────────────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                        │                                                   │
│                        │                                                   │
│  ┌─────────────────────▼─────────────────────────────────────────────────┐  │
│  │                    AI INTEGRATION                                   │  │
│  │  ┌─────────────────────────────────────────────────────────────────┐  │  │
│  │  │  NVIDIA NIM API                                              │  │  │
│  │  │  Llama 3.1 8B Instruct (Primary)                             │  │  │
│  │  │  Mistral 7B Instruct (Secondary)                             │  │  │
│  │  │  Rule-Based Fallback (Always Available)                      │  │  │
│  │  └─────────────────────────────────────────────────────────────────┘  │  │
│  └─────────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Key Features

- **Automatic Incident Detection**: Monitors services continuously and creates incidents when failures are detected
- **Intelligent Analysis**: Uses AI to determine incident severity, category, and root cause
- **Multi-Endpoint Monitoring**: Checks multiple endpoints (/health, /api, /db, /auth) for comprehensive coverage
- **Smart Incident Deduplication**: Prevents duplicate incidents for the same service failure
- **Configurable Monitoring Intervals**: Adjustable check frequency based on service importance
- **Robust Error Handling**: Comprehensive fallback mechanisms for all AI and external services
- **RESTful API Design**: Standardized API endpoints for all operations
- **MCP JSON-RPC Integration**: Standardized interface for AI tools and analysis
- **Real-Time Logging**: Detailed logging of all system events and health checks

## API Endpoints

- `GET /api/incidents` - Retrieve all incidents with filtering options
- `GET /api/incidents/:id` - Get specific incident details
- `PATCH /api/incidents/:id/status` - Update incident status
- `GET /api/logs/:incidentId` - Get logs for a specific incident
- `GET /api/services` - Get all registered services
- `POST /api/services` - Register a new service for monitoring
- `GET /api/system/stats` - Get system-wide statistics
- `POST /api/mcp/jsonrpc` - MCP JSON-RPC interface for AI tools
- `GET /health` - Server health check endpoint

## AI Analysis Capabilities

The backend provides sophisticated AI analysis through NVIDIA NIM integration:

- **Severity Analysis**: Determines incident severity (high, medium, low)
- **Category Classification**: Categorizes incidents (database, network, authentication, performance, deployment)
- **Root Cause Identification**: Identifies likely root causes with probability scores
- **Action Recommendations**: Suggests remediation actions with confidence levels
- **Trend Analysis**: Detects if system conditions are degrading over time
- **Related Incident Detection**: Finds similar past incidents for pattern recognition

## Security & Reliability

- **Read-Only AI Operations**: All AI analysis is read-only, preventing accidental changes
- **Human-in-the-Loop**: Critical actions require explicit human approval
- **Database Validation**: All data inputs are validated before storage
- **Error Recovery**: Automatic retry mechanisms and graceful degradation
- **Authentication Ready**: JWT-based authentication framework (can be enabled)

## Monitoring & Observability

- **Detailed Logging**: Comprehensive logging of all system operations
- **Health Metrics**: Real-time health and performance metrics
- **Error Tracking**: Automatic error detection and reporting
- **Performance Monitoring**: Response time and throughput tracking
- **Incident Timeline**: Complete audit trail of all incident events

This backend system forms the backbone of the AI-powered incident management solution, providing reliable monitoring, intelligent analysis, and centralized management of system incidents.