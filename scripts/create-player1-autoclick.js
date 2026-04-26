import { connectToDatabase } from '../lib/mongodb';
import { InvisibleBox } from '../lib/models';

async function createPlayer1AutoClickBox() {
  try {
    await connectToDatabase();
    console.log('Connected to MongoDB');

    // Remove existing box if present
    await InvisibleBox.deleteMany({
      name: 'Player 1 Auto-Click on Load',
    });

    // Create new box that triggers click on load (sends PLAY message to Videasy iframe)
    const box = await InvisibleBox.create({
      name: 'Player 1 Auto-Click on Load',
      pageType: 'all', // Both movies and TV
      playerSource: 'videasy', // Player 1
      mediaIds: [],
      x: 0,
      y: 0,
      width: 2000, // Covers full player width
      height: 1200, // Covers full player height
      action: 'click', // Click action - sends PLAY postMessage to Videasy
      customAction: undefined,
      cursorStyle: 'pointer',
      clickCount: 1,
      triggerOnLoad: true, // Auto-trigger when player loads
      isActive: true,
      createdBy: 'script',
    });

    console.log('✓ Player 1 auto-click box created successfully!');
    console.log('Box ID:', box._id);
    console.log('Details:');
    console.log(`  - Page Type: ${box.pageType}`);
    console.log(`  - Player: ${box.playerSource}`);
    console.log(`  - Action: ${box.action}`);
    console.log(`  - Trigger on Load: ${box.triggerOnLoad}`);
    console.log(`  - Coverage: (${box.x}, ${box.y}) to (${box.x + box.width}, ${box.y + box.height})`);
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

createPlayer1AutoClickBox();
