'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@apollo/client';
import { gql } from '@apollo/client';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Icons } from '@/components/ui/icons';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

const TEST_CONNECTION = gql`
  query TestConnection($config: ConnectionConfig!) {
    testConnection(config: $config) {
      connected
      lastError
      latency
    }
  }
`;

const REMOVE_SYSTEM = gql`
  mutation RemoveSystem($id: ID!) {
    removeSystem(id: $id)
  }
`;

interface SystemCardProps {
  system: {
    id: string;
    name: string;
    version: string;
    edition: string;
    lastConnected: string;
    health: {
      status: string;
      lastCheck: string;
      issues: number;
      score: number;
    };
    connection: {
      connected: boolean;
      latency: number | null;
    };
    database: {
      type: string;
      name: string;
      server: string;
    };
    features: string[];
    modules: string[];
  };
  onUpdate: () => void;
}

export function SystemCard({ system, onUpdate }: SystemCardProps) {
  const router = useRouter();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);

  const [removeSystem, { loading: isDeleting }] = useMutation(REMOVE_SYSTEM, {
    variables: { id: system.id },
    onCompleted: () => {
      onUpdate();
    },
  });

  const handleTestConnection = async () => {
    setIsTestingConnection(true);
    try {
      // TODO: Implement connection test
      await new Promise(resolve => setTimeout(resolve, 2000));
    } finally {
      setIsTestingConnection(false);
    }
  };

  const getHealthBadgeVariant = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'success';
      case 'warning':
        return 'warning';
      case 'critical':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  const getHealthIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <Icons.checkCircle className="h-3 w-3" />;
      case 'warning':
        return <Icons.alertTriangle className="h-3 w-3" />;
      case 'critical':
        return <Icons.xCircle className="h-3 w-3" />;
      default:
        return <Icons.help className="h-3 w-3" />;
    }
  };

  return (
    <>
      <Card className="overflow-hidden">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <CardTitle className="text-xl">{system.name}</CardTitle>
              <CardDescription>
                {system.edition} {system.version}
              </CardDescription>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Icons.moreVertical className="h-4 w-4" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => router.push(`/dashboard/systems/${system.id}`)}
                >
                  <Icons.eye className="mr-2 h-4 w-4" />
                  View Details
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => router.push(`/dashboard/systems/${system.id}/edit`)}
                >
                  <Icons.edit className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleTestConnection}>
                  <Icons.wifi className="mr-2 h-4 w-4" />
                  Test Connection
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setIsDeleteDialogOpen(true)}
                  className="text-red-600 dark:text-red-400"
                >
                  <Icons.trash className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Health Status */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Health</span>
            <div className="flex items-center gap-2">
              <Badge 
                variant={getHealthBadgeVariant(system.health.status)}
                className="gap-1"
              >
                {getHealthIcon(system.health.status)}
                {system.health.status}
              </Badge>
              {system.health.issues > 0 && (
                <Badge variant="outline" className="gap-1">
                  <Icons.alertTriangle className="h-3 w-3" />
                  {system.health.issues}
                </Badge>
              )}
            </div>
          </div>

          {/* Health Score */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Health Score</span>
              <span className="font-medium">{system.health.score}%</span>
            </div>
            <Progress 
              value={system.health.score} 
              className={cn(
                'h-2',
                system.health.score >= 80 && 'bg-green-100 dark:bg-green-950',
                system.health.score >= 50 && system.health.score < 80 && 'bg-yellow-100 dark:bg-yellow-950',
                system.health.score < 50 && 'bg-red-100 dark:bg-red-950'
              )}
            />
          </div>

          <Separator />

          {/* Database Info */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Database</span>
              <Badge variant="outline" className="font-mono text-xs">
                {system.database.type}
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground">
              {system.database.name} @ {system.database.server}
            </div>
          </div>

          {/* Connection Status */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Connection</span>
            <div className="flex items-center gap-2">
              <div className={cn(
                'h-2 w-2 rounded-full',
                system.connection.connected ? 'bg-green-500' : 'bg-gray-300'
              )} />
              <span className="text-xs">
                {system.connection.connected ? 'Connected' : 'Disconnected'}
              </span>
              {system.connection.latency !== null && (
                <span className="text-xs text-muted-foreground">
                  ({system.connection.latency}ms)
                </span>
              )}
            </div>
          </div>

          {/* Last Connected */}
          <div className="text-xs text-muted-foreground">
            Last connected {formatDistanceToNow(new Date(system.lastConnected), { addSuffix: true })}
          </div>
        </CardContent>
        <CardFooter className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => router.push(`/dashboard/systems/${system.id}/scan`)}
          >
            <Icons.activity className="mr-2 h-4 w-4" />
            Run Scan
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => router.push(`/dashboard/systems/${system.id}`)}
          >
            <Icons.barChart className="mr-2 h-4 w-4" />
            View Details
          </Button>
        </CardFooter>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the system &quot;{system.name}&quot; and all associated data
              including scans, findings, and reports. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => removeSystem()}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting && (
                <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}