import React, { useState, useEffect } from 'react';
import type { AppState, ViewType } from './types/karaoke';
import { SyncService } from './services/syncService';
import { Navigation } from './components/common/Navigation';
import { StageView } from './components/views/StageView';
import { OperatorView } from './components/views/OperatorView';
import { JudgeView } from './components/views/JudgeView';
import { AudienceRequestView } from './components/views/AudienceRequestView';
import { QrCodeModal } from './components/common/QrCodeModal';
import { SoundEffectsPlayer } from './components/karaoke/SoundEffectsPlayer';

export const App: React.FC = () => {
  const sync = SyncService.getInstance();
  const [state, setState] = useState<AppState>(sync.getState());
  const [isQrModalOpen, setIsQrModalOpen] = useState<boolean>(false);

  const [currentView, setCurrentView] = useState<ViewType>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const viewParam = params.get('view') as ViewType;
      if (['stage', 'operator', 'judge', 'request'].includes(viewParam)) {
        return viewParam;
      }
    }
    return 'operator';
  });

  useEffect(() => {
    const unsubscribe = sync.subscribe((newState) => {
      setState(newState);
    });
    return () => unsubscribe();
  }, []);

  const handleSelectView = (view: ViewType) => {
    setCurrentView(view);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('view', view);
      window.history.replaceState({}, '', url.toString());
    }
  };

  const handleToggleMode = () => {
    sync.updateState((prev) => ({
      ...prev,
      activeMode: prev.activeMode === 'competition' ? 'train' : 'competition'
    }));
  };

  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const viewParam = params.get('view') as ViewType;
      if (['stage', 'operator', 'judge', 'request'].includes(viewParam)) {
        setCurrentView(viewParam);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Show top navigation bar ONLY for operator and judge views
  // Stage (Projector) and Audience Request views have 100% clean layouts without admin bars
  const showTopNav = currentView === 'operator' || currentView === 'judge';

  return (
    <div className="min-h-screen bg-stage-dark text-white flex flex-col selection:bg-stage-accent selection:text-white">
      {/* Sound Effects Synthesizer Node */}
      <SoundEffectsPlayer />

      {/* Top Header Navigation (Operator & Judge only) */}
      {showTopNav && (
        <Navigation
          currentView={currentView}
          onSelectView={handleSelectView}
          activeMode={state.activeMode}
          onToggleMode={handleToggleMode}
          onOpenQrModal={() => setIsQrModalOpen(true)}
        />
      )}

      {/* Main View Container */}
      <main className="flex-1">
        {currentView === 'stage' && (
          <StageView state={state} onNavigateToOperator={() => handleSelectView('operator')} />
        )}
        {currentView === 'operator' && <OperatorView state={state} onOpenQrModal={() => setIsQrModalOpen(true)} />}
        {currentView === 'judge' && <JudgeView state={state} />}
        {currentView === 'request' && <AudienceRequestView />}
      </main>

      {/* QR Code Sharing Modal */}
      {isQrModalOpen && (
        <QrCodeModal onClose={() => setIsQrModalOpen(false)} />
      )}
    </div>
  );
};

export default App;
