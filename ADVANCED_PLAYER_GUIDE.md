# Advanced Video Player & Playtime Tracking System

## Overview

This is a full-featured video watching system that integrates with VidKing and VidSrc embed players to provide:

- ✅ **Automatic Resume** - Continue watching where you left off
- ✅ **Device Sync** - Progress syncs across devices via MongoDB
- ✅ **Smart Tracking** - Saves every 10 seconds, efficient batching
- ✅ **Quality Selection** - Choose video quality
- ✅ **Playback Speed** - Adjust playback speed
- ✅ **Progress Persistence** - Survives tab/browser close
- ✅ **Resume Prompt** - Beautiful UI to resume or start fresh

---

## Component Files Created

### 1. **AdvancedVideoPlayer.tsx**
Main video player component with custom controls overlay.

```tsx
import AdvancedVideoPlayer from '@/components/AdvancedVideoPlayer';

<AdvancedVideoPlayer
  embedUrl="https://www.vidking.net/embed/tv/550/1/1"
  title="Breaking Bad S01E01"
  mediaId={550}
  mediaType="tv"
  posterPath="/path/to/poster.jpg"
  seasonNumber={1}
  episodeNumber={1}
  initialTime={0}
/>
```

**Features:**
- Custom controls with progress bar
- Volume control with slider
- Fullscreen support
- Settings panel (speed, quality)
- Auto-hide controls on inactivity
- Automatic playtime saving to database
- Works with VidKing & VidSrc embeds

---

### 2. **useAdvancedPlaytime.ts**
Custom hook for tracking and saving video playtime.

```tsx
import { useAdvancedPlaytime } from '@/lib/hooks/useAdvancedPlaytime';

const { queueUpdate, flushUpdates, pendingUpdatesCount } = useAdvancedPlaytime();

// Queue an update
queueUpdate({
  mediaId: 550,
  mediaType: 'tv',
  currentTime: 1234,
  totalDuration: 3600,
  progress: 34.3,
  posterPath: '/path/to/poster.jpg',
  seasonNumber: 1,
  episodeNumber: 1,
  quality: '720p',
  playbackRate: 1.25,
});

// Manually flush if needed
await flushUpdates();
```

**Features:**
- Queue updates (doesn't save every frame)
- Auto-batch save every 30 seconds
- Flush on page unload/tab switch
- Debouncing to prevent excessive saves
- Tracks quality and playback rate

---

### 3. **VideoSourceSelector.tsx**
Component for selecting between VidKing and VidSrc with feature comparison.

```tsx
import VideoSourceSelector from '@/components/VideoSourceSelector';

const [currentSource, setCurrentSource] = useState<'vidking' | 'vidsrc'>('vidking');

<VideoSourceSelector
  currentSource={currentSource}
  onSourceChange={setCurrentSource}
  onConfirm={() => {
    // Save source preference and reload video
  }}
  showWarning={true}
/>
```

**Features:**
- Visual comparison of features
- Shows which source supports auto-resume
- Warning when switching mid-video
- Speed indicators

---

### 4. **ResumePrompt.tsx**
Beautiful prompt to resume watching or start from beginning.

```tsx
import ResumePrompt from '@/components/ResumePrompt';

<ResumePrompt
  show={showResumePrompt}
  title="Breaking Bad - Pilot"
  savedTime={2700} // 45 minutes
  totalDuration={3600} // 1 hour
  posterPath="/path/to/poster.jpg"
  onResume={() => {
    // Resume from 2700 seconds
  }}
  onStart={() => {
    // Start from 0
  }}
  onDismiss={() => {
    // Close prompt
  }}
  autoHideDuration={10000} // Auto-close in 10 seconds
/>
```

**Features:**
- Shows progress bar with time
- Displays percentage watched
- Shows remaining time
- Auto-dismiss countdown
- Beautiful gradient design

---

### 5. **Video Proxy API** (`/api/video-proxy`)
Backend API for video source management.

**POST /api/video-proxy**
```json
{
  "source": "vidking",
  "tmdbId": 550,
  "season": 1,
  "episode": 1,
  "mediaType": "tv"
}
```

**Response:**
```json
{
  "url": "https://www.vidking.net/embed/tv/550/1/1",
  "metadata": {
    "source": "vidking",
    "features": {
      "supportsProgress": true,
      "supportsSubtitles": true,
      "supportsQualitySelect": true
    }
  }
}
```

**GET /api/video-proxy**
```
GET /api/video-proxy?source=vidking&tmdbId=550&mediaType=tv
```

Returns capabilities of the video source.

---

## Integration Example

Here's how to integrate into your TV show page:

```tsx
import AdvancedVideoPlayer from '@/components/AdvancedVideoPlayer';
import ResumePrompt from '@/components/ResumePrompt';
import VideoSourceSelector from '@/components/VideoSourceSelector';
import { useAdvancedPlaytime } from '@/lib/hooks/useAdvancedPlaytime';
import { useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';

export default function TvShowPage({ tmdbId, season, episode }) {
  const { data: session } = useSession();
  const [videoSource, setVideoSource] = useState<'vidking' | 'vidsrc'>('vidking');
  const [savedTime, setSavedTime] = useState(0);
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  const [resumeChoice, setResumeChoice] = useState<'yes' | 'no'>('no');
  const { queueUpdate } = useAdvancedPlaytime();

  // Fetch saved progress
  useEffect(() => {
    if (!session?.user) return;

    const fetchProgress = async () => {
      const response = await fetch('/api/watch-history');
      const data = await response.json();
      
      const history = data.find(
        (item: any) => 
          item.mediaId === tmdbId && 
          item.seasonNumber === season &&
          item.episodeNumber === episode
      );

      if (history?.currentTime > 0) {
        setSavedTime(history.currentTime);
        setShowResumePrompt(true);
      }
    };

    fetchProgress();
  }, [session, tmdbId, season, episode]);

  // Build embed URL
  const embedUrl = `https://www.vidking.net/embed/tv/${tmdbId}/${season}/${episode}${
    resumeChoice === 'yes' ? `?progress=${Math.floor(savedTime)}` : ''
  }`;

  return (
    <>
      {/* Resume Prompt */}
      <ResumePrompt
        show={showResumePrompt && resumeChoice === 'no'}
        title={`Season ${season} Episode ${episode}`}
        savedTime={savedTime}
        totalDuration={3600} // Get from API
        onResume={() => setResumeChoice('yes')}
        onStart={() => setResumeChoice('no')}
        onDismiss={() => setShowResumePrompt(false)}
      />

      {/* Video Player */}
      <AdvancedVideoPlayer
        embedUrl={embedUrl}
        title={`Season ${season} Episode ${episode}`}
        mediaId={tmdbId}
        mediaType="tv"
        seasonNumber={season}
        episodeNumber={episode}
        initialTime={resumeChoice === 'yes' ? savedTime : 0}
      />
    </>
  );
}
```

---

## Database Schema

Your existing `WatchHistory` schema handles all required fields:

```typescript
{
  userId: ObjectId,
  mediaId: Number,
  mediaType: 'movie' | 'tv',
  title: String,
  posterPath: String,
  progress: Number (0-100),
  totalDuration: Number (seconds),
  currentTime: Number (seconds), // THIS IS KEY - resume position
  totalPlayedSeconds: Number,
  seasonNumber: Number (for TV),
  episodeNumber: Number (for TV),
  lastWatchedAt: Date,
  finished: Boolean,
}
```

---

## API Endpoints

Your existing endpoints already support this:

- `POST /api/watch-history` - Save playtime
- `GET /api/watch-history` - Get watch history
- `POST /api/video-proxy` - Video source management

---

## VidKing vs VidSrc Comparison

| Feature | VidKing | VidSrc |
|---------|---------|--------|
| Auto-Resume | ✅ Yes | ❌ No |
| Quality Select | ✅ Yes | ❌ No |
| Subtitles | ✅ Yes | ✅ Yes |
| Progress Param | ✅ Yes | ❌ No |
| Speed | ⚡ Fast | 🔄 Medium |

**Recommendation:** Default to VidKing, use VidSrc as fallback.

---

## Environment Variables

Add to your `.env.local`:

```env
# Optional: Video service preferences
NEXT_PUBLIC_PREFERRED_VIDEO_SOURCE=vidking
NEXT_PUBLIC_VIDEO_QUALITY_DEFAULT=720p
```

---

## Performance Optimizations

1. **Batching** - Saves are batched every 30 seconds
2. **Debouncing** - Won't save twice within 10 seconds
3. **Flushing** - Auto-flush on:
   - Page unload
   - Tab switch
   - Window blur
   - 30-second interval
4. **Lazy Loading** - Embed only loads when needed
5. **Rate Limiting** - Existing API rate limits apply

---

## Testing Checklist

- [ ] Video plays from VidKing embed
- [ ] Pause and resume in same session
- [ ] Progress saves to database (check MongoDB)
- [ ] Refresh page and resume prompt appears
- [ ] Clicking "Resume" skips to saved time
- [ ] "Start from Beginning" resets to 0
- [ ] Auto-dismiss after 10 seconds
- [ ] Works on mobile
- [ ] VidSrc fallback works
- [ ] No progress save with VidSrc (expected)
- [ ] Quality selector works
- [ ] Speed selector works
- [ ] Fullscreen works
- [ ] Volume slider works

---

## Troubleshooting

### Issue: Resume prompt not appearing
- Check user is logged in
- Check MongoDB has saved data
- Check browser console for errors

### Issue: VidKing not resuming
- Make sure `?progress=1234` parameter is in URL
- Check VidKing API hasn't changed

### Issue: Player not showing controls
- Wait 3 seconds without moving mouse
- Click anywhere on player to show controls

### Issue: Playtime not saving
- Check `/api/watch-history` endpoint is working
- Check user is authenticated
- Check network tab in DevTools

---

## Future Enhancements

1. **Offline Support** - Queue saves when offline
2. **Analytics** - Track watch patterns
3. **Recommendations** - Suggest based on watch history
4. **Watchlist Integration** - Mark as watched when finished
5. **Multi-Profile** - Different users on same device
6. **Chapters** - Skip to chapter marks
7. **Next Episode Auto-Play** - Auto-play next episode
