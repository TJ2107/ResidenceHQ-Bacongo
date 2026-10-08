import React, { Component, ErrorInfo } from 'react';
import { AlertCircle } from 'lucide-react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      const errorMessage = this.state.error?.message || 'Une erreur est survenue';
      let indexLink = '';

      try {
        if (errorMessage.startsWith('{')) {
          const parsed = JSON.parse(errorMessage);
          if (parsed.error && parsed.error.includes('The query requires an index')) {
            const match = parsed.error.match(/https:\/\/console\.firebase\.google\.com[^\s"]+/);
            if (match) {
              indexLink = match[0];
            }
          }
        }
      } catch (e) {
        // Not a JSON error, use raw message
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-red-50">
          <AlertCircle className="w-16 h-16 text-red-500 mb-6" />
          <h1 className="text-2xl font-bold text-red-900 mb-4 text-center">Oups ! Quelque chose s'est mal passé.</h1>
          <div className="bg-white p-6 rounded-2xl border border-red-100 shadow-xl max-w-lg w-full mb-8">
            <p className="text-red-700 text-center font-medium leading-relaxed">{indexLink ? "Cette opération nécessite la création d'un index dans Firestore." : errorMessage}</p>
            
            {indexLink && (
              <div className="mt-6 p-4 bg-blue-50 border border-blue-100 rounded-xl">
                <p className="text-blue-800 text-sm font-bold mb-3">Action Requise :</p>
                <p className="text-blue-700 text-xs leading-relaxed mb-4">
                  Veuillez cliquer sur le bouton ci-dessous pour créer l'index manquant dans votre console Firebase. 
                  L'application fonctionnera normalement une fois l'index créé (cela peut prendre quelques minutes).
                </p>
                <a 
                  href={indexLink} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="block w-full py-3 bg-blue-600 text-white text-center rounded-lg font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20"
                >
                  Créer l'index dans Firebase
                </a>
              </div>
            )}
          </div>
          
          <div className="flex gap-4">
            <button 
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-600/20"
            >
              Recharger l'application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
