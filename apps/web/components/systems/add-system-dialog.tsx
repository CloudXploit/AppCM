'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery } from '@apollo/client';
import { gql } from '@apollo/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Icons } from '@/components/ui/icons';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';

const ADD_SYSTEM = gql`
  mutation AddSystem($name: String!, $config: ConnectionConfig!) {
    addSystem(name: $name, config: $config) {
      id
      name
      version
      edition
      features
      modules
    }
  }
`;

const TEST_CONNECTION = gql`
  query TestConnection($config: ConnectionConfig!) {
    testConnection(config: $config) {
      connected
      lastError
      latency
    }
  }
`;

const connectionSchema = z.object({
  name: z.string().min(1, 'System name is required'),
  databaseType: z.enum(['SQLSERVER', 'ORACLE']),
  host: z.string().min(1, 'Host is required'),
  port: z.coerce.number().optional(),
  database: z.string().min(1, 'Database name is required'),
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
  apiEndpoint: z.string().url().optional().or(z.literal('')),
  apiKey: z.string().optional(),
});

type ConnectionFormData = z.infer<typeof connectionSchema>;

interface AddSystemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function AddSystemDialog({ open, onOpenChange, onSuccess }: AddSystemDialogProps) {
  const [step, setStep] = useState(1);
  const [connectionTestResult, setConnectionTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    reset,
  } = useForm<ConnectionFormData>({
    resolver: zodResolver(connectionSchema),
    defaultValues: {
      databaseType: 'SQLSERVER',
      port: 1433,
    },
  });

  const [addSystem, { loading: isAdding, error: addError }] = useMutation(ADD_SYSTEM);
  const [testConnection, { loading: isTesting }] = useQuery(TEST_CONNECTION, {
    skip: true,
  });

  const databaseType = watch('databaseType');

  // Update default port when database type changes
  React.useEffect(() => {
    if (databaseType === 'SQLSERVER') {
      setValue('port', 1433);
    } else if (databaseType === 'ORACLE') {
      setValue('port', 1521);
    }
  }, [databaseType, setValue]);

  const handleTestConnection = async () => {
    const formData = watch();
    setConnectionTestResult(null);

    try {
      const { data } = await testConnection({
        variables: {
          config: {
            databaseType: formData.databaseType,
            host: formData.host,
            port: formData.port,
            database: formData.database,
            username: formData.username,
            password: formData.password,
            apiEndpoint: formData.apiEndpoint || undefined,
            apiKey: formData.apiKey || undefined,
          },
        },
      });

      if (data.testConnection.connected) {
        setConnectionTestResult({
          success: true,
          message: `Connection successful! Latency: ${data.testConnection.latency}ms`,
        });
        setStep(2);
      } else {
        setConnectionTestResult({
          success: false,
          message: data.testConnection.lastError || 'Connection failed',
        });
      }
    } catch (error) {
      setConnectionTestResult({
        success: false,
        message: error instanceof Error ? error.message : 'Connection test failed',
      });
    }
  };

  const onSubmit = async (data: ConnectionFormData) => {
    try {
      const result = await addSystem({
        variables: {
          name: data.name,
          config: {
            databaseType: data.databaseType,
            host: data.host,
            port: data.port,
            database: data.database,
            username: data.username,
            password: data.password,
            apiEndpoint: data.apiEndpoint || undefined,
            apiKey: data.apiKey || undefined,
          },
        },
      });

      if (result.data) {
        reset();
        setStep(1);
        setConnectionTestResult(null);
        onSuccess();
      }
    } catch (error) {
      // Error is handled by Apollo
    }
  };

  const handleClose = () => {
    reset();
    setStep(1);
    setConnectionTestResult(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Add Content Manager System</DialogTitle>
            <DialogDescription>
              Connect to a Content Manager system to start monitoring and diagnostics
            </DialogDescription>
          </DialogHeader>

          {/* Progress Steps */}
          <div className="my-6">
            <div className="flex items-center justify-between mb-2">
              <span className={cn('text-sm', step >= 1 ? 'text-primary' : 'text-muted-foreground')}>
                1. Connection Details
              </span>
              <Icons.chevronRight className="h-4 w-4 text-muted-foreground" />
              <span className={cn('text-sm', step >= 2 ? 'text-primary' : 'text-muted-foreground')}>
                2. System Information
              </span>
            </div>
            <Progress value={step * 50} className="h-2" />
          </div>

          <div className="space-y-6">
            {step === 1 ? (
              <>
                <Tabs defaultValue="database" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="database">Database Connection</TabsTrigger>
                    <TabsTrigger value="api">API Connection (Optional)</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="database" className="space-y-4">
                    <div className="grid gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="databaseType">Database Type</Label>
                        <Select
                          value={watch('databaseType')}
                          onValueChange={(value) => setValue('databaseType', value as 'SQLSERVER' | 'ORACLE')}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select database type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="SQLSERVER">SQL Server</SelectItem>
                            <SelectItem value="ORACLE">Oracle</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <div className="grid gap-2 col-span-2">
                          <Label htmlFor="host">Host</Label>
                          <Input
                            id="host"
                            placeholder="server.example.com"
                            {...register('host')}
                          />
                          {errors.host && (
                            <p className="text-sm text-destructive">{errors.host.message}</p>
                          )}
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="port">Port</Label>
                          <Input
                            id="port"
                            type="number"
                            {...register('port')}
                          />
                          {errors.port && (
                            <p className="text-sm text-destructive">{errors.port.message}</p>
                          )}
                        </div>
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor="database">Database Name</Label>
                        <Input
                          id="database"
                          placeholder={databaseType === 'SQLSERVER' ? 'ContentManager' : 'CMDB'}
                          {...register('database')}
                        />
                        {errors.database && (
                          <p className="text-sm text-destructive">{errors.database.message}</p>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label htmlFor="username">Username</Label>
                          <Input
                            id="username"
                            placeholder="cm_user"
                            {...register('username')}
                          />
                          {errors.username && (
                            <p className="text-sm text-destructive">{errors.username.message}</p>
                          )}
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="password">Password</Label>
                          <Input
                            id="password"
                            type="password"
                            placeholder="••••••••"
                            {...register('password')}
                          />
                          {errors.password && (
                            <p className="text-sm text-destructive">{errors.password.message}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="api" className="space-y-4">
                    <Alert>
                      <Icons.info className="h-4 w-4" />
                      <AlertDescription>
                        API connection is optional but provides additional features like real-time monitoring
                      </AlertDescription>
                    </Alert>
                    
                    <div className="grid gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="apiEndpoint">API Endpoint</Label>
                        <Input
                          id="apiEndpoint"
                          type="url"
                          placeholder="https://cm.example.com/api"
                          {...register('apiEndpoint')}
                        />
                        {errors.apiEndpoint && (
                          <p className="text-sm text-destructive">{errors.apiEndpoint.message}</p>
                        )}
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="apiKey">API Key</Label>
                        <Input
                          id="apiKey"
                          type="password"
                          placeholder="Optional API key"
                          {...register('apiKey')}
                        />
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>

                {connectionTestResult && (
                  <Alert variant={connectionTestResult.success ? 'default' : 'destructive'}>
                    <Icons.alertCircle className="h-4 w-4" />
                    <AlertDescription>{connectionTestResult.message}</AlertDescription>
                  </Alert>
                )}
              </>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">System Name</Label>
                  <Input
                    id="name"
                    placeholder="Production CM System"
                    {...register('name')}
                  />
                  {errors.name && (
                    <p className="text-sm text-destructive">{errors.name.message}</p>
                  )}
                </div>

                <Alert>
                  <Icons.checkCircle className="h-4 w-4" />
                  <AlertDescription>
                    Connection verified! Enter a name for this system to complete setup.
                  </AlertDescription>
                </Alert>

                {addError && (
                  <Alert variant="destructive">
                    <Icons.alertCircle className="h-4 w-4" />
                    <AlertDescription>{addError.message}</AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="mt-6">
            {step === 1 ? (
              <>
                <Button type="button" variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={isTesting}
                >
                  {isTesting && (
                    <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Test Connection
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep(1)}
                  disabled={isAdding}
                >
                  Back
                </Button>
                <Button type="submit" disabled={isAdding}>
                  {isAdding && (
                    <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Add System
                </Button>
              </>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}