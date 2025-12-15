# Watch Progress Testing Guide

## Changes Made

### 1. **Improved Time Tracking Frequency**
- Changed from 30-second intervals to **10-second intervals**
- Added `beforeunload` event handler to save time immediately when you close/refresh
- Added `visibilitychange` event handler to save when you switch tabs

This means your watched time should now capture more accurately. If you watch for 66 seconds, you should see ~60 seconds captured (the last 10-second interval before you stop).

### 2. **Enhanced Debugging Logging**
Added console logs to track:
- When session is loaded
- What user email is being used
- All watch history from database
- When progress is found/not found
- Exact match criteria for episodes/movies

## Testing Steps

### Test 1: Time Tracking Accuracy
1. **Go to a TV show** (e.g., The Office S1E1)
2. **Open Browser DevTools** (F12 → Console tab)
3. **Watch for exactly 1 minute 30 seconds** (keep track of time with a watch/phone)
4. **Refresh the page** without closing it
5. **Check the resume prompt**:
   - Should appear with "1:30 / 45:00" or close to it
   - Progress bar should show ~3% (90 seconds / 2700 seconds)

### Test 2: Cross-Browser Testing
1. **In Browser A** (e.g., Chrome):
   - Watch a TV show for ~1-2 minutes
   - **DON'T refresh yet**
   - Close the tab or click to another page
   
2. **Check Server Logs** (look for "POST /api/watch-history"):
   - Should show watch data being saved
   - Look for `totalDuration: 2700` (45 minutes in seconds)
   - Look for your currentTime

3. **In Browser B** (e.g., Firefox or incognito):
   - Log in with same account
   - Go to **same TV show and same episode**
   - The resume prompt should appear automatically
   - Progress bar should show the time you watched in Browser A
   
4. **Click "Resume from X time"**:
   - It should jump to that position (or near it)
   - The player should continue from there

### Test 3: Title Display
1. Open the resume prompt (by watching content and refreshing)
2. Check if the title shows at the top of the prompt
3. Should show "Season X Episode Y"

## Expected Behavior

### Console Output When Everything Works:
```
Fetching watch progress for user: admin@gmail.com
All watch history: [
  {
    mediaId: 1622,
    mediaType: 'tv',
    currentTime: 90,
    totalDuration: 2700,
    seasonNumber: 1,
    episodeNumber: 1,
    ...
  }
]
✅ Found episode-specific progress: 90 for S 1 E 1
```

### If Progress Not Found:
```
❌ No saved progress for S 1 E 1
```
This means either:
- You haven't watched that episode yet
- Session isn't authenticated
- Time wasn't saved properly

## Debugging Tips

### If title is still missing:
- Check console for errors
- Verify the ResumePrompt is receiving the title prop
- The title passed should be: `Season X Episode Y`

### If cross-browser doesn't work:
- Check console on second browser for fetch logs
- Verify same user is logged in on both browsers
- Check that the episode numbers match exactly
- Look for "❌ No saved progress" message

### If time is still showing old value (30s):
- The old interval should be cleared
- Refresh both browser and server
- Make sure you see the new 10-second interval working
- Check "POST /api/watch-history" every 10 seconds in network tab

## Server Logs to Watch

Open a second terminal and run:
```powershell
cd c:\Users\rosen\Desktop\movie\j-squared-cinema
tail -f logs/server.log
```

Or just check the running server output for:
- `POST /api/watch-history` requests
- The currentTime value in each request
- The totalDuration value

Good luck! 🎬
