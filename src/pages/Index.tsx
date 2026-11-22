import { PlaylistManager } from '@/components/PlaylistManager';
import { CollectionController } from '@/components/CollectionController';

const Index = () => {
  return (
    <main className="playlist-app min-h-screen bg-background text-foreground mx-auto">
      <div className="p-4 sm:p-6 space-y-7">
        <PlaylistManager />
        <CollectionController />
      </div>
    </main>
  );
};

export default Index;
