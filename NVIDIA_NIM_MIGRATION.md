# NVIDIA NIM API Integration

## Overview
The AI analysis system has been migrated from HuggingFace API to **NVIDIA NIM (NVIDIA Inference Microservices)** APIs.

## Changes Made

### 1. API Client Updated
- **File**: `src/huggins/huggingface.client.js`
- **Previous**: Used HuggingFace Inference API
- **Current**: Uses NVIDIA NIM API with Llama 3.1 8B Instruct model

### 2. API Configuration
- **Base URL**: `https://integrate.api.nvidia.com`
- **Endpoint**: `/v1/chat/completions`
- **Primary Model**: `meta/llama-3.1-8b-instruct` (BEST OVERALL - instruction-tuned, excellent at classification + reasoning)
- **Secondary Model**: `mistralai/mistral-7b-instruct` (Backup - quick classification)
- **API Key**: Configured via `NVIDIA_NIM_API_KEY` environment variable or uses default key

### 3. How It Works

#### Model Selection Strategy
1. **Primary Model (Llama 3.1 8B Instruct)**: Tried first
   - Best for classification + reasoning
   - Excellent at understanding context
   - Industry-trusted (Meta + NVIDIA)
   
2. **Secondary Model (Mistral 7B Instruct)**: Used as backup
   - Quick classification
   - Good for short summaries
   - Activated if primary model fails

3. **Pattern-Based Fallback**: Final fallback
   - Rule-based analysis
   - No API calls needed
   - Always available

#### Severity Analysis
- Tries Llama 3.1 first (best reasoning)
- Falls back to Mistral if primary fails
- Falls back to pattern matching if both fail
- Temperature: 0.3 (for consistent results)
- Max tokens: 10 (just need the classification word)

#### Category Analysis
- Tries Llama 3.1 first (best classification)
- Falls back to Mistral if primary fails
- Falls back to pattern matching if both fail
- Temperature: 0.3
- Max tokens: 20

### 4. Error Handling
- **401/403**: Authentication failed - switches to fallback mode
- **500+**: Server errors - uses fallback for that request
- **Timeout**: 15 seconds
- **Fallback**: Always available pattern-based analysis

## Environment Variables

### Option 1: Environment Variable (Recommended)
```bash
export NVIDIA_NIM_API_KEY=""
```

### Option 2: Default Key
The code includes a default API key, but it's recommended to use environment variables for security.

## Benefits

1. **Dual Model Strategy**: Primary + backup ensures high availability
2. **Best-in-Class Models**: Llama 3.1 for reasoning, Mistral for speed
3. **Better Performance**: NVIDIA NIM provides optimized inference
4. **More Reliable**: Better uptime with fallback models
5. **Advanced Models**: Access to state-of-the-art LLM models
6. **Cost Effective**: Efficient inference infrastructure
7. **Industry Trusted**: Meta and NVIDIA backed models

## Fallback System

The system includes robust fallback logic:
- If NVIDIA NIM API fails, automatically uses pattern-based analysis
- Pattern matching is fast and doesn't require API calls
- System continues working even if API is down

## Testing

To test the integration:
1. Start the server
2. Create an incident via `/api/system/events`
3. Trigger AI analysis via `/api/ai/analysis/:incidentId`
4. Check logs for any API errors

## Notes

- The file is still named `huggingface.client.js` for backward compatibility
- All imports remain the same - no code changes needed elsewhere
- The API key is hardcoded as default but can be overridden via environment variable

