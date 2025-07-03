'use client';

import { useState } from 'react';
import { useQuery } from '@apollo/client';
import { gql } from '@apollo/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Icons } from '@/components/ui/icons';
import { SystemCard } from '@/components/systems/system-card';
import { AddSystemDialog } from '@/components/systems/add-system-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';

const GET_SYSTEMS = gql`
  query GetSystems {
    systems {
      id
      name
      version
      edition
      lastConnected
      health {
        status
        lastCheck
        issues
        score
      }
      connection {
        connected
        latency
      }
      database {
        type
        name
        server
      }
      features
      modules
    }
  }
`;

export default function SystemsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  
  const { loading, error, data, refetch } = useQuery(GET_SYSTEMS, {
    pollInterval: 30000, // Poll every 30 seconds
  });

  const filteredSystems = data?.systems?.filter((system: any) =>
    system.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    system.version.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const systemStats = {
    total: data?.systems?.length || 0,
    healthy: data?.systems?.filter((s: any) => s.health.status === 'healthy').length || 0,
    warning: data?.systems?.filter((s: any) => s.health.status === 'warning').length || 0,
    critical: data?.systems?.filter((s: any) => s.health.status === 'critical').length || 0,
  };

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Systems</h1>
          <p className="text-muted-foreground">
            Manage your Content Manager systems
          </p>
        </div>
        <Alert variant="destructive">
          <Icons.alertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load systems: {error.message}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Systems</h1>
          <p className="text-muted-foreground">
            Manage and monitor your Content Manager systems
          </p>
        </div>
        <Button onClick={() => setIsAddDialogOpen(true)}>
          <Icons.plus className="mr-2 h-4 w-4" />
          Add System
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Systems</CardTitle>
            <Icons.server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{systemStats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Healthy</CardTitle>
            <Icons.checkCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{systemStats.healthy}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Warning</CardTitle>
            <Icons.alertTriangle className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{systemStats.warning}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical</CardTitle>
            <Icons.xCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{systemStats.critical}</div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex items-center space-x-2">
        <div className="relative flex-1 max-w-sm">
          <Icons.search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search systems..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
          />
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => refetch()}
          disabled={loading}
        >
          <Icons.refresh className={cn('h-4 w-4', loading && 'animate-spin')} />
        </Button>
      </div>

      {/* Systems Grid */}
      {loading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-4 w-[200px]" />
                <Skeleton className="h-3 w-[150px]" />
              </CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredSystems.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-10">
            <Icons.server className="h-10 w-10 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">No systems found</p>
            <p className="text-sm text-muted-foreground mb-4">
              {searchQuery ? 'Try adjusting your search' : 'Add your first Content Manager system to get started'}
            </p>
            {!searchQuery && (
              <Button onClick={() => setIsAddDialogOpen(true)}>
                <Icons.plus className="mr-2 h-4 w-4" />
                Add System
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredSystems.map((system: any) => (
            <SystemCard 
              key={system.id} 
              system={system} 
              onUpdate={() => refetch()}
            />
          ))}
        </div>
      )}

      {/* Add System Dialog */}
      <AddSystemDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onSuccess={() => {
          refetch();
          setIsAddDialogOpen(false);
        }}
      />
    </div>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}