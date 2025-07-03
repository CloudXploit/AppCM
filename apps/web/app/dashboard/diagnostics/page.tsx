'use client';

import { useState } from 'react';
import { useQuery } from '@apollo/client';
import { gql } from '@apollo/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Icons } from '@/components/ui/icons';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScanCard } from '@/components/diagnostics/scan-card';
import { CreateScanDialog } from '@/components/diagnostics/create-scan-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

const GET_SCANS = gql`
  query GetScans($systemId: ID, $status: DiagnosticStatus, $pagination: PaginationInput) {
    scans(systemId: $systemId, status: $status, pagination: $pagination) {
      id
      name
      systemId
      status
      progress
      triggeredBy
      triggerType
      createdAt
      completedAt
      duration
      findingsCount {
        total
        bySeverity {
          low
          medium
          high
          critical
        }
      }
      system {
        id
        name
        version
      }
    }
    systems {
      id
      name
    }
  }
`;

export default function DiagnosticsPage() {
  const router = useRouter();
  const [selectedSystem, setSelectedSystem] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const { loading, error, data, refetch } = useQuery(GET_SCANS, {
    variables: {
      systemId: selectedSystem !== 'all' ? selectedSystem : undefined,
      status: selectedStatus !== 'all' ? selectedStatus : undefined,
      pagination: { limit: 20, page: 1 }
    },
    pollInterval: 5000, // Poll every 5 seconds for active scans
  });

  const filteredScans = data?.scans?.filter((scan: any) =>
    scan.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    scan.system.name.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const scanStats = {
    total: data?.scans?.length || 0,
    completed: data?.scans?.filter((s: any) => s.status === 'COMPLETED').length || 0,
    inProgress: data?.scans?.filter((s: any) => s.status === 'IN_PROGRESS').length || 0,
    failed: data?.scans?.filter((s: any) => s.status === 'FAILED').length || 0,
  };

  const activeScans = filteredScans.filter((s: any) => s.status === 'IN_PROGRESS' || s.status === 'PENDING');
  const completedScans = filteredScans.filter((s: any) => s.status === 'COMPLETED' || s.status === 'FAILED' || s.status === 'CANCELLED');

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Diagnostics</h1>
          <p className="text-muted-foreground">
            Run diagnostic scans on your Content Manager systems
          </p>
        </div>
        <Alert variant="destructive">
          <Icons.alertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load scans: {error.message}
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
          <h1 className="text-3xl font-bold tracking-tight">Diagnostics</h1>
          <p className="text-muted-foreground">
            Run and manage diagnostic scans across your systems
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Icons.plus className="mr-2 h-4 w-4" />
          New Scan
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Scans</CardTitle>
            <Icons.activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{scanStats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <Icons.checkCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{scanStats.completed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <Icons.loader className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{scanStats.inProgress}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
            <Icons.xCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{scanStats.failed}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Icons.search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search scans..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={selectedSystem} onValueChange={setSelectedSystem}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All systems" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All systems</SelectItem>
            {data?.systems?.map((system: any) => (
              <SelectItem key={system.id} value={system.id}>
                {system.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={selectedStatus} onValueChange={setSelectedStatus}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="All status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
            <SelectItem value="FAILED">Failed</SelectItem>
            <SelectItem value="CANCELLED">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="icon"
          onClick={() => refetch()}
          disabled={loading}
        >
          <Icons.refresh className={cn('h-4 w-4', loading && 'animate-spin')} />
        </Button>
      </div>

      {/* Scans List */}
      <Tabs defaultValue="active" className="space-y-4">
        <TabsList>
          <TabsTrigger value="active">
            Active
            {activeScans.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {activeScans.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-4">
          {loading ? (
            <div className="grid gap-4">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-4 w-[200px]" />
                    <Skeleton className="h-3 w-[150px]" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-2 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : activeScans.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-10">
                <Icons.activity className="h-10 w-10 text-muted-foreground mb-4" />
                <p className="text-lg font-medium">No active scans</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Start a new diagnostic scan to monitor your systems
                </p>
                <Button onClick={() => setIsCreateDialogOpen(true)}>
                  <Icons.plus className="mr-2 h-4 w-4" />
                  New Scan
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {activeScans.map((scan: any) => (
                <ScanCard
                  key={scan.id}
                  scan={scan}
                  onUpdate={() => refetch()}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          {loading ? (
            <div className="grid gap-4">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-4 w-[200px]" />
                    <Skeleton className="h-3 w-[150px]" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-20 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : completedScans.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-10">
                <Icons.inbox className="h-10 w-10 text-muted-foreground mb-4" />
                <p className="text-lg font-medium">No scan history</p>
                <p className="text-sm text-muted-foreground">
                  Completed scans will appear here
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {completedScans.map((scan: any) => (
                <ScanCard
                  key={scan.id}
                  scan={scan}
                  onUpdate={() => refetch()}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create Scan Dialog */}
      <CreateScanDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        systems={data?.systems || []}
        onSuccess={() => {
          refetch();
          setIsCreateDialogOpen(false);
        }}
      />
    </div>
  );
}