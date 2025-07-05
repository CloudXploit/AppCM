# SDK Reference Documentation

## Overview

The CM24.4 SDK provides convenient client libraries for JavaScript, Python, and .NET to interact with the Content Manager API. Each SDK handles authentication, request signing, retries, and provides type-safe interfaces for all API operations.

## Installation

### JavaScript/TypeScript

```bash
npm install @cm24/sdk
# or
yarn add @cm24/sdk
```

### Python

```bash
pip install cm24-sdk
```

### .NET

```bash
dotnet add package CM24.SDK
# or via Package Manager
Install-Package CM24.SDK
```

## Quick Start

### JavaScript/TypeScript

```javascript
import { CM24Client } from '@cm24/sdk';

// Initialize client
const client = new CM24Client({
  apiKey: 'your-api-key',
  apiSecret: 'your-api-secret',
  baseUrl: 'https://api.cm24.example.com', // optional
  timeout: 30000 // optional, defaults to 30s
});

// Run a diagnostic
async function runDiagnostic() {
  try {
    const result = await client.diagnostics.run({
      profileId: 'diag-prof-001',
      target: {
        type: 'server',
        id: 'srv-12345'
      },
      options: {
        async: true
      }
    });
    
    console.log('Diagnostic started:', result.diagnosticId);
  } catch (error) {
    console.error('Error:', error.message);
  }
}
```

### Python

```python
from cm24_sdk import CM24Client

# Initialize client
client = CM24Client(
    api_key='your-api-key',
    api_secret='your-api-secret',
    base_url='https://api.cm24.example.com',  # optional
    timeout=30  # optional, defaults to 30s
)

# Run a diagnostic
def run_diagnostic():
    try:
        result = client.diagnostics.run(
            profile_id='diag-prof-001',
            target={
                'type': 'server',
                'id': 'srv-12345'
            },
            options={
                'async': True
            }
        )
        
        print(f"Diagnostic started: {result.diagnostic_id}")
    except Exception as e:
        print(f"Error: {e}")
```

### .NET

```csharp
using CM24.SDK;

// Initialize client
var client = new CM24Client(new CM24ClientOptions
{
    ApiKey = "your-api-key",
    ApiSecret = "your-api-secret",
    BaseUrl = "https://api.cm24.example.com", // optional
    Timeout = TimeSpan.FromSeconds(30) // optional
});

// Run a diagnostic
async Task RunDiagnostic()
{
    try
    {
        var result = await client.Diagnostics.RunAsync(new RunDiagnosticRequest
        {
            ProfileId = "diag-prof-001",
            Target = new Target
            {
                Type = "server",
                Id = "srv-12345"
            },
            Options = new DiagnosticOptions
            {
                Async = true
            }
        });
        
        Console.WriteLine($"Diagnostic started: {result.DiagnosticId}");
    }
    catch (CM24Exception ex)
    {
        Console.WriteLine($"Error: {ex.Message}");
    }
}
```

## Authentication

### OAuth2 Flow

#### JavaScript/TypeScript

```javascript
// Initialize OAuth client
const oauth = new CM24OAuth({
  clientId: 'your-client-id',
  clientSecret: 'your-client-secret',
  redirectUri: 'https://yourapp.com/callback'
});

// Get authorization URL
const authUrl = oauth.getAuthorizationUrl({
  scope: ['read:diagnostics', 'write:remediation'],
  state: 'random-state-string'
});

// Exchange code for token
const tokens = await oauth.exchangeCodeForToken(authorizationCode);

// Use tokens with client
const client = new CM24Client({
  accessToken: tokens.accessToken,
  refreshToken: tokens.refreshToken,
  onTokenRefresh: (newTokens) => {
    // Store new tokens
    saveTokens(newTokens);
  }
});
```

#### Python

```python
from cm24_sdk import CM24OAuth

# Initialize OAuth client
oauth = CM24OAuth(
    client_id='your-client-id',
    client_secret='your-client-secret',
    redirect_uri='https://yourapp.com/callback'
)

# Get authorization URL
auth_url = oauth.get_authorization_url(
    scope=['read:diagnostics', 'write:remediation'],
    state='random-state-string'
)

# Exchange code for token
tokens = oauth.exchange_code_for_token(authorization_code)

# Use tokens with client
client = CM24Client(
    access_token=tokens.access_token,
    refresh_token=tokens.refresh_token,
    on_token_refresh=lambda new_tokens: save_tokens(new_tokens)
)
```

#### .NET

```csharp
// Initialize OAuth client
var oauth = new CM24OAuth(new OAuthOptions
{
    ClientId = "your-client-id",
    ClientSecret = "your-client-secret",
    RedirectUri = "https://yourapp.com/callback"
});

// Get authorization URL
var authUrl = oauth.GetAuthorizationUrl(new AuthorizationRequest
{
    Scope = new[] { "read:diagnostics", "write:remediation" },
    State = "random-state-string"
});

// Exchange code for token
var tokens = await oauth.ExchangeCodeForTokenAsync(authorizationCode);

// Use tokens with client
var client = new CM24Client(new CM24ClientOptions
{
    AccessToken = tokens.AccessToken,
    RefreshToken = tokens.RefreshToken,
    OnTokenRefresh = (newTokens) => SaveTokens(newTokens)
});
```

## Diagnostics

### Run Diagnostic

#### JavaScript/TypeScript

```javascript
// Run diagnostic with full options
const diagnostic = await client.diagnostics.run({
  profileId: 'diag-prof-001',
  target: {
    type: 'server',
    id: 'srv-12345',
    hostname: 'cm24-prod-01.example.com'
  },
  options: {
    async: true,
    priority: 'high',
    timeout: 600,
    notifyOnCompletion: true
  },
  metadata: {
    initiatedBy: 'user@example.com',
    reason: 'Performance investigation'
  }
});

// Poll for status
const checkStatus = async (diagnosticId) => {
  const status = await client.diagnostics.getStatus(diagnosticId);
  
  if (status.status === 'completed') {
    const results = await client.diagnostics.getResults(diagnosticId);
    console.log('Health Score:', results.summary.healthScore);
    return results;
  } else if (status.status === 'failed') {
    throw new Error('Diagnostic failed');
  }
  
  // Still running, check again later
  console.log(`Progress: ${status.progress.percentage}%`);
  setTimeout(() => checkStatus(diagnosticId), 5000);
};

await checkStatus(diagnostic.diagnosticId);
```

#### Python

```python
# Run diagnostic with full options
diagnostic = client.diagnostics.run(
    profile_id='diag-prof-001',
    target={
        'type': 'server',
        'id': 'srv-12345',
        'hostname': 'cm24-prod-01.example.com'
    },
    options={
        'async': True,
        'priority': 'high',
        'timeout': 600,
        'notify_on_completion': True
    },
    metadata={
        'initiated_by': 'user@example.com',
        'reason': 'Performance investigation'
    }
)

# Poll for status
import time

def check_status(diagnostic_id):
    while True:
        status = client.diagnostics.get_status(diagnostic_id)
        
        if status.status == 'completed':
            results = client.diagnostics.get_results(diagnostic_id)
            print(f"Health Score: {results.summary.health_score}")
            return results
        elif status.status == 'failed':
            raise Exception('Diagnostic failed')
        
        print(f"Progress: {status.progress.percentage}%")
        time.sleep(5)

results = check_status(diagnostic.diagnostic_id)
```

#### .NET

```csharp
// Run diagnostic with full options
var diagnostic = await client.Diagnostics.RunAsync(new RunDiagnosticRequest
{
    ProfileId = "diag-prof-001",
    Target = new Target
    {
        Type = "server",
        Id = "srv-12345",
        Hostname = "cm24-prod-01.example.com"
    },
    Options = new DiagnosticOptions
    {
        Async = true,
        Priority = Priority.High,
        Timeout = 600,
        NotifyOnCompletion = true
    },
    Metadata = new Dictionary<string, string>
    {
        ["initiatedBy"] = "user@example.com",
        ["reason"] = "Performance investigation"
    }
});

// Poll for status
async Task<DiagnosticResults> CheckStatus(string diagnosticId)
{
    while (true)
    {
        var status = await client.Diagnostics.GetStatusAsync(diagnosticId);
        
        if (status.Status == DiagnosticStatus.Completed)
        {
            var results = await client.Diagnostics.GetResultsAsync(diagnosticId);
            Console.WriteLine($"Health Score: {results.Summary.HealthScore}");
            return results;
        }
        else if (status.Status == DiagnosticStatus.Failed)
        {
            throw new Exception("Diagnostic failed");
        }
        
        Console.WriteLine($"Progress: {status.Progress.Percentage}%");
        await Task.Delay(5000);
    }
}

var results = await CheckStatus(diagnostic.DiagnosticId);
```

## Remediation

### Execute Remediation

#### JavaScript/TypeScript

```javascript
// Execute remediation with error handling
try {
  const execution = await client.remediation.execute({
    actionId: 'rem-act-001',
    target: {
      type: 'server',
      id: 'srv-12345'
    },
    parameters: {
      targetPaths: ['/tmp', '/var/log'],
      ageDays: 7
    },
    options: {
      dryRun: false,
      async: true,
      rollbackEnabled: true
    }
  });
  
  // Monitor execution
  const monitor = client.remediation.monitor(execution.executionId);
  
  monitor.on('progress', (progress) => {
    console.log(`Progress: ${progress.percentage}%`);
  });
  
  monitor.on('completed', (results) => {
    console.log('Remediation completed:', results);
  });
  
  monitor.on('error', (error) => {
    console.error('Remediation failed:', error);
  });
  
  await monitor.start();
  
} catch (error) {
  if (error.code === 'REM006') {
    console.log('Approval required for this action');
  } else {
    console.error('Error:', error);
  }
}
```

#### Python

```python
# Execute remediation with error handling
try:
    execution = client.remediation.execute(
        action_id='rem-act-001',
        target={
            'type': 'server',
            'id': 'srv-12345'
        },
        parameters={
            'target_paths': ['/tmp', '/var/log'],
            'age_days': 7
        },
        options={
            'dry_run': False,
            'async': True,
            'rollback_enabled': True
        }
    )
    
    # Monitor execution
    def on_progress(progress):
        print(f"Progress: {progress['percentage']}%")
    
    def on_completed(results):
        print(f"Remediation completed: {results}")
    
    def on_error(error):
        print(f"Remediation failed: {error}")
    
    monitor = client.remediation.monitor(
        execution.execution_id,
        on_progress=on_progress,
        on_completed=on_completed,
        on_error=on_error
    )
    
    monitor.start()
    
except CM24Exception as e:
    if e.code == 'REM006':
        print('Approval required for this action')
    else:
        print(f"Error: {e}")
```

#### .NET

```csharp
// Execute remediation with error handling
try
{
    var execution = await client.Remediation.ExecuteAsync(new ExecuteRemediationRequest
    {
        ActionId = "rem-act-001",
        Target = new Target
        {
            Type = "server",
            Id = "srv-12345"
        },
        Parameters = new Dictionary<string, object>
        {
            ["targetPaths"] = new[] { "/tmp", "/var/log" },
            ["ageDays"] = 7
        },
        Options = new RemediationOptions
        {
            DryRun = false,
            Async = true,
            RollbackEnabled = true
        }
    });
    
    // Monitor execution
    var monitor = client.Remediation.Monitor(execution.ExecutionId);
    
    monitor.OnProgress += (sender, progress) =>
    {
        Console.WriteLine($"Progress: {progress.Percentage}%");
    };
    
    monitor.OnCompleted += (sender, results) =>
    {
        Console.WriteLine($"Remediation completed: {results}");
    };
    
    monitor.OnError += (sender, error) =>
    {
        Console.WriteLine($"Remediation failed: {error}");
    };
    
    await monitor.StartAsync();
}
catch (CM24Exception ex) when (ex.Code == "REM006")
{
    Console.WriteLine("Approval required for this action");
}
catch (Exception ex)
{
    Console.WriteLine($"Error: {ex.Message}");
}
```

## Monitoring

### Real-time Metrics Stream

#### JavaScript/TypeScript

```javascript
// Subscribe to real-time metrics
const stream = client.monitoring.streamMetrics({
  targetId: 'srv-12345',
  metrics: ['cpu.usage_percent', 'memory.usage_percent'],
  interval: 5
});

stream.on('data', (data) => {
  console.log(`CPU: ${data['cpu.usage_percent']}%`);
  console.log(`Memory: ${data['memory.usage_percent']}%`);
});

stream.on('alert', (alert) => {
  console.log(`Alert: ${alert.metric} exceeded threshold`);
});

stream.on('error', (error) => {
  console.error('Stream error:', error);
});

// Start streaming
await stream.connect();

// Stop after 5 minutes
setTimeout(() => {
  stream.disconnect();
}, 5 * 60 * 1000);
```

#### Python

```python
# Subscribe to real-time metrics
stream = client.monitoring.stream_metrics(
    target_id='srv-12345',
    metrics=['cpu.usage_percent', 'memory.usage_percent'],
    interval=5
)

def on_data(data):
    print(f"CPU: {data['cpu.usage_percent']}%")
    print(f"Memory: {data['memory.usage_percent']}%")

def on_alert(alert):
    print(f"Alert: {alert['metric']} exceeded threshold")

def on_error(error):
    print(f"Stream error: {error}")

stream.on_data = on_data
stream.on_alert = on_alert
stream.on_error = on_error

# Start streaming
stream.connect()

# Stop after 5 minutes
import threading
timer = threading.Timer(5 * 60, stream.disconnect)
timer.start()
```

#### .NET

```csharp
// Subscribe to real-time metrics
var stream = client.Monitoring.StreamMetrics(new StreamMetricsRequest
{
    TargetId = "srv-12345",
    Metrics = new[] { "cpu.usage_percent", "memory.usage_percent" },
    Interval = 5
});

stream.OnData += (sender, data) =>
{
    Console.WriteLine($"CPU: {data["cpu.usage_percent"]}%");
    Console.WriteLine($"Memory: {data["memory.usage_percent"]}%");
};

stream.OnAlert += (sender, alert) =>
{
    Console.WriteLine($"Alert: {alert.Metric} exceeded threshold");
};

stream.OnError += (sender, error) =>
{
    Console.WriteLine($"Stream error: {error}");
};

// Start streaming
await stream.ConnectAsync();

// Stop after 5 minutes
await Task.Delay(TimeSpan.FromMinutes(5));
await stream.DisconnectAsync();
```

### Create Alert Rules

#### JavaScript/TypeScript

```javascript
// Create complex alert rule
const rule = await client.monitoring.createAlertRule({
  name: 'High Resource Usage',
  description: 'Alert on high CPU or memory usage',
  enabled: true,
  targets: ['srv-12345', 'srv-12346'],
  conditions: [
    {
      metric: 'cpu.usage_percent',
      operator: 'greater_than',
      threshold: 90,
      duration: '5m'
    },
    {
      metric: 'memory.usage_percent',
      operator: 'greater_than',
      threshold: 85,
      duration: '10m'
    }
  ],
  logic: 'OR', // Alert if any condition is met
  severity: 'warning',
  notifications: [
    {
      type: 'email',
      recipients: ['ops@example.com']
    }
  ]
});

console.log('Alert rule created:', rule.ruleId);
```

## Webhooks

### Webhook Management

#### JavaScript/TypeScript

```javascript
// Create webhook with retry configuration
const webhook = await client.webhooks.create({
  name: 'Production Alerts',
  url: 'https://myapp.com/webhooks/cm24',
  events: [
    'diagnostic.completed',
    'alert.triggered',
    'remediation.failed'
  ],
  secret: 'my-webhook-secret',
  retryPolicy: {
    maxAttempts: 3,
    backoffMultiplier: 2,
    initialDelaySeconds: 5
  },
  filters: {
    severity: ['critical', 'warning']
  }
});

// Test webhook
const testResult = await client.webhooks.test(webhook.webhookId);
console.log('Test result:', testResult.status);

// Handle webhook in Express.js
app.post('/webhooks/cm24', (req, res) => {
  const signature = req.headers['x-cm24-signature'];
  
  if (!client.webhooks.verifySignature(req.body, signature)) {
    return res.status(401).send('Invalid signature');
  }
  
  const event = req.body;
  console.log(`Received ${event.event} event`);
  
  // Process event asynchronously
  processWebhookEvent(event).catch(console.error);
  
  res.status(200).send('OK');
});
```

## Error Handling

### JavaScript/TypeScript

```javascript
import { CM24Error, RateLimitError, ValidationError } from '@cm24/sdk';

try {
  await client.diagnostics.run({ /* ... */ });
} catch (error) {
  if (error instanceof RateLimitError) {
    console.log(`Rate limited. Retry after ${error.retryAfter} seconds`);
  } else if (error instanceof ValidationError) {
    console.log('Validation error:', error.errors);
  } else if (error instanceof CM24Error) {
    console.log(`API error: ${error.code} - ${error.message}`);
  } else {
    console.error('Unexpected error:', error);
  }
}
```

### Python

```python
from cm24_sdk.exceptions import CM24Error, RateLimitError, ValidationError

try:
    client.diagnostics.run(...)
except RateLimitError as e:
    print(f"Rate limited. Retry after {e.retry_after} seconds")
except ValidationError as e:
    print(f"Validation error: {e.errors}")
except CM24Error as e:
    print(f"API error: {e.code} - {e.message}")
except Exception as e:
    print(f"Unexpected error: {e}")
```

### .NET

```csharp
try
{
    await client.Diagnostics.RunAsync(...);
}
catch (RateLimitException ex)
{
    Console.WriteLine($"Rate limited. Retry after {ex.RetryAfter} seconds");
}
catch (ValidationException ex)
{
    Console.WriteLine($"Validation error: {string.Join(", ", ex.Errors)}");
}
catch (CM24Exception ex)
{
    Console.WriteLine($"API error: {ex.Code} - {ex.Message}");
}
catch (Exception ex)
{
    Console.WriteLine($"Unexpected error: {ex.Message}");
}
```

## Advanced Features

### Batch Operations

#### JavaScript/TypeScript

```javascript
// Batch diagnostic runs
const batch = await client.diagnostics.runBatch([
  {
    profileId: 'diag-prof-001',
    target: { type: 'server', id: 'srv-12345' }
  },
  {
    profileId: 'diag-prof-002',
    target: { type: 'server', id: 'srv-12346' }
  }
]);

// Wait for all to complete
const results = await Promise.all(
  batch.diagnostics.map(d => 
    client.diagnostics.waitForCompletion(d.diagnosticId)
  )
);
```

### Custom Retry Logic

#### JavaScript/TypeScript

```javascript
const client = new CM24Client({
  apiKey: 'your-api-key',
  retryConfig: {
    maxRetries: 5,
    retryCondition: (error) => {
      // Retry on 5xx errors and specific 4xx errors
      return error.status >= 500 || error.code === 'TIMEOUT';
    },
    retryDelay: (retryCount) => {
      // Exponential backoff with jitter
      return Math.min(1000 * Math.pow(2, retryCount) + Math.random() * 1000, 10000);
    }
  }
});
```

### Request Interceptors

#### JavaScript/TypeScript

```javascript
// Add request interceptor
client.interceptors.request.use((config) => {
  // Add custom header
  config.headers['X-Request-ID'] = generateRequestId();
  
  // Log request
  console.log(`${config.method} ${config.url}`);
  
  return config;
});

// Add response interceptor
client.interceptors.response.use(
  (response) => {
    // Log response time
    console.log(`Response time: ${response.duration}ms`);
    return response;
  },
  (error) => {
    // Log error details
    console.error(`Error: ${error.code} - ${error.message}`);
    throw error;
  }
);
```

## Best Practices

1. **Initialize once**: Create a single client instance and reuse it
2. **Handle rate limits**: Implement exponential backoff for retries
3. **Use async operations**: Prefer async methods for long-running operations
4. **Monitor streams**: Always handle stream errors and reconnection
5. **Verify webhooks**: Always verify webhook signatures
6. **Cache responses**: Cache frequently accessed data like profiles
7. **Use types**: Leverage TypeScript/type hints for better IDE support
8. **Clean up resources**: Properly disconnect streams and cancel operations
9. **Log requests**: Use interceptors for debugging and monitoring
10. **Handle timeouts**: Set appropriate timeouts for different operations