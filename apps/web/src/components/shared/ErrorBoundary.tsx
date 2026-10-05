import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = { hasError: false };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary caught error]:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <Card className="border-destructive/30 my-4">
          <CardContent className="flex flex-col items-center gap-3 py-6 text-center">
            <AlertCircle className="h-6 w-6 text-destructive" />
            <p className="text-sm font-medium text-foreground">
              Something went wrong loading this section
            </p>
            <p className="text-xs text-muted-foreground">
              {this.state.error?.message || 'Unexpected rendering error'}
            </p>
            <Button
              onClick={() => this.setState({ hasError: false })}
              size="sm"
              variant="outline"
            >
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}
