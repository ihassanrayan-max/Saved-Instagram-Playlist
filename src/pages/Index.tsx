import { PlaylistManager } from '@/components/PlaylistManager';
import { CollectionController } from '@/components/CollectionController';

const Index = () => {
  return (
    <div className="min-h-screen bg-background max-w-6xl mx-auto">
      <div className="p-4 space-y-4">
        <PlaylistManager />
        <CollectionController />
      </div>
    </div>
  );
};

export default Index;
