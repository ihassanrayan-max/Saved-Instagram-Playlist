import { Play, Video, Shuffle, List, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-instagram-gradient opacity-10"></div>
        <div className="relative max-w-6xl mx-auto px-4 py-20 text-center">
          <div className="inline-flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-full mb-6">
            <Video className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-primary">Chrome Extension</span>
          </div>
          
          <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
            Instagram Video Playlist
          </h1>
          
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            Transform your Instagram saved collections into seamless video playlists. 
            Watch your favorite content continuously with full playback controls.
          </p>

          <Button className="bg-instagram-gradient hover:opacity-90 text-white px-8 py-6 text-lg rounded-full">
            <Download className="mr-2 h-5 w-5" />
            Install Extension
          </Button>
        </div>
      </div>

      {/* Features Section */}
      <div className="max-w-6xl mx-auto px-4 py-20">
        <div className="grid md:grid-cols-3 gap-8">
          <div className="text-center p-6">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Play className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Seamless Playback</h3>
            <p className="text-muted-foreground">
              Play your saved Instagram videos continuously without interruption
            </p>
          </div>

          <div className="text-center p-6">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-accent/10 flex items-center justify-center">
              <Shuffle className="h-8 w-8 text-accent" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Smart Controls</h3>
            <p className="text-muted-foreground">
              Shuffle, loop, skip, and manage your playlist with intuitive controls
            </p>
          </div>

          <div className="text-center p-6">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary/10 flex items-center justify-center">
              <List className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Full Playlist View</h3>
            <p className="text-muted-foreground">
              See all your videos at a glance and jump to any video instantly
            </p>
          </div>
        </div>
      </div>

      {/* How It Works */}
      <div className="bg-muted py-20">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>
          
          <div className="space-y-8">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-instagram-gradient flex items-center justify-center text-white font-bold">
                1
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2">Install the Extension</h3>
                <p className="text-muted-foreground">
                  Add the extension to your Chrome browser in seconds
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-instagram-gradient flex items-center justify-center text-white font-bold">
                2
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2">Open a Collection</h3>
                <p className="text-muted-foreground">
                  Navigate to any of your saved collections on Instagram
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-instagram-gradient flex items-center justify-center text-white font-bold">
                3
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2">Enable Playlist</h3>
                <p className="text-muted-foreground">
                  Click the floating button to automatically collect and play all videos
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="max-w-6xl mx-auto px-4 text-center text-muted-foreground">
          <p>Built with ❤️ for Instagram video enthusiasts</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
