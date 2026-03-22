import React, { Suspense } from "react";

export interface SuspenseErrorBoundaryProps {
	fallback?: (error?: Error) => React.ReactNode;
	children?: React.ReactNode;
}

export default class SuspenseErrorBoundary extends React.Component<
	SuspenseErrorBoundaryProps,
	{ error: Error | null }
> {
	constructor(props: SuspenseErrorBoundaryProps) {
		super(props);
		this.state = { error: null };
	}

	static override getDerivedStateFromError(error: Error) {
		return { error };
	}

	override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
		// You can also log the error to an error reporting service
		console.error(error);
		console.info(errorInfo);
	}

	render() {
		if (this.state.error) {
			return this.props.fallback?.(this.state.error);
		}

		return (
			<Suspense fallback={this.props.fallback?.()}>
				{this.props.children}
			</Suspense>
		);
	}
}
